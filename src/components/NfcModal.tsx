import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Radio,
  CheckCircle2,
  Tag,
  PenTool,
  Search,
  Check,
  Zap
} from 'lucide-react';
import { Spool } from '../types/filament';
import { NfcInspectTab } from './nfc/NfcInspectTab';
import { NfcWriteDirectTab } from './nfc/NfcWriteDirectTab';
import { NfcWriteTab } from './nfc/NfcWriteTab';
import { NfcReadTab } from './nfc/NfcReadTab';
import { NfcBatchTab } from './nfc/NfcBatchTab';
import {
  isWebNfcSupported,
  NfcPayload,
  parseNfcContent,
  writeSpoolToNfcTag,
  openTag3dToJsonText,
  type NfcWriteFormat,
  eraseNfcTag,
  mapTagToSpool,
  playNfcSuccessChime,
  triggerNfcHaptic
} from '../utils/nfcManager';
import { OPENTAG3D_MIME } from '../utils/openTag3d';

export interface NfcModalProps {
  isOpen: boolean;
  onClose: () => void;
  spools: Spool[];
  initialMode?: 'read' | 'write' | 'batch' | 'write-direct' | 'inspect';
  preselectedSpoolId?: string;
  /** Tag wurde schon außerhalb gelesen (App-Start/Halten am Handy): Tag-Fenster zeigt direkt diese Spule */
  scannedSpoolId?: string;
  onDeductWeight: (spoolId: string, grams: number) => void;
  onAddWeight?: (spoolId: string, grams: number) => void;
  onOpenNewSpoolWithPrefill?: (prefill: Partial<Spool>) => void;
  onSelectSpoolForEdit?: (spool: Spool) => void;
  /** „Einem AMS-Slot zuweisen“ im Tag-Fenster */
  onAssignToSlot?: (spool: Spool) => void;
  onMarkSpoolWritten?: (spoolId: string, written: boolean) => void;
  onResetAllNfcWritten?: () => void;
}

