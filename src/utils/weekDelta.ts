// 1.249: Verbrauch der letzten 7 Tage im Vergleich zu den 7 Tagen davor (für die Zahlen-Leiste)
import type { HistoryEntry } from '../types/filament';

export interface WeekDelta {
  week: number;
  prev: number;
  diff: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function weekDelta(history: Pick<HistoryEntry, 'grams' | 'timestamp'>[], nowMs: number = Date.now()): WeekDelta {
  let week = 0;
  let prev = 0;
  for (const h of history) {
    const t = Date.parse(h.timestamp);
    const g = Number(h.grams) || 0;
    if (!Number.isFinite(t) || g <= 0) continue;
    const age = nowMs - t;
    if (age < 0) continue;
    if (age < 7 * DAY) week += g;
    else if (age < 14 * DAY) prev += g;
  }
  week = Math.round(week);
  prev = Math.round(prev);
  return { week, prev, diff: week - prev };
}
