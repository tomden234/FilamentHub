import { useEffect, useRef } from 'react';
import { printerApi } from '../api/printerApi';
import { addSystemLog } from '../utils/logService';
import { raiseAlert } from '../utils/alerts';
import { jobKey } from '../utils/printUsage';
import { ACTIVE_STATES, parseStartMs } from '../utils/printSession';
import { clearPrintPlan, getPrintPlan, setPrintPlan, usePrintPlan } from '../utils/printPlan';
import { samePlanJob, splitId } from '../utils/printPlanJob';
import { delayResumeOnServer } from '../utils/recorderServer';

// Druck-Planer (siehe utils/printPlan.ts):
//  - Neuer Druck (Start oder noch ganz am Anfang) → Fenster „Was soll mit dem Druck passieren?“ (state ask)
//  - Druck verzögern: App pausiert den Druck und setzt ihn zur gewählten Zeit fort
//  - Lief währenddessen die AMS-Trocknung: sie wird beim Fortsetzen beendet, der Rest der Zeit läuft nach dem Druck weiter
//    (außer „Nach Druck aus“ ist gewählt, das gewinnt)
//  - Wird im Fenster nichts gewählt, passiert nichts und der Druck läuft normal
//  - Der Plan überlebt, wenn der Drucker Name oder Startzeit erst später meldet (gleicher Auftrag wird tolerant erkannt)
//  - Hängt die Trocknung beim Fortsetzen, wird nach 90 Sekunden trotzdem fortgesetzt (der Drucker beendet sie beim Start selbst)
//  - Ist die App zu, setzt der Drucker-Kern den Druck 90 Sekunden nach der Zeit selbst fort (printerApi.delayResume)

interface Params {
  connected: boolean;
  gcodeState: string | undefined;
  jobName: string | undefined;
  startTime: string | undefined;
  percent: number;
  dryMinutesLeft: number;
  dryTemp: number;
  stopDrying: () => Promise<boolean>;
  /** Trocknung nach dem Druck mit dem Rest der Zeit wieder starten */
  restartDryAfterPrint: (temp: number, minutes: number) => void;
  notify: (t: { text: string; ok: boolean }) => void;
}

const TICK_MS = 10_000;
const CMD_RETRY_MS = 20_000;
const DRY_STOP_MAX_MS = 90_000; // so lange versuchen, die Trocknung zu beenden, dann trotzdem fortsetzen
const RESUME_FAILS_WARN = 3; // so viele Fehlversuche, dann Hinweis „bitte am Drucker fortsetzen“
const IDLE_CLEAR_MS = 120_000; // verzögerter Plan gilt erst nach so langem „Leerlauf“ als erledigt

