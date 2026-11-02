import { useEffect, useState } from 'react';
import { getLiveAms } from '../utils/liveAms';

// AMS-Platz und laufende Trocknung einer Spule. Wird jede Sekunde und bei jeder Änderung neu gelesen.
// Trocknung zählt nur für Slot 1-4 (das AMS trocknet), nicht für Extern (5), und kommt vom Drucker, wenn er verbunden ist.

export interface SpoolAmsInfo {
  slot: number | null;
  isDrying: boolean;
  dryTemp: number;
  remainingTime: string | null;
}

const fmt = (ms: number) => `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;

export function readSpoolAms(spoolId: string): SpoolAmsInfo {
  try {
    const slotsRaw = localStorage.getItem('filamenthub_ams_slots_x2d');
    const slots: Record<string, string> = slotsRaw ? JSON.parse(slotsRaw) : {};
    let slot: number | null = null;
    for (const [k, v] of Object.entries(slots)) {
      if (v === spoolId) {
        slot = parseInt(k, 10);
        break;
      }
    }
    let isDrying = false;
    let dryTemp = 50;
    let remainingTime: string | null = null;
    if (slot !== null && slot >= 1 && slot <= 4) {
      const live = getLiveAms();
      if (live.connected) {
        // Drucker verbunden: nur das zählt, was er selbst meldet
        if (live.drying) {
          isDrying = true;
          if (live.dryTemp) dryTemp = live.dryTemp;
          if (live.dryMinLeft) remainingTime = fmt(live.dryMinLeft * 60000);
        }
      } else {
        // Nicht verbunden: letzter Stand aus der lokalen Merkliste
        const dryRaw = localStorage.getItem('filamenthub_ams_drying_state');
        const p = dryRaw ? JSON.parse(dryRaw) : null;
        if (p && p.isDrying) {
          const totalMs = (p.durationHours || 4) * 3600 * 1000;
          const elapsed = Date.now() - (p.startTimestamp || 0);
          if (elapsed < totalMs) {
            isDrying = true;
            dryTemp = p.targetTemp || 50;
            remainingTime = fmt(totalMs - elapsed);
          }
        }
      }
    }
    return { slot, isDrying, dryTemp, remainingTime };
  } catch {
    return { slot: null, isDrying: false, dryTemp: 50, remainingTime: null };
  }
}

export function useSpoolAms(spoolId: string): SpoolAmsInfo {
  const [info, setInfo] = useState<SpoolAmsInfo>(() => readSpoolAms(spoolId));
  useEffect(() => {
    const update = () => setInfo(prev => {
      const next = readSpoolAms(spoolId);
      return prev.slot === next.slot && prev.isDrying === next.isDrying && prev.remainingTime === next.remainingTime && prev.dryTemp === next.dryTemp ? prev : next;
    });
    update();
    window.addEventListener('filamenthub_drying_update', update);
    window.addEventListener('filamenthub:device-synced', update);
    window.addEventListener('storage', update);
    const t = setInterval(update, 1000);
    return () => {
      window.removeEventListener('filamenthub_drying_update', update);
      window.removeEventListener('filamenthub:device-synced', update);
      window.removeEventListener('storage', update);
      clearInterval(t);
    };
  }, [spoolId]);
  return info;
}
