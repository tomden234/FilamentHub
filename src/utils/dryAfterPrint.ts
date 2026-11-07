// „Nach dem Druck trocknen“: gemerkter Plan (bleibt nach App-Neustart). Wird gesetzt, wenn eine Spule eingelegt wird,
// die trocknen sollte, oder von Hand bei der Drucksteuerung. Nach dem nächsten Druckende startet die AMS-Trocknung.
import { useSyncExternalStore } from 'react';
import type { Spool } from '../types/filament';
import { safeStorage } from './safeStorage';
import { getDryingStatus } from './shopLinks';

interface DryPlan {
  armed: boolean;
  temp: number;
  hours: number;
  spoolIds: string[];
  armedAt: number;
  /** Seit dem Setzen lief ein Druck (erst danach wird getrocknet) */
  sawPrint: boolean;
}

const KEY = 'filamenthub_dry_after_print_v1';
const OFF: DryPlan = { armed: false, temp: 50, hours: 8, spoolIds: [], armedAt: 0, sawPrint: false };

let cache: DryPlan | null = null;
const listeners = new Set<() => void>();

function read(): DryPlan {
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) || 'null');
    if (v && typeof v.armed === 'boolean') return { ...OFF, ...v };
  } catch {
    /* kaputt */
  }
  return OFF;
}

export function getDryPlan(): DryPlan {
  if (!cache) cache = read();
  return cache;
}

function save(p: DryPlan): void {
  cache = p;
  if (p.armed) safeStorage.setItem(KEY, JSON.stringify(p));
  else safeStorage.removeItem(KEY);
  listeners.forEach(l => l());
}

export function armDryPlan(plan: { temp: number; hours: number; spoolIds: string[] }, printRunning: boolean): void {
  save({ armed: true, temp: plan.temp, hours: plan.hours, spoolIds: plan.spoolIds, armedAt: Date.now(), sawPrint: printRunning });
}

export function markDryPlanSawPrint(): void {
  const p = getDryPlan();
  if (p.armed && !p.sawPrint) save({ ...p, sawPrint: true });
}

export function disarmDryPlan(): void {
  save(OFF);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useDryPlan(): DryPlan {
  return useSyncExternalStore(subscribe, getDryPlan, getDryPlan);
}

/** Spule sollte getrocknet werden (überfällig oder „muss trocknen“ gesetzt, nicht verschweißt) */
export function needsDryingNow(s: Spool): boolean {
  const st = getDryingStatus(s);
  return !st.sealed && (st.forced || st.isOverdue);
}

/**
 * Temperatur und Dauer für die AMS-Trocknung: Die Temperatur muss für ALLE Spulen im AMS passen
 * (es wird das ganze AMS geheizt), also die niedrigste. Dauer: die längste der Spulen, die trocknen sollen.
 * AMS 2 Pro: 45–65 °C, 1–24 h.
 */
export function dryPlanFor(toDry: Spool[], allInAms: Spool[]): { temp: number; hours: number } {
  const temps = (allInAms.length ? allInAms : toDry).map(s => Number(s.dryTemp) || 50);
  const temp = Math.max(45, Math.min(65, Math.floor(Math.min(...temps) / 5) * 5));
  const hours = Math.max(1, Math.min(24, Math.ceil(Math.max(...toDry.map(s => Number(s.dryHours) || 8), 1))));
  return { temp, hours };
}
