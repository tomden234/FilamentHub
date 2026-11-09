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

/** Adresse der App (GitHub Pages), einstellbar über APP_URL */
const appUrl = (): string => {
  const u = String(process.env.APP_URL || '').trim();
  return /^https:\/\/[\w.-]+(\/[\w./-]*)?$/.test(u) ? u : 'https://tomden234.github.io/FilamentHub/';
};

/** Eigenständige HTML-Seite im Look der App („Sand“: warmes Papier, Waldgrün, Serifen-Überschriften). Alles escaped, kein Skript. */
export function reportPage(r: Report, others: Report[]): string {
  const lines = r.text.split('\n').filter(Boolean);
  const old = others.filter(o => o.id !== r.id);
  const item = (l: string) => {
    const m = /^(\P{L}+?)\s+(.*)$/u.exec(l);
    return m ? `<li><span class="i">${esc(m[1])}</span><span>${esc(m[2])}</span></li>` : `<li><span>${esc(l)}</span></li>`;
  };
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="theme-color" content="#e9e2d3">
<title>${esc(r.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
:root{--bg:#e9e2d3;--card:#f5f0e4;--sub:#eee7d8;--bd:#d5cbb6;--tx:#2f2b23;--mu:#5f5848;--ac:#3f8a5c;--act:#3b6444}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;color:var(--tx);font:15px/1.5 'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
background:radial-gradient(1000px 560px at 6% -10%,rgba(255,250,235,.7),transparent 62%),radial-gradient(900px 600px at 108% 2%,rgba(220,170,60,.09),transparent 60%),var(--bg);background-attachment:fixed}
main{max-width:34rem;margin:0 auto;padding:1.5rem 1rem 3rem}
.e{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mu);margin:0 0 .5rem}
h1{font:600 1.5rem/1.2 'Fraunces',Georgia,'Times New Roman',serif;letter-spacing:-.005em;margin:0 0 .25rem}
.d{color:var(--mu);font-size:.8rem;margin:0 0 1.25rem}
ul{list-style:none;margin:0;padding:0;display:grid;gap:.55rem}
li{display:flex;gap:.7rem;align-items:center;background:var(--card);border:1px solid var(--bd);border-radius:1.05rem;padding:.8rem 1rem;box-shadow:0 12px 28px -22px rgba(70,55,30,.35);font-weight:600}
.i{font-size:1.25rem;line-height:1}
h2{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mu);margin:2rem 0 .6rem}
a{color:var(--act);text-decoration:none}
.o{display:grid;gap:.4rem}
.o a{display:block;background:var(--sub);border:1px solid var(--bd);border-radius:.8rem;padding:.55rem .9rem;font-size:.85rem;font-weight:600}
.b{display:block;text-align:center;background:var(--ac);color:#fff;border-radius:.8rem;padding:.7rem 1rem;font-weight:700;margin-top:.5rem}
</style></head><body><main>
<p class="e">FilamentHub · Wochenbericht</p>
<h1>${esc(r.title)}</h1>
<p class="d">${esc(fmtDate(r.at))}</p>
<ul>${lines.map(item).join('')}</ul>
${old.length ? `<h2>Frühere Berichte</h2><div class="o">${old.map(o => `<a href="/bericht/${o.id}">${esc(o.title.replace(/^\P{L}+/u, ''))} · ${esc(fmtDate(o.at))}</a>`).join('')}</div>` : ''}
<a class="b" href="${esc(appUrl())}">App öffnen</a>
</main></body></html>`;
}
