import React, { useState, useEffect, useRef } from 'react';
import { SpoolSelect } from './SpoolPicker';
import { printerApi } from '../api';
import {
  ScrollText,
  ChevronRight,
  Trash2,
  Copy,
  Check,
  Plug,
  Lightbulb,
  Flame,
  Disc,
  Server,
  Camera,
  Activity,
  Search,
  ListOrdered,
  Printer
} from 'lucide-react';
import { QueueTab } from './workshop/QueueTab';
import { PrintsTab } from './workshop/PrintsTab';
import { LogCategory, SystemLogEntry, Spool } from '../types/filament';
import { getSystemLogs, clearSystemLogs, addSystemLog } from '../utils/logService';
import { safeStorage } from '../utils/safeStorage';
import { useBackLayer } from '../utils/backNav';
import { setDruckerOpen, setQueueDock, useQueueDock } from '../utils/queueDock';
import { QUEUE_PANEL_W } from './QueueDrawer';

interface RightLogDrawerProps {
  onOpenPrinterSettings?: () => void;
  spools?: Spool[];
  onDeductWeight?: (spoolId: string, grams: number) => void;
  /** Drucker steckt schon in der festen Leiste: hier nur die Logs */
  logsOnly?: boolean;
}

export const RightLogDrawer: React.FC<RightLogDrawerProps> = ({
  onOpenPrinterSettings: _onOpenPrinterSettings,
  spools,
  onDeductWeight,
  logsOnly = false
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  // Warteschlangen-Fach offen: der Drucker-Streifen rückt neben dessen Kante, statt darüber zu liegen
  const queuePanelOpen = useQueueDock();
  // Immer nur eines von beiden rechts: Drucker auf → Warteschlange zu; Warteschlange auf → Drucker zu
  useEffect(() => {
    if (isOpen) setQueueDock(false);
    setDruckerOpen(isOpen);
  }, [isOpen]);
  useEffect(() => {
    if (queuePanelOpen) setIsOpen(false);
  }, [queuePanelOpen]);
  const [panelTabState, setPanelTab] = useState<'queue' | 'prints' | 'logs'>('queue');
  const panelTab = logsOnly ? 'logs' : panelTabState;
  useBackLayer(isOpen, () => setIsOpen(false), 'log-drawer');
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => getSystemLogs());
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [hasNewEntry, setHasNewEntry] = useState<boolean>(false);
  const logListRef = useRef<HTMLDivElement>(null);

  // Automatischer Druck-Abschluss / Aktiver Druckauftrag zum Spulen-Gewichtsabzug
  const [activeJob, setActiveJob] = useState<{
    fileName: string;
    weightGrams: number;
    targetSpoolId: string;
    isDeducted: boolean;
    dismissed: boolean;
  } | null>(null);

  // Druckstatus abfragen und Vorschlag zur Gewichtsabzug vorbereiten
  useEffect(() => {
    const checkPrintStatus = async () => {
      try {
        const res = await printerApi.bambuStatus();
        const data = res.data;
        if (data && data.success) {
          const fileName = data.printName || data.subtask_name || '';
          const grams = Number(data.printGrams) || 0; // nur echte Werte, kein Schätzwert mehr
          // Slot-1-Spule aus der AMS-Zuordnung
          let targetSpool: Spool | undefined = undefined;
          try {
            const rawSlots = safeStorage.getItem('filamenthub_ams_slots_x2d');
            if (rawSlots) {
              const parsed = JSON.parse(rawSlots);
              if (parsed[1]) {
                const found = spools?.find(s => s.id === parsed[1]);
                if (found) targetSpool = found;
              }
            }
          } catch {}

          if (fileName && targetSpool && grams > 0) {
            const lastDeducted = safeStorage.getItem('filamenthub_last_deducted_job');
            if (lastDeducted !== fileName) {
              setActiveJob({
                fileName,
                weightGrams: grams,
                targetSpoolId: targetSpool.id,
                isDeducted: false,
                dismissed: false
              });
            }
          }
        }
      } catch {}
    };

    checkPrintStatus();
  }, [spools, isOpen]);

  // Event Listener für neue Logs & Clear
  useEffect(() => {
    const handleNewLog = (e: Event) => {
      const custom = e as CustomEvent<SystemLogEntry>;
      if (custom.detail) {
        setLogs(prev => [custom.detail, ...prev].slice(0, 200));
        if (!isOpen) {
          setHasNewEntry(true);
        }
      }
    };

    const handleClearLogs = () => {
      setLogs(getSystemLogs());
    };

    window.addEventListener('filamenthub:new_log', handleNewLog);
    window.addEventListener('filamenthub:clear_logs', handleClearLogs);

    return () => {
      window.removeEventListener('filamenthub:new_log', handleNewLog);
      window.removeEventListener('filamenthub:clear_logs', handleClearLogs);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(prev => {
      const next = !prev;
      if (next) setHasNewEntry(false);
      return next;
    });
  };

  const handleCopyLogs = async () => {
    const formatted = logs
      .map(l => `[${l.dateStr} ${l.timestamp}] [${l.category.toUpperCase()}] ${l.message}${l.details ? ` (${l.details})` : ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const filteredLogs = logs.filter(log => {
    if (selectedCategory !== 'all' && log.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q)) ||
        log.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCategoryMeta = (cat: LogCategory) => {
    switch (cat) {
      case 'steckdose':
        return { label: 'Steckdose', icon: Plug, color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' };
      case 'drucker':
        return { label: 'Drucker', icon: Activity, color: 'text-sky-400', bg: 'bg-sky-500/15 border-sky-500/30' };
      case 'licht':
        return { label: 'Licht', icon: Lightbulb, color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' };
      case 'temp':
        return { label: 'Temperatur', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30' };
      case 'spule':
        return { label: 'Spule', icon: Disc, color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' };
      case 'kamera':
        return { label: 'Kamera', icon: Camera, color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' };
      case 'system':
      default:
        return { label: 'System', icon: Server, color: 'text-[var(--app-text)]', bg: 'bg-slate-500/15 border-slate-500/30' };
    }
  };

  return (
    <>
      {/* 1. DER ZENTIMETERLANGE STREIFEN AM RECHTEN BILDSCHIRMRAND */}
      <div
        className={`fixed top-1/2 -translate-y-1/2 z-40 transition-all duration-300 select-none ${
          isOpen ? 'translate-x-full pointer-events-none opacity-0' : 'translate-x-0'
        }`}
        style={{ right: queuePanelOpen ? QUEUE_PANEL_W : 0 }}
      >
        <button
          onClick={handleToggle}
          title={logsOnly ? 'Logs: Steckdose, Druckerstatus, Licht, Temperaturen, Spulen' : 'Drucker: Warteschlange, Drucke und Logs'}
          className="group relative flex flex-col items-center justify-between w-7 sm:w-8 min-h-[64px] sm:min-h-[140px] py-2 sm:py-3 px-0.5 sm:px-1.5 rounded-l-2xl border-l-2 border-t border-b shadow-2xl backdrop-blur-xl cursor-pointer transition-all opacity-80 hover:opacity-100 sm:opacity-100 hover:scale-105 active:scale-95"
          style={{
            backgroundColor: 'var(--app-card)',
            borderColor: hasNewEntry ? 'var(--app-accent)' : 'var(--app-border)',
            color: 'var(--app-text)',
            boxShadow: hasNewEntry
              ? '0 0 20px var(--app-accent-sub)'
              : '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
          }}
        >
          {/* Pulsierender Status-Punkt oben */}
          <div className="relative flex items-center justify-center">
            <span
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: hasNewEntry ? 'var(--app-accent)' : '#00AE42' }}
            />
            <span
              className="absolute w-2 h-2 rounded-full"
              style={{ backgroundColor: hasNewEntry ? 'var(--app-accent)' : '#00AE42' }}
            />
          </div>

          {/* Vertikaler Text "LOGS" */}
          <div className="flex flex-col items-center justify-center gap-1 my-1">
            <span
              className="hidden sm:block text-[10px] font-black tracking-widest uppercase [writing-mode:vertical-lr] rotate-180 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--app-text)' }}
            >
              {logsOnly ? 'LOGS' : 'DRUCKER'}
            </span>
            <span
              className="text-[9px] font-mono font-bold px-1 py-0.5 rounded border"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-accent-text)'
              }}
            >
              {logs.length}
            </span>
          </div>

          {/* Icon unten (am Handy statt dem senkrechten Text) */}
          <div style={{ color: 'var(--app-text-muted)' }}>
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </button>
      </div>

      {/* 2. BACKDROP (bei Klick außerhalb schließen – neutral ohne Blaustich) */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-y-0 left-0 z-50 transition-opacity animate-fadeIn cursor-pointer"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', right: queuePanelOpen ? QUEUE_PANEL_W : 0 }}
        />
      )}

      {/* 3. AUSGEKLAPPTES LOG-DRAWER PANEL – IM ORIGINALEN AKTIVEN THEME */}
      <div
        className={`fixed top-0 bottom-0 h-full z-50 w-full sm:w-[420px] shadow-2xl flex flex-col transform transition-all duration-300 ease-out border-l`}
        style={{
          right: queuePanelOpen ? QUEUE_PANEL_W : 0,
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
          // zu: ganz aus dem Bild (auch hinter dem Warteschlangen-Fach weg)
          transform: isOpen ? 'translateX(0)' : `translateX(calc(100% + ${QUEUE_PANEL_W}))`
        }}
      >
        {/* DRAWER HEADER */}
        <div
          className="p-4 border-b flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)'
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--app-accent-sub)',
                borderColor: 'var(--app-accent)',
                color: 'var(--app-accent-text)'
              }}
            >
              <Printer className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm tracking-tight truncate" style={{ color: 'var(--app-text)' }}>
                {logsOnly ? 'Logs' : 'Drucker'}
              </h3>
              <p className="text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                {panelTab === 'queue' ? 'Was als Nächstes gedruckt wird' : panelTab === 'prints' ? 'Fertige Drucke mit Foto' : 'Steckdose, Drucker, Licht, Temperatur und Spulen'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {panelTab === 'logs' && (
            <>
            {/* Kopieren */}
            <button
              onClick={handleCopyLogs}
              title="Alle Logs formatiert kopieren"
              className="p-1.5 rounded-lg border transition cursor-pointer hover:opacity-80"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)'
              }}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Leeren */}
            <button
              onClick={clearSystemLogs}
              title="Logs leeren"
              className="p-1.5 rounded-lg border transition cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-400"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text-muted)'
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            </>
            )}

            {/* Schließen Button */}
            <button
              onClick={() => setIsOpen(false)}
              title="Logs schließen"
              aria-label="Logs schließen"
              className="p-1.5 rounded-lg border transition cursor-pointer ml-1 hover:opacity-80"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)'
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* REITER: Warteschlange, Drucke, Logs */}
        {!logsOnly && (
        <div className="flex gap-1.5 px-3 pt-3 shrink-0">
          {(
            [
              { id: 'queue', label: 'Warteschlange', icon: ListOrdered },
              { id: 'prints', label: 'Drucke', icon: Camera },
              { id: 'logs', label: 'Logs', icon: ScrollText }
            ] as const
          ).map(t => {
            const active = panelTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setPanelTab(t.id)}
                className="px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--app-accent)' : 'var(--app-card-sub)',
                  borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
                  color: active ? '#ffffff' : 'var(--app-text)'
                }}
              >
                <t.icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {t.id === 'logs' && (
                  <span className="text-[10px] font-mono-num opacity-80">{logs.length}</span>
                )}
              </button>
            );
          })}
        </div>
        )}

        {panelTab === 'queue' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <QueueTab spools={spools || []} />
          </div>
        )}
        {panelTab === 'prints' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <PrintsTab />
          </div>
        )}

        {/* AKTIVER / BEENDETER DRUCK: MINIMALISTISCHE 1-KLICK ABZUGS-KARTE */}
        {activeJob && !activeJob.dismissed && !activeJob.isDeducted && (
          <div
            className="mx-3 mt-3 p-3 rounded-2xl border space-y-2 animate-fadeIn shadow-lg shrink-0"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-accent)'
            }}
          >
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--app-accent-text)' }}>
                <span>🖨️</span>
                <span className="truncate max-w-[240px]">Druck: {activeJob.fileName}</span>
              </span>
              <button
                onClick={() => setActiveJob(prev => prev ? { ...prev, dismissed: true } : null)}
                className="text-[11px] opacity-70 hover:opacity-100 cursor-pointer p-0.5"
                style={{ color: 'var(--app-text-muted)' }}
                title="Ausblenden"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--app-text-muted)' }}>Filamentverbrauch:</span>
              <span className="font-mono-num font-black text-orange-400">{activeJob.weightGrams} g</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] block" style={{ color: 'var(--app-text-muted)' }}>
                Abziehen von Spule (AMS Slot 1):
              </label>
              <SpoolSelect
                spools={spools || []}
                value={activeJob.targetSpoolId}
                onChange={id => setActiveJob(prev => prev ? { ...prev, targetSpoolId: id } : null)}
                title="Von welcher Spule abziehen?"
                className="w-full"
              />
            </div>

            <button
              onClick={() => {
                if (!activeJob.targetSpoolId) return;
                onDeductWeight?.(activeJob.targetSpoolId, activeJob.weightGrams);
                safeStorage.setItem('filamenthub_last_deducted_job', activeJob.fileName);
                addSystemLog('spule', `${activeJob.weightGrams}g für Druckauftrag "${activeJob.fileName}" von Spule abgezogen`, 'Auto-Druckabzug', 'success');
                setActiveJob(prev => prev ? { ...prev, isDeducted: true } : null);
              }}
              className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{activeJob.weightGrams}g jetzt abziehen</span>
            </button>
          </div>
        )}

        {panelTab === 'logs' && (
        <>
        {/* SUCHE & KATEGORIE-FILTER */}
        <div
          className="p-3 border-b space-y-2"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)'
          }}
        >
          {/* Suchleiste */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }} />
            <input
              type="text"
              placeholder="Logs durchsuchen (z.B. Leerlauf, Dose, Licht, M104)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border text-xs outline-none transition font-mono"
              style={{
                backgroundColor: 'var(--app-input-bg)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-70 hover:opacity-100"
                style={{ color: 'var(--app-text-muted)' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[11px]">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer border ${
                selectedCategory === 'all'
                  ? 'text-white shadow-xs'
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: selectedCategory === 'all' ? 'var(--app-accent)' : 'var(--app-card)',
                borderColor: selectedCategory === 'all' ? 'var(--app-accent)' : 'var(--app-border)',
                color: selectedCategory === 'all' ? '#ffffff' : 'var(--app-text-muted)'
              }}
            >
              Alle ({logs.length})
            </button>
            <button
              onClick={() => setSelectedCategory('steckdose')}
              className={`px-2 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 border ${
                selectedCategory === 'steckdose'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'hover:opacity-80'
              }`}
              style={selectedCategory !== 'steckdose' ? {
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text-muted)'
              } : undefined}
            >
              <Plug className="w-3 h-3" />
              <span>Dose</span>
            </button>
            <button
              onClick={() => setSelectedCategory('drucker')}
              className={`px-2 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 border ${
                selectedCategory === 'drucker'
                  ? 'bg-[#00AE42] text-white border-[#00AE42]'
                  : 'hover:opacity-80'
              }`}
              style={selectedCategory !== 'drucker' ? {
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text-muted)'
              } : undefined}
            >
              <Activity className="w-3 h-3" />
              <span>Drucker</span>
            </button>
            <button
              onClick={() => setSelectedCategory('licht')}
              className={`px-2 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 border ${
                selectedCategory === 'licht'
                  ? 'bg-amber-500 text-slate-950 font-black border-amber-500'
                  : 'hover:opacity-80'
              }`}
              style={selectedCategory !== 'licht' ? {
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text-muted)'
              } : undefined}
            >
              <Lightbulb className="w-3 h-3" />
              <span>Licht</span>
            </button>
            <button
              onClick={() => setSelectedCategory('temp')}
              className={`px-2 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 border ${
                selectedCategory === 'temp'
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'hover:opacity-80'
              }`}
              style={selectedCategory !== 'temp' ? {
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text-muted)'
              } : undefined}
            >
              <Flame className="w-3 h-3" />
              <span>Temp</span>
            </button>
            <button
              onClick={() => setSelectedCategory('spule')}
              className={`px-2 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 border ${
                selectedCategory === 'spule'
                  ? 'bg-purple-500 text-white border-purple-500'
                  : 'hover:opacity-80'
              }`}
              style={selectedCategory !== 'spule' ? {
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text-muted)'
              } : undefined}
            >
              <Disc className="w-3 h-3" />
              <span>Spulen</span>
            </button>
          </div>
        </div>

        {/* LOG-LISTE CONTAINER */}
        <div ref={logListRef} className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center space-y-2" style={{ color: 'var(--app-text-muted)' }}>
              <ScrollText className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs">Keine Logs für diesen Filter vorhanden.</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs underline cursor-pointer"
                  style={{ color: 'var(--app-accent-text)' }}
                >
                  Suche zurücksetzen
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map(log => {
              const meta = getCategoryMeta(log.category);
              const CatIcon = meta.icon;

              return (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl border transition-colors space-y-1 group"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  {/* Top-Row: Zeit & Kategorie Badge */}
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono-num font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                        [{log.timestamp}]
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${meta.bg} ${meta.color}`}
                      >
                        <CatIcon className="w-2.5 h-2.5" />
                        <span>{meta.label}</span>
                      </span>
                    </div>

                    <span className="text-[9px] font-mono opacity-70" style={{ color: 'var(--app-text-muted)' }}>
                      {log.dateStr}
                    </span>
                  </div>

                  {/* Nachricht */}
                  <p className="text-xs font-sans font-medium leading-relaxed pl-0.5" style={{ color: 'var(--app-text)' }}>
                    {log.message}
                  </p>

                  {/* Detail-Subtext */}
                  {log.details && (
                    <p
                      className="text-[10px] font-mono p-1.5 rounded-lg border break-all"
                      style={{
                        backgroundColor: 'var(--app-input-bg)',
                        borderColor: 'var(--app-border)',
                        color: 'var(--app-text-muted)'
                      }}
                    >
                      {log.details}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* DRAWER FOOTER */}
        <div
          className="p-3 border-t flex items-center justify-between text-[11px]"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)',
            color: 'var(--app-text-muted)'
          }}
        >
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span style={{ color: 'var(--app-text)' }}>Live Stream aktiv</span>
          </span>
          <span className="font-mono text-[10px]">
            {filteredLogs.length} von {logs.length} Einträgen
          </span>
        </div>
        </>
        )}
      </div>
    </>
  );
};
