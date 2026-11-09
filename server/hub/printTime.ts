// 1.271: Druckzeit nach Slicer (prediction in der .3mf) und berechnete Zeit (Slicer-Zeit × gelernter Faktor je Material).
// Nach jedem fertigen Druck, den die Warteschlange gestartet hat, lernt der Pi: echte Dauer ÷ Slicer-Zeit.
import path from 'path';
import { dataDir } from '../paths.js';
import { readJsonWithPrev, saveJsonConfig } from '../jsonConfig.js';

export interface Factor {
  /** Anzahl gelernter Drucke */
  n: number;
  /** Echte Dauer ÷ Slicer-Zeit */
  f: number;
}
export type Factors = Record<string, Factor>;

/** Ab so vielen Drucken gilt der Faktor als gelernt */
export const MIN_SAMPLES = 2;
const ALL = '*';

/** Hauptmaterial eines Drucks: das mit den meisten Gramm („PLA“, „PETG“ …) */
export function mainMaterial(filaments: { type: string; grams: number }[]): string {
  const best = [...filaments].sort((a, b) => b.grams - a.grams)[0];
  return String(best?.type || '').trim().toUpperCase();
}

export function nextFactor(cur: Factor | undefined, ratio: number): Factor {
  const r = Math.min(3, Math.max(0.5, ratio));
  if (!cur || cur.n <= 0) return { n: 1, f: r };
  const f = cur.n < 5 ? (cur.f * cur.n + r) / (cur.n + 1) : cur.f * 0.8 + r * 0.2;
  return { n: Math.min(99, cur.n + 1), f: Math.round(f * 1000) / 1000 };
}

/** Faktor für ein Material. Hat es zu wenig Drucke, zählt der Faktor über alle Materialien. */
export function factorFor(factors: Factors, material: string): { f: number; n: number; learned: boolean } {
  const m = factors[material];
  if (m && m.n >= MIN_SAMPLES) return { f: m.f, n: m.n, learned: true };
  const a = factors[ALL];
  if (a && a.n >= MIN_SAMPLES) return { f: a.f, n: a.n, learned: true };
  return { f: 1, n: Math.max(m?.n || 0, a?.n || 0), learned: false };
}

export interface TimeInfo {
  /** Zeit laut Slicer in Sekunden */
  slicerSec: number;
  /** Berechnete Zeit in Sekunden (ohne gelernten Faktor = Slicer-Zeit) */
  calcSec: number;
  /** Faktor ist aus echten Drucken gelernt */
  learned: boolean;
  /** Anzahl gelernter Drucke */
  n: number;
  /** Voraussichtlich fertig (ms), wenn alle davor eingerechnet sind */
  endAt?: number;
}

export function timeInfo(predSec: number, material: string, factors: Factors): TimeInfo {
  const fc = factorFor(factors, material);
  return { slicerSec: Math.round(predSec), calcSec: Math.round(predSec * fc.f), learned: fc.learned, n: fc.n };
}

export { fmtDur } from '../../src/utils/printTimeFmt.js';

/** Neuer Stand der Faktoren nach einem Druck (gleiche Liste zurück, wenn der Druck nicht zählt) */
export function learn(factors: Factors, material: string, predSec: number, realSec: number): Factors {
  if (!(predSec >= 300) || !(realSec >= 300)) return factors;
  const ratio = realSec / predSec;
  const out: Factors = { ...factors, [ALL]: nextFactor(factors[ALL], ratio) };
  if (material) out[material] = nextFactor(factors[material], ratio);
  return out;
}

const file = () => path.join(dataDir, 'hub-timefactor.json');
let cache: Factors | null = null;

export function loadFactors(): Factors {
  if (!cache) cache = readJsonWithPrev<Factors>(file(), v => Boolean(v) && typeof v === 'object' && !Array.isArray(v)) || {};
  return cache;
}

/** Nach einem fertigen Druck lernen. Nur FINISH zählt, nur wenn die Warteschlange ihn gestartet hat (Slicer-Zeit bekannt). */
export function learnFromPrint(rec: { state: string; startMs: number; endMs: number }, info: { predSec: number; material: string } | null): void {
  if (rec.state !== 'FINISH' || !info || !(info.predSec > 0)) return;
  const cur = loadFactors();
  const next = learn(cur, info.material, info.predSec, (rec.endMs - rec.startMs) / 1000);
  if (next === cur) return;
  cache = next;
  saveJsonConfig(file(), next, 'Zeit-Faktoren', { pretty: true, keepPrev: true });
}
