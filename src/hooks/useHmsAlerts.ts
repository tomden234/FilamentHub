import { useEffect, useRef } from 'react';
import { raiseAlert } from '../utils/alerts';
import { HMS_HELP_URL, hmsCode, hmsModule, hmsSeverity, hmsText, printErrorCode, printErrorText, type HmsEntry } from '../utils/hms';
import { safeStorage } from '../utils/safeStorage';
import { getWorkshopSettings } from '../utils/workshopSettings';
import { CANCELED_PRINT_ERROR, IGNORE_HMS, hmsIsImportant, printErrorIsImportant } from '../utils/hmsFilter';

// Fehler-Mitteilungen des Druckers. Standard: nur das, was wirklich wichtig ist.
//  - nur schwere Meldungen (Stufe „Kritisch“ oder „Ernst“), nur während Druck/Pause/Fehler
//  - erst melden, wenn die Meldung 1 Minute ansteht (Dialoge wie „Düse wechseln“, „Filament einlegen“, „fortsetzen?“ sind dann längst weg)
//  - Druckfehler-Code (Grund des Abbruchs) nur, wenn der Druck wirklich fehlgeschlagen ist
//  - gleiche Meldung nicht doppelt: erst nach 6 Stunden wieder
// Mit „Auch Hinweise und Dialoge“ (alertErrorsAll) gilt wieder alles sofort.

interface Params {
  connected: boolean;
  gcodeState: string | undefined;
  hms: HmsEntry[] | undefined;
  printError: number | undefined;
  jobName: string | undefined;
  showToast?: (t: string) => void;
}

const KEY = 'filamenthub_hms_alerted_v2';
const CONFIRM_MS = 60_000;
const AGAIN_MS = 6 * 3600_000;
const TICK_MS = 10_000;
function readMap(): Record<string, number> {
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function remember(code: string): void {
  const m = readMap();
  m[code] = Date.now();
  const entries = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 80);
  safeStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
}

export function useHmsAlerts(p: Params) {
  const latest = useRef(p);
  latest.current = p;
  /** Wann wurde die Meldung zuerst gesehen (seit sie ununterbrochen ansteht) */
  const seen = useRef<Map<string, number>>(new Map());
  /** Für diese Meldungen wurde in diesem Durchgang schon gemeldet */
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!p.connected) {
      seen.current.clear();
      fired.current.clear();
      return;
    }

    const tick = () => {
      const { hms, printError, gcodeState, jobName, showToast } = latest.current;
      const all = getWorkshopSettings().alertErrorsAll;
      const need = all ? 0 : CONFIRM_MS;
      const now = Date.now();

      type Cand = { code: string; kind: 'hms' | 'perr'; h?: HmsEntry; err?: number };
      const cands: Cand[] = [];
      (hms || []).forEach(h => {
        const code = hmsCode(h);
        if (IGNORE_HMS.has(code)) return;
        if (!all && !hmsIsImportant(h, gcodeState)) return;
        cands.push({ code: `hms-${code}`, kind: 'hms', h });
      });
      const err = Number(printError) || 0;
      if (err && err !== CANCELED_PRINT_ERROR && (all || printErrorIsImportant(err, gcodeState))) {
        cands.push({ code: `perr-${printErrorCode(err)}`, kind: 'perr', err });
      }

      // Was nicht mehr ansteht, vergessen (kommt es später wieder, zählt es neu)
      const present = new Set(cands.map(c => c.code));
      for (const k of Array.from(seen.current.keys())) if (!present.has(k)) seen.current.delete(k);
      for (const k of Array.from(fired.current)) if (!present.has(k)) fired.current.delete(k);

      cands.forEach(c => {
        if (!seen.current.has(c.code)) seen.current.set(c.code, now);
        if (fired.current.has(c.code)) return;
        if (now - (seen.current.get(c.code) as number) < need) return;
        const short = c.code.replace(/^(hms|perr)-/, '');
        if (now - (readMap()[short] || 0) < AGAIN_MS) {
          fired.current.add(c.code);
          return;
        }
        fired.current.add(c.code);
        remember(short);
        void (async () => {
          if (c.kind === 'hms' && c.h) {
            const sev = hmsSeverity(c.h);
            const text = (await hmsText(c.h)) || `Unbekannte Meldung ${short}. Details im Bambu-Wiki.`;
            void raiseAlert(
              {
                kind: 'printer-error',
                key: `hms-${short}-${now}`,
                title: sev.level === 4 ? 'Drucker-Hinweis' : 'Druckerfehler',
                text,
                toast: `⚠️ ${text}`,
                facts: [
                  { label: 'Bereich', value: hmsModule(c.h) },
                  { label: 'Stufe', value: sev.text },
                  { label: 'Code', value: short },
                  ...(jobName ? [{ label: 'Auftrag', value: jobName }] : []),
                  { label: 'Hilfe', value: HMS_HELP_URL }
                ]
              },
              showToast
            );
          } else if (c.err) {
            const text = (await printErrorText(c.err)) || `Druckfehler ${short}.`;
            void raiseAlert(
              {
                kind: 'printer-error',
                key: `perr-${short}-${now}`,
                title: 'Druckerfehler',
                text,
                toast: `⚠️ ${text}`,
                facts: [{ label: 'Code', value: short }, ...(jobName ? [{ label: 'Auftrag', value: jobName }] : []), { label: 'Hilfe', value: HMS_HELP_URL }]
              },
              showToast
            );
          }
        })();
      });
    };

    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [p.connected]);
}