export function usePrintPlanRunner(p: Params) {
  const plan = usePrintPlan();
  const latest = useRef(p);
  latest.current = p;
  const lastCmd = useRef(0);
  const busy = useRef(false);
  const dueSince = useRef(0);
  const resumeFails = useRef(0);
  const idleSince = useRef(0);
  const dryStopped = useRef(false);

  // --- Neuer Druck / Druck vorbei ---
  useEffect(() => {
    if (!p.connected || !p.gcodeState) return;
    const cur = getPrintPlan();
    const st = p.gcodeState;
    const startMs = parseStartMs(p.startTime);
    const id = `${jobKey(p.jobName || '') || 'druck'}|${startMs || 0}`;
    if (ACTIVE_STATES.has(st)) {
      idleSince.current = 0;
      if (cur.jobId) {
        // Gleicher Auftrag (Name oder Startzeit kamen nur später): Plan behalten, Kennung nachziehen
        if (samePlanJob(cur.jobId, p.jobName, startMs)) {
          if (cur.jobId !== id) {
            const old = splitId(cur.jobId);
            const betterKey = !old.key && jobKey(p.jobName || '');
            const betterMs = !old.ms && startMs;
            if (betterKey || betterMs) setPrintPlan({ jobId: id, jobName: p.jobName || cur.jobName });
          }
          return;
        }
        // Wirklich anderer Auftrag: alten Plan verwerfen
        clearPrintPlan();
      }
      // Nur frische Drucke fragen (Start oder ganz am Anfang), keine mitten im Druck
      if (st === 'PREPARE' || p.percent <= 3) {
        setPrintPlan({ jobId: id, jobName: p.jobName || '', state: 'ask', resumeAt: 0, dryMinLeft: 0, dryTemp: 50, dryWasRunning: false });
      }
      return;
    }
    // Druck vorbei oder abgebrochen: Plan weg. Der Trocknen-Rest wurde schon beim Fortsetzen eingeplant.
    // Ein verzögerter Plan überlebt kurze „Leerlauf“-Meldungen (Verbindungsproblem), den prüft der Takt unten.
    if (cur.jobId && (st === 'FINISH' || st === 'FAILED' || (st === 'IDLE' && cur.state !== 'delayed'))) clearPrintPlan();
  }, [p.connected, p.gcodeState, p.jobName, p.startTime, p.percent]);

  // --- Sicherheitsnetz im Drucker-Kern: setzt auch bei geschlossener App fort ---
  useEffect(() => {
    if (!p.connected) return;
    const at = plan.state === 'delayed' ? plan.resumeAt : 0;
    void printerApi.delayResume(at).catch(() => {
      /* nächster Wechsel sendet erneut */
    });
  }, [plan.state, plan.resumeAt, p.connected]);

  // --- Auch der Pi-Server setzt fort (läuft rund um die Uhr, auch wenn alle Apps zu sind) ---
  useEffect(() => {
    const at = plan.state === 'delayed' ? plan.resumeAt : 0;
    void delayResumeOnServer(at);
  }, [plan.state, plan.resumeAt]);

  // --- Pausieren, Trocknung merken, zur Zeit fortsetzen ---
  useEffect(() => {
    if (plan.state === 'none') return;
    const tick = async () => {
      const cur = getPrintPlan();
      const q = latest.current;
      if (cur.state === 'none' || busy.current || !q.connected) return;
      // Trocknung merken, solange sie läuft (auch wenn der Drucker sie beim Druckstart selbst beendet)
      if (q.dryMinutesLeft > 0 && (cur.dryMinLeft !== q.dryMinutesLeft || cur.dryTemp !== q.dryTemp)) {
        setPrintPlan({ dryMinLeft: q.dryMinutesLeft, dryTemp: q.dryTemp || cur.dryTemp, dryWasRunning: true });
      }
      if (cur.state !== 'delayed') return;
      const st = q.gcodeState;
      const now = Date.now();
      // Dauerhaft „Leerlauf“: Druck wurde abgebrochen, Plan erledigt
      if (st === 'IDLE') {
        if (!idleSince.current) idleSince.current = now;
        if (now - idleSince.current >= IDLE_CLEAR_MS) clearPrintPlan();
        return;
      }
      idleSince.current = 0;
      const due = now >= cur.resumeAt;
      if (!due) {
        dueSince.current = 0;
        dryStopped.current = false;
        resumeFails.current = 0;
        // Pause erzwingen, sobald der Druck läuft
        if (st === 'RUNNING' && now - lastCmd.current >= CMD_RETRY_MS) {
          lastCmd.current = now;
          busy.current = true;
          try {
            const res = await printerApi.command('pause');
            if (res.ok && res.data.success) addSystemLog('drucker', 'Druck verzögert: pausiert', cur.jobName, 'info');
          } catch {
            /* nächster Versuch */
          } finally {
            busy.current = false;
          }
        }
        return;
      }
      // Zeit ist da: Trocknung beenden, dann fortsetzen. Hängt die Trocknung, nach 90 s trotzdem fortsetzen.
      if (!dueSince.current) dueSince.current = now;
      // Trocknung nur beenden, solange der Druck wirklich pausiert ist, und nur einmal erfolgreich
      // (läuft sie danach wieder, hast du sie neu gestartet: nicht noch einmal stoppen)
      if (q.dryMinutesLeft > 0 && !dryStopped.current && st === 'PAUSE' && now - dueSince.current < DRY_STOP_MAX_MS) {
        if (now - lastCmd.current >= CMD_RETRY_MS) {
          lastCmd.current = now;
          busy.current = true;
          try {
            addSystemLog('drucker', 'Trocknung beendet für verzögerten Druck', 'Quelle: Druck verzögern', 'info');
            if (await q.stopDrying()) dryStopped.current = true;
          } finally {
            busy.current = false;
          }
        }
        return; // erst fortsetzen, wenn die Trocknung aus ist (oder 90 s um sind)
      }
      if (q.dryMinutesLeft > 0 && !dryStopped.current && st === 'PAUSE') addSystemLog('drucker', 'Trocknung ließ sich nicht beenden', 'Druck wird trotzdem fortgesetzt (der Drucker beendet die Trocknung beim Start)', 'info');
      if (st === 'PAUSE') {
        if (now - lastCmd.current < CMD_RETRY_MS) return;
        lastCmd.current = now;
        busy.current = true;
        try {
          const res = await printerApi.command('resume');
          if (res.ok && res.data.success) finishResume();
          else failedResume();
        } catch {
          failedResume();
        } finally {
          busy.current = false;
        }
      } else if (st === 'RUNNING' || st === 'PREPARE') {
        finishResume(); // läuft schon (von Hand fortgesetzt)
      }
    };
    const failedResume = () => {
      resumeFails.current += 1;
      if (resumeFails.current === RESUME_FAILS_WARN) {
        const text = `„${getPrintPlan().jobName || 'Druck'}“ ließ sich nicht fortsetzen. Bitte am Drucker oder in der App auf „Fortsetzen“ tippen.`;
        addSystemLog('drucker', 'Verzögerter Druck: Fortsetzen fehlgeschlagen', text, 'error');
        void raiseAlert({ kind: 'info', key: `print-delay-fail-${getPrintPlan().jobId}-${getPrintPlan().resumeAt}`, title: 'Druck nicht fortgesetzt', text, toast: `⚠️ ${text}` }, t => latest.current.notify({ text: t, ok: false }));
      }
    };
    const finishResume = () => {
      dueSince.current = 0;
      dryStopped.current = false;
      resumeFails.current = 0;
      const cur = getPrintPlan();
      const q = latest.current;
      if (cur.dryWasRunning && cur.dryMinLeft > 0) q.restartDryAfterPrint(cur.dryTemp, cur.dryMinLeft);
      const text = `„${cur.jobName || 'Druck'}“ läuft wieder.${cur.dryWasRunning && cur.dryMinLeft > 0 ? ' Die Trocknung geht nach dem Druck mit der Restzeit weiter.' : ''}`;
      addSystemLog('drucker', 'Verzögerter Druck fortgesetzt', text, 'success');
      void raiseAlert({ kind: 'info', key: `print-delay-${cur.jobId}-${cur.resumeAt}`, title: 'Druck fortgesetzt', text, toast: `▶️ ${text}` }, t => latest.current.notify({ text: t, ok: true }));
      setPrintPlan({ state: 'none', resumeAt: 0 });
    };
    const id = setInterval(() => void tick(), TICK_MS);
    void tick();
    return () => clearInterval(id);
  }, [plan.state, plan.jobId, plan.resumeAt]);

  return plan;
}
