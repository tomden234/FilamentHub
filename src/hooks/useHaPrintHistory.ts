import { useEffect, useRef } from 'react';
import { syncHaPrints, type HaEndHandler } from '../utils/haPrintSync';

// Holt regelmäßig den Druckverlauf aus Home Assistant und trägt fehlende Drucke nach (siehe haPrintSync.ts).
// Auslöser: App-Start, App wird sichtbar, alle 10 Minuten, kurz nach einem Druckende (HA braucht die 3 Minuten Wartezeit).

interface Params {
  onEnd: HaEndHandler;
  gcodeState: string | undefined;
}

export function useHaPrintHistory({ onEnd, gcodeState }: Params) {
  const latest = useRef(onEnd);
  latest.current = onEnd;
  const running = useRef(false);

  const run = useRef(async () => {
    if (running.current) return;
    running.current = true;
    try {
      await syncHaPrints((s, i) => latest.current(s, i));
    } catch {
      /* Home Assistant nicht erreichbar: nächster Auslöser versucht es erneut */
    } finally {
      running.current = false;
    }
  });

  useEffect(() => {
    const first = setTimeout(() => void run.current(), 8000);
    const every = setInterval(() => void run.current(), 10 * 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('filamenthub:ha-history-sync', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('filamenthub:ha-history-sync', onVisible);
    };
  }, []);

  // Druck gerade zu Ende: nach 3,5 Minuten nachsehen (frühere Drucke übernimmt der Live-Weg)
  useEffect(() => {
    if (gcodeState !== 'FINISH' && gcodeState !== 'FAILED') return;
    const t = setTimeout(() => void run.current(), 3.5 * 60_000);
    return () => clearTimeout(t);
  }, [gcodeState]);
}