export const NfcModal: React.FC<NfcModalProps> = ({
  isOpen,
  onClose,
  spools,
  initialMode = 'read',
  preselectedSpoolId,
  scannedSpoolId,
  onDeductWeight,
  onAddWeight,
  onSelectSpoolForEdit,
  onAssignToSlot,
  onMarkSpoolWritten,
  onResetAllNfcWritten
}) => {
  const [activeTab, setActiveTab] = useState<'read' | 'write' | 'batch' | 'write-direct' | 'inspect'>(initialMode);
  const [, setIsScanning] = useState<boolean>(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string>('Warte auf NFC-Tag...');

  // Gescannte Daten (Lesen)
  const [detectedTagUid, setDetectedTagUid] = useState<string>('');
  const [unwrittenTagDetected, setUnwrittenTagDetected] = useState<boolean>(false);
  const [loadedSpool, setLoadedSpool] = useState<Spool | null>(null);
  const [, setLoadedPayload] = useState<NfcPayload | null>(null);

  // Einzel-Schreib-Modus
  const [selectedSpoolId, setSelectedSpoolId] = useState<string>(
    preselectedSpoolId || spools[0]?.id || ''
  );
  const [spoolSearchQuery, setSpoolSearchQuery] = useState<string>('');
  const [spoolMaterialFilter, setSpoolMaterialFilter] = useState<string>('ALL');

  const [isWriting, setIsWriting] = useState<boolean>(false);
  // Schreibformat: eigenes FilamentHub-JSON oder offener OpenTag3D-Standard (NTAG215 oder größer)
  // Standard: OpenTag3D (offener Standard, passt auf NTAG215/216). Die Wahl wird gemerkt.
  const [writeFormat, setWriteFormatState] = useState<NfcWriteFormat>(() => {
    try {
      return localStorage.getItem('filamenthub_nfc_format') === 'filamenthub' ? 'filamenthub' : 'opentag3d';
    } catch {
      return 'opentag3d';
    }
  });
  const setWriteFormat = (f: NfcWriteFormat) => {
    setWriteFormatState(f);
    try {
      localStorage.setItem('filamenthub_nfc_format', f);
    } catch {}
  };
  const [writeSuccessMessage, setWriteSuccessMessage] = useState<string>('');
  const [writeErrorMessage, setWriteErrorMessage] = useState<string>('');

  // BATCH-MODUS: "Alle Spulen nacheinander beschreiben"
  const [batchTargetSpoolId, setBatchTargetSpoolId] = useState<string>('');
  const [, setIsBatchActive] = useState<boolean>(true);
  const [isBatchWriting, setIsBatchWriting] = useState<boolean>(false);
  const [batchLastSuccessMessage, setBatchLastSuccessMessage] = useState<string>('');
  const [batchErrorMessage, setBatchErrorMessage] = useState<string>('');

  // Gewichts-Eingabe (Abziehen & Hinzufügen)
  const [adjustGramsInput, setAdjustGramsInput] = useState<string>('50');
  const [adjustFeedbackMessage, setAdjustFeedbackMessage] = useState<string>('');

  // Wartet gerade auf den Tag zum Beschreiben (Spule) oder Löschen; „Spule ändern“-Auswahl offen
  const [waitingSpool, setWaitingSpool] = useState<Spool | null>(null);
  const [waitingErase, setWaitingErase] = useState<boolean>(false);
  const [changePicker, setChangePicker] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const writeAbortRef = useRef<AbortController | null>(null);
  const batchLoopRef = useRef<boolean>(false);
  const lastReadTimeRef = useRef<number>(0);
  const prevIsOpenRef = useRef<boolean>(false);

  // Zähler für Fortschritt
  const writtenCount = useMemo(() => spools.filter(s => s.nfcWritten).length, [spools]);
  const totalCount = spools.length;
  const progressPct = totalCount > 0 ? Math.round((writtenCount / totalCount) * 100) : 0;
  const allCompleted = totalCount > 0 && writtenCount === totalCount;

  // Ermitteln der aktuellen Zielspule im Batch-Modus
  const currentBatchSpool = useMemo(() => {
    if (batchTargetSpoolId) {
      const found = spools.find(s => s.id === batchTargetSpoolId);
      if (found) return found;
    }
    // Nächste unbeschriebene Spule finden
    const nextUnwritten = spools.find(s => !s.nfcWritten);
    return nextUnwritten || spools[0];
  }, [batchTargetSpoolId, spools]);

  // Fenster wird geschlossen (ausgeblendet): laufenden Scan sicher beenden, sonst bekäme ein unsichtbarer Leser die Tags
  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
      writeAbortRef.current?.abort();
      batchLoopRef.current = false;
    },
    []
  );

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      writeAbortRef.current?.abort();
      setWaitingSpool(null);
      setWaitingErase(false);
      setChangePicker(false);
      batchLoopRef.current = false;
      setIsScanning(false);
      setIsBatchWriting(false);
      setUnwrittenTagDetected(false);
      setLoadedSpool(null);
      setLoadedPayload(null);
      setWriteSuccessMessage('');
      setWriteErrorMessage('');
      setBatchLastSuccessMessage('');
      setBatchErrorMessage('');
      setSpoolSearchQuery('');
      setSpoolMaterialFilter('ALL');
      return;
    }

    // Nur beim erstmaligen Öffnen oder expliziter Modus-Änderung ausführen, um Oszillation zu verhindern
    const isFirstOpen = !prevIsOpenRef.current;
    prevIsOpenRef.current = true;

    const scanned = scannedSpoolId ? spools.find(s => s.id === scannedSpoolId) : undefined;
    if (scanned) {
      if (isFirstOpen) {
        setActiveTab('read');
        setLoadedSpool(scanned);
        setUnwrittenTagDetected(false);
        setScanStatusMessage('Tag erkannt');
      }
      return;
    }

    if (isFirstOpen || initialMode) {
      if (preselectedSpoolId) {
        setSelectedSpoolId(preselectedSpoolId);
        setBatchTargetSpoolId(preselectedSpoolId);
        const sp = spools.find(s => s.id === preselectedSpoolId);
        if (initialMode === 'write-direct' || initialMode === 'inspect') {
          setActiveTab(initialMode);
        } else if (sp?.nfcWritten) {
          setActiveTab('inspect');
        } else {
          setActiveTab('write-direct');
        }
      } else {
        setActiveTab(initialMode || 'read');
      }

      if (initialMode === 'read' || (!preselectedSpoolId && isFirstOpen)) {
        startNfcScan();
      }
    }
  }, [isOpen, initialMode, preselectedSpoolId, scannedSpoolId]);

  // Gefilterte Spulenliste für die Einzel-Auswahl
  const filteredSpools = useMemo(() => {
    return spools.filter(s => {
      const matchesSearch =
        !spoolSearchQuery.trim() ||
        `${s.brand} ${s.name} ${s.material} ${s.colorName}`.toLowerCase().includes(spoolSearchQuery.toLowerCase());
      const matchesMat =
        spoolMaterialFilter === 'ALL' ||
        s.material.toUpperCase().includes(spoolMaterialFilter.toUpperCase());
      return matchesSearch && matchesMat;
    });
  }, [spools, spoolSearchQuery, spoolMaterialFilter]);

  // Zielspule und stets synchrone Spule aus dem Hauptbestand verwenden (Echtzeit-Aktualisierung bei Abzug / Hinzufügen)
  const targetSpool = useMemo(() => {
    return spools.find(s => s.id === selectedSpoolId) || spools[0];
  }, [spools, selectedSpoolId]);

  const activeLoadedSpool = useMemo(() => {
    if (!loadedSpool) return null;
    return spools.find(s => s.id === loadedSpool.id) || loadedSpool;
  }, [loadedSpool, spools]);

  const activeTargetSpool = useMemo(() => {
    if (!targetSpool) return null;
    return spools.find(s => s.id === targetSpool.id) || targetSpool;
  }, [targetSpool, spools]);

  // =========================================================================
  // NFC LESEN
  // =========================================================================
  const startNfcScan = async () => {
    writeAbortRef.current?.abort(); // laufendes Warten auf Schreiben/Löschen beenden
    setChangePicker(false);
    setUnwrittenTagDetected(false);
    setLoadedSpool(null);
    setLoadedPayload(null);
    setDetectedTagUid('');
    setWriteSuccessMessage('');
    setWriteErrorMessage('');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    if (!isWebNfcSupported()) {
      setIsScanning(true);
      setScanStatusMessage(
        'Web NFC wird in diesem Browser nicht direkt unterstützt (nutze Chrome / Samsung Internet auf Android oder teste mit den Buttons unten).'
      );
      return;
    }

    try {
      setIsScanning(true);
      setScanStatusMessage('Halte einen NFC-Tag oder eine Spule an die Rückseite deines Smartphones...');
      const NDEFReaderClass = (window as any).NDEFReader;
      const ndef = new NDEFReaderClass();

      await ndef.scan({ signal: abortCtrl.signal });

      ndef.onreading = (event: any) => {
        const now = Date.now();
        if (now - lastReadTimeRef.current < 1200) {
          return; // Verhindert Oszillation & Mehrfach-Auslösung beim Halten an die Antenne
        }
        lastReadTimeRef.current = now;

        const serialNumber = event.serialNumber || 'NTAG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        setDetectedTagUid(serialNumber);

        let textContent = '';
        if (event.message && event.message.records) {
          for (const record of event.message.records) {
            if (record.recordType === 'text') {
              const textDecoder = new TextDecoder(record.encoding || 'utf-8');
              textContent = textDecoder.decode(record.data);
              break;
            }
            if (record.recordType === 'mime' && record.mediaType === OPENTAG3D_MIME) {
              textContent = openTag3dToJsonText(new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength));
              break;
            }
          }
        }

        const result = parseNfcContent(textContent, serialNumber, spools);

        if (result.hasFilamentData && (result.matchedSpool || result.payload)) {
          setUnwrittenTagDetected(false);
          if (result.matchedSpool) {
            setLoadedSpool(result.matchedSpool);
            // Als beschrieben markieren falls noch nicht geschehen
            onMarkSpoolWritten?.(result.matchedSpool.id, true);
          } else if (result.payload) {
            const fallbackSpool: Spool = {
              id: result.payload.spoolId || 'nfc-' + Date.now(),
              brand: result.payload.brand,
              material: (result.payload.material as any) || 'PLA',
              name: result.payload.name,
              colorName: result.payload.colorName || 'Standard',
              colorHex: result.payload.colorHex || '#f97316',
              initialWeight: result.payload.initialWeight || 1000,
              remainingWeight: result.payload.remainingWeight || 1000,
              emptySpoolWeight: result.payload.emptySpoolWeight || 200,
              pricePerKg: result.payload.pricePerKg || 19.99,
              lastDried: new Date().toISOString(),
              dryIntervalDays: 30,
              dryTemp: 50,
              dryHours: 6,
              nfcWritten: true
            };
            setLoadedSpool(fallbackSpool);
          }
          setLoadedPayload(result.payload || null);
          setScanStatusMessage('Spule erfolgreich geladen!');
          playNfcSuccessChime();
          triggerNfcHaptic();
        } else {
          setUnwrittenTagDetected(true);
          setLoadedSpool(null);
          setLoadedPayload(null);
          setScanStatusMessage('Unbeschriebener NFC-Tag erkannt.');
        }
      };

      ndef.onreadingerror = () => {
        setScanStatusMessage('Fehler beim Lesen des NFC-Tags. Bitte halte den Tag näher ans Smartphone.');
      };
    } catch (err: any) {
      setIsScanning(false);
      setScanStatusMessage(`NFC-Scanner konnte nicht gestartet werden: ${err.message || String(err)}`);
    }
  };

  const handleSimulateUnwrittenTag = () => {
    const fakeUid = '04:A1:88:2E:7C';
    setDetectedTagUid(fakeUid);
    setUnwrittenTagDetected(true);
    setLoadedSpool(null);
    setLoadedPayload(null);
    setScanStatusMessage('Simulation: Unbeschriebener Tag erkannt');
  };

  const handleSimulateLoadedTag = () => {
    const target = spools[0] || null;
    if (!target) return;
    const fakeUid = '04:B2:91:8C:3F';
    setDetectedTagUid(fakeUid);
    setUnwrittenTagDetected(false);
    setLoadedSpool(target);
    mapTagToSpool(fakeUid, target.id);
    onMarkSpoolWritten?.(target.id, true);
    playNfcSuccessChime();
    triggerNfcHaptic();
    setScanStatusMessage(`NFC-Tag erkannt: ${target.brand} ${target.name}`);
  };

  // =========================================================================
  // EINZEL-SPULE SCHREIBEN
  // =========================================================================
  // Beschreiben/Löschen warten im selben Fenster auf den Tag (kein extra Fenster) und legen sofort los, sobald er da ist.
  const stopScanForWrite = () => {
    // Der laufende Lese-Scan würde den Tag abfangen, den wir gleich beschreiben wollen
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    writeAbortRef.current?.abort();
    const ctrl = new AbortController();
    writeAbortRef.current = ctrl;
    return ctrl;
  };

  /** Fehler, bei denen ein neuer Versuch nichts bringt (anderer Tag nötig) */
  const isFinalNfcError = (msg: string) => /schreibgeschützt|zu klein|kein NDEF|NTAG215|nicht gefunden|ausgeschaltet|kein NFC/i.test(msg);

  /** Android-Fehlertexte verständlich machen („Tag is out of date“ = Tag wurde gerade neu erkannt, neuer Versuch folgt von selbst) */
  const friendlyNfcError = (msg: string) =>
    /out of date|Permission Denial/i.test(msg)
      ? 'Android hat den Tag gerade neu erkannt. Ich versuche es gleich nochmal, halte den Tag ruhig am Handy.'
      : msg;

  const cancelWaiting = () => {
    writeAbortRef.current?.abort();
  };

  const handleWriteSpoolToCurrentTag = async (spoolToSave: Spool, previousSpoolId?: string) => {
    const ctrl = stopScanForWrite();
    setIsWriting(true);
    setWaitingSpool(spoolToSave);
    setWriteSuccessMessage('');
    setWriteErrorMessage('');

    try {
      // Bis zu 6 Versuche: ein verrutschter Tag soll nicht gleich abbrechen. Der Abbrechen-Knopf beendet das Warten sofort.
      for (let attempt = 0; attempt < 6 && !ctrl.signal.aborted; attempt++) {
        const res = await writeSpoolToNfcTag(spoolToSave, ctrl.signal, writeFormat);
        if (res.success) {
          if (detectedTagUid) mapTagToSpool(detectedTagUid, spoolToSave.id);
          playNfcSuccessChime();
          triggerNfcHaptic();
          if (previousSpoolId && previousSpoolId !== spoolToSave.id) onMarkSpoolWritten?.(previousSpoolId, false);
          onMarkSpoolWritten?.(spoolToSave.id, true);
          setWriteSuccessMessage(`Erfolgreich! NFC-Tag wurde mit „${spoolToSave.brand} ${spoolToSave.name}“ beschrieben.`);
          setUnwrittenTagDetected(false);
          setChangePicker(false);
          setLoadedSpool(spoolToSave);
          return;
        }
        setWriteErrorMessage(friendlyNfcError(res.message));
        if (isFinalNfcError(res.message)) return;
        await new Promise(r => setTimeout(r, 700));
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setWriteErrorMessage(`Fehler beim Beschreiben: ${e?.message || String(e)}`);
    } finally {
      if (writeAbortRef.current === ctrl) {
        writeAbortRef.current = null;
        setIsWriting(false);
        setWaitingSpool(null);
      }
    }
  };

  const handleManualWriteSubmit = async () => {
    const spool = spools.find(s => s.id === selectedSpoolId);
    if (!spool) return;

    setIsWriting(true);
    setWriteSuccessMessage('');
    setWriteErrorMessage('');

    try {
      const res = await writeSpoolToNfcTag(spool, undefined, writeFormat);
      if (res.success) {
        playNfcSuccessChime();
        triggerNfcHaptic();
        onMarkSpoolWritten?.(spool.id, true);
        setWriteSuccessMessage(`Erfolgreich! „${spool.brand} ${spool.name}“ auf NFC-Tag geschrieben.`);
      } else {
        setWriteErrorMessage(res.message);
      }
    } catch (e: any) {
      setWriteErrorMessage(e.message || 'Schreiben abgebrochen.');
    } finally {
      setIsWriting(false);
    }
  };

  // =========================================================================
  // NFC-TAG LÖSCHEN & FORMATIEREN
  // =========================================================================
  const handleDeleteTargetSpoolTag = async () => {
    if (!targetSpool) return;
    setIsWriting(true);
    setWriteSuccessMessage('');
    setWriteErrorMessage('');
    try {
      const res = await eraseNfcTag(detectedTagUid);
      if (res.success) {
        onMarkSpoolWritten?.(targetSpool.id, false);
        setWriteSuccessMessage(`✓ NFC-Tag für „${targetSpool.brand} ${targetSpool.name}“ erfolgreich gelöscht! Status ist nun wieder unbeschrieben (rot).`);
      } else {
        setWriteErrorMessage(res.message);
      }
    } catch (err: any) {
      setWriteErrorMessage(`Fehler beim Löschen des Tags: ${err.message || String(err)}`);
    } finally {
      setIsWriting(false);
    }
  };

  const handleDeleteLoadedTag = async () => {
    if (!loadedSpool) return;
    const ctrl = stopScanForWrite();
    setIsWriting(true);
    setWaitingErase(true);
    setWriteSuccessMessage('');
    setWriteErrorMessage('');
    setChangePicker(false);
    try {
      const spoolId = loadedSpool.id;
      const spoolName = `${loadedSpool.brand} ${loadedSpool.name}`;
      for (let attempt = 0; attempt < 6 && !ctrl.signal.aborted; attempt++) {
        const res = await eraseNfcTag(detectedTagUid, ctrl.signal);
        if (res.success) {
          onMarkSpoolWritten?.(spoolId, false);
          setLoadedSpool(null);
          setLoadedPayload(null);
          setUnwrittenTagDetected(true);
          setWriteErrorMessage('');
          setScanStatusMessage(`✓ NFC-Tag für „${spoolName}“ erfolgreich gelöscht & formatiert! Status ist jetzt rot.`);
          return;
        }
        setWriteErrorMessage(friendlyNfcError(res.message));
        if (isFinalNfcError(res.message)) return;
        await new Promise(r => setTimeout(r, 700));
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') setWriteErrorMessage(`Fehler beim Löschen: ${err?.message || String(err)}`);
    } finally {
      if (writeAbortRef.current === ctrl) {
        writeAbortRef.current = null;
        setIsWriting(false);
        setWaitingErase(false);
      }
    }
  };

  // =========================================================================
  // BATCH-MODUS: ALLE SPULEN SCHREIBEN (SERIEN-TAG-SCHREIBER)
  // =========================================================================
  const executeBatchWriteStep = useCallback(async (spool: Spool) => {
    setIsBatchWriting(true);
    setBatchErrorMessage('');

    try {
      const res = await writeSpoolToNfcTag(spool, undefined, writeFormat);
      if (res.success) {
        playNfcSuccessChime();
        triggerNfcHaptic();
        onMarkSpoolWritten?.(spool.id, true);
        setBatchLastSuccessMessage(`✓ „${spool.brand} ${spool.name}“ erfolgreich auf Tag übertragen!`);

        // Nach kurzer Pause automatisch die nächste unbeschriebene Spule anwählen
        setTimeout(() => {
          const remaining = spools.filter(s => s.id !== spool.id && !s.nfcWritten);
          if (remaining.length > 0) {
            setBatchTargetSpoolId(remaining[0].id);
          }
        }, 1100);
      } else {
        setBatchErrorMessage(res.message);
      }
    } catch (e: any) {
      setBatchErrorMessage(e.message || 'Fehler beim Schreiben des Tags.');
    } finally {
      setIsBatchWriting(false);
    }
  }, [spools, onMarkSpoolWritten, writeFormat]);

  // Simulation für Desktop / Entwickler
  const handleSimulateBatchTagContact = () => {
    if (!currentBatchSpool) return;
    executeBatchWriteStep(currentBatchSpool);
  };

  // Diese Spule im Batch überspringen
  const handleSkipCurrentBatchSpool = () => {
    const unwritten = spools.filter(s => s.id !== currentBatchSpool?.id && !s.nfcWritten);
    if (unwritten.length > 0) {
      setBatchTargetSpoolId(unwritten[0].id);
      setBatchLastSuccessMessage(`Spule „${currentBatchSpool?.name}“ übersprungen.`);
    }
  };

  if (!isOpen) return null;

  const handleAdjustLoadedSpoolWeight = (deltaGrams: number) => {
    const spoolToAdjust = spools.find(s => s.id === loadedSpool?.id) || loadedSpool;
    if (!spoolToAdjust) return;

    if (deltaGrams < 0) {
      onDeductWeight(spoolToAdjust.id, Math.abs(deltaGrams));
      setAdjustFeedbackMessage(`✓ ${Math.abs(deltaGrams)}g direkt vom Filament abgezogen!`);
    } else {
      if (onAddWeight) {
        onAddWeight(spoolToAdjust.id, deltaGrams);
      } else {
        onDeductWeight(spoolToAdjust.id, -deltaGrams);
      }
      setAdjustFeedbackMessage(`✓ ${deltaGrams}g direkt zum Filament hinzugefügt!`);
    }
    playNfcSuccessChime();
    triggerNfcHaptic();
    setLoadedSpool(prev => prev ? {
      ...prev,
      remainingWeight: Math.max(0, prev.remainingWeight + deltaGrams)
    } : null);

    setTimeout(() => setAdjustFeedbackMessage(''), 3500);
  };

  const handleAdjustTargetSpoolWeight = (deltaGrams: number) => {
    const spoolToAdjust = spools.find(s => s.id === targetSpool?.id) || targetSpool;
    if (!spoolToAdjust) return;

    if (deltaGrams < 0) {
      onDeductWeight(spoolToAdjust.id, Math.abs(deltaGrams));
      setWriteSuccessMessage(`✓ ${Math.abs(deltaGrams)}g direkt vom Filament abgezogen!`);
    } else {
      if (onAddWeight) {
        onAddWeight(spoolToAdjust.id, deltaGrams);
      } else {
        onDeductWeight(spoolToAdjust.id, -deltaGrams);
      }
      setWriteSuccessMessage(`✓ ${deltaGrams}g direkt zum Filament hinzugefügt!`);
    }
    playNfcSuccessChime();
    triggerNfcHaptic();
    setTimeout(() => setWriteSuccessMessage(''), 3500);
  };

  // „Spule ändern“: Auswahl aller Spulen öffnen, aktuelle Spule ist vorgewählt
  const openChangePicker = () => {
    if (loadedSpool) setSelectedSpoolId(loadedSpool.id);
    setSpoolSearchQuery('');
    setSpoolMaterialFilter('ALL');
    setWriteSuccessMessage('');
    setWriteErrorMessage('');
    setChangePicker(true);
  };

  // Wiederverwendbare Spulenauswahl
  const renderSpoolPicker = () => (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
          <input
            type="text"
            placeholder="Spule suchen (Marke, Farbe, Material)..."
            value={spoolSearchQuery}
            onChange={e => setSpoolSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] text-xs text-[var(--app-text)] placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
          />
          {spoolSearchQuery && (
            <button
              onClick={() => setSpoolSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {['ALL', 'PLA', 'PETG', 'TPU', 'ABS'].map(mat => (
            <button
              key={mat}
              onClick={() => setSpoolMaterialFilter(mat)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 transition cursor-pointer ${
                spoolMaterialFilter === mat
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-[var(--app-card-sub)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] border border-[var(--app-border)]'
              }`}
            >
              {mat === 'ALL' ? 'Alle' : mat}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 border border-[var(--app-border)] rounded-xl p-1 bg-[var(--app-input-bg)]/60">
        {filteredSpools.length === 0 ? (
          <div className="py-6 text-center text-[var(--app-text-muted)] text-xs">
            Keine Spule gefunden für „{spoolSearchQuery}“
          </div>
        ) : (
          filteredSpools.map(s => {
            const isSelected = s.id === selectedSpoolId;
            return (
              <div
                key={s.id}
                onClick={() => setSelectedSpoolId(s.id)}
                className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-orange-500/15 border-orange-500 shadow-sm'
                    : 'bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] border-[var(--app-border)]/80 hover:border-orange-500/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-5 h-5 rounded-full border border-white/20 shrink-0 shadow-sm"
                    style={{ backgroundColor: s.colorHex || '#f97316' }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase text-orange-400">
                        {s.brand}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--app-card-sub)] text-[var(--app-text)] font-bold border border-[var(--app-border)]">
                        {s.material}
                      </span>
                      {s.nfcWritten ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                          ✓ Beschrieben
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                          Offen
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-xs text-[var(--app-text)] truncate mt-0.5">
                      {s.name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono-num text-xs font-bold text-emerald-400">
                    {s.remainingWeight}g
                  </span>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-[var(--app-border)] bg-[var(--app-card-sub)]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Header & Tabs */}
        <div className="p-4 border-b flex items-center justify-between gap-2 shrink-0" style={{ borderColor: 'var(--app-border)' }}>
          {activeTab === 'write-direct' && targetSpool ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center border border-orange-500/30 shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-[var(--app-text)] truncate">
                  Spule auf NFC-Tag schreiben
                </h3>
                <p className="text-[11px] text-orange-400 font-semibold truncate">
                  {targetSpool.brand} {targetSpool.name}
                </p>
              </div>
            </div>
          ) : activeTab === 'inspect' && targetSpool ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-[var(--app-text)] truncate">
                  Inhalt des NFC-Tags
                </h3>
                <p className="text-[11px] text-emerald-400 font-semibold truncate">
                  ✓ Verknüpft mit {targetSpool.brand} {targetSpool.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--app-card-sub)] border border-[var(--app-border)] text-xs font-bold">
              {/* TAB 1: BATCH-MODUS (ALLE SPULEN BESCHREIBEN) */}
              <button
                onClick={() => {
                  setActiveTab('batch');
                  setIsBatchActive(true);
                }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'batch'
                    ? 'bg-[var(--app-accent)] text-white shadow-md'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Alle Spulen beschreiben</span>
                <span className="sm:hidden">Alle</span>
              </button>

              {/* TAB 2: LESEN */}
              <button
                onClick={() => {
                  setActiveTab('read');
                  startNfcScan();
                }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'read' ? 'bg-orange-500 text-white shadow' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Lesen</span>
              </button>

              {/* TAB 3: EINZEL-TAG SCHREIBEN */}
              <button
                onClick={() => {
                  setActiveTab('write');
                  setWriteSuccessMessage('');
                  setWriteErrorMessage('');
                }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'write' ? 'bg-orange-500 text-white shadow' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Einzel-Spule</span>
                <span className="sm:hidden">Einzeln</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {(activeTab === 'write-direct' || activeTab === 'inspect') && (
              <button
                onClick={() => {
                  setActiveTab('batch');
                  setIsBatchActive(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-[var(--app-text)] text-[11px] font-semibold border border-[var(--app-border)] transition cursor-pointer"
                title="Zur Übersicht aller Spulen"
              >
                Übersicht
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-accent-sub)] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollbarer Modal-Inhalt */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* =============================================================== */}
          {/* TAB 1: MODUS "ALLE SPULEN BESCHREIBEN"                          */}
          {/* =============================================================== */}
          {activeTab === 'batch' && <NfcBatchTab writeFormat={writeFormat} setWriteFormat={setWriteFormat} writtenCount={writtenCount} totalCount={totalCount} progressPct={progressPct} allCompleted={allCompleted} onResetAllNfcWritten={onResetAllNfcWritten} currentBatchSpool={currentBatchSpool} batchLastSuccessMessage={batchLastSuccessMessage} batchErrorMessage={batchErrorMessage} handleSimulateBatchTagContact={handleSimulateBatchTagContact} isBatchWriting={isBatchWriting} handleSkipCurrentBatchSpool={handleSkipCurrentBatchSpool} spools={spools} setBatchTargetSpoolId={setBatchTargetSpoolId} />}

          {/* =============================================================== */}
          {/* TAB 2: NFC-TAG LESEN                                           */}
          {/* =============================================================== */}
          {activeTab === 'read' && <NfcReadTab unwrittenTagDetected={unwrittenTagDetected} setUnwrittenTagDetected={setUnwrittenTagDetected} startNfcScan={startNfcScan} detectedTagUid={detectedTagUid} renderSpoolPicker={renderSpoolPicker} targetSpool={targetSpool} handleWriteSpoolToCurrentTag={handleWriteSpoolToCurrentTag} isWriting={isWriting} loadedSpool={loadedSpool} activeLoadedSpool={activeLoadedSpool} adjustFeedbackMessage={adjustFeedbackMessage} handleAdjustLoadedSpoolWeight={handleAdjustLoadedSpoolWeight} adjustGramsInput={adjustGramsInput} setAdjustGramsInput={setAdjustGramsInput} handleDeleteLoadedTag={handleDeleteLoadedTag} onSelectSpoolForEdit={onSelectSpoolForEdit} onAssignToSlot={onAssignToSlot} onClose={onClose} scanStatusMessage={scanStatusMessage} handleSimulateUnwrittenTag={handleSimulateUnwrittenTag} handleSimulateLoadedTag={handleSimulateLoadedTag} waitingSpool={waitingSpool} waitingErase={waitingErase} cancelWaiting={cancelWaiting} writeSuccessMessage={writeSuccessMessage} writeErrorMessage={writeErrorMessage} changePicker={changePicker} setChangePicker={setChangePicker} openChangePicker={openChangePicker} />}

          {/* =============================================================== */}
          {/* TAB 3: EINZEL-SPULE AUF NFC-TAG BESCHREIBEN                     */}
          {/* =============================================================== */}
          {activeTab === 'write' && <NfcWriteTab writeFormat={writeFormat} setWriteFormat={setWriteFormat} renderSpoolPicker={renderSpoolPicker} targetSpool={targetSpool} writeSuccessMessage={writeSuccessMessage} writeErrorMessage={writeErrorMessage} handleManualWriteSubmit={handleManualWriteSubmit} isWriting={isWriting} />}

          {/* =============================================================== */}
          {/* TAB 4: DIREKT-SCHREIBEN NUR FÜR DIESE SPULE                     */}
          {/* =============================================================== */}
          {activeTab === 'write-direct' && targetSpool && <NfcWriteDirectTab targetSpool={targetSpool} writeSuccessMessage={writeSuccessMessage} onClose={onClose} writeErrorMessage={writeErrorMessage} handleWriteSpoolToCurrentTag={handleWriteSpoolToCurrentTag} isWriting={isWriting} />}

          {/* =============================================================== */}
          {/* TAB 5: INSPEKTOR & LÖSCHEN FÜR BEREITS BESCHRIEBENE SPULE       */}
          {/* =============================================================== */}
          {activeTab === 'inspect' && activeTargetSpool && <NfcInspectTab activeTargetSpool={activeTargetSpool} handleAdjustTargetSpoolWeight={handleAdjustTargetSpoolWeight} adjustGramsInput={adjustGramsInput} setAdjustGramsInput={setAdjustGramsInput} writeSuccessMessage={writeSuccessMessage} writeErrorMessage={writeErrorMessage} handleDeleteTargetSpoolTag={handleDeleteTargetSpoolTag} isWriting={isWriting} setWriteSuccessMessage={setWriteSuccessMessage} setWriteErrorMessage={setWriteErrorMessage} setActiveTab={setActiveTab} />}
        </div>
      </div>
    </div>
  );
};
