// „Drucker nach dem Druck ausschalten“: gemerkter Schalter (bleibt auch nach App-Neustart gesetzt).
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';

interface AutoOffState {
  armed: boolean;
  /** Auftrag, für den es gilt */
  jobName: string;
  armedAt: number;
}

const KEY = 'filamenthub_auto_power_off_v1';
const OFF: AutoOffState = { armed: false, jobName: '', armedAt: 0 };

let cache: AutoOffState | null = null;
const listeners = new Set<() => void>();

function read(): AutoOffState {
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) || 'null');
    if (v && typeof v.armed === 'boolean') return { armed: v.armed, jobName: String(v.jobName || ''), armedAt: Number(v.armedAt) || 0 };
  } catch {
    /* kaputt */
  }
  return OFF;
}

function getAutoOff(): AutoOffState {
  if (!cache) cache = read();
  return cache;
}

function save(s: AutoOffState): void {
  cache = s;
  if (s.armed) safeStorage.setItem(KEY, JSON.stringify(s));
  else safeStorage.removeItem(KEY);
  listeners.forEach(l => l());
}

export function armAutoOff(jobName: string): void {
  save({ armed: true, jobName, armedAt: Date.now() });
}

export function disarmAutoOff(): void {
  save(OFF);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useAutoOff(): AutoOffState {
  return useSyncExternalStore(subscribe, getAutoOff, getAutoOff);
}
