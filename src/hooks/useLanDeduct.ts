import { useCallback, useEffect, useRef } from 'react';
import type { Spool } from '../types/filament';
import { readTrays, EXTERNAL_SLOT, baseMaterial, colorDistance, activeSlotFromPrinter } from '../utils/amsMatch';
import { printerApi } from '../api/printerApi';
import { alreadyDeducted, bestSpool, isAutoDeductOn, jobKey, readJobGrams, recordDeduct, rememberJobGrams, PENDING_DEDUCT_KEY, type PendingDeduct } from '../utils/printUsage';
import { mainSlot, type PrintSession } from '../utils/printSession';
import type { PrintEndInfo } from './usePrintWatch';
import { safeStorage } from '../utils/safeStorage';
import { addSystemLog } from '../utils/logService';

// Abzug im LAN-Modus (ohne Bambu Cloud), ausgelöst von usePrintWatch am Ende jedes Drucks:
//  - Ende live gesehen + Gewicht bekannt (Druckdatei per FTPS in der Windows-App oder gemerkt) → automatisch abziehen
//  - Ende verpasst (App war zu) → beim Öffnen fragen „Spule abziehen?“ mit vorgewählter Spule und Gramm
//  - Druck abgebrochen → fragen, Gramm anteilig nach Fortschritt vorgeschlagen
//  - Gewicht unbekannt → nach Gramm fragen
// Spule: der AMS-Slot, der beim Druck am meisten aktiv war (zugewiesene Spule), sonst Material und Farbe.

interface Params {
  enabled: boolean;
  ams: any;
  vtTray: any;
  amsSlots: Record<number, string>;
  spools: Spool[];
  /** Abziehen und dem Druck im Verlauf zuordnen */
  onDeductForPrint: (printId: string, spoolId: string, grams: number) => void;
  notify: (t: { text: string; ok: boolean }) => void;
  onPending: (p: PendingDeduct) => void;
}

const round1 = (g: number) => Math.round(g * 10) / 10;

