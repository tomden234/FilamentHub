import { useEffect, useRef } from 'react';
import { printerApi } from '../../api/printerApi';
import type { Spool } from '../../types/filament';
import { alreadyDeducted, autoDeductSince, bestSpool, isAutoDeductOn, markDone, readDone, recordDeduct, slotFromTask } from '../../utils/printUsage';
import { addSystemLog } from '../../utils/logService';

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
          if (alreadyDeducted(task.title, endAt)) {
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
          recordDeduct(task.title, endAt, 'cloud');
          const parts: string[] = [];
          let n = 0;
          perSpool.forEach((grams, id) => {
            const g = Math.round(grams);
            if (g <= 0) return;
            setTimeout(() => latest.current.onDeductWeight(id, g), n * 300);
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
