// Spulen und Verbrauch mit der Cloud (Pi-Server oder Gist) abgleichen. 1.231 aus App.tsx herausgelöst.
// Abgleich mit Drei-Wege-Merge (utils/syncMerge): Änderungen von zwei Geräten und Abzüge vom Pi gehen nicht mehr verloren.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HistoryEntry, Spool } from '../types/filament';
import { cloudSync, type CloudPayload } from '../api';
import { safeStorage } from '../utils/safeStorage';
import { STORAGE_KEY_HISTORY, STORAGE_KEY_SPOOLS, STORAGE_KEY_SPOOLS_AT } from '../utils/storageKeys';
import { mergePrintLog, printLogForCloud, PRINT_LOG_CHANGED } from '../utils/printLog';
import { normalizeSpools } from '../utils/spoolState';
import { addSystemLog } from '../utils/logService';
import { cleanServerDeducts, getAppliedServerDeducts, reconcileServerDeducts, rememberServerDeducts } from '../utils/serverDeducts';
import { canon, loadSyncBase, mergeById, mergeHistory, saveSyncBase } from '../utils/syncMerge';

interface SyncStatus {
  label: string;
  ok: boolean;
}

interface Data {
  spools: Spool[];
  history: HistoryEntry[];
}

const sameData = (a: Data, b: Data) => canon(a.spools) === canon(b.spools) && canon(a.history) === canon(b.history);

