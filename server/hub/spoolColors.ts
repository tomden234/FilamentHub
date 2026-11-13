// Echte Filamentfarben fürs Dashboard: Der Pi lädt je Spule das Produktbild aus dem Shop-Link (Amazon, Bambu, Prusa …), liest es mit ffmpeg
// (64×64 Bildpunkte) und misst die Farbe (spoolColorLogic). Eine Spule alle 4 Minuten, Ergebnis gemerkt in spool-colors.json.
// Die App-Daten bleiben unverändert; Druckerbild, Spulen-Sensoren und Testbild nehmen die gemessene Farbe.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../paths.js';
import { writeFileAtomic } from '../jsonConfig.js';
import { hubEnabled } from './core.js';
import { hasRealLink } from './productLink.js';
import { spools } from './dashboardEdit.js';
import { filamentColor, productImageUrl } from './spoolColorLogic.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const RETRY_MS = 3 * 24 * 3600_000; // fehlgeschlagen: nach 3 Tagen nochmal
const MAX_IMG = 4 * 1024 * 1024;

interface Entry {
  url: string;
  hint: string;
  hex: string | null;
  at: number;
  note?: string;
}

const file = () => path.join(dataDir, 'spool-colors.json');
let cache: Record<string, Entry> | null = null;

function readCache(): Record<string, Entry> {
  if (cache) return cache;
  try {
    const v = JSON.parse(fs.readFileSync(file(), 'utf-8'));
    cache = v && typeof v === 'object' ? v : {};
  } catch {
    cache = {};
  }
  return cache!;
}

/** Farbe für die Anzeige: gemessene Shop-Farbe, wenn sie zur aktuellen Spule passt, sonst die Farbe aus der App */
export function realColor(sp: { id?: string; colorHex?: string; productUrl?: string } | undefined): string {
  const app = String(sp?.colorHex || '');
  const e = sp?.id ? readCache()[sp.id] : undefined;
  return e?.hex && e.hint.toLowerCase() === app.toLowerCase() && e.url === sp?.productUrl ? e.hex : app;
}

/** Bild mit ffmpeg auf 64×64 RGB bringen */
function decode(img: Buffer): Promise<Uint8Array | null> {
  return new Promise(resolve => {
    const p = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', 'scale=64:64', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
    const out: Buffer[] = [];
    const timer = setTimeout(() => p.kill('SIGKILL'), 20_000);
    p.stdout.on('data', d => out.push(d));
    p.on('error', () => resolve(null));
    p.on('close', code => {
      clearTimeout(timer);
      const b = Buffer.concat(out);
      resolve(code === 0 && b.length >= 64 * 64 * 3 ? new Uint8Array(b) : null);
    });
    p.stdin.on('error', () => undefined);
    p.stdin.end(img);
  });
}

async function get(url: string, accept: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5', Accept: accept },
    signal: AbortSignal.timeout(20_000)
  });
}

/** Farbe einer Spule aus ihrem Shop-Link messen */
export async function measure(sp: { colorHex: string; productUrl: string }): Promise<{ hex: string | null; note: string }> {
  const page = await get(sp.productUrl, 'text/html,application/xhtml+xml');
  if (!page.ok) return { hex: null, note: `Shop-Seite: HTTP ${page.status}` };
  const imgUrl = productImageUrl(await page.text());
  if (!imgUrl) return { hex: null, note: 'kein Produktbild auf der Seite' };
  const img = await get(imgUrl, 'image/avif,image/webp,image/*;q=0.8');
  if (!img.ok) return { hex: null, note: `Bild: HTTP ${img.status}` };
  const buf = Buffer.from(await img.arrayBuffer());
  if (buf.length > MAX_IMG) return { hex: null, note: 'Bild zu groß' };
  const px = await decode(buf);
  if (!px) return { hex: null, note: 'Bild nicht lesbar' };
  const hex = filamentColor(px, sp.colorHex);
  return { hex, note: hex ? 'gemessen' : 'keine passende Farbe im Bild' };
}

let running = false;

/** Eine Spule pro Takt: neue oder geänderte Spulen zuerst, Fehlschläge nach 3 Tagen nochmal */
export async function spoolColorTick(): Promise<void> {
  if (running || !hubEnabled()) return;
  running = true;
  try {
    const c = readCache();
    const list = (await spools()).filter(s => s?.id && hasRealLink(s.productUrl) && /^#[0-9a-fA-F]{6}$/.test(String(s.colorHex || '')));
    const todo = list.find(s => {
      const e = c[s.id];
      return !e || e.url !== s.productUrl || e.hint.toLowerCase() !== String(s.colorHex).toLowerCase() || (!e.hex && Date.now() - e.at > RETRY_MS);
    });
    if (!todo) return;
    let r: { hex: string | null; note: string };
    try {
      r = await measure(todo);
    } catch (e) {
      r = { hex: null, note: (e as Error)?.message || 'Fehler' };
    }
    c[todo.id] = { url: todo.productUrl, hint: todo.colorHex, hex: r.hex, at: Date.now(), note: r.note.slice(0, 80) };
    // Gelöschte Spulen vergessen
    for (const id of Object.keys(c)) if (!list.some(s => s.id === id)) delete c[id];
    writeFileAtomic(file(), JSON.stringify(c), { mode: 0o644 });
    console.log(`[Hub] Spulenfarbe ${todo.brand || ''} ${todo.colorName || ''}: ${r.hex || '–'} (${r.note})`);
  } finally {
    running = false;
  }
}

export function startSpoolColors(): void {
  if (!hubEnabled()) return;
  setTimeout(() => void spoolColorTick(), 120_000).unref();
  setInterval(() => void spoolColorTick(), 4 * 60_000).unref();
}
