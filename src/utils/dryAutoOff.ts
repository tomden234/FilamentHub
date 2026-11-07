// „Nach Trocknen ausschalten“: gemerkter Schalter + reine Entscheidungslogik (ohne Browser, darum testbar).
// Die Steckdose geht aus, wenn die AMS-Trocknung gelaufen und zu Ende ist und kein Druck läuft.
// Der Schalter bleibt dauerhaft an (gilt für jede Trocknung), bis du ihn selbst ausmachst.
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';
import { ACTIVE_STATES } from './printSession';
import { getWorkshopSettings } from './workshopSettings';

interface DryOffState {
  armed: boolean;
  armedAt: number;
  /** Wann die letzte Trocknung zu Ende ging (0 = keine, die 3 Minuten laufen) */
  endedAt: number;
  /** Von Hand abgebrochen: der laufende Durchgang zählt nicht */
  skipAt: number;
}

const KEY = 'filamenthub_dry_power_off_v1';
const OFF: DryOffState = { armed: false, armedAt: 0, endedAt: 0, skipAt: 0 };

/** Nach dem Ende der Trocknung warten (Lüfter/Ventile des AMS laufen noch aus) */
export const DRY_OFF_SETTLE_MS = 3 * 60_000;

/** Eingestellte Wartezeit (Standard 3 Minuten) */
export function dryOffSettleMs(): number {
  return Math.max(1, getWorkshopSettings().dryOffDelayMin) * 60_000;
}

type DryOffAction = 'wait' | 'switch-off' | 'cancel-print' | 'cancel-socket-off';

export interface DryOffInput {
  armedAt: number;
  now: number;
  /** Letzter Zeitpunkt, an dem die Trocknung lief (0 = seit dem Wählen noch nie gesehen) */
  lastDryingAt: number;
  dryingNow: boolean;
  gcodeState?: string;
  switchState: 'on' | 'off' | 'unknown' | 'error';
  /** Wartezeit nach dem Ende (ms), Standard 3 Minuten */
  settleMs?: number;
}

/** Was soll jetzt passieren? */
export function dryOffAction(i: DryOffInput): DryOffAction {
  const printing = ACTIVE_STATES.has(String(i.gcodeState || ''));
  if (i.dryingNow) return 'wait'; // läuft noch (auch neben einem Druck): nie ausschalten
  if (i.lastDryingAt === 0) return 'wait'; // Trocknung in diesem Durchgang noch nicht gesehen
  // Trocknung ist vorbei
  if (i.switchState === 'off') return 'cancel-socket-off'; // schon aus (z. B. von Hand): erledigt
  if (printing) return 'cancel-print'; // danach hat ein neuer Druck begonnen: Drucker bleibt an
  if (i.now - i.lastDryingAt < (i.settleMs ?? DRY_OFF_SETTLE_MS)) return 'wait';
  return 'switch-off';
}

let cache: DryOffState | null = null;
const listeners = new Set<() => void>();

function read(): DryOffState {
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) || 'null');
    if (v && typeof v.armed === 'boolean') return { armed: v.armed, armedAt: Number(v.armedAt) || 0, endedAt: Number(v.endedAt) || 0, skipAt: Number(v.skipAt) || 0 };
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
  save({ armed: true, armedAt: Date.now(), endedAt: 0, skipAt: 0 });
}

/** Ende der Trocknung merken (für den 3-Minuten-Zähler), 0 = kein Zähler */
export function setDryEndedAt(ts: number): void {
  const c = getDryOff();
  if (c.armed && c.endedAt !== ts) save({ ...c, endedAt: ts });
}

/** Diesen Durchgang abbrechen (z. B. Trocknung von Hand gestoppt), der Schalter bleibt an */
export function skipDryOffRun(): void {
  const c = getDryOff();
  if (c.armed) save({ ...c, endedAt: 0, skipAt: Date.now() });
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