export function useCloudSync(o: {
  cloudDbUrl: string;
  spools: Spool[];
  printHistory: HistoryEntry[];
  setSpools: (s: Spool[]) => void;
  setPrintHistory: (h: HistoryEntry[]) => void;
  showToast: (msg: string) => void;
}) {
  const { cloudDbUrl, setSpools, setPrintHistory, showToast } = o;
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ label: 'Gespeichert', ok: true });

  // Neuester Stand (auch direkt nach einer Änderung, bevor React neu gezeichnet hat): der Abgleich darf nie einen alten Stand zurückschreiben
  const latest = useRef<Data>({ spools: o.spools, history: o.printHistory });
  latest.current = { spools: o.spools, history: o.printHistory };
  // 1.231: Sperre als Ref statt State (vorher konnten zwei Aufrufe im selben Moment beide „frei“ sehen) und „nachholen“-Merker
  const busy = useRef(false);
  const pending = useRef(false);
  const urlRef = useRef(cloudDbUrl);
  urlRef.current = cloudDbUrl;

  /** Lokal übernehmen (Zustand + Gerätespeicher) */
  const applyLocal = useCallback(
    (d: Data, stamp?: number) => {
      latest.current = d;
      setSpools(d.spools);
      setPrintHistory(d.history);
      safeStorage.setItem(STORAGE_KEY_SPOOLS, JSON.stringify(d.spools));
      safeStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(d.history));
      if (stamp) safeStorage.setItem(STORAGE_KEY_SPOOLS_AT, String(stamp));
    },
    [setSpools, setPrintHistory]
  );

  /** Server-Abzüge (Pi) genau einmal übernehmen */
  const reconcile = useCallback(
    (d: Data, serverDeducts: unknown): Data => {
      const r = reconcileServerDeducts(d.spools, d.history, cleanServerDeducts(serverDeducts), getAppliedServerDeducts());
      rememberServerDeducts(cleanServerDeducts(serverDeducts), r.applied);
      if (r.changed) {
        addSystemLog('spule', 'Abzug vom Pi-Server übernommen', r.texts.join(', '), 'success');
        showToast(`Pi-Server hat abgezogen: ${r.texts.join(', ')}`);
      }
      return { spools: r.spools, history: r.history };
    },
    [showToast]
  );

  /** Aktuellen lokalen Stand hochladen (mit Abgleich). Gibt zurück, ob gespeichert wurde. */
  const push = useCallback(async (): Promise<boolean> => {
    const url = urlRef.current;
    const sent = latest.current;
    const stamp = Number(safeStorage.getItem(STORAGE_KEY_SPOOLS_AT)) || Date.now();
    const base = loadSyncBase<Spool, HistoryEntry>(url);
    const doc = await cloudSync.saveMerged(
      url,
      { updatedAt: stamp, spools: sent.spools, printHistory: sent.history, ...printLogForCloud() },
      base ? { spools: base.spools, history: base.history } : null
    );
    if (!doc) return false;
    const written: Data = {
      spools: normalizeSpools((Array.isArray(doc.spools) ? doc.spools : sent.spools) as Spool[]),
      history: (Array.isArray(doc.printHistory) ? doc.printHistory : sent.history) as HistoryEntry[]
    };
    saveSyncBase(url, written.spools, written.history);
    const now = latest.current;
    if (now === sent || sameData(now, sent)) {
      // Nichts hier geändert, während gespeichert wurde: Ergebnis (inkl. Änderungen von anderen Geräten) übernehmen
      if (!sameData(written, now)) applyLocal(written);
    } else {
      // Während des Speicherns hier weiter geändert: diese Änderungen auf das Ergebnis setzen und gleich nochmal speichern
      applyLocal({ spools: mergeById(sent.spools, now.spools, written.spools), history: mergeHistory(sent.history, now.history, written.history) });
      pending.current = true;
    }
    return true;
  }, [applyLocal]);

  /** Speicher-Lauf mit Sperre; holt verpasste Speicherungen nach */
  const runPush = useCallback(async () => {
    if (busy.current) {
      pending.current = true;
      return;
    }
    busy.current = true;
    setIsSyncing(true);
    setSyncStatus({ label: 'Speichere...', ok: false });
    try {
      let ok = true;
      do {
        pending.current = false;
        ok = await push().catch(() => false);
      } while (pending.current && ok);
      setSyncStatus(ok ? { label: 'Cloud synchron', ok: true } : { label: 'Lokal gespeichert', ok: false });
    } finally {
      busy.current = false;
      setIsSyncing(false);
    }
  }, [push]);

  // Speichern in LocalStorage und Cloud
  const persistState = useCallback(
    async (newSpools: Spool[], newHistory: HistoryEntry[]) => {
      latest.current = { spools: newSpools, history: newHistory };
      try {
        safeStorage.setItem(STORAGE_KEY_SPOOLS, JSON.stringify(newSpools));
        safeStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
      } catch {
        /* Gerätespeicher voll */
      }
      safeStorage.setItem(STORAGE_KEY_SPOOLS_AT, String(Date.now())); // lokaler Änderungszeitpunkt (Rückfall ohne Basis)
      if (!urlRef.current) return;
      await runPush();
    },
    [runPush]
  );

  // Synchronisation von Cloud laden
  const syncWithCloud = useCallback(
    async (notify = false) => {
      if (busy.current) return;
      const url = urlRef.current;
      busy.current = true;
      setIsSyncing(true);
      let needPush = false;
      try {
        const cloud = await cloudSync.load(url);
        if (!cloud.ok) return;
        const data: CloudPayload & { serverDeducts?: unknown } = cloud.data || {};
        // 1.193: Druckliste immer vereinigen (jedes Gerät sieht alle Drucke, auch die, bei denen es zu war)
        const pl = mergePrintLog(data.printLog, data.printLogRemoved);
        if (pl.localHasMore) void cloudSync.save(url, printLogForCloud()).catch(() => {});
        if (!Array.isArray(data.spools)) {
          needPush = true; // leere Cloud: eigenen Stand hochladen
          return;
        }
        const remote: Data = {
          spools: normalizeSpools(data.spools as Spool[]),
          history: Array.isArray(data.printHistory) ? (data.printHistory as HistoryEntry[]) : []
        };
        const local = latest.current;
        const base = loadSyncBase<Spool, HistoryEntry>(url);
        let merged: Data;
        if (base) {
          // 1.231: Drei-Wege-Abgleich
          merged = { spools: mergeById(base.spools, local.spools, remote.spools), history: mergeHistory(base.history, local.history, remote.history) };
        } else {
          // Noch keine gemeinsame Basis (erster Abgleich mit dieser Adresse): neuerer Stand gewinnt wie bisher
          const cloudAt = Number(data.updatedAt) || 0;
          const localAt = Number(safeStorage.getItem(STORAGE_KEY_SPOOLS_AT)) || 0;
          merged = cloudAt >= localAt ? { spools: remote.spools, history: Array.isArray(data.printHistory) ? remote.history : local.history } : local;
          if (cloudAt >= localAt) safeStorage.setItem(STORAGE_KEY_SPOOLS_AT, String(cloudAt));
        }
        merged = reconcile(merged, data.serverDeducts);
        if (!sameData(merged, local)) applyLocal(merged);
        if (sameData(merged, remote)) {
          saveSyncBase(url, remote.spools, remote.history);
          setSyncStatus({ label: 'Cloud synchron', ok: true });
          if (notify) showToast(base ? 'Schon synchron.' : 'Erfolgreich mit Cloud synchronisiert!');
        } else {
          needPush = true;
        }
      } catch {
        setSyncStatus({ label: 'Lokal aktiv', ok: false });
      } finally {
        busy.current = false;
        setIsSyncing(false);
      }
      if (needPush) {
        await runPush();
        if (notify) showToast('Erfolgreich mit Cloud synchronisiert!');
      }
    },
    [applyLocal, reconcile, runPush, showToast]
  );

  // Laufend abgleichen: alle 60 s, wenn die App wieder sichtbar wird und auf Zuruf (z. B. Cloud gewechselt)
  const syncRef = useRef(syncWithCloud);
  syncRef.current = syncWithCloud;
  useEffect(() => {
    const iv = setInterval(() => void syncRef.current(false), 60000);
    const vis = () => {
      if (document.visibilityState === 'visible') void syncRef.current(false);
    };
    const now = () => void syncRef.current(false);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('filamenthub:sync-now', now);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('filamenthub:sync-now', now);
    };
  }, []);

  // Neuer oder gelöschter Druck: kurz danach in die Cloud (andere Geräte holen ihn beim nächsten Abgleich)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void cloudSync.save(cloudDbUrl, printLogForCloud()).catch(() => {}), 3000);
    };
    window.addEventListener(PRINT_LOG_CHANGED, onChange);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener(PRINT_LOG_CHANGED, onChange);
    };
  }, [cloudDbUrl]);

  return { isSyncing, syncStatus, persistState, syncWithCloud };
}
