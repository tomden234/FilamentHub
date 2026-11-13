import { useState, useEffect } from 'react';
import { safeStorage } from '../../utils/safeStorage';
import { printerApi } from '../../api';
import { addSystemLog } from '../../utils/logService';
import type { BambuPrinterWidgetProps as ParentProps } from '../BambuPrinterWidget';
import { sendToSlot } from '../../utils/slotAssign';
import { paramsFromSpool } from '../../utils/spoolProfile';
import { mismatch, readExternal, readTrays, EXTERNAL_SLOT } from '../../utils/amsMatch';

interface useAmsControlParams {
  spools: ParentProps['spools'];
  liveState: any;
  onApplyDryingCredit: ParentProps['onApplyDryingCredit'];
  setActionToast: any;
  setLiveState: any;
  setActionLoading: any;
}

export function useAmsControl({ spools, liveState, onApplyDryingCredit, setActionToast, setLiveState, setActionLoading }: useAmsControlParams) {
  const [editingAmsSlot, setEditingAmsSlot] = useState<number | null>(null);

  const [amsEditColor, setAmsEditColor] = useState<string>('898989');

  const [amsEditMaterial, setAmsEditMaterial] = useState<string>('PLA');

  const [amsEditMinTemp, setAmsEditMinTemp] = useState<number>(190);

  const [amsEditMaxTemp, setAmsEditMaxTemp] = useState<number>(240);

  const [amsDryHours, setAmsDryHours] = useState<number>(6);

  const [amsDryTemp, setAmsDryTemp] = useState<number>(50);

  const [dryLoading, setDryLoading] = useState<boolean>(false);

  const [localDrying, setLocalDrying] = useState<{
    isDrying: boolean;
    startTimestamp: number;
    durationHours: number;
    targetTemp: number;
  }>(() => {
    try {
      const raw = safeStorage.getItem('filamenthub_ams_drying_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.isDrying) {
          const elapsedMs = Date.now() - (parsed.startTimestamp || 0);
          const totalMs = (parsed.durationHours || 4) * 3600 * 1000;
          if (elapsedMs < totalMs) return parsed;
        }
      }
    } catch {}
    return { isDrying: false, startTimestamp: 0, durationHours: 4, targetTemp: 50 };
  });

  const [, setDryingTicker] = useState<number>(0);

  useEffect(() => {
    if (!localDrying.isDrying) return;
    const interval = setInterval(() => setDryingTicker(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [localDrying.isDrying]);

  // Slot-Zuweisung (Slot 1-4 → Spulen-ID). Früher waren hier Demo-Spulen fest eingetragen, die falsche Farben zeigten:
  // steht noch genau diese Demo-Belegung drin, wird sie geleert. Richtig belegen: „Mit Drucker synchronisieren".
  const [amsSlots, setAmsSlots] = useState<Record<number, string>>(() => {
    const demo = JSON.stringify({ 1: 'sp-3', 2: 'sp-18', 3: 'sp-9', 4: 'sp-1' });
    try {
      const raw = safeStorage.getItem('filamenthub_ams_slots_x2d');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (JSON.stringify(parsed) === demo) {
          safeStorage.setItem('filamenthub_ams_slots_x2d', '{}');
          return {};
        }
        return parsed && typeof parsed === 'object' ? parsed : {};
      }
    } catch {}
    return {};
  });

  // Alle Spulen entfernt: Slot-Zuordnung leeren (sie zeigt sonst auf gelöschte Spulen)
  useEffect(() => {
    const clear = () => setAmsSlots({});
    window.addEventListener('filamenthub:spools-cleared', clear);
    return () => window.removeEventListener('filamenthub:spools-cleared', clear);
  }, []);

  // Geräte-Sync hat die Slot-Zuordnung von einem anderen Gerät übernommen: sofort anzeigen (ohne Neuladen)
  useEffect(() => {
    const reload = () => {
      try {
        const parsed = JSON.parse(safeStorage.getItem('filamenthub_ams_slots_x2d') || '{}');
        if (parsed && typeof parsed === 'object') {
          setAmsSlots(prev => (JSON.stringify(prev) === JSON.stringify(parsed) ? prev : parsed));
        }
      } catch {
        /* kaputter Eintrag: alten Stand behalten */
      }
    };
    window.addEventListener('filamenthub:device-synced', reload);
    return () => window.removeEventListener('filamenthub:device-synced', reload);
  }, []);

  const [activeSlot, setActiveSlot] = useState<number>(() => {
    return Number(safeStorage.getItem('filamenthub_ams_active_slot_x2d') || 1);
  });

  const handleSetAmsSlot = (slotIdx: number, spoolId: string) => {
    const updated = { ...amsSlots, [slotIdx]: spoolId };
    setAmsSlots(updated);
    safeStorage.setItem('filamenthub_ams_slots_x2d', JSON.stringify(updated));
    // Neue Zuordnung gleich an die anderen Geräte (PC, Handy) weitergeben, nicht erst beim nächsten Abgleich
    window.dispatchEvent(new CustomEvent('filamenthub:sync-now'));

    if (spoolId) {
      const spool = spools.find(s => s.id === spoolId);
      // 1.195: Spule am Drucker setzen – für Slot 1-4 UND Extern. Früher nur Extern: der Drucker behielt bei Slot 1-4
      // die alten Werte und „Mit Drucker synchronisieren“ holte die falsche Spule zurück.
      if (spool && liveState?.connected) {
        const hw = slotIdx === EXTERNAL_SLOT ? readExternal(liveState.data?.vt_tray) : readTrays(liveState.data?.ams).find(t => t.slot === slotIdx);
        const name = slotIdx === EXTERNAL_SLOT ? 'Extern' : `Slot ${slotIdx}`;
        if (slotIdx !== EXTERNAL_SLOT && hw?.rfid) {
          setActionToast({ text: `${name}: Bambu-Spule mit Chip, der Drucker liest sie selbst. Nur in der App zugewiesen.`, ok: true });
        } else if (slotIdx !== EXTERNAL_SLOT && hw?.empty) {
          setActionToast({ text: `${name} ist laut Drucker leer. Erst Filament einlegen, dann nochmal wählen.`, ok: false });
        } else if (!hw || hw.empty || mismatch(spool, hw)) {
          setActionToast({ text: `🧵 ${name}: sende an den Drucker … (kann bis 10 s dauern)`, ok: true });
          void sendToSlot(slotIdx, paramsFromSpool(spool)).then(r => {
            setActionToast({ text: r.confirmed ? `🧵 ${r.text}` : `${name}: ${r.text}`, ok: r.confirmed });
            if (r.confirmed) void printerApi.refresh().then(() => printerApi.status()).then(res => {
              if (res.ok && res.data?.data) setLiveState(res.data);
            }).catch(() => {});
          });
        }
      }
      if (spool) {
        // Prüfen, ob für das AMS eine Trocknungszeit vorliegt
        const amsData = liveState.data.ams?.ams?.[0];
        const drySetting = amsData?.dry_setting;
        // Trocknung nur anrechnen, wenn der AMS wirklich gerade trocknet (früher wurden bei jeder Zuweisung 4 h gutgeschrieben)
        const detectedDryHours = (drySetting && drySetting.dry_duration > 0)
          ? drySetting.dry_duration
          : localDrying.isDrying
          ? amsDryHours
          : 0;

        if (detectedDryHours && detectedDryHours > 0) {
          onApplyDryingCredit?.(spoolId, detectedDryHours, amsDryTemp);
          setActionToast({
            text: `☀️ ${spool.name} in AMS Slot ${slotIdx} zugewiesen: ${detectedDryHours}h Trocknung anteilig auf Trockenstand angerechnet!`,
            ok: true
          });
        }
      }
    }
  };

  const handleSetActiveSlot = (slotIdx: number) => {
    setActiveSlot(slotIdx);
    safeStorage.setItem('filamenthub_ams_active_slot_x2d', String(slotIdx));
  };

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleRefreshLiveState = async () => {
    setIsRefreshing(true);
    try {
      // Nicht verbunden: erst neu verbinden, sonst nur den vollen Stand anfordern
      if (!liveState.connected) {
        const r = await printerApi.reconnect();
        if (r.data?.message) setActionToast({ text: r.data.message, ok: Boolean(r.data.success) });
      }
      await printerApi.refresh();
      const res = await printerApi.status();
      if (res.ok && res.data?.data) {
        setLiveState(res.data);
      }
    } catch {}
    finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleSaveAmsSlotToPrinter = async () => {
    if (editingAmsSlot === null) return;
    setActionLoading(`ams_${editingAmsSlot}`);
    try {
      const res = await printerApi.amsFilament({
        slotIdx: editingAmsSlot,
        colorHex: amsEditColor,
        material: amsEditMaterial,
        minTemp: amsEditMinTemp,
        maxTemp: amsEditMaxTemp
      });
      const data = res.data;
      if (res.ok && data.success) {
        setActionToast({ text: data.message, ok: true });
        setEditingAmsSlot(null);
        handleRefreshLiveState();
      } else {
        setActionToast({
          text: data.error || 'AMS-Befehl abgelehnt. Bitte Entwickler-Modus am Drucker aktivieren!',
          ok: false
        });
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Übertragen der AMS-Spule.', ok: false });
    } finally {
      setActionLoading(null);
    }
  };

  /** Trocknung starten/stoppen. override = Dauer/Temperatur von außen (z. B. „Nach Druck trocknen“). Gibt zurück, ob der Drucker es angenommen hat. */
  const handleToggleAmsDrying = async (start: boolean, override?: { hours: number; temp: number }): Promise<boolean> => {
    const dryHours = override?.hours ?? amsDryHours;
    const dryTemp = override?.temp ?? amsDryTemp;
    setDryLoading(true);
    const nextDrying = {
      isDrying: start,
      startTimestamp: start ? Date.now() : 0,
      durationHours: start ? dryHours : 0,
      targetTemp: start ? dryTemp : 50
    };

    const revertDrying = () => {
      const off = { isDrying: false, startTimestamp: 0, durationHours: 0, targetTemp: 50 };
      setLocalDrying(off);
      safeStorage.setItem('filamenthub_ams_drying_state', JSON.stringify(off));
      window.dispatchEvent(new CustomEvent('filamenthub_drying_update', { detail: off }));
    };

    try {
      const res = await printerApi.amsDrying({
        amsId: 0,
        mode: start ? 1 : 0,
        duration: dryHours,
        temp: dryTemp
      });
      const data = res.data;
      if (res.ok && data.success) {
        setLocalDrying(nextDrying);
        safeStorage.setItem('filamenthub_ams_drying_state', JSON.stringify(nextDrying));
        window.dispatchEvent(new CustomEvent('filamenthub_drying_update', { detail: nextDrying }));
        setActionToast({ text: data.message, ok: true });
        handleRefreshLiveState();
        if (start) {
          const credited: string[] = [];
          [1, 2, 3, 4].forEach(slotIdx => {
            const sid = amsSlots[slotIdx];
            if (sid) {
              const sp = spools.find(s => s.id === sid);
              if (sp) {
                onApplyDryingCredit?.(sid, dryHours, dryTemp);
                credited.push(`${sp.name} (Slot ${slotIdx})`);
              }
            }
          });
          if (credited.length > 0) {
            addSystemLog('spule', `☀️ AMS Trocknung (${dryHours}h @ ${dryTemp}°C) automatisch gutgeschrieben auf: ${credited.join(', ')}`, 'AMS Trocknung', 'success');
          } else {
            addSystemLog('drucker', `AMS Trocknung gestartet (${dryHours}h @ ${dryTemp}°C)`, 'Bambu AMS', 'info');
          }
        } else {
          addSystemLog('drucker', 'AMS Trocknung gestoppt', 'Bambu AMS', 'info');
        }
        return true;
      } else {
        revertDrying();
        addSystemLog('drucker', 'AMS Trocknung nicht bestätigt', String(data?.error || ''), 'error');
        setActionToast({ text: data?.error || 'Trocknung wurde vom Drucker/AMS nicht angenommen. Verbindung und Entwickler-Modus prüfen.', ok: false });
        return false;
      }
    } catch {
      revertDrying();
      setActionToast({ text: 'Verbindungsfehler: Trocknung nicht gesendet.', ok: false });
      return false;
    } finally {
      setDryLoading(false);
    }
  };

  return { handleRefreshLiveState, localDrying, amsDryHours, isRefreshing, setAmsSlots, activeSlot, amsSlots, handleSetActiveSlot, setEditingAmsSlot, setAmsEditColor, setAmsEditMaterial, handleSetAmsSlot, amsDryTemp, setAmsDryHours, setAmsDryTemp, handleToggleAmsDrying, dryLoading, editingAmsSlot, amsEditColor, setAmsEditMinTemp, setAmsEditMaxTemp, amsEditMaterial, amsEditMinTemp, amsEditMaxTemp, handleSaveAmsSlotToPrinter };
}
