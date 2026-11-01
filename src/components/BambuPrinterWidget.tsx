import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import QRCode from 'qrcode';
import {
  Clock,
  ChevronDown,
  ChevronUp,
  Settings,
  RefreshCw,
  QrCode,
  X,
  Camera,
  Lightbulb,
  FileCode,
  Printer,
  History,
  Nfc,
  Power,
  Plug,
  Home
} from 'lucide-react';
import { Spool, ViewMode } from '../types/filament';
import type { BambuLiveState } from '../types/bambu';
import { printerApi } from '../api';
import { safeStorage } from '../utils/safeStorage';
import { ThreeDPrinterIcon } from './ThreeDPrinterIcon';
import { addSystemLog } from '../utils/logService';
import { IS_STATIC, IS_NATIVE } from '../utils/env';
import { PrinterCameraPanel } from './bambu/PrinterCameraPanel';
import { TemperatureModal } from './bambu/TemperatureModal';
import { GcodeUploadModal } from './bambu/GcodeUploadModal';
import { AmsSlotEditModal } from './bambu/AmsSlotEditModal';
import { StopPinModal } from './bambu/StopPinModal';
import { PrinterExpandedPanel } from './bambu/PrinterExpandedPanel';
import { fetchHaCameraBlobUrl } from '../utils/haClient';
import { useAmsControl } from './bambu/useAmsControl';
import { useHaSwitch } from './bambu/useHaSwitch';
import { useGcodeUpload } from './bambu/useGcodeUpload';
import { PrintUsageModal } from './bambu/PrintUsageModal';
import { NfcSlotModal } from './bambu/NfcSlotModal';
import { OPEN_SLOT_ASSIGN_EVENT } from '../utils/uiEvents';
import { useAutoDeduct } from './bambu/useAutoDeduct';
import { readTrays, activeSlotFromPrinter } from '../utils/amsMatch';
import { usePrinterAlerts } from '../hooks/usePrinterAlerts';
import { setPrinterLive, type PrinterLevel } from '../utils/printerLive';
import { useLanDeduct } from '../hooks/useLanDeduct';
import { usePrintWatch } from '../hooks/usePrintWatch';
import { useAutoPowerOff } from '../hooks/useAutoPowerOff';
import { useDryAutoOff } from '../hooks/useDryAutoOff';
import { useDryLightOff } from '../hooks/useDryLightOff';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { amsHumidityPercent } from '../utils/humidity';
import { useWorkshopSettings } from '../utils/workshopSettings';
import { armAutoOff, disarmAutoOff } from '../utils/autoPowerOff';
import { alertPrintEnd, alertPrintStart } from '../utils/printAlerts';
import { ACTIVE_STATES } from '../utils/printSession';
import { checkPrintStart } from '../utils/printChecks';
import { getWorkshopSettings } from '../utils/workshopSettings';
import { useHmsAlerts } from '../hooks/useHmsAlerts';
import { useHumidityAlarm } from '../hooks/useHumidityAlarm';
import { useDryAfterPrint } from '../hooks/useDryAfterPrint';
import { DrySuggestSheet } from './bambu/DrySuggestSheet';
import { armDryPlan, disarmDryPlan, dryPlanFor, needsDryingNow } from '../utils/dryAfterPrint';
import { setHaAutoOff } from '../utils/haAutoOff';
import { installHaDryOff, setHaDryOff } from '../utils/haDryOff';
import { installStatusLed, setStatusLed } from '../utils/statusLed';
import { usePrintPlanRunner } from '../hooks/usePrintPlan';
import { clearPrintPlan, setPrintPlan, clockText } from '../utils/printPlan';
import { PrintPlanSheet } from './bambu/PrintPlanSheet';
import { addPrintRecord, addPrintUsage, capturePrintPhoto } from '../utils/printLog';
import { useAmsNfcReaders } from '../hooks/useAmsNfcReaders';
import { useBambuRfid } from '../hooks/useBambuRfid';
import { BambuSpoolSheet } from './bambu/BambuSpoolSheet';
import { spoolFromBambu } from '../utils/bambuTray';
import { LanDeductPrompt } from './bambu/LanDeductPrompt';
import type { PendingDeduct } from '../utils/printUsage';

const BambuSettingsModal = lazy(() => import('./BambuSettingsModal').then(m => ({ default: m.BambuSettingsModal })));

export interface BambuPrinterWidgetProps {
  spools: Spool[];
  onDeductWeight: (spoolId: string, grams: number) => void;
  /** Formular „Neue Spule“ öffnen, optional vorbefüllt (z. B. aus einem Bambu-Chip) */
  onOpenNewSpool: (prefill?: Partial<Spool>) => void;
  onApplyDryingCredit?: (spoolId: string, driedHours: number, dryTemp?: number) => void;
  viewMode?: ViewMode;
  /** Handy-Ansicht: ohne Druckauftrag-Kasten und Temperaturen */
  compact?: boolean;
}

export type { BambuLiveState };

const DEFAULT_LIVE_STATE: BambuLiveState = {
  connected: false,
  connecting: false,
  error: null,
  serialNumber: '',
  userId: '',
  brokerHost: 'us.mqtt.bambulab.com',
  hasAdminPin: true,
  hasToken: false,
  retryInSec: null,
  lastUpdated: null,
  data: {
    gcode_state: 'IDLE',
    subtask_name: '',
    gcode_file: '',
    mc_percent: 0,
    mc_remaining_time: 0,
    layer_num: 0,
    total_layer_num: 0,
    bed_temper: 0,
    bed_target_temper: 0,
    chamber_temper: 0,
    nozzle_temper: 0,
    nozzle_target_temper: 0,
    nozzle2_temper: 0,
    nozzle2_target_temper: 0,
    fan_gear: 0,
    spd_mag: 100,
    ams: null,
    vt_tray: null,
    lights_report: [{ node: 'chamber_light', mode: 'off' }]
  },
  formatted: {
    remainingTimeStr: '--',
    etaClockStr: '--:-- Uhr',
    statusText: 'Ausgeschaltet (Stromlos)',
    statusColor: '#64748b'
  }
};

/** Pro App-Start wird die Home-Assistant-Automation „Nach Trocknen aus“ einmal automatisch geprüft */
let haDryOffCheckedThisStart = false;
/** Dasselbe für die Status-LED-Automation */
let statusLedCheckedThisStart = false;

