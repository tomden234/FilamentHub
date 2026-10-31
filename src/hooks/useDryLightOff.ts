import { useEffect, useRef } from 'react';
import { addSystemLog } from '../utils/logService';
import { DRY_LIGHT_RESET_MS, dryIdleSituation, dryLightShouldTurnOff } from '../utils/dryLight';

// Licht im Drucker beim Trocknen: Läuft die AMS-Trocknung und es wird nicht gedruckt, geht das Bauraum-Licht einmal je Trocknung aus.
// Du kannst es danach von Hand wieder anmachen (zum Nachsehen mit der Kamera), es geht dann nicht noch einmal aus.

interface Params {
  enabled: boolean;
  connected: boolean;
  drying: boolean;
  gcodeState: string | undefined;
  lightOn: boolean;
  /** Licht aus schicken, gibt zurück, ob der Drucker es angenommen hat */
  turnLightOff: () => Promise<boolean>;
}

const TICK_MS = 5_000;

export function useDryLightOff(p: Params) {
  const latest = useRef(p);
  latest.current = p;
  const heldSince = useRef<number | null>(null);
  const doneThisRun = useRef(false);
  const lastDryAt = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const tick = async () => {
      const c = latest.current;
      const now = Date.now();
      if (c.drying) lastDryAt.current = now;
      else if (lastDryAt.current && now - lastDryAt.current > DRY_LIGHT_RESET_MS) {
        doneThisRun.current = false; // nächste Trocknung zählt neu
        lastDryAt.current = 0;
      }
      if (!dryIdleSituation(c.connected, c.drying, c.gcodeState)) {
        heldSince.current = null;
        return;
      }
      if (heldSince.current === null) heldSince.current = now;
      if (busy.current) return;
      if (
        dryLightShouldTurnOff({
          enabled: c.enabled,
          connected: c.connected,
          dryingNow: c.drying,
          gcodeState: c.gcodeState,
          lightOn: c.lightOn,
          alreadyDone: doneThisRun.current,
          heldMs: now - heldSince.current
        })
      ) {
        busy.current = true;
        try {
          if (await c.turnLightOff()) {
            doneThisRun.current = true;
            addSystemLog('licht', 'Bauraum-Licht aus (Trocknung läuft, kein Druck)', 'Automatik beim Trocknen', 'info');
          }
        } finally {
          busy.current = false;
        }
      }
    };
    const id = setInterval(() => void tick(), TICK_MS);
    void tick();
    return () => clearInterval(id);
  }, []);
}
