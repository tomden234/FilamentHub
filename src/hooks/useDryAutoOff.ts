import { useEffect, useRef } from 'react';
import { toggleHaSwitch } from '../utils/haClient';
import { raiseAlert } from '../utils/alerts';
import { addSystemLog } from '../utils/logService';
import { dryOffAction, dryOffSettleMs, setDryEndedAt, useDryOff } from '../utils/dryAutoOff';
import { getHaDryOffRun } from '../utils/haDryOff';
import { hubHandlesPower, powerSig } from '../utils/serverDeducts';

// „Nach Trocknen ausschalten“: Ist die AMS-Trocknung zu Ende (und kein Druck), geht nach 3 Minuten die Steckdose über Home Assistant aus.
//  - gilt nur, wenn die Trocknung nach dem Wählen wirklich gelaufen ist
//  - der Schalter bleibt an und gilt für jede weitere Trocknung, bis du ihn selbst ausmachst
//  - startet ein Druck, bleibt der Drucker an (nur dieses Mal)
//  - du stoppst die Trocknung von Hand: zählt wie das Ende, der 3-Minuten-Zähler startet
//  - „Abbrechen“ im Zähler: nur dieses Mal kein Ausschalten
//  - beginnt in den 3 Minuten ein Druck oder eine neue Trocknung, wird nichts ausgeschaltet
//  - die 3 Minuten laufen als Zähler in der Trocknen-Ansicht
// Läuft auf jedem Gerät, auf dem die App offen ist (Android: auch im Hintergrund mit Hintergrund-Dienst).

interface Params {
  connected: boolean;
  gcodeState: string | undefined;
  /** AMS trocknet gerade (Restzeit > 0) */
  drying: boolean;
  switchState: 'on' | 'off' | 'unknown' | 'error';
  /** Am Drucker wird gearbeitet (Düse/Bett heizen auf Zieltemperatur) */
  busy: boolean;
  refreshSwitch: () => void;
  notify: (t: { text: string; ok: boolean }) => void;
}

const TICK_MS = 10_000;
const MAX_FAILS = 4;

export function useDryAutoOff(p: Params) {
  const state = useDryOff();
  const latest = useRef(p);
  latest.current = p;
  const lastDryingAt = useRef(0);
  const busy = useRef(false);
  const fails = useRef(0);

  /** Home Assistant meldet: 3-Minuten-Wartezeit läuft seit diesem Zeitpunkt (0 = nein) */
  const haRunAt = useRef(0);

  useEffect(() => {
    if (!state.armed) {
      haRunAt.current = 0;
      lastDryingAt.current = 0;
      fails.current = 0;
      return;
    }
    /** Durchgang abgeschlossen: Schalter bleibt an, der nächste Durchgang beginnt neu */
    // App war zu und wird wieder geöffnet: Zähler läuft weiter, wo er war (nur wenn noch innerhalb der 3 Minuten + Puffer)
    if (state.endedAt > 0) {
      if (Date.now() - state.endedAt < dryOffSettleMs() + 60_000 && state.endedAt > state.skipAt) lastDryingAt.current = state.endedAt;
      else setDryEndedAt(0);
    }
    const pollHa = async () => {
      const r = await getHaDryOffRun();
      if (!r) return;
      haRunAt.current = r.running && r.startedAt > state.skipAt ? r.startedAt : 0;
    };
    void pollHa();
    const haId = setInterval(() => void pollHa(), 15_000);
    const finish = (title: string, text: string, ok: boolean, kind: 'info' = 'info') => {
      lastDryingAt.current = 0;
      haRunAt.current = 0;
      setDryEndedAt(0);
      addSystemLog('steckdose', title, text, ok ? 'success' : 'info');
      void raiseAlert({ kind, key: `dry-off-${Date.now()}-${title}`, title, text, toast: `${ok ? '🔌' : 'ℹ️'} ${text}` }, t => latest.current.notify({ text: t, ok }));
    };
    const tick = async () => {
      const cur = latest.current;
      if (!cur.connected || busy.current) return;
      // Nach einem Abbruch von Hand ignorieren, bis die Trocknung wirklich aus ist
      const skipping = Date.now() - state.skipAt < 120_000;
      if (cur.drying && !skipping) lastDryingAt.current = Date.now();
      if (state.skipAt && lastDryingAt.current && lastDryingAt.current < state.skipAt) lastDryingAt.current = 0;
      // Jemand arbeitet am Drucker (Düse wechseln, aufheizen ...): nicht ausschalten
      if (cur.busy && !cur.drying && lastDryingAt.current > 0) {
        finish('Drucker bleibt an', 'Am Drucker wird gearbeitet (Düse/Bett heizen). Der Drucker bleibt an (nur dieses Mal).', false);
        return;
      }
      const action = dryOffAction({
        armedAt: state.armedAt,
        now: Date.now(),
        lastDryingAt: lastDryingAt.current,
        dryingNow: cur.drying,
        gcodeState: cur.gcodeState,
        switchState: cur.switchState,
        settleMs: dryOffSettleMs()
      });
      // Zähler für die Anzeige: läuft ab Trocknungsende, solange nicht gedruckt wird
      const localEnded = !cur.drying && lastDryingAt.current && action !== 'cancel-print' && action !== 'cancel-socket-off' ? lastDryingAt.current : 0;
      setDryEndedAt(cur.drying ? 0 : haRunAt.current || localEnded);
      switch (action) {
        case 'wait':
          return;
        case 'cancel-socket-off':
          finish('Drucker ausgeschaltet', 'Nach dem Trocknen ist der Drucker aus.', true);
          return;
        case 'cancel-print':
          finish('Drucker bleibt an', 'Nach dem Trocknen hat ein Druck begonnen. Der Drucker bleibt an (nur dieses Mal).', false);
          return;
        case 'switch-off': {
          // Der Pi-Server schaltet (läuft rund um die Uhr): nicht doppelt. Ist die Steckdose aus, meldet „cancel-socket-off“ es hier.
          if (hubHandlesPower(powerSig('dry', state.armed, state.armedAt))) return;
          busy.current = true;
          try {
            const res = await toggleHaSwitch('off');
            if (res.success) {
              finish('Drucker ausgeschaltet', 'Trocknung fertig, Drucker automatisch ausgeschaltet (nach der eingestellten Wartezeit).', true);
              setTimeout(() => latest.current.refreshSwitch(), 800);
            } else if (++fails.current >= MAX_FAILS) {
              fails.current = 0;
              finish('Ausschalten fehlgeschlagen', `Ausschalten hat nicht geklappt (Home Assistant: ${res.message || 'keine Antwort'}). Bitte selbst ausschalten.`, false);
            }
          } catch {
            fails.current++;
          } finally {
            busy.current = false;
          }
        }
      }
    };
    const id = setInterval(() => void tick(), TICK_MS);
    void tick();
    return () => {
      clearInterval(id);
      clearInterval(haId);
    };
  }, [state.armed, state.armedAt, state.skipAt]);

  return state;
}
