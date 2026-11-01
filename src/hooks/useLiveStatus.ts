import { useEffect, useRef } from 'react';
import { buildLiveStatus, type LiveStatusInput } from '../utils/liveStatus';
import { clearOngoingStatus, showOngoingStatus } from '../utils/notify';
import { safeStorage } from '../utils/safeStorage';
import { useWorkshopSettings } from '../utils/workshopSettings';
import { dryOffSettleMs, useDryOff } from '../utils/dryAutoOff';
import { IS_NATIVE } from '../utils/env';

// Stehende Mitteilung (Android): Druck- oder Trocknungsstand mit Balken, Restzeit und Uhrzeit des Endes.
// Die Zeit zählt die Mitteilung selbst herunter, der Balken und die Texte werden alle 20 Sekunden (im Aus-Zähler jede Sekunde) erneuert.

interface Params {
  connected: boolean;
  gcodeState?: string;
  percent: number;
  remainingMin: number;
  jobName?: string;
  layer?: number;
  totalLayers?: number;
  dryMinLeft: number;
}

function dryTotalFromStorage(): number {
  try {
    const st = JSON.parse(safeStorage.getItem('filamenthub_ams_drying_state') || 'null');
    if (st?.isDrying && Number(st.durationHours) > 0) return Math.round(Number(st.durationHours) * 60);
  } catch {
    /* egal */
  }
  return 0;
}

export function useLiveStatus(p: Params) {
  const [settings] = useWorkshopSettings();
  const dryOff = useDryOff();
  const latest = useRef({ p, endedAt: dryOff.armed ? dryOff.endedAt : 0 });
  latest.current = { p, endedAt: dryOff.armed ? dryOff.endedAt : 0 };
  const peak = useRef(0);
  const shown = useRef(false);
  const lastKey = useRef('');

  useEffect(() => {
    if (!IS_NATIVE) return;
    if (!settings.liveStatus) {
      if (shown.current) void clearOngoingStatus();
      shown.current = false;
      lastKey.current = '';
      return;
    }
    const tick = () => {
      const { p: cur, endedAt } = latest.current;
      if (cur.dryMinLeft > peak.current) peak.current = cur.dryMinLeft;
      if (cur.dryMinLeft <= 0) peak.current = 0;
      const input: LiveStatusInput = {
        connected: cur.connected,
        gcodeState: cur.gcodeState,
        percent: cur.percent,
        remainingMin: cur.remainingMin,
        jobName: cur.jobName,
        layer: cur.layer,
        totalLayers: cur.totalLayers,
        dryMinLeft: cur.dryMinLeft,
        dryTotalMin: dryTotalFromStorage() || peak.current,
        dryOffEndedAt: endedAt,
        now: Date.now(),
        settleMs: dryOffSettleMs()
      };
      const s = buildLiveStatus(input);
      if (!s) {
        if (shown.current) {
          shown.current = false;
          lastKey.current = '';
          void clearOngoingStatus();
        }
        return;
      }
      // nur senden, wenn sich etwas geändert hat (Zeit zählt die Mitteilung selbst)
      const key = `${s.kind}|${s.title}|${s.text}|${s.sub}|${s.progress}`;
      if (key === lastKey.current) return;
      lastKey.current = key;
      shown.current = true;
      void showOngoingStatus({ title: s.title, text: s.text, sub: s.sub, progress: s.progress, etaMs: s.etaMs, shortText: s.shortText });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [settings.liveStatus]);

  useEffect(
    () => () => {
      if (shown.current) void clearOngoingStatus();
    },
    []
  );
}
