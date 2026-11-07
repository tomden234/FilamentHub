// 1.244: Dauer-Protokoll für die Fun Facts. Winzig (je Druck ~100 Byte) und ohne Obergrenze von 200 Drucken:
// nur Start, Ende, fertig/abgebrochen und Gramm je Material und Farbe. Reicht für Jahre.
import path from 'path';
import { dataDir } from '../paths.js';
import { readJsonWithPrev, saveJsonConfig } from '../jsonConfig.js';
import { printRecorder, type RecordedPrint } from '../printRecorder.js';

/** [Material und Farbe, Farbe als Hex, Gramm, Spulen-ID] */
export type StatGram = [string, string, number, string];
export interface StatEntry {
  id: string;
  s: number;
  e: number;
  /** F = fertig, X = abgebrochen */
  st: 'F' | 'X';
  g?: StatGram[];
}

const MAX = 100_000;
const file = () => path.join(dataDir, 'print-stats.json');
let items: StatEntry[] | null = null;

function load(): StatEntry[] {
  if (items) return items;
  const raw = readJsonWithPrev<any>(file(), d => Boolean(d && Array.isArray(d.items)));
  items = raw ? (raw.items as StatEntry[]) : [];
  // Einmal beim ersten Start: schon aufgezeichnete Drucke übernehmen (nur Dauer, Gramm gab es dort nicht)
  const known = new Set(items.map(x => x.id));
  let added = 0;
  for (const r of printRecorder.list(0)) {
    if (known.has(r.id)) continue;
    items.push({ id: r.id, s: r.startMs, e: r.endMs, st: r.state === 'FAILED' ? 'X' : 'F' });
    added++;
  }
  if (added || !raw) {
    items.sort((a, b) => a.e - b.e);
    save();
  }
  return items;
}

function save(): void {
  if (!items) return;
  if (items.length > MAX) items = items.slice(-MAX);
  saveJsonConfig(file(), { v: 1, items }, 'Druck-Statistik', { pretty: false, keepPrev: true });
}

/** Ein Druck ist zu Ende */
export function statsPrint(rec: RecordedPrint): void {
  const list = load();
  const i = list.findIndex(x => x.id === rec.id);
  const e: StatEntry = { id: rec.id, s: rec.startMs, e: rec.endMs, st: rec.state === 'FAILED' ? 'X' : 'F', ...(i >= 0 && list[i].g ? { g: list[i].g } : {}) };
  if (i >= 0) list[i] = e;
  else list.push(e);
  save();
}

/** Abzug ist gebucht: Gramm je Material und Farbe dazu */
export function statsGrams(rec: { id: string; startMs: number; endMs: number; state?: string }, grams: StatGram[]): void {
  const clean = grams.filter(g => g[2] > 0).map(g => [String(g[0]).slice(0, 60), String(g[1]), Math.round(g[2] * 10) / 10, String(g[3])] as StatGram);
  if (!clean.length) return;
  const list = load();
  const i = list.findIndex(x => x.id === rec.id);
  if (i >= 0) list[i] = { ...list[i], g: clean };
  else list.push({ id: rec.id, s: rec.startMs, e: rec.endMs, st: rec.state === 'FAILED' ? 'X' : 'F', g: clean });
  save();
}

export const statsAll = (): StatEntry[] => load();

/** Nur für Tests */
export const _resetStats = (): void => {
  items = null;
};
