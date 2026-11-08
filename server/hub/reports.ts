// 1.261: Wochenberichte merken und als eigene Seite zeigen.
// Der Push ist nur eine Kurzfassung. Ein Tipp darauf öffnet die Seite /bericht/<Kennung> direkt vom Pi (ohne Anmeldung, die Kennung ist zufällig und nicht erratbar).
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../paths.js';
import { readJsonWithPrev, saveJsonConfig, writeFileAtomic } from '../jsonConfig.js';
import { isLanIp } from '../netCheck.js';

export interface Report {
  id: string;
  at: number;
  title: string;
  text: string;
}

const MAX = 12;
const file = () => path.join(dataDir, 'hub-reports.json');
let cache: Report[] | null = null;

const valid = (r: any): r is Report => Boolean(r && typeof r.id === 'string' && /^[0-9a-f]{24}$/.test(r.id) && typeof r.text === 'string' && Number.isFinite(r.at));

function load(): Report[] {
  if (cache) return cache;
  const v = readJsonWithPrev<Report[]>(file(), d => Array.isArray(d));
  cache = Array.isArray(v) ? v.filter(valid).slice(0, MAX) : [];
  return cache;
}

/** Bericht merken (neueste zuerst, höchstens 12) */
export function addReport(title: string, text: string, now = Date.now()): Report {
  const r: Report = { id: crypto.randomBytes(12).toString('hex'), at: now, title: String(title).slice(0, 200), text: String(text).slice(0, 4000) };
  cache = [r, ...load()].slice(0, MAX);
  saveJsonConfig(file(), cache, 'Wochenberichte', { pretty: false, keepPrev: true });
  return r;
}

export const listReports = (): Report[] => load().slice();

export function getReport(id: string): Report | undefined {
  return /^[0-9a-f]{24}$/.test(String(id)) ? load().find(r => r.id === id) : undefined;
}

// ---------- Adresse des Pi (für den Link im Push) ----------

const baseFile = () => path.join(dataDir, 'hub-base.txt');
let base: string | null = null;

/** Adresse „http://192.168.68.10:3000“ aus einer angemeldeten Anfrage merken (nur Heimnetz-/Tailscale-IP mit Port) */
export function rememberBase(host: string | undefined): void {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})$/.exec(String(host || '').trim());
  if (!m || !isLanIp(m[1])) return;
  const b = `http://${m[1]}:${m[2]}`;
  if (b === getBase()) return;
  // Tailscale-Adresse (100.x) nicht über eine Heimnetz-Adresse stellen: zu Hause geht nur die Heimnetz-Adresse ohne Tailscale
  if (/^100\./.test(m[1]) && getBase() && !/^http:\/\/100\./.test(getBase())) return;
  base = b;
  try {
    writeFileAtomic(baseFile(), b);
  } catch {
    /* egal */
  }
}

export function getBase(): string {
  if (base !== null) return base;
  try {
    const s = fs.readFileSync(baseFile(), 'utf-8').trim();
    base = /^http:\/\/\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}$/.test(s) ? s : '';
  } catch {
    base = '';
  }
  return base;
}

/** Link zur Berichtsseite, leer wenn die Adresse des Pi noch nicht bekannt ist */
export const reportUrl = (id: string): string => (getBase() ? `${getBase()}/bericht/${id}` : '');

// ---------- Seite ----------

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const fmtDate = (t: number) => new Date(t).toLocaleString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: process.env.TZ || 'Europe/Berlin' });

/** Eigenständige HTML-Seite (alles escaped, kein Skript) */
export function reportPage(r: Report, others: Report[]): string {
  const lines = r.text.split('\n').filter(Boolean);
  const old = others.filter(o => o.id !== r.id);
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(r.title)}</title>
<style>
body{margin:0;background:#f5efe4;color:#2b2620;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:34rem;margin:0 auto;padding:1.5rem 1rem 3rem}
h1{font-size:1.4rem;margin:0 0 .25rem}
.d{color:#6f665a;font-size:.85rem;margin:0 0 1.25rem}
ul{list-style:none;margin:0;padding:0;display:grid;gap:.6rem}
li{background:#fffaf0;border:1px solid #e3d9c6;border-radius:14px;padding:.8rem 1rem}
h2{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#6f665a;margin:2rem 0 .6rem}
a{color:#8a6a1f}
.o a{display:block;padding:.35rem 0}
</style></head><body><main>
<h1>${esc(r.title)}</h1>
<p class="d">${esc(fmtDate(r.at))}</p>
<ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
${old.length ? `<h2>Frühere Berichte</h2><div class="o">${old.map(o => `<a href="/bericht/${o.id}">${esc(fmtDate(o.at))}</a>`).join('')}</div>` : ''}
<h2>FilamentHub</h2><a href="/">App öffnen</a>
</main></body></html>`;
}
