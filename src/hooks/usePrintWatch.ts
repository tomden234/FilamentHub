import { useEffect, useRef } from 'react';
import { activeSlotFromPrinter } from '../utils/amsMatch';
import { jobKey } from '../utils/printUsage';
import {
  ACTIVE_STATES,
  END_STATES,
  isPrintDone,
  makePrintId,
  markPrintDone,
  parseStartMs,
  readSession,
  watchSince,
  writeSession,
  type PrintSession
} from '../utils/printSession';

// Beobachtet den Druck, egal wo er gestartet wurde (Bambu Studio, Handy-App, Drucker-Display oder diese App).
// Der Zustand wird im Gerät gespeichert. Dadurch klappt es auch, wenn die App erst mitten im Druck oder nach dem Ende geöffnet wird.
//  - onStart: einmal je Druck (beim Start oder beim ersten Sehen mitten im Druck)
//  - onEnd:   einmal je Druck (missed = App hat das Ende nicht live gesehen)

export interface PrintEndInfo {
  state: 'FINISH' | 'FAILED';
  missed: boolean;
}

interface Params {
  /** Verbunden und der Drucker schickt Daten */
  connected: boolean;
  gcodeState: string | undefined;
  jobName: string | undefined;
  startTime: string | undefined;
  percent: number;
  ams: any;
  onStart: (s: PrintSession) => void;
  /** App geöffnet / neu verbunden, während der Druck schon läuft und schon gemeldet war: trotzdem melden */
  onResume?: (s: PrintSession) => void;
  onEnd: (s: PrintSession, info: PrintEndInfo) => void;
}

const MAX_MISSED_AGE_MS = 3 * 24 * 3600 * 1000;
const IDLE_CONFIRM_MS = 60_000;

/** Gehört der gespeicherte Druck zu dem, was der Drucker gerade meldet? */
function matches(s: PrintSession, name: string, startMs: number): boolean {
  if (startMs && s.startMs) return Math.abs(s.startMs - startMs) < 5000;
  if (!s.name || !name) return true;
  return jobKey(s.name) === jobKey(name);
}

export function usePrintWatch(p: Params) {
  const latest = useRef(p);
  latest.current = p;
  const prev = useRef<string | null>(null);
  const lastWrite = useRef(0);
  /** Aktueller Druck im Speicher (gespeichert wird höchstens alle 5 s, damit nicht bei jedem Paket geschrieben wird) */
  const mem = useRef<PrintSession | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const { connected, gcodeState } = p;
    if (!connected || !gcodeState) {
      prev.current = null; // nach Verbindungsabbruch zählt das nächste Paket wieder als „erstes“
      return;
    }
    const before = prev.current;
    prev.current = gcodeState;
    const name = p.jobName || '';
    const startMs = parseStartMs(p.startTime);
    const now = Date.now();
    watchSince(); // Startpunkt festlegen (beim allerersten Lauf)

    const load = (): PrintSession | null => {
      const stored = readSession();
      if (mem.current && (!stored || stored.id === mem.current.id)) return mem.current;
      mem.current = stored;
      return stored;
    };
    const save = (s: PrintSession, force: boolean) => {
      mem.current = s;
      if (force || now - lastWrite.current > 5000) {
        writeSession(s);
        lastWrite.current = now;
      }
    };
    const finish = (s: PrintSession, state: 'FINISH' | 'FAILED', missed: boolean) => {
      const done: PrintSession = { ...s, ended: true };
      save(done, true);
      if (isPrintDone(s.id)) return;
      markPrintDone(s.id);
      latest.current.onEnd(done, { state, missed });
    };

    if (idleTimer.current && gcodeState !== 'IDLE') {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }

    // --- Druck läuft ---
    if (ACTIVE_STATES.has(gcodeState)) {
      let s = load();
      if (s && !s.ended && !matches(s, name, startMs)) {
        // Anderer Auftrag läuft: den alten abschließen (war er fast fertig, gilt er als fertig)
        if (s.lastPercent >= 95) finish(s, 'FINISH', true);
        else save({ ...s, ended: true }, true);
        s = null;
      }
      let changed = false;
      if (!s || s.ended) {
        s = {
          id: makePrintId(name, startMs, now),
          name,
          startMs,
          seenAt: now,
          midway: before === null && p.percent > 2,
          slots: {},
          lastPercent: p.percent,
          ended: false,
          announced: false
        };
        changed = true;
      } else {
        if (name && !s.name) {
          s.name = name;
          changed = true;
        }
        if (startMs && !s.startMs) {
          s.startMs = startMs;
          changed = true;
        }
      }
      if (gcodeState === 'RUNNING') {
        const slot = activeSlotFromPrinter(p.ams);
        if (slot) {
          if (!s.slots[String(slot)]) changed = true; // neuer Slot: sofort speichern
          s.slots = { ...s.slots, [String(slot)]: (s.slots[String(slot)] || 0) + 1 };
        }
      }
      s.lastPercent = Number(p.percent) || s.lastPercent || 0;
      // Meldung erst, wenn der Name da ist (beim Vorbereiten fehlt er oft kurz), spätestens nach 1 Minute
      if (!s.announced && (s.name || now - s.seenAt > 60_000)) {
        s.announced = true;
        save(s, true);
        latest.current.onStart(s);
        return;
      }
      save(s, changed);
      // App kommt mitten in einen laufenden Druck (auch wenn er schon vor 2 Minuten startete): immer eine Meldung
      if (before === null && s.announced && !s.ended) latest.current.onResume?.(s);
      return;
    }

    // --- Druck zu Ende ---
    if (END_STATES.has(gcodeState)) {
      const state = gcodeState as 'FINISH' | 'FAILED';
      const missed = !(before && ACTIVE_STATES.has(before));
      const s = load();
      if (s && !s.ended && matches(s, name, startMs)) {
        finish({ ...s, lastPercent: state === 'FINISH' ? 100 : s.lastPercent }, state, missed);
        return;
      }
      // App hat den Druck gar nicht gesehen: nur mit Startzeit vom Drucker (sonst wüssten wir nicht, ob er schon erledigt ist)
      if (!s || s.ended) {
        if (!startMs || startMs < watchSince() || now - startMs > MAX_MISSED_AGE_MS) return;
        const id = makePrintId(name, startMs, 0);
        if (isPrintDone(id) || (s && (s.id === id || matches(s, name, startMs)))) return;
        const slot = activeSlotFromPrinter(p.ams);
        finish(
          { id, name, startMs, seenAt: now, midway: true, slots: slot ? { [String(slot)]: 1 } : {}, lastPercent: state === 'FINISH' ? 100 : Number(p.percent) || 0, ended: false },
          state,
          true
        );
      }
      return;
    }

    // --- Leerlauf, obwohl noch ein Druck offen ist (z. B. Drucker war aus): nach 1 Minute Ruhe abschließen ---
    if (gcodeState === 'IDLE') {
      const s = load();
      if (!s || s.ended || idleTimer.current) return;
      idleTimer.current = setTimeout(() => {
        idleTimer.current = null;
        if (prev.current !== 'IDLE') return;
        const cur = mem.current && mem.current.id === s.id ? mem.current : readSession();
        if (!cur || cur.ended || cur.id !== s.id) return;
        if (cur.lastPercent >= 95) finish(cur, 'FINISH', true);
        else if (cur.lastPercent >= 5) finish(cur, 'FAILED', true);
        else save({ ...cur, ended: true }, true);
      }, IDLE_CONFIRM_MS);
    }
  }, [p.connected, p.gcodeState, p.jobName, p.startTime, p.percent, p.ams]);

  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    },
    []
  );
}
