// „Druck-Planer“: Kommt ein neuer Druck an, kann beim Öffnen der App gewählt werden: danach trocknen, danach ausschalten,
// Druck verzögern (pausieren und nach X Stunden / um eine Uhrzeit fortsetzen). Wird nichts gewählt, läuft der Druck normal.
// Der Zustand bleibt nach App-Neustart erhalten.
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';

interface PrintPlan {
  /** Auftrag, für den der Plan gilt */
  jobId: string;
  jobName: string;
  /** ask = Fenster wartet auf Auswahl · delayed = pausiert bis resumeAt · none = nichts zu tun */
  state: 'ask' | 'delayed' | 'none';
  /** Zeitpunkt (ms), an dem der Druck fortgesetzt wird */
  resumeAt: number;
  /** Zuletzt gemerkte Trocknung während der Wartezeit (Restminuten, Temperatur) */
  dryMinLeft: number;
  dryTemp: number;
  /** Beim Fortsetzen lief die Trocknung (danach wieder starten) */
  dryWasRunning: boolean;
}

const KEY = 'filamenthub_print_plan_v1';
const NONE: PrintPlan = { jobId: '', jobName: '', state: 'none', resumeAt: 0, dryMinLeft: 0, dryTemp: 50, dryWasRunning: false };

let cache: PrintPlan | null = null;
const listeners = new Set<() => void>();

function read(): PrintPlan {
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) || 'null');
    if (v && typeof v.jobId === 'string') return { ...NONE, ...v };
  } catch {
    /* kaputt */
  }
  return NONE;
}

export function getPrintPlan(): PrintPlan {
  if (!cache) cache = read();
  return cache;
}

export function setPrintPlan(patch: Partial<PrintPlan>): void {
  const next = { ...getPrintPlan(), ...patch };
  cache = next;
  if (next.state === 'none' && !next.jobId) safeStorage.removeItem(KEY);
  else safeStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach(l => l());
}

export function clearPrintPlan(): void {
  cache = NONE;
  safeStorage.removeItem(KEY);
  listeners.forEach(l => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function usePrintPlan(): PrintPlan {
  return useSyncExternalStore(subscribe, getPrintPlan, getPrintPlan);
}

/** „HH:MM“ → nächster Zeitpunkt mit dieser Uhrzeit (ms). Liegt sie schon hinter uns, gilt morgen. */
export function nextClockTime(hhmm: string, now = Date.now()): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  const d = new Date(now);
  d.setHours(Math.min(23, Number(m[1])), Math.min(59, Number(m[2])), 0, 0);
  if (d.getTime() <= now + 30_000) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function clockText(ms: number): string {
  const d = new Date(ms);
  const t = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? `${t} Uhr` : `${d.toLocaleDateString('de-DE', { weekday: 'short' })} ${t} Uhr`;
}
