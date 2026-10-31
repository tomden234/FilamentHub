// „Nach Trocknen ausschalten“: gemerkter Schalter + reine Entscheidungslogik (ohne Browser, darum testbar).
// Die Steckdose geht aus, wenn die AMS-Trocknung gelaufen und zu Ende ist und kein Druck läuft.
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';
import { ACTIVE_STATES } from './printSession';

export interface DryOffState {
  armed: boolean;
  armedAt: number;
}

const KEY = 'filamenthub_dry_power_off_v1';
const OFF: DryOffState = { armed: false, armedAt: 0 };

/** Nach dem Ende der Trocknung warten (Lüfter/Ventile des AMS laufen noch aus) */
export const DRY_OFF_SETTLE_MS = 3 * 60_000;
/** Gewählt, aber die Trocknung startet nie: nach so langer Zeit vergessen */
export const DRY_OFF_NEVER_STARTED_MS = 30 * 60_000;
/** Ein Schalter, der älter ist, wird nicht mehr beachtet */
export const DRY_OFF_STALE_MS = 36 * 3600_000;

export type DryOffAction = 'wait' | 'switch-off' | 'cancel-print' | 'cancel-never-started' | 'cancel-stale' | 'cancel-socket-off';

export interface DryOffInput {
  armedAt: number;
  now: number;
  /** Letzter Zeitpunkt, an dem die Trocknung lief (0 = seit dem Wählen noch nie gesehen) */
  lastDryingAt: number;
  dryingNow: boolean;
  gcodeState?: string;
  switchState: 'on' | 'off' | 'unknown' | 'error';
}

/** Was soll jetzt passieren? */
export function dryOffAction(i: DryOffInput): DryOffAction {
  if (i.now - i.armedAt > DRY_OFF_STALE_MS) return 'cancel-stale';
  const printing = ACTIVE_STATES.has(String(i.gcodeState || ''));
  if (i.dryingNow) return 'wait'; // läuft noch (auch neben einem Druck): nie ausschalten
  if (i.lastDryingAt === 0) {
    // Trocknung noch nicht gesehen: warten, aber nicht ewig
    if (printing) return 'wait';
    return i.now - i.armedAt > DRY_OFF_NEVER_STARTED_MS ? 'cancel-never-started' : 'wait';
  }
  // Trocknung ist vorbei
  if (i.switchState === 'off') return 'cancel-socket-off'; // schon aus (z. B. von Hand): erledigt
  if (printing) return 'cancel-print'; // danach hat ein neuer Druck begonnen: Drucker bleibt an
  if (i.now - i.lastDryingAt < DRY_OFF_SETTLE_MS) return 'wait';
  return 'switch-off';
}

let cache: DryOffState | null = null;
const listeners = new Set<() => void>();

function read(): DryOffState {
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) || 'null');
    if (v && typeof v.armed === 'boolean') return { armed: v.armed, armedAt: Number(v.armedAt) || 0 };
  } catch {
    /* kaputt */
  }
  return OFF;
}

export function getDryOff(): DryOffState {
  if (!cache) cache = read();
  return cache;
}

function save(s: DryOffState): void {
  cache = s;
  if (s.armed) safeStorage.setItem(KEY, JSON.stringify(s));
  else safeStorage.removeItem(KEY);
  listeners.forEach(l => l());
}

export function armDryOff(): void {
  save({ armed: true, armedAt: Date.now() });
}

export function disarmDryOff(): void {
  if (getDryOff().armed) save(OFF);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useDryOff(): DryOffState {
  return useSyncExternalStore(subscribe, getDryOff, getDryOff);
}