export const BambuPrinterWidget: React.FC<BambuPrinterWidgetProps> = ({
  spools,
  onDeductWeight,
  onOpenNewSpool,
  onApplyDryingCredit,
  viewMode,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => viewMode !== 'simple');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [liveState, setLiveState] = useState<BambuLiveState>(DEFAULT_LIVE_STATE);

  // Klappe für Live-Kamera
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraSnapshotKey, setCameraSnapshotKey] = useState<number>(Date.now());

  // Steuerung & Admin-PIN Modal
  const [showStopPinModal, setShowStopPinModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<{ text: string; ok: boolean } | null>(null);

  // Temperatur-Einstellungsmodal bei Klick auf Hotend / Bett
  const [tempModalTarget, setTempModalTarget] = useState<'nozzle1' | 'nozzle2' | 'bed' | null>(null);
  const [tempModalValue, setTempModalValue] = useState<string>('210');

  // G-Code Upload Modal

  // AMS Spulen-Editor
  const { handleRefreshLiveState, localDrying, amsDryHours, isRefreshing, setAmsSlots, activeSlot, amsSlots, handleSetActiveSlot, setEditingAmsSlot, setAmsEditColor, setAmsEditMaterial, handleSetAmsSlot, amsDryTemp, setAmsDryHours, setAmsDryTemp, handleToggleAmsDrying, dryLoading, editingAmsSlot, amsEditColor, setAmsEditMinTemp, setAmsEditMaxTemp, amsEditMaterial, amsEditMinTemp, amsEditMaxTemp, handleSaveAmsSlotToPrinter } = useAmsControl({ spools, liveState, onApplyDryingCredit, setActionToast, setLiveState, setActionLoading });

  // AMS Trocknung

  // Lokaler Trocknungs-Zustand mit Zeitstempel & Restzeit-Berechnung

  // Ticker für Live-Countdown

  // Inline Live-Temperatur Eingabefelder
  const [inlineNozzle1Temp, setInlineNozzle1Temp] = useState<string>('210');
  const [inlineNozzle2Temp, setInlineNozzle2Temp] = useState<string>('210');
  const [inlineBedTemp, setInlineBedTemp] = useState<string>('55');

  // Lokale IP & Kamera
  const [printerLocalIp] = useState<string>(() => safeStorage.getItem('bambu_local_ip') || '');


  // Dynamischer QR-Code
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  // Home Assistant & Steckdosen State (Unified haClient)
  // Auto-Abzug braucht nur den Cloud-Login (Aufträge kommen aus der Bambu Cloud), nicht die Live-Verbindung
  // NFC-Leser im AMS (ESPHome über Home Assistant): Spule ↔ Slot automatisch
  const nfcReaders = useAmsNfcReaders({
    spools,
    amsSlots,
    handleSetAmsSlot,
    ams: liveState.data.ams,
    printerConnected: Boolean(liveState.connected),
    notify: setActionToast
  });
  // Bambu-Spulen über den RFID-Chip, den das AMS selbst liest (kein eigener Tag nötig)
  const bambuRfid = useBambuRfid({
    ams: liveState.data.ams,
    connected: Boolean(liveState.connected && liveState.receivingData !== false),
    spools,
    amsSlots,
    handleSetAmsSlot,
    notify: setActionToast
  });
  // Frage „Neue Bambu-Spule erkannt“: in dieser Sitzung ausgeblendete Kennungen (z. B. während „Neue Spule“ offen ist)
  const [bambuHidden, setBambuHidden] = useState<string[]>([]);
  const bambuOpen = bambuRfid.unknown.filter(b => !bambuHidden.includes(b.rfid));
  const handleSetAmsSlotNfc = (slot: number, spoolId: string) => {
    nfcReaders.learn(slot, spoolId); // unbekannten Tag in diesem Slot mit der gewählten Spule verknüpfen
    bambuRfid.learn(slot, spoolId); // Bambu-Spule (RFID vom AMS) ebenso
    handleSetAmsSlot(slot, spoolId);
  };
  const nfcInfo = { readers: Object.keys(nfcReaders.entities).length, unknown: Object.keys(nfcReaders.unknown).map(Number) };

  useAutoDeduct({ spools, amsSlots, onDeductWeight, isConnected: Boolean(liveState.connected || liveState.hasToken), gcodeState: liveState.data.gcode_state, notify: setActionToast });

  // LAN-Modus: kein Cloud-Auftrag mit Gewicht → gemerktes Gewicht je Auftrag oder kurze Frage nach dem Druck
  const [pendingDeduct, setPendingDeduct] = useState<PendingDeduct | null>(null);
  // Abziehen und im Druck-Verlauf dem Druck zuordnen (Verbrauch, Kosten)
  const spoolsRef = useRef(spools);
  spoolsRef.current = spools;
  const deductForPrint = (printId: string | undefined, spoolId: string, grams: number) => {
    addPrintUsage(printId, spoolsRef.current.find(s => s.id === spoolId), grams);
    onDeductWeight(spoolId, grams);
  };
  // Immer die neueste Version (mehrere Abzüge hintereinander dürfen sich nicht gegenseitig überschreiben)
  const deductRef = useRef(deductForPrint);
  deductRef.current = deductForPrint;
  const lanDeduct = useLanDeduct({
    enabled: Boolean(liveState.lanMode),
    ams: liveState.data.ams,
    vtTray: liveState.data.vt_tray,
    amsSlots,
    spools,
    onDeductForPrint: deductForPrint,
    notify: setActionToast,
    onPending: setPendingDeduct
  });

  // Aktuelle Daten für verzögerte Prüfungen (Spulen-Check kurz nach dem Start)
  const liveRef = useRef({ liveState, amsSlots });
  liveRef.current = { liveState, amsSlots };

  // Jeden Druck verfolgen, egal wo gestartet (Studio, Handy, Display). Auch Start/Ende, während die App zu war.
  const printToast = (text: string) => setActionToast({ text, ok: true });
  usePrintWatch({
    connected: Boolean(liveState.connected && liveState.receivingData !== false),
    gcodeState: liveState.data.gcode_state,
    jobName: liveState.data.subtask_name,
    startTime: liveState.data.gcode_start_time,
    percent: Number(liveState.data.mc_percent) || 0,
    ams: liveState.data.ams,
    onStart: session => {
      alertPrintStart(session, {
        spools,
        activeSlot: activeSlotFromPrinter(liveState.data.ams),
        percent: Number(liveState.data.mc_percent) || 0,
        remainingMin: Number(liveState.data.mc_remaining_time) || 0,
        etaText: liveState.formatted.etaClockStr,
        showToast: printToast
      });
      // Spulen- und Material-Check: beim Start kurz warten, bis der Drucker den aktiven Slot meldet
      if (getWorkshopSettings().alertPrintCheck) {
        setTimeout(
          () => {
            const { liveState: ls, amsSlots: slots } = liveRef.current;
            void checkPrintStart(session, { spools: spoolsRef.current, amsSlots: slots, ams: ls.data.ams, vtTray: ls.data.vt_tray, percent: Number(ls.data.mc_percent) || 0, showToast: printToast });
          },
          session.midway ? 3000 : 90_000
        );
      }
    },
    onEnd: (session, info) => {
      const end = Date.now();
      const begin = session.startMs || (session.midway ? 0 : session.seenAt);
      addPrintRecord({
        id: session.id,
        name: session.name || 'Druckauftrag',
        startMs: begin,
        endMs: end,
        state: info.state,
        missed: info.missed,
        percent: info.state === 'FINISH' ? 100 : Math.round(session.lastPercent || 0),
        durationMin: begin && !info.missed ? Math.round((end - begin) / 60000) : 0
      });
      void capturePrintPhoto(session.id);
      alertPrintEnd(session, info, { spools, showToast: printToast });
      lanDeduct.handleEnd(session, info);
    }
  });

  // Fehler des Druckers (HMS) als Klartext aufs Handy
  useHmsAlerts({
    connected: Boolean(liveState.connected && liveState.receivingData !== false),
    gcodeState: liveState.data.gcode_state,
    hms: liveState.data.hms,
    printError: liveState.data.print_error,
    jobName: liveState.data.subtask_name,
    showToast: (text: string) => setActionToast({ text, ok: false })
  });

  // „Neu verbinden"
  const [reconnecting, setReconnecting] = useState(false);
  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const res = await printerApi.reconnect();
      if (res.data?.status?.data) setLiveState(res.data.status);
      const okConn = Boolean(res.data?.success);
      setActionToast({ text: res.data?.message || (okConn ? 'Drucker verbunden.' : 'Verbindung fehlgeschlagen.'), ok: okConn });
    } catch {
      setActionToast({ text: 'Verbindung fehlgeschlagen.', ok: false });
    } finally {
      setReconnecting(false);
    }
  };
  const { setHaCameraBlobUrl, haCreds, haSwitchState, handleToggleSwitch: rawToggleSwitch, haSwitchLoading, handleFetchSwitchStatus, haCameraBlobUrl } = useHaSwitch({ setActionToast });

  // „Nach dem Druck ausschalten“ (Steckdose über Home Assistant, 3 Minuten nach Druckende)
  const printActive = Boolean(liveState.connected && liveState.receivingData !== false && ACTIVE_STATES.has(liveState.data.gcode_state));
  const dryLeftNow = liveState.connected ? Number(liveState.data.ams?.ams?.[0]?.dry_time) || 0 : 0;

  // Trocknen-Vorschlag beim Einlegen + „Nach Druck trocknen“
  const dryAfter = useDryAfterPrint({
    connected: Boolean(liveState.connected && liveState.receivingData !== false),
    gcodeState: liveState.data.gcode_state,
    amsSlots,
    spools,
    startDrying: o => handleToggleAmsDrying(true, o),
    notify: setActionToast
  });
  const amsSpools = () => [1, 2, 3, 4].map(sl => spools.find(s => s.id === amsSlots[sl])).filter(Boolean) as Spool[];
  const handleToggleDryAfter = () => {
    if (dryAfter.plan.armed) {
      disarmDryPlan();
      setActionToast({ text: 'Keine Trocknung nach dem Druck.', ok: true });
      return;
    }
    if (autoOff.armed) {
      setActionToast({ text: '„Nach Druck aus“ ist gewählt und gewinnt. Erst abwählen, dann trocknen.', ok: false });
      return;
    }
    const inAms = amsSpools();
    if (!inAms.length) {
      setActionToast({ text: 'Erst Spulen den AMS-Slots zuordnen.', ok: false });
      return;
    }
    const due = inAms.filter(needsDryingNow);
    const plan = dryPlanFor(due.length ? due : inAms, inAms);
    armDryPlan({ ...plan, spoolIds: (due.length ? due : inAms).map(s => s.id) }, printActive);
    setActionToast({ text: `Nach dem Druck wird getrocknet (${plan.temp} °C, ${plan.hours} h).`, ok: true });
  };

  const autoOff = useAutoPowerOff({
    drying: dryLeftNow > 0, // Aus nach Druck ist stärker als Trocknen: Trocknung wird beendet
    stopDrying: () => handleToggleAmsDrying(false),
    connected: Boolean(liveState.connected && liveState.receivingData !== false),
    gcodeState: liveState.data.gcode_state,
    jobName: liveState.data.subtask_name,
    nozzleTemps: [Number(liveState.data.nozzle_temper), Number(liveState.data.nozzle2_temper)],
    switchState: haSwitchState.state,
    refreshSwitch: () => void handleFetchSwitchStatus(),
    notify: setActionToast
  });
  // „Nach Trocknen ausschalten“: Steckdose aus, wenn die AMS-Trocknung fertig ist und kein Druck läuft
  const dryOffState = useDryAutoOff({
    connected: Boolean(liveState.connected && liveState.receivingData !== false),
    gcodeState: liveState.data.gcode_state,
    drying: dryLeftNow > 0,
    switchState: haSwitchState.state,
    busy: (liveState.data.nozzle_target_temper || 0) > 0 || (liveState.data.nozzle2_target_temper || 0) > 0 || (liveState.data.bed_target_temper || 0) > 0,
    refreshSwitch: () => void handleFetchSwitchStatus(),
    notify: setActionToast
  });
  // Stehende Mitteilung (Android) mit Balken: Druck oder Trocknung
  useLiveStatus({
    connected: Boolean(liveState.connected && liveState.receivingData !== false),
    gcodeState: liveState.data.gcode_state,
    percent: Number(liveState.data.mc_percent) || 0,
    remainingMin: Number(liveState.data.mc_remaining_time) || 0,
    jobName: liveState.data.subtask_name || undefined,
    layer: Number(liveState.data.layer_num) || 0,
    totalLayers: Number(liveState.data.total_layer_num) || 0,
    dryMinLeft: dryLeftNow,
    amsHumidity: amsHumidityPercent(liveState.data.ams?.ams?.[0])
  });
  // Altzustand: beides gewählt → Aus nach Druck gewinnt, Trocknen nach Druck wird abgewählt
  useEffect(() => {
    if (autoOff.armed && dryAfter.plan.armed) disarmDryPlan();
  }, [autoOff.armed, dryAfter.plan.armed]);
  const handleToggleAutoOff = () => {
    if (autoOff.armed) {
      disarmAutoOff();
      setActionToast({ text: 'Drucker bleibt nach dem Druck an.', ok: true });
      addSystemLog('steckdose', 'Auto-Aus nach Druck abgewählt', liveState.data.subtask_name || '', 'info');
      return;
    }
    if (!haSwitchState.configured) {
      setActionToast({ text: 'Dafür braucht die App Home Assistant mit Steckdose (Verbindungen).', ok: false });
      return;
    }
    const dropDry = dryAfter.plan.armed;
    if (dropDry) disarmDryPlan(); // Aus nach Druck ist stärker als Trocknen nach Druck
    armAutoOff(liveState.data.subtask_name || '');
    setActionToast({
      text: dropDry ? 'Drucker geht nach dem Druck aus. Trocknen nach Druck ist abgewählt.' : 'Drucker wird nach dem Druck ausgeschaltet (3 Minuten nach Druckende).',
      ok: true
    });
    addSystemLog('steckdose', 'Auto-Aus nach Druck gewählt', liveState.data.subtask_name || '', 'info');
  };
  // Auto-Aus auch ohne offene App: Automation in Home Assistant an, solange gewählt (nicht bei geplanter Trocknung,
  // die steuert die App, damit der Strom erst nach dem Trocknen ausgeht)
  const haAutoOffWanted = autoOff.armed;
  useEffect(() => {
    if (!haSwitchState.configured) return;
    void setHaAutoOff(haAutoOffWanted);
  }, [haAutoOffWanted, haSwitchState.configured]);
  // „Nach Trocknen aus“ ebenso ohne offene App: Home-Assistant-Automation an, solange gewählt
  const [workshopSettings] = useWorkshopSettings();
  const haDryOffWanted = dryOffState.armed;
  useEffect(() => {
    if (!haSwitchState.configured) return;
    void (async () => {
      // Bei jedem App-Start einmal prüfen (Sensoren suchen, Automation anlegen/aktualisieren), danach nur noch an/aus
      if (haDryOffWanted && !haDryOffCheckedThisStart) {
        const r = await installHaDryOff();
        if (r.ok) haDryOffCheckedThisStart = true; // bei Fehler beim nächsten Mal erneut versuchen
      }
      await setHaDryOff(haDryOffWanted);
    })();
  }, [haDryOffWanted, haSwitchState.configured, workshopSettings.dryOffDelayMin]);

  // Status-LED (WLED über Home Assistant): Automation beim Start prüfen, danach nur noch an/aus
  useEffect(() => {
    if (!haSwitchState.configured) return;
    void (async () => {
      if (workshopSettings.statusLed && !statusLedCheckedThisStart) {
        const r = await installStatusLed();
        if (r.ok) statusLedCheckedThisStart = true;
      }
      await setStatusLed(workshopSettings.statusLed);
    })();
  }, [workshopSettings.statusLed, workshopSettings.statusLedBrightness, haSwitchState.configured]);

  // Druck-Planer: danach trocknen / ausschalten / Druck verzögern (Fenster bei neuem Druck)
  const armDryAfterNow = (temp: number, hours: number, ids: string[]) => {
    armDryPlan({ temp, hours, spoolIds: ids }, true);
  };
  const printPlan = usePrintPlanRunner({
    connected: Boolean(liveState.connected && liveState.receivingData !== false),
    gcodeState: liveState.data.gcode_state,
    jobName: liveState.data.subtask_name,
    startTime: liveState.data.gcode_start_time,
    percent: Number(liveState.data.mc_percent) || 0,
    dryMinutesLeft: dryLeftNow,
    dryTemp: Number(liveState.data.ams?.ams?.[0]?.dry_setting?.dry_temperature) || 50,
    stopDrying: () => handleToggleAmsDrying(false),
    restartDryAfterPrint: (temp, minutes) => {
      if (autoOff.armed) return; // Aus nach Druck gewinnt
      armDryAfterNow(Math.max(45, Math.min(65, Math.round(temp / 5) * 5)), Math.max(1, Math.min(24, Math.ceil(minutes / 60))), amsSpools().map(sp => sp.id));
    },
    notify: setActionToast
  });
  const applyPrintPlan = (o: { dry: boolean; off: boolean; resumeAt: number }) => {
    const parts: string[] = [];
    if (o.off) {
      if (!autoOff.armed) {
        if (!haSwitchState.configured) setActionToast({ text: 'Danach ausschalten braucht Home Assistant mit Steckdose (Verbindungen).', ok: false });
        else {
          if (dryAfter.plan.armed) disarmDryPlan();
          armAutoOff(liveState.data.subtask_name || '');
          parts.push('danach aus');
        }
      } else parts.push('danach aus');
    } else if (o.dry) {
      const inAms = amsSpools();
      if (!inAms.length) setActionToast({ text: 'Erst Spulen den AMS-Slots zuordnen.', ok: false });
      else if (!autoOff.armed) {
        const due = inAms.filter(needsDryingNow);
        const plan = dryPlanFor(due.length ? due : inAms, inAms);
        armDryAfterNow(plan.temp, plan.hours, (due.length ? due : inAms).map(sp => sp.id));
        parts.push(`danach trocknen (${plan.temp} °C, ${plan.hours} h)`);
      }
    }
    if (o.resumeAt > Date.now()) {
      setPrintPlan({ state: 'delayed', resumeAt: o.resumeAt });
      parts.push(`Druck pausiert bis ${clockText(o.resumeAt)}`);
    } else {
      clearPrintPlan();
    }
    if (parts.length) setActionToast({ text: parts.join(' · ') + '.', ok: true });
  };

  // Feuchte-Alarm (AMS + externer Sensor)
  useHumidityAlarm({
    amsUnit: liveState.data.ams?.ams?.[0],
    printerConnected: Boolean(liveState.connected && liveState.receivingData !== false),
    drying: dryLeftNow > 0,
    spools,
    amsSpools: amsSpools(),
    printActive,
    blockDrying: autoOff.armed, // Aus nach Druck ist stärker: kein Auto-Trocknen
    startDrying: o => handleToggleAmsDrying(true, o),
    notify: setActionToast
  });

  // Strom während eines Drucks nur mit Rückfrage ausschalten
  const handleToggleSwitch = () => {
    if (haSwitchState.state === 'on' && printActive && !window.confirm('Es läuft gerade ein Druck! Strom wirklich ausschalten? Der Druck wäre dann verloren.')) return;
    void rawToggleSwitch();
  };

  // Kamera Quelle ('bambu' | 'ha')
  const [cameraSource] = useState<'bambu' | 'ha'>(() => {
    return (safeStorage.getItem('filamenthub_camera_source') as 'bambu' | 'ha') || 'ha';
  });

  // Steckdosen-Status periodisch abfragen

  // Home Assistant Kamera Auto-Refresh mit Blob-URL
  useEffect(() => {
    if (!isCameraOpen) return;
    let active = true;

    let timer: ReturnType<typeof setTimeout> | undefined;
    // Ein Bild nach dem anderen (kein Stau), sofort das nächste, Bild wird vor dem Tausch fertig dekodiert (kein Flackern)
    const loop = async () => {
      if (!active) return;
      if (document.hidden) {
        timer = setTimeout(loop, 1000);
        return;
      }
      const t0 = Date.now();
      const blob = await fetchHaCameraBlobUrl();
      if (blob && active) {
        try {
          const im = new Image();
          im.src = blob;
          await im.decode();
        } catch {
          /* trotzdem anzeigen */
        }
        if (!active) {
          URL.revokeObjectURL(blob);
          return;
        }
        setHaCameraBlobUrl(prev => {
          if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1500);
          return blob;
        });
      }
      timer = setTimeout(loop, Math.max(0, (blob ? 150 : 2000) - (Date.now() - t0)));
    };
    void loop();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [isCameraOpen, cameraSnapshotKey]);

  // Statuswechsel für Live-Logs erfassen (z.B. Leerlauf, Drucken, Pausiert)
  // Nur echte, stabile Wechsel loggen: Ein Status muss 15 s gelten, kurzes Flackern (Verbinden, Daten fehlen kurz) wird ignoriert.
  const loggedStatusRef = useRef<string>('');
  useEffect(() => {
    const currentStatus = liveState.formatted.statusText;
    if (!currentStatus) return;
    const timer = setTimeout(() => {
      const prev = loggedStatusRef.current;
      loggedStatusRef.current = currentStatus;
      if (!prev || prev === currentStatus) return; // erster Wert oder keine Änderung
      addSystemLog(
        'drucker',
        `Bambu Lab X2D: ${currentStatus}`,
        liveState.data.subtask_name ? `Auftrag: ${liveState.data.subtask_name}` : undefined,
        currentStatus.toLowerCase().includes('druck') ? 'success' : 'info'
      );
    }, 15000);
    return () => clearTimeout(timer);
  }, [liveState.formatted.statusText, liveState.data.subtask_name]);

  // Home Assistant Steckdose umschalten (direkt ohne störendes Popup)

  // AMS Slot Zuordnung (im localStorage) – Alle 4 Slots mit echten Drucker-Filamenten belegen

  useEffect(() => {
    if (viewMode === 'simple') {
      setIsExpanded(false);
    } else if (viewMode === 'full') {
      setIsExpanded(true);
    }
  }, [viewMode]);

  // Bugfix: Wenn der X2D eingefahren/zugeklappt wird, schließt sich automatisch auch die Kamera sofort
  useEffect(() => {
    if (!isExpanded) {
      setIsCameraOpen(false);
    }
  }, [isExpanded]);

  // "wenn ich dann spulen ins ams zuweise und du erkennst, dass sie x lang getrocknet wurden dann rechne es auf die trockenstand drauf
  // wenn ich pla nur die hälfte der zeit getrocknet habe dann rechne halt nur die hälfte drauf"

  // Toast Timer (Meldungen verschwinden automatisch nach 10 Sekunden)
  useEffect(() => {
    if (actionToast) {
      const t = setTimeout(() => setActionToast(null), 10000);
      return () => clearTimeout(t);
    }
  }, [actionToast]);

  // 1. Live-Status vom Drucker
  //  - Windows-/Server-App: Server-Stream (SSE). Nur wenn der Stream ausfällt, alle 3 s abfragen; der Stream wird
  //    mit wachsender Pause (5 s … 60 s) neu aufgebaut. Vorher liefen Stream und Abfrage immer gleichzeitig (doppelte Updates).
  //  - Android-App: Status kommt direkt vom nativen MQTT; eine Abfrage alle 10 s hält „Drucker aus?“ aktuell.
  useEffect(() => {
    let stopped = false;
    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 5000;

    const fetchStatus = async () => {
      try {
        const res = await printerApi.status();
        if (!stopped && res.ok && res.data?.data) setLiveState(res.data);
      } catch {
        /* Server gerade nicht erreichbar */
      }
    };
    const startPolling = (ms: number) => {
      if (pollInterval) return;
      void fetchStatus();
      pollInterval = setInterval(fetchStatus, ms);
    };
    const stopPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = null;
    };

    // Auf GitHub Pages gibt es keinen Server: kein Polling, kein Stream
    if (IS_STATIC && !IS_NATIVE) return;

    if (IS_NATIVE) {
      let off: (() => void) | undefined;
      import('../utils/bambu/NativeBambuService').then(m => {
        if (stopped) return;
        off = m.subscribeNativePrinter(st => setLiveState(st as any));
      });
      startPolling(10_000);
      return () => {
        stopped = true;
        off?.();
        stopPolling();
      };
    }

    const connectSSE = () => {
      if (stopped) return;
      try {
        eventSource = new EventSource('/api/printer/stream');
        eventSource.onopen = () => {
          retryDelay = 5000;
          stopPolling(); // Stream läuft: keine zusätzliche Abfrage
        };
        eventSource.onmessage = event => {
          try {
            const data: BambuLiveState = JSON.parse(event.data);
            if (data && data.data) setLiveState(data);
          } catch {
            /* kaputtes Paket überspringen */
          }
        };
        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
          startPolling(3000); // bis der Stream wieder läuft
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(connectSSE, retryDelay);
          retryDelay = Math.min(60_000, retryDelay * 2);
        };
      } catch {
        startPolling(3000);
      }
    };

    void fetchStatus();
    connectSSE();

    return () => {
      stopped = true;
      eventSource?.close();
      stopPolling();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  // 2. Dynamischen QR-Code mit aktuellem Status generieren
  useEffect(() => {
    const generateQr = async () => {
      try {
        const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://filamenthub.app';
        const url = await QRCode.toDataURL(currentUrl, {
          width: 220,
          margin: 1.5,
          color: {
            dark: '#00AE42',
            light: '#ffffff'
          }
        });
        setQrCodeDataUrl(url);
      } catch (e) {
        console.error('QR-Code Generierung fehlgeschlagen:', e);
      }
    };
    generateQr();
  }, [liveState.data.gcode_state, liveState.data.mc_percent]);

  // 3. Steuerungsbefehl senden (Pause, Resume, Stop)
  const handleSendCommand = async (command: 'pause' | 'resume' | 'stop', pin?: string) => {
    setActionLoading(command);
    try {
      const res = await printerApi.command(command, pin);
      const data = res.data;

      if (res.ok && data.success) {
        setActionToast({ text: data.message || `Befehl "${command}" ausgeführt!`, ok: true });
        setShowStopPinModal(false);
        setAdminPinInput('');
      } else {
        setActionToast({
          text: data.error || `Fehler bei Befehl "${command}". Bitte Entwickler-Modus am Drucker aktivieren.`,
          ok: false
        });
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler zum Backend.', ok: false });
    } finally {
      setActionLoading(null);
    }
  };

  // 3b. G-Code Zeile direkt über MQTT senden
  const handleSendGcodeLine = async (gcode: string) => {
    if (!gcode.trim()) return;
    setActionLoading('gcode');
    try {
      const res = await printerApi.gcodeLine(gcode);
      const data = res.data;
      if (res.ok && data.success) {
        setActionToast({ text: data.message || `G-Code "${gcode.trim()}" gesendet!`, ok: true });
        addSystemLog('drucker', `G-Code Befehl gesendet: ${gcode.trim()}`, 'MQTTS Command', 'info');
      } else {
        setActionToast({ text: data.error || 'Fehler beim Senden des G-Codes', ok: false });
        addSystemLog('drucker', `Fehler beim Senden von G-Code "${gcode.trim()}": ${data.error || 'Fehlgeschlagen'}`, 'MQTTS Error', 'error');
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Senden des G-Codes.', ok: false });
      addSystemLog('drucker', `Verbindungsfehler beim Senden von G-Code "${gcode.trim()}"`, 'Network', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 4. Zieltemperatur einstellen
  const handleSetTemperature = async (target: 'nozzle1' | 'nozzle2' | 'bed', temp: number) => {
    setActionLoading(`temp_${target}`);
    const targetLabel = target === 'nozzle1' ? 'Düse 1 (Links)' : target === 'nozzle2' ? 'Düse 2 (Rechts)' : 'Druckbett';

    // Optimistisch Zieltemperatur im Frontend anzeigen
    setLiveState(prev => {
      const copy = { ...prev };
      if (target === 'nozzle1') copy.data.nozzle_target_temper = temp;
      if (target === 'nozzle2') copy.data.nozzle2_target_temper = temp;
      if (target === 'bed') copy.data.bed_target_temper = temp;
      return copy;
    });

    try {
      const res = await printerApi.temperature(target, temp);
      const data = res.data;
      if (res.ok && data.success) {
        setActionToast({ text: data.message || 'OK', ok: true });
        setTempModalTarget(null);
        addSystemLog('temp', `${targetLabel} Zieltemperatur auf ${temp}°C gestellt`, 'Bambu Lab X2D', 'info');
      } else {
        if (data.error?.includes('verify failed') || data.error?.includes('84033543')) {
          // Bambu sperrt fremde Befehle über die Cloud (Autorisierungs-Firmware)
          setActionToast({
            text: 'Bambu hat den Befehl abgelehnt: Fremd-Befehle sind über die Cloud gesperrt. Geht nur im LAN-Modus mit Entwickler-Modus.',
            ok: false
          });
        } else {
          setActionToast({
            text: data.error || 'Befehl abgelehnt. Bitte am X2D Display "Entwickler-Modus" auf AN stellen!',
            ok: false
          });
        }
        addSystemLog('temp', `Fehler beim Einstellen von ${targetLabel} auf ${temp}°C: ${data.error || 'Befehl abgelehnt'}`, 'MQTTS', 'warn');
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Setzen der Temperatur.', ok: false });
      addSystemLog('temp', `Verbindungsfehler beim Setzen von ${targetLabel} auf ${temp}°C`, 'Network', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 5. Bauraum-Licht umschalten
  const isLightOn = Boolean(liveState.data.lights_report?.some(l => l.node === 'chamber_light' && l.mode === 'on'));
  // Licht beim Trocknen (ohne Druck) von selbst aus, leise ohne Einblendung
  const [workshop] = useWorkshopSettings();
  useDryLightOff({
    enabled: workshop.dryLightOff,
    connected: Boolean(liveState.connected && liveState.receivingData !== false),
    drying: dryLeftNow > 0,
    gcodeState: liveState.data.gcode_state,
    lightOn: isLightOn,
    turnLightOff: async () => {
      try {
        const res = await printerApi.light('off');
        return Boolean(res.ok && res.data?.success);
      } catch {
        return false;
      }
    }
  });
  const handleToggleLight = async () => {
    const nextMode = isLightOn ? 'off' : 'on';
    setActionLoading('light');
    try {
      const res = await printerApi.light(nextMode);
      const data = res.data;
      if (res.ok && data.success) {
        setActionToast({ text: data.message || 'OK', ok: true });
        setCameraSnapshotKey(Date.now());
        addSystemLog('licht', `Bauraum-Licht ${nextMode === 'on' ? 'eingeschaltet' : 'ausgeschaltet'}`, 'Bambu Lab X2D', 'info');
      } else {
        setActionToast({
          text: data.error || 'Lichtbefehl abgelehnt. Bitte Entwickler-Modus am Drucker aktivieren!',
          ok: false
        });
        addSystemLog('licht', `Lichtbefehl abgelehnt: ${data.error || 'Entwickler-Modus prüfen'}`, 'Bambu MQTTS', 'warn');
      }
    } catch {
      setActionToast({ text: 'Verbindungsfehler beim Schalten des Lichts.', ok: false });
      addSystemLog('licht', 'Verbindungsfehler beim Schalten des Bauraum-Lichts', 'Network', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 6. G-Code Datei auswählen & analysieren

  // 7. G-Code Datei übertragen / starten
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showNfcSlotModal, setShowNfcSlotModal] = useState(false);
  const [slotModalSpoolId, setSlotModalSpoolId] = useState<string | undefined>(undefined);
  // Von außen öffnen (z. B. aus dem Tag-Fenster: „Einem AMS-Slot zuweisen“)
  useEffect(() => {
    const h = (e: Event) => {
      setSlotModalSpoolId((e as CustomEvent<{ spoolId?: string }>).detail?.spoolId);
      setShowNfcSlotModal(true);
    };
    window.addEventListener(OPEN_SLOT_ASSIGN_EVENT, h);
    return () => window.removeEventListener(OPEN_SLOT_ASSIGN_EVENT, h);
  }, []);
  const { setShowGcodeModal, showGcodeModal, fileInputRef, handleGcodeFileSelect, selectedGcodeFile, gcodeFileInfo, setSelectedGcodeFile, setGcodeFileInfo, handleUploadGcode, isUploadingGcode, gcodeGrams } = useGcodeUpload({ setActionToast, handleRefreshLiveState });

  // 8. AMS Spuleneinstellungen direkt am Drucker ändern

  // 9. AMS Trocknung starten / stoppen
  // Nur was der Drucker selbst meldet (dry_time = Restminuten), keine geschätzten/lokalen Werte
  const amsUnit0 = liveState.connected ? liveState.data.ams?.ams?.[0] : null;
  const dryMinutesLeft = Number(amsUnit0?.dry_time) || 0;
  const dsx = amsUnit0?.dry_setting;
  const isDryingActive = dryMinutesLeft > 0 || (Number(dsx?.dry_duration) > 0 && Number(dsx?.dry_temperature) > 0);

  // Meldungen aufs Handy: Druck fertig/fehlgeschlagen, AMS-Trocknung fertig (laut Drucker)
  usePrinterAlerts({
    connected: Boolean(liveState.connected && liveState.receivingData !== false),
    dryMinutesLeft,
    spools,
    showToast: (text: string) => setActionToast({ text, ok: true })
  });

  const calcRemainingTime = () => {
    if (!isDryingActive) return null;
    if (dryMinutesLeft <= 0) return null;
    return `${Math.floor(dryMinutesLeft / 60)}h ${dryMinutesLeft % 60}m`;
  };

  const getHumidityDisplay = () => {
    if (!amsUnit0) return '–';
    // AMS 2 Pro / HT melden den echten Wert in humidity_raw (%), sonst nur Stufe 1-5 (grob)
    const raw = Number(amsUnit0.humidity_raw);
    if (amsUnit0.humidity_raw !== undefined && amsUnit0.humidity_raw !== '' && Number.isFinite(raw) && raw > 0) return `${raw}% rF`;
    const lvl = Number(amsUnit0.humidity);
    if (!Number.isFinite(lvl) || amsUnit0.humidity === undefined || amsUnit0.humidity === '') return '–';
    if (lvl >= 10) return `${lvl}% rF`;
    const map: Record<number, string> = { 1: '≈ 20% rF (Stufe 1)', 2: '≈ 30% rF (Stufe 2)', 3: '≈ 40% rF (Stufe 3)', 4: '≈ 50% rF (Stufe 4)', 5: '≈ 60%+ rF (Stufe 5)' };
    return map[lvl] || `Stufe ${lvl}`;
  };

  // Intelligente Strom- und Verbindungszustände (Kopplung mit Home Assistant Steckdose & MQTT)
  const isSocketOff = haSwitchState.configured && haSwitchState.state === 'off';
  const isPrinterConnected = liveState.connected === true;
  // Cloud verbunden heißt nicht, dass der Drucker an ist: nur wenn er gerade Daten schickt, gilt er als erreichbar
  const isPrinterAlive = isPrinterConnected && liveState.receivingData !== false;
  const isPrinterPowerOff = isSocketOff || (!isPrinterAlive && haSwitchState.state === 'off');

  // Effektiver Status & Farbe für Badge und Anzeigen
  let effectiveStatusText = liveState.formatted.statusText;
  let effectiveStatusColor = liveState.formatted.statusColor;

  if (isSocketOff) {
    effectiveStatusText = 'Ausgeschaltet (Stromlos)';
    effectiveStatusColor = '#64748b';
  } else if (isPrinterConnected && !isPrinterAlive) {
    effectiveStatusText = 'Drucker aus / nicht erreichbar';
    effectiveStatusColor = '#64748b';
  } else if (!isPrinterConnected) {
    if (liveState.connecting || reconnecting) {
      effectiveStatusText = 'Verbindet …';
      effectiveStatusColor = '#f59e0b';
    } else if (!liveState.hasToken && IS_NATIVE) {
      effectiveStatusText = 'Nicht angemeldet';
      effectiveStatusColor = '#64748b';
    } else {
      effectiveStatusText = 'Offline';
      effectiveStatusColor = '#64748b';
    }
  }

  // Anmelden statt „Neu verbinden“: noch kein Login oder die Cloud lehnt den gespeicherten Login ab
  const needsLogin =
    IS_NATIVE && (!liveState.hasToken || /abgelaufen|ung[üu]ltig|abgelehnt|neu anmelden|Zugangscode/i.test(String(liveState.error || '')));

  // Stand ans Verbindungen-Menü melden (dort steht dann dasselbe wie hier auf der Karte)
  const liveLevel: PrinterLevel = isSocketOff
    ? 'standby'
    : isPrinterAlive
      ? 'online'
      : isPrinterConnected
        ? 'standby'
        : liveState.connecting || reconnecting
          ? 'connecting'
          : 'offline';
  useEffect(() => {
    setPrinterLive({ level: liveLevel, text: effectiveStatusText });
  }, [liveLevel, effectiveStatusText]);

  const isPrinting = isPrinterAlive && liveState.data.gcode_state === 'RUNNING';
  const isPaused = isPrinterAlive && liveState.data.gcode_state === 'PAUSE';

  return (
    <div
      className="rounded-2xl border transition-all shadow-md overflow-hidden"
      style={{
        backgroundColor: 'var(--app-card)',
        borderColor: 'var(--app-border)',
        color: 'var(--app-text)'
      }}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        className="p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b cursor-pointer transition select-none"
        style={{ borderColor: 'var(--app-border)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md shrink-0 transition-transform ${
              isPrinting
                ? 'bg-gradient-to-br from-[#00AE42] to-emerald-600 text-white shadow-[#00AE42]/25 ring-2 ring-[#00AE42]/30 animate-pulse'
                : isPaused
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-[#00AE42]/15 text-[#00AE42] border border-[#00AE42]/30'
            }`}
          >
            <ThreeDPrinterIcon className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm sm:text-base tracking-tight" style={{ color: 'var(--app-text)' }}>
                Bambu Lab X2D
              </span>

              {/* Status Badge */}
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 border"
                style={{
                  backgroundColor: `${effectiveStatusColor}20`,
                  // Grau (offline) als Schrift passend zum Theme, sonst kaum lesbar
                  color: effectiveStatusColor === '#64748b' ? 'var(--app-text-muted)' : effectiveStatusColor,
                  borderColor: `${effectiveStatusColor}40`
                }}
              >
                {isSocketOff ? (
                  <Power className="w-3 h-3 text-[var(--app-text-muted)]" />
                ) : !isPrinterConnected ? (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: effectiveStatusColor }}
                  />
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isPrinting ? 'animate-ping' : ''}`}
                    style={{ backgroundColor: effectiveStatusColor }}
                  />
                )}
                <span>{effectiveStatusText}</span>
              </span>

              {/* Kompakter Fortschritt im eingeklappten Zustand */}
              {(!isExpanded || compact) && isPrinting && (
                <div
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono-num text-[#00AE42] font-bold"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <Clock className="w-3 h-3 text-[#00AE42]" />
                  <span>{liveState.data.mc_percent}%</span>
                  <span style={{ color: 'var(--app-text-muted)' }}>• {liveState.formatted.remainingTimeStr}</span>
                </div>
              )}
              {autoOff.armed && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleToggleAutoOff();
                  }}
                  title="Drucker wird nach dem Druck ausgeschaltet. Tippen zum Abwählen."
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-sky-500/50 bg-sky-500/15 text-sky-300 text-[10px] font-bold cursor-pointer"
                >
                  <Power className="w-3 h-3" />
                  <span>Aus nach Druck</span>
                </button>
              )}
            </div>

            <p className="text-[11px] truncate flex items-center gap-2 mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
              <span>SN: {liveState.serialNumber || '–'}</span>
              {liveState.data.subtask_name && isPrinterAlive && (
                <>
                  <span>•</span>
                  <span className="font-medium text-[var(--app-text)] truncate">
                    Datei: {liveState.data.subtask_name}
                  </span>
                </>
              )}
              {haSwitchState.configured && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold">
                    <Plug className={`w-3 h-3 ${haSwitchState.state === 'on' ? 'text-emerald-400' : 'text-rose-400'}`} />
                    <span className={haSwitchState.state === 'on' ? 'text-emerald-400' : 'text-rose-400'}>
                      Strom: {haSwitchState.state === 'on' ? 'AN' : 'AUS'}
                    </span>
                    {haSwitchState.power && <span className="text-amber-400 font-mono">({haSwitchState.power}W)</span>}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Schnellaktionen Header: Aufgeräumt ohne unschönes Wrapping */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap" onClick={e => e.stopPropagation()}>
          {/* 1. LAN-Steckdose Toggle */}
          <button
            onClick={handleToggleSwitch}
            disabled={haSwitchLoading}
            title={`LAN-Steckdose ${haSwitchState.state === 'on' ? 'ausschalten' : 'einschalten'}`}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
              haSwitchState.state === 'on'
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-emerald-500/20'
                : 'bg-rose-500/20 border-rose-500/50 text-rose-300 ring-1 ring-rose-500/30'
            }`}
            style={{ backgroundColor: 'var(--app-card-sub)' }}
          >
            <Power className={`w-3.5 h-3.5 shrink-0 ${haSwitchState.state === 'on' ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-[11px] whitespace-nowrap">
              {haSwitchState.state === 'on' ? 'Strom: AN' : 'Strom: AUS'}
            </span>
          </button>

          {/* 1b. Nach dem Druck ausschalten (eingeklappt; aufgeklappt steht es bei der Drucksteuerung) */}
          {!isExpanded && printActive && !autoOff.armed && haSwitchState.configured && (
            <button
              onClick={handleToggleAutoOff}
              title="Steckdose ausschalten, 3 Minuten nach Druckende"
              className="px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
            >
              <Power className="w-3.5 h-3.5 text-sky-400" />
              <span>Nach Druck aus</span>
            </button>
          )}

          {/* 2. Bauraum-Licht Toggle */}
          <button
            onClick={handleToggleLight}
            disabled={isPrinterPowerOff}
            title={isPrinterPowerOff ? 'Drucker ist stromlos' : isLightOn ? 'Bauraum-Licht ausschalten' : 'Bauraum-Licht einschalten'}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed ${
              isLightOn
                ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 shadow-amber-500/20'
                : 'border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-accent-sub)]'
            }`}
            style={{ backgroundColor: isLightOn ? undefined : 'var(--app-card-sub)' }}
          >
            <Lightbulb className={`w-3.5 h-3.5 shrink-0 ${isLightOn ? 'text-amber-400 fill-amber-400/40 animate-pulse' : ''}`} />
            <span className="hidden sm:inline text-[11px] whitespace-nowrap">{isLightOn ? 'Licht An' : 'Licht'}</span>
          </button>

          {/* 3. G-Code Upload (nur online, nicht in der Android-App) */}
          {!IS_NATIVE && (
            <button
              onClick={() => setShowGcodeModal(true)}
              title="G-Code oder .3MF Datei an X2D senden"
              className="px-2.5 py-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <FileCode className="w-3.5 h-3.5 shrink-0 text-sky-400" />
              <span className="hidden md:inline text-[11px] whitespace-nowrap">G-Code</span>
            </button>
          )}

          {/* 3b. Verbrauch der letzten Drucke (Bambu Cloud) */}
          <button
            onClick={() => setShowUsageModal(true)}
            title="Letzter Druck: Verbrauch ansehen und von der Spule abziehen"
            className="px-2.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <span className="relative w-4 h-4 shrink-0 flex items-center justify-center">
              <Printer className="w-3.5 h-3.5" />
              <History className="w-2.5 h-2.5 absolute -right-1 -bottom-1 rounded-full" style={{ backgroundColor: 'var(--app-card-sub)' }} />
            </span>
            <span className="hidden md:inline text-[11px] whitespace-nowrap">Letzter Druck</span>
          </button>

          {/* 3c. NFC-Tag → AMS-Slot */}
          <button
            onClick={() => {
              setSlotModalSpoolId(undefined);
              setShowNfcSlotModal(true);
            }}
            title="Spule per NFC lesen und in einen AMS-Slot eintragen"
            className="px-2.5 py-1.5 rounded-xl border border-violet-500/40 bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Nfc className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline text-[11px] whitespace-nowrap">NFC→Slot</span>
          </button>

          {/* 4. Kamera-Klappe Toggle */}
          <button
            onClick={() => {
              if (!isExpanded) {
                setIsExpanded(true);
                setIsCameraOpen(true);
              } else {
                setIsCameraOpen(prev => !prev);
              }
            }}
            title="Kamera Live-Bild ein-/ausklappen"
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
              isCameraOpen
                ? 'bg-[#00AE42]/20 border-[#00AE42]/50 text-[#00AE42]'
                : 'border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-accent-sub)]'
            }`}
            style={{ backgroundColor: isCameraOpen ? undefined : 'var(--app-card-sub)' }}
          >
            <Camera className="w-3.5 h-3.5 shrink-0 text-[#00AE42]" />
            <span className="hidden sm:inline text-[11px] whitespace-nowrap">Kamera</span>
          </button>

          {/* 5. Aktualisieren Button */}
          <button
            onClick={handleRefreshLiveState}
            disabled={isRefreshing}
            title="Telemetrie sofort synchronisieren"
            className="p-1.5 rounded-xl border transition cursor-pointer hover:opacity-80 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00AE42]' : ''}`} />
          </button>

          {/* 6./7. Home-Assistant-Status und Einstellungen: nur online. In der App stehen die Einstellungen im Menü. */}
          {!IS_NATIVE && (
            <>
              <button
                onClick={handleFetchSwitchStatus}
                title="Home Assistant Status aktualisieren"
                className="p-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsSettingsModalOpen(true)}
                title="Drucker & MQTTS Einstellungen"
                className="p-1.5 rounded-xl border transition cursor-pointer hover:opacity-80"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* 8. Ausklappen / Einklappen Pfeil */}
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            title={isExpanded ? 'Einklappen' : 'Mehr anzeigen (Temperaturen, AMS, Trocknung)'}
            aria-label={isExpanded ? 'Einklappen' : 'Mehr anzeigen'}
            aria-expanded={isExpanded}
            className="p-1.5 rounded-xl border transition cursor-pointer hover:opacity-80 ml-0.5"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* VERBINDUNGS-HINWEIS: warum offline + Knopf zum Neu-Verbinden */}
      {!isPrinterConnected && !isSocketOff && (!IS_STATIC || IS_NATIVE) && (
        <div
          className="px-3 py-2.5 border-b flex items-start gap-2.5 text-[11px]"
          style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-card-sub)' }}
        >
          <span className="mt-0.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: effectiveStatusColor }} />
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="font-bold break-words" style={{ color: 'var(--app-text)' }}>
              {liveState.connecting || reconnecting
                ? liveState.lanMode
                  ? 'Verbinde direkt mit dem Drucker …'
                  : 'Verbinde mit der Bambu Cloud …'
                : !liveState.hasToken
                ? 'Noch nicht bei Bambu angemeldet.'
                : 'Drucker nicht verbunden.'}
            </p>
            {!liveState.connecting && !reconnecting && (
              <p className="break-words leading-snug" style={{ color: 'var(--app-text-muted)' }}>
                {!liveState.hasToken
                  ? 'Tippe auf „Anmelden“ und melde dich mit deinem Bambu-Konto an. Danach verbindet die App selbst.'
                  : liveState.error || 'Die App verbindet sich automatisch neu.'}
                {liveState.hasToken && liveState.retryInSec != null && ` Nächster Versuch in ${liveState.retryInSec} s.`}
              </p>
            )}
          </div>
          <button
            onClick={needsLogin ? () => setIsSettingsModalOpen(true) : handleReconnect}
            disabled={reconnecting || liveState.connecting}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1"
            style={{ backgroundColor: 'var(--app-accent)' }}
          >
            {needsLogin ? (
              <>
                <Settings className="w-3.5 h-3.5" />
                <span>Anmelden</span>
              </>
            ) : (
              <>
                <RefreshCw className={`w-3.5 h-3.5 ${reconnecting || liveState.connecting ? 'animate-spin' : ''}`} />
                <span>Neu verbinden</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Verbunden, aber der Drucker schickt nichts (aus, kein WLAN oder Cloud hakt) */}
      {isPrinterConnected && liveState.receivingData === false && (
        <div className="px-3 py-2 border-b flex items-center gap-2 text-[11px]" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-card-sub)' }}>
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
          <span className="flex-1 min-w-0 break-words" style={{ color: 'var(--app-text-muted)' }}>
            {liveState.lanMode ? 'Direkt mit dem Drucker verbunden' : 'Mit der Bambu Cloud verbunden'}, warte auf Daten vom Drucker … Ist er eingeschaltet und im WLAN?
          </span>
        </div>
      )}

      {/* KLAPPE: REALE LIVE-KAMERA (HOME ASSISTANT & X2D SNAPSHOT) */}
      {isExpanded && isCameraOpen && <PrinterCameraPanel setCameraSnapshotKey={setCameraSnapshotKey} handleToggleLight={handleToggleLight} isLightOn={isLightOn} isSocketOff={isSocketOff} handleToggleSwitch={handleToggleSwitch} haSwitchLoading={haSwitchLoading} cameraSource={cameraSource} haCameraBlobUrl={haCameraBlobUrl} haCreds={haCreds} cameraSnapshotKey={cameraSnapshotKey} printerLocalIp={printerLocalIp} haSwitchState={haSwitchState} />}

      {/* AUSGEKLAPPTE VOLLANSICHT */}
      {isExpanded && <PrinterExpandedPanel compact={compact} isSocketOff={isSocketOff} haCreds={haCreds} handleToggleSwitch={handleToggleSwitch} haSwitchLoading={haSwitchLoading} isPrinterPowerOff={isPrinterPowerOff} isPrinterConnected={isPrinterAlive} liveState={liveState} setActionToast={setActionToast} setTempModalTarget={setTempModalTarget} setTempModalValue={setTempModalValue} inlineNozzle1Temp={inlineNozzle1Temp} setInlineNozzle1Temp={setInlineNozzle1Temp} handleSendGcodeLine={handleSendGcodeLine} actionLoading={actionLoading} inlineNozzle2Temp={inlineNozzle2Temp} setInlineNozzle2Temp={setInlineNozzle2Temp} inlineBedTemp={inlineBedTemp} setInlineBedTemp={setInlineBedTemp} isPrinting={isPrinting} handleSendCommand={handleSendCommand} setShowStopPinModal={setShowStopPinModal} setAmsSlots={setAmsSlots} activeSlot={activeSlot} amsSlots={amsSlots} spools={spools} handleSetActiveSlot={handleSetActiveSlot} setEditingAmsSlot={setEditingAmsSlot} setAmsEditColor={setAmsEditColor} setAmsEditMaterial={setAmsEditMaterial} handleSetAmsSlot={handleSetAmsSlotNfc} nfcInfo={nfcInfo} onApplyDryingCredit={onApplyDryingCredit} amsDryTemp={amsDryTemp} isDryingActive={isDryingActive} getHumidityDisplay={getHumidityDisplay} calcRemainingTime={calcRemainingTime} setAmsDryHours={setAmsDryHours} amsDryHours={amsDryHours} setAmsDryTemp={setAmsDryTemp} handleToggleAmsDrying={handleToggleAmsDrying} dryLoading={dryLoading} printActive={printActive} autoOffArmed={autoOff.armed} onToggleAutoOff={handleToggleAutoOff} dryAfterArmed={dryAfter.plan.armed} onToggleDryAfter={handleToggleDryAfter} />}

      {/* MODAL 1: TEMPERATUR ANPASSEN BEI KLICK AUF HOTEND ODER BETT */}
      {tempModalTarget && <TemperatureModal setTempModalTarget={setTempModalTarget} tempModalTarget={tempModalTarget} setTempModalValue={setTempModalValue} tempModalValue={tempModalValue} handleSetTemperature={handleSetTemperature} actionLoading={actionLoading} />}

      {/* MODAL 2: G-CODE DATEI AN DRUCKER SENDEN */}
      {showNfcSlotModal && (
        <NfcSlotModal
          spools={spools}
          initialSpoolId={slotModalSpoolId}
          trays={liveState.connected ? readTrays(liveState.data.ams) : []}
          onAssign={(slotNo, spoolId) => handleSetAmsSlot(slotNo, spoolId)}
          onClose={() => {
            setShowNfcSlotModal(false);
            setSlotModalSpoolId(undefined);
          }}
        />
      )}
      {showUsageModal && <PrintUsageModal spools={spools} onDeductWeight={onDeductWeight} onClose={() => setShowUsageModal(false)} />}
      {showGcodeModal && <GcodeUploadModal setShowGcodeModal={setShowGcodeModal} fileInputRef={fileInputRef} handleGcodeFileSelect={handleGcodeFileSelect} selectedGcodeFile={selectedGcodeFile} gcodeFileInfo={gcodeFileInfo} setSelectedGcodeFile={setSelectedGcodeFile} setGcodeFileInfo={setGcodeFileInfo} handleUploadGcode={handleUploadGcode} isUploadingGcode={isUploadingGcode} spools={spools} amsSlots={amsSlots} gcodeGrams={gcodeGrams} />}

      {/* MODAL 3: AMS SPULEN-EDITOR AM ECHTEN DRUCKER */}
      {editingAmsSlot !== null && <AmsSlotEditModal setEditingAmsSlot={setEditingAmsSlot} editingAmsSlot={editingAmsSlot} setAmsEditColor={setAmsEditColor} amsEditColor={amsEditColor} setAmsEditMaterial={setAmsEditMaterial} setAmsEditMinTemp={setAmsEditMinTemp} setAmsEditMaxTemp={setAmsEditMaxTemp} amsEditMaterial={amsEditMaterial} amsEditMinTemp={amsEditMinTemp} amsEditMaxTemp={amsEditMaxTemp} handleSaveAmsSlotToPrinter={handleSaveAmsSlotToPrinter} actionLoading={actionLoading} />}

      {/* MODAL 4: ADMIN-PIN SICHERHEITSABFRAGE FÜR STOPP */}
      {showStopPinModal && <StopPinModal setShowStopPinModal={setShowStopPinModal} setAdminPinInput={setAdminPinInput} adminPinInput={adminPinInput} handleSendCommand={handleSendCommand} actionLoading={actionLoading} />}

      {/* MODAL 5: DYNAMISCHER DASHBOARD QR-CODE FÜRS SMARTPHONE */}
      {showQrModal && (
        <div
          onClick={() => setShowQrModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl text-center space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#00AE42]" />
                <span className="font-extrabold text-sm" style={{ color: 'var(--app-text)' }}>
                  Smartphone Live-Dashboard
                </span>
              </div>
              <button onClick={() => setShowQrModal(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {qrCodeDataUrl ? (
              <div className="p-3 bg-white rounded-2xl shadow-lg border border-slate-200 inline-block">
                <img src={qrCodeDataUrl} alt="Dashboard QR-Code" className="w-44 h-44 object-contain mx-auto" />
              </div>
            ) : null}

            <div className="space-y-1">
              <span className="text-xs font-bold block" style={{ color: 'var(--app-text)' }}>
                Druckerstatus live am Smartphone verfolgen
              </span>
              <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Scanne den QR-Code mit deiner Handy-Kamera, um das Dashboard mit Live-Fortschritt & Temperaturen direkt zu öffnen.
              </p>
            </div>

            <div
              className="p-2 rounded-xl border text-[10px] font-mono-num font-bold text-[#00AE42]"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              Status: {liveState.formatted.statusText} ({liveState.data.mc_percent}%) • Rest: {liveState.formatted.remainingTimeStr}
            </div>
          </div>
        </div>
      )}

      {/* Home Assistant Integration is configured cleanly in Sidebar menu without intrusive popup */}

      {/* MODAL 6: VERBINDUNGS-EINSTELLUNGEN (ZAHNRAD) */}
      {isSettingsModalOpen && (
        <Suspense fallback={null}>
        <BambuSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          onConnected={() => {
            printerApi
              .status()
              .then(res => {
                if (res.data?.data) setLiveState(res.data);
              })
              .catch(() => {});
          }}
        />
        </Suspense>
      )}

      {/* ZERO LAYOUT SHIFT: Floating Fixed Toast am Bildschirmrand */}
      {pendingDeduct && (
        <LanDeductPrompt pending={pendingDeduct} spools={spools} onDeduct={(sid, g) => deductRef.current(pendingDeduct.printId, sid, g)} onClose={() => setPendingDeduct(null)} />
      )}
      {bambuOpen.length > 0 && !dryAfter.offer && !pendingDeduct && (
        <BambuSpoolSheet
          items={bambuOpen}
          spools={spools}
          onCreate={b => {
            setBambuHidden(h => [...h, b.rfid]);
            onOpenNewSpool(spoolFromBambu(b)); // nach dem Speichern erkennt die App die Spule über ihre Kennung
          }}
          onLink={(b, spoolId) => {
            handleSetAmsSlot(b.slot, spoolId);
            bambuRfid.learn(b.slot, spoolId);
            setActionToast({ text: `Bambu-Spule in Slot ${b.slot} verknüpft.`, ok: true });
          }}
          onLater={b => bambuRfid.dismiss(b.rfid)}
          onClose={() => setBambuHidden(h => [...h, ...bambuOpen.map(b => b.rfid)])}
        />
      )}
      {printPlan.state === 'ask' && printActive && (
        <PrintPlanSheet
          jobName={printPlan.jobName}
          dryArmed={dryAfter.plan.armed}
          offArmed={autoOff.armed}
          drying={dryLeftNow > 0}
          onApply={o => applyPrintPlan(o)}
          onClose={() => setPrintPlan({ state: 'none' })}
        />
      )}
      {printPlan.state === 'delayed' && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[110] max-w-sm w-[calc(100%-1.5rem)] rounded-xl border px-3 py-2 flex items-center gap-2 text-[11px] font-bold" style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
          <span className="flex-1">⏸️ Druck verzögert bis {clockText(printPlan.resumeAt)}</span>
          <button className="px-2 py-1 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--app-border)' }} onClick={() => setPrintPlan({ resumeAt: Date.now() })}>Jetzt fortsetzen</button>
          <button className="px-2 py-1 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--app-border)' }} onClick={() => setPrintPlan({ state: 'none', resumeAt: 0 })}>Abbrechen</button>
        </div>
      )}
      {dryAfter.offer && (
        <DrySuggestSheet
          offer={dryAfter.offer}
          printRunning={printActive}
          onAfterPrint={o => {
            if (autoOff.armed) {
              setActionToast({ text: '„Nach Druck aus“ ist gewählt und gewinnt. Es wird nicht getrocknet.', ok: false });
              dryAfter.closeOffer();
              return;
            }
            armDryPlan({ ...o, spoolIds: dryAfter.offer!.spools.map(x => x.id) }, printActive);
            setActionToast({ text: `Nach dem Druck wird getrocknet (${o.temp} °C, ${o.hours} h).`, ok: true });
            dryAfter.closeOffer();
          }}
          onNow={o => {
            dryAfter.closeOffer();
            void handleToggleAmsDrying(true, o);
          }}
          onClose={dryAfter.closeOffer}
        />
      )}
      {actionToast && (
        <div
          className="fixed bottom-5 right-5 z-[100] max-w-sm p-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center justify-between gap-3 text-xs font-bold animate-fadeIn pointer-events-auto"
          style={{
            backgroundColor: actionToast.ok ? 'rgba(5, 119, 72, 0.95)' : 'rgba(220, 38, 38, 0.95)',
            color: '#ffffff',
            borderColor: actionToast.ok ? '#22c55e' : '#f87171'
          }}
        >
          <span>{actionToast.text}</span>
          <button
            onClick={() => setActionToast(null)}
            className="p-1 hover:opacity-75 cursor-pointer ml-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