export function useLanDeduct(p: Params) {
  const latest = useRef(p);
  latest.current = p;

  // Beim App-Start noch offene Frage wieder anzeigen
  useEffect(() => {
    if (!p.enabled) return;
    try {
      const raw = safeStorage.getItem(PENDING_DEDUCT_KEY);
      if (raw) latest.current.onPending(JSON.parse(raw));
    } catch {
      /* kaputter Eintrag */
    }
    // nur einmal beim Aktivieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.enabled]);

  /** Am Druckende aufrufen (von usePrintWatch) */
  // opts.force: auch ohne LAN-Verbindung (Druck aus dem Home-Assistant-Verlauf, Drucker oft schon aus)
  const handleEnd = useCallback((session: PrintSession, info: PrintEndInfo, opts?: { force?: boolean }) => {
    const { enabled, spools, amsSlots, ams, vtTray, notify, onPending } = latest.current;
    if ((!enabled && !opts?.force) || !isAutoDeductOn()) return;
    const endAt = info.endMs || Date.now(); // echtes Druckende (bei nachgetragenen Drucken nicht „jetzt“)
    const name = session.name || 'Druckauftrag';
    const slot = mainSlot(session) ?? activeSlotFromPrinter(ams);

    const trays = readTrays(ams);
    const hw = slot === EXTERNAL_SLOT ? null : trays.find(t => t.slot === slot);
    const material = slot === EXTERNAL_SLOT ? String(vtTray?.tray_type || '') : hw?.type || '';
    const colorHex = (slot === EXTERNAL_SLOT ? '#' + String(vtTray?.tray_color || '888888').slice(0, 6) : hw?.colorHex) || '#888888';
    const assigned = slot ? amsSlots[slot] : '';
    const spoolId = assigned && spools.some(s => s.id === assigned) ? assigned : material ? bestSpool(spools, material, colorHex) : '';
    const failed = info.state === 'FAILED';
    const share = failed ? Math.min(1, Math.max(0, (session.lastPercent || 0) / 100)) : 1;

    const ask = (parts: { spoolId: string; grams: number }[]) => {
      const pending: PendingDeduct = {
        jobName: name,
        slot,
        spoolId,
        material,
        colorHex,
        at: new Date(endAt).toISOString(),
        reason: failed ? 'failed' : info.missed ? 'missed' : 'unknown',
        printId: session.id,
        percent: failed ? Math.round(session.lastPercent || 0) : undefined,
        parts: parts.length ? parts.map(x => ({ spoolId: x.spoolId, grams: round1(x.grams * share) })) : undefined
      };
      safeStorage.setItem(PENDING_DEDUCT_KEY, JSON.stringify(pending));
      onPending(pending);
    };

    const deductNow = (parts: { spoolId: string; grams: number }[], source: string) => {
      // Schon über die Cloud abgezogen (gleicher Druck): nichts doppelt
      if (alreadyDeducted(name, endAt)) {
        addSystemLog('spule', 'Auto-Abzug übersprungen', `${name}: schon abgezogen (Cloud)`, 'info');
        return;
      }
      recordDeduct(name, endAt, 'lan');
      const texts: string[] = [];
      parts.forEach((x, i) => {
        const grams = round1(x.grams);
        // Jedes Mal die neueste Funktion holen: nach dem ersten Abzug hat sich die Spulenliste geändert
        setTimeout(() => latest.current.onDeductForPrint(session.id, x.spoolId, grams), i * 300);
        const sp = spools.find(s => s.id === x.spoolId);
        texts.push(`${grams} g von ${sp ? `${sp.brand} ${sp.name}` : 'Spule'}`);
      });
      notify({ text: `Auto-Abzug „${name}“${source}: ${texts.join(', ')}`, ok: true });
      addSystemLog('spule', `Auto-Abzug (LAN)${source}`, `${name}: ${texts.join(', ')}`, 'success');
    };

    // Gewicht ohne Druckdatei: gemerkt zum Auftragsnamen
    const fallback = () => {
      const known = readJobGrams()[jobKey(name)];
      const parts = known > 0 && spoolId ? [{ spoolId, grams: known }] : [];
      if (parts.length && !info.missed && !failed) return deductNow(parts, '');
      ask(parts);
    };

    // Druckdatei vom Drucker holen (klappt in der Windows-/Server-App). Der Drucker braucht kurz nach Druckende, bis alles bereit ist.
    void (async () => {
      try {
        const res = await printerApi.jobWeights({ jobName: name });
        const fil = res.ok && res.data?.success ? res.data.filaments : undefined;
        if (!fil || fil.length === 0) return fallback();
        const all = [...trays.filter(t => !t.empty), ...(vtTray?.tray_type ? [{ slot: EXTERNAL_SLOT, type: String(vtTray.tray_type), colorHex: '#' + String(vtTray.tray_color || '888888').slice(0, 6) }] : [])];
        // 1.192: Slots, die beim Druck wirklich aktiv waren, zuerst (zwei gleiche Spulen in zwei Slots: die benutzte gewinnt)
        const used = new Set(Object.keys(session.slots || {}).map(Number));
        const usedOnly = all.filter(t => used.has(t.slot));
        const candidates = usedOnly.length ? usedOnly : all;
        const perSpool = new Map<string, number>();
        for (const f of fil) {
          let target = '';
          let bestD = Infinity;
          for (const t of candidates) {
            if (baseMaterial(t.type) !== baseMaterial(f.type)) continue;
            const d = colorDistance(t.colorHex || '#888888', f.colorHex);
            if (d < bestD) {
              bestD = d;
              const a = amsSlots[t.slot];
              target = a && spools.some(x => x.id === a) ? a : '';
            }
          }
          if (!target && fil.length === 1) target = spoolId; // einzige Farbe: aktiver Slot
          if (!target) target = bestSpool(spools, f.type, f.colorHex);
          if (target) perSpool.set(target, (perSpool.get(target) || 0) + f.grams);
        }
        if (perSpool.size === 0) return fallback();
        const parts = Array.from(perSpool, ([id, g]) => ({ spoolId: id, grams: g }));
        if (!failed) rememberJobGrams(name, res.data!.totalGrams || fil.reduce((a, f) => a + f.grams, 0));
        if (info.missed || failed) return ask(parts);
        deductNow(parts, ' (aus Druckdatei)');
      } catch {
        fallback();
      }
    })();
  }, []);

  return { handleEnd };
}
