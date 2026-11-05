import { useEffect, useRef } from 'react';
import { printerApi } from '../../api/printerApi';
import type { Spool } from '../../types/filament';
import { alreadyDeducted, autoDeductSince, bestSpool, isAutoDeductOn, markDone, readDone, recordDeduct, slotFromTask } from '../../utils/printUsage';
import { addSystemLog } from '../../utils/logService';
import { addPrintRecord, addPrintUsage, findPrint } from '../../utils/printLog';
import { hubDeductActive, printAlreadyDeducted } from '../../utils/serverDeducts';

// Zieht den Verbrauch fertiger Drucke automatisch von der Spule ab.
// Auslöser: Druck wird fertig, App startet, App kommt in den Vordergrund. Es werden nur Aufträge genommen, die nach dem
// Einschalten fertig wurden und noch nicht abgezogen sind (so wird nie doppelt abgezogen, auch wenn die App zu war).
// Zuordnung: AMS-Slot → zugewiesene Spule, sonst Material und Farbe.

interface Params {
  spools: Spool[];
  amsSlots: Record<number, string>;
  onDeductWeight: (spoolId: string, grams: number) => void;
  isConnected: boolean;
  gcodeState: string;
  notify: (t: { text: string; ok: boolean }) => void;
}

export function useAutoDeduct({ spools, amsSlots, onDeductWeight, isConnected, gcodeState, notify }: Params) {
  const latest = useRef({ spools, amsSlots, onDeductWeight, notify });
  latest.current = { spools, amsSlots, onDeductWeight, notify };
  const running = useRef(false);
  const prevState = useRef(gcodeState);

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;

    const run = async () => {
      if (running.current || !isAutoDeductOn()) return;
      running.current = true;
      try {
        const since = autoDeductSince();
        const res = await printerApi.tasks(10);
        if (!res.ok || !res.data?.tasks) return;
        // 1.193: Druckliste aus der Bambu Cloud ergänzen (Drucke, während keine App lief)
        for (const t of res.data.tasks) {
          if (t.status !== 2 && t.status !== 3) continue;
          const endMs = new Date(t.endTime || t.startTime).getTime();
          const startMs = new Date(t.startTime).getTime();
          const name = t.jobName || t.title;
          if (!Number.isFinite(endMs) || findPrint(name, endMs)) continue;
          addPrintRecord({
            id: `cloud-${t.id}`,
            name,
            startMs: Number.isFinite(startMs) ? startMs : endMs,
            endMs,
            state: t.status === 2 ? 'FINISH' : 'FAILED',
            missed: true,
            percent: t.status === 2 ? 100 : 0,
            durationMin: Math.round((t.costTime || 0) / 60)
          });
        }
        const done = readDone();
        const open = res.data.tasks
          .filter(t => t.status === 2 && t.filaments.length > 0 && !done.includes(t.id))
          .filter(t => {
            const end = new Date(t.endTime || t.startTime).getTime();
            return Number.isFinite(end) && end > since;
          })
          .reverse(); // älteste zuerst
        for (const task of open) {
          if (cancelled) return;
          const { spools: sp, amsSlots: slots, notify: toast } = latest.current;
          const endAt = new Date(task.endTime || task.startTime).getTime();
          // Schon über den LAN-Weg abgezogen (gleicher Druck): nur merken, nicht noch einmal abziehen
          const jobName = task.jobName || task.title;
          if (hubDeductActive() || alreadyDeducted(jobName, endAt) || alreadyDeducted(task.title, endAt) || printAlreadyDeducted(undefined, jobName, endAt)) {
            markDone([task.id]);
            continue;
          }
          const perSpool = new Map<string, number>();
          for (const f of task.filaments) {
            // Slot laut Drucker: 1-4 = erstes AMS, 5 = externe Spule. Andere AMS-Einheiten: nur über Material/Farbe.
            const slot = slotFromTask(f.slot);
            const assigned = slot ? slots[slot] : undefined;
            const id = assigned && sp.some(s => s.id === assigned) ? assigned : bestSpool(sp, f.material, f.colorHex);
            if (id && f.grams > 0) perSpool.set(id, (perSpool.get(id) || 0) + f.grams);
          }
          markDone([task.id]); // zuerst merken, damit nichts doppelt abgezogen wird
          recordDeduct(jobName, endAt, 'cloud');
          const recordId = findPrint(jobName, endAt)?.id;
          const parts: string[] = [];
          let n = 0;
          perSpool.forEach((grams, id) => {
            const g = Math.round(grams);
            if (g <= 0) return;
            setTimeout(() => latest.current.onDeductWeight(id, g), n * 300);
            addPrintUsage(recordId, sp.find(x => x.id === id), g);
            n++;
            const s = sp.find(x => x.id === id);
            parts.push(`${g} g von ${s ? `${s.brand} ${s.name}` : 'Spule'}`);
          });
          if (parts.length) {
            toast({ text: `Auto-Abzug „${task.title}“: ${parts.join(', ')}`, ok: true });
            addSystemLog('spule', 'Auto-Abzug (Cloud)', `${task.title}: ${parts.join(', ')}`, 'success');
          }
          // Abzüge nacheinander lassen (jeder braucht den neuen Spulenstand)
          await new Promise(r => setTimeout(r, Math.max(1, n) * 300 + 200));
        }
      } catch {
        // offline oder Cloud nicht erreichbar: nächster Auslöser versucht es erneut
      } finally {
        running.current = false;
      }
    };

    // Beim Start und wenn die App wieder sichtbar wird (nachholen, was in der Zwischenzeit fertig wurde)
    const first = setTimeout(run, 4000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);

    // Druck gerade fertig geworden: Bambu braucht etwas, bis der Auftrag in der Cloud steht, daher mehrere Versuche
    const timers: ReturnType<typeof setTimeout>[] = [];
    const was = prevState.current;
    prevState.current = gcodeState;
    if (was === 'RUNNING' && (gcodeState === 'FINISH' || gcodeState === 'IDLE')) {
      [15000, 60000, 180000].forEach(ms => timers.push(setTimeout(run, ms)));
    }

    return () => {
      cancelled = true;
      clearTimeout(first);
      timers.forEach(clearTimeout);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isConnected, gcodeState]);
}
