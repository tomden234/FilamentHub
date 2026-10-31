// Letzte Feuchte-Werte (AMS vom Drucker, externer Sensor über Home Assistant), damit Einstellungen und Anzeige sie zeigen können.
import { useSyncExternalStore } from 'react';

export interface HumidityReading {
  value: number | null;
  temp?: number | null;
  at: number;
  /** Text, falls der Sensor nicht gelesen werden konnte */
  error?: string;
}

export interface HumidityLive {
  ams: HumidityReading | null;
  /** Sensor in der Lagerbox */
  external: HumidityReading | null;
  /** Optionaler zweiter Sensor im externen Spulentrockner (5. Spule) */
  room: HumidityReading | null;
}

let live: HumidityLive = { ams: null, external: null, room: null };
const listeners = new Set<() => void>();

export function setHumidity(patch: Partial<HumidityLive>): void {
  live = { ...live, ...patch };
  listeners.forEach(l => l());
}

export function getHumidity(): HumidityLive {
  return live;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useHumidity(): HumidityLive {
  return useSyncExternalStore(subscribe, getHumidity, getHumidity);
}

/** AMS-Feuchte in % (nur echte Messwerte: AMS 2 Pro / HT melden humidity_raw). Ältere AMS melden nur eine grobe Stufe → null. */
export function amsHumidityPercent(unit: any): number | null {
  if (!unit) return null;
  const raw = Number(unit.humidity_raw);
  if (unit.humidity_raw !== undefined && unit.humidity_raw !== '' && Number.isFinite(raw) && raw > 0) return raw;
  const lvl = Number(unit.humidity);
  if (Number.isFinite(lvl) && lvl >= 10 && lvl <= 100) return lvl;
  return null;
}
