import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';

import QRCode from 'qrcode';

import {
  X,
  Disc,
  Bot,
  FileCode2,
  Wrench,
  Sparkles,
  Layers,
  PlusCircle,
  Smartphone,
  Settings,
  Check,
  LayoutGrid,
  ChevronDown,
  Palette,
  FlaskConical,
  Plug,
  PanelLeftClose,
  ChevronRight,
  ChevronLeft,
  DatabaseBackup,
  Bell,
  BarChart3,
  QrCode,
  Lightbulb,
  Printer,
  Waves,
  PackageMinus,
  SlidersHorizontal
} from 'lucide-react';
import { TestTab } from './sidebar/TestTab';
import { StatusLedCard } from './sidebar/StatusLedCard';
import { NoticesTab, type NoticeSection } from './workshop/NoticesTab';
import { useBackLayer } from '../utils/backNav';
import {
  AppSettings,
  BrandConfig,
  MaterialDryingConfig,
  SidebarTab,
  Spool,
  VersionProfile,
  ViewMode
} from '../types/filament';
import { ThemeBrightness, ThemeAccent } from '../types/theme';

import { SettingsThemesPanel } from './sidebar/SettingsThemesPanel';
import { SettingsPresetsPanel } from './sidebar/SettingsPresetsPanel';
import { ConnectionsPanel } from './sidebar/ConnectionsPanel';
import { ConnectTab } from './sidebar/ConnectTab';
import { ApkUpdateRow } from './sidebar/ApkUpdateRow';
import { AiAgentTab } from './sidebar/AiAgentTab';
import { GcodeCalcTab } from './sidebar/GcodeCalcTab';
import { ToolsTab } from './sidebar/ToolsTab';
import { isAppShell, IS_DESKTOP } from '../utils/env';

import { useCalculator } from './sidebar/useCalculator';
import { usePresetSettings } from './sidebar/usePresetSettings';
import { useGcodeImport } from './sidebar/useGcodeImport';
import { useAgentChat } from './sidebar/useAgentChat';
import { pairUrlFor } from '../utils/gistStore';
import { isOfficialRevision } from '../data/defaultSpools';

const FunFactsModal = lazy(() => import('./FunFactsModal').then(m => ({ default: m.FunFactsModal })));
const BambuSettingsModal = lazy(() => import('./BambuSettingsModal').then(m => ({ default: m.BambuSettingsModal })));

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Vor-Taste der Maus: Menü wieder öffnen */
  onReopen?: () => void;
  /** Fenster öffnen: Statistik, Etiketten, Postfach */
  onOpenWorkshop?: (tab: 'stats' | 'labels' | 'inbox') => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  spools: Spool[];
  onDeductWeight: (spoolId: string, grams: number) => void;
  onAddWeight?: (spoolId: string, grams: number) => void;
  onMarkDried: (spoolId: string) => void;
  onOpenNewSpool: (prefill?: Partial<Spool>) => void;
  onOpenQr: () => void;
  onOpenNotices?: () => void;
  onSyncCloud: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onRestoreDefaultSpools: () => void;
  onClearAllSpools: () => void;
  onCloudUrlChange: (url: string) => void;
  versionProfiles: VersionProfile[];
  activeVersionId: string;
  onSelectVersion: (versionId: string) => void;
  onCreateVersionProfile: (versionName: string) => void;
  onOpenCamera: () => void;
  onOpenPWAInstall: () => void;
  themeBrightness: ThemeBrightness;
  themeAccent: ThemeAccent;
  onSetBrightness: (b: ThemeBrightness) => void;
  onSetAccent: (a: ThemeAccent) => void;
  // Einstellungs-Hub Props
  appSettings: AppSettings;
  onUpdateMaterialPreset: (material: string, config: MaterialDryingConfig) => void;
  onResetMaterialPreset: (material: string) => void;
  onUpdateBrandPreset: (brand: string, config: BrandConfig) => void;
  onResetBrandPreset: (brand: string) => void;
  onUpdateEibosBagTara: (tara: number) => void;
  onUpdateCardSize?: (size: number) => void;
  onResetAllSettings: () => void;
  cloudDbUrl: string;
  syncStatus: { label: string; ok: boolean };
  /** Desktop: Menü dauerhaft als feste Seitenleiste, ohne Abdunkeln */
  docked?: boolean;
  onToggleDock?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onReopen,
  onOpenWorkshop,
  onSetViewMode,
  spools,
  onDeductWeight,
  onAddWeight,
  onMarkDried,
  onOpenNewSpool,
  onOpenNotices,
  onSyncCloud,
  onExportBackup,
  onImportBackup,
  onRestoreDefaultSpools,
  onClearAllSpools,
  onCloudUrlChange,
  versionProfiles,
  activeVersionId,
  onSelectVersion,
  onCreateVersionProfile,
  onOpenCamera,
  onOpenPWAInstall,
  themeBrightness,
  themeAccent,
  onSetBrightness,
  onSetAccent,
  appSettings,
  onUpdateMaterialPreset,
  onResetMaterialPreset,
  onUpdateBrandPreset,
  onResetBrandPreset,
  onUpdateEibosBagTara,
  onUpdateCardSize,
  cloudDbUrl,
  syncStatus,
  docked = false,
  onToggleDock
}) => {
  // Android-App und installierte Web-App: nur die App-Funktionen. Windows-App/Browser: alles.
  const APP = isAppShell();
  const [activeTab, setActiveTabRaw] = useState<SidebarTab>('home'); // Start: Menü-Liste
  // G-Code-Rechner gibt es in der App nicht: dorthin springt nichts
  const setActiveTab = (t: SidebarTab) => setActiveTabRaw(APP && (t === 'gcode' || t === 'calc') ? 'tools' : t);

  // Kostenrechner State
  const {
    setCalcGrams,
    setCalcPrintHours,
    setCalcSpoolId,
    setCalcPricePerKg,
    calcSpoolId,
    calcGrams,
    calcPricePerKg,
    calcPrintHours,
    calcPrinterWatts,
    setCalcPrinterWatts,
    filamentCost,
    powerCost,
    totalCost
  } = useCalculator({ spools });

  // Versions-Erstellung State
  const [showNewVersionInput, setShowNewVersionInput] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-Close: Wenn ein Profil gewählt wird, oder wenn außerhalb geklickt oder die Seite gescrollt wird
  useEffect(() => {
    if (!isProfileDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    const handleScroll = (e: Event) => {
      // Wenn innerhalb der Profil-Ausklappliste gescrollt wird, Menü NICHT schließen!
      if (profileDropdownRef.current && profileDropdownRef.current.contains(e.target as Node)) {
        return;
      }
      setIsProfileDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isProfileDropdownOpen]);

  // Fun Facts & Self-Hosting Modal State
  const [showFunFacts, setShowFunFacts] = useState<boolean>(false);

  // Einstellungen Sub-State
  const {
    selectedMaterial,
    setSelectedMaterial,
    matInterval,
    setMatInterval,
    matTemp,
    setMatTemp,
    matHours,
    setMatHours,
    handleSaveMaterial,
    matSavedSuccess,
    handleResetMaterial,
    eibosTaraInput,
    setEibosTaraInput,
    handleSaveEibosTara,
    eibosSavedSuccess,
    selectedBrand,
    setSelectedBrand,
    brandTara,
    setBrandTara,
    brandDefaultPrice,
    setBrandDefaultPrice,
    handleSaveBrand,
    brandSavedSuccess,
    handleResetBrand
  } = usePresetSettings({
    appSettings,
    onUpdateMaterialPreset,
    onResetMaterialPreset,
    onUpdateBrandPreset,
    onResetBrandPreset,
    onUpdateEibosBagTara
  });

  // QR-Code Kopplung im Einstellungsreiter
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showBambuSettings, setShowBambuSettings] = useState<boolean>(false);
  const [settingsSubTab, setSettingsSubTab] = useState<'themes' | 'presets' | 'connections'>('themes');
  const [noticeSection, setNoticeSection] = useState<NoticeSection>('print');

  // Kurze Rückmeldung unten im Menü (z. B. G-Code vom Drucker geholt)
  const [haActionToast, setHaActionToast] = useState<string | null>(null);
  useEffect(() => {
    if (!haActionToast) return;
    const t = setTimeout(() => setHaActionToast(null), 6000);
    return () => clearTimeout(t);
  }, [haActionToast]);

  // Mapped Sensor Paths

  // Nabu Casa & Home Assistant Vault State (Dauerhaft gespeichert)

  // Neueste Versionen immer an oberster Stelle anzeigen (umgekehrte Reihenfolge)
  // Alte Revision angetippt: nur Beschreibung zeigen (die App läuft immer auf dem neuesten Stand)
  const [infoRevId, setInfoRevId] = useState<string | null>(null);
  const infoRev = infoRevId ? versionProfiles.find(v => v.id === infoRevId) : undefined;

  const sortedVersionProfiles = useMemo(() => {
    return [...versionProfiles].slice().reverse();
  }, [versionProfiles]);

  // Auto-Dismiss für alle Benachrichtigungen nach exakt 10 Sekunden (gemäß Benutzeranforderung)

  // Initiales Laden aus dem Tresor

  // Home Assistant Automation (automation.filament_website_auto_pull_github) auslösen (nativ & ohne JSON-Parse Absturz)

  // G-Code vom X2D Drucker automatisch übernehmen

  // Synchronisiere Eingabefelder mit appSettings bei Wechsel des gewählten Materials

  // Synchronisiere Eingabefelder mit appSettings bei Wechsel der gewählten Marke

  // QR-Code generieren für Koppel-Link
  const pairUrl = typeof window !== 'undefined' ? pairUrlFor(cloudDbUrl) : '';

  useEffect(() => {
    if (!pairUrl) return;
    QRCode.toDataURL(pairUrl, {
      width: 200,
      margin: 1.5,
      color: { dark: '#0b111e', light: '#ffffff' }
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(() => {});
  }, [pairUrl]);

  // G-Code Upload Handler
  const {
    handlePullGcodeFromPrinter,
    printerFetchLoading,
    handleGcodeFileChange,
    gcodeData
  } = useGcodeImport({
    setCalcGrams,
    setCalcPrintHours,
    setHaActionToast,
    spools,
    setCalcSpoolId,
    setCalcPricePerKg,
    setActiveTab
  });

  // KI-Agent Befehle verarbeiten
  const {
    setAiInput,
    chatMessages,
    handleAiSubmit,
    aiInput
  } = useAgentChat({
    spools,
    onOpenCamera,
    onSetViewMode,
    versionProfiles,
    onSelectVersion,
    setActiveTab,
    appSettings,
    onMarkDried,
    onDeductWeight,
    onAddWeight
  });

  // Zurück-Taste: erst die Seite im Menü, dann das Menü selbst
  useBackLayer(isOpen && !docked, onClose, 'menu', onReopen);
  // Vor-Taste öffnet genau die Seite wieder, die offen war
  const pageSnapshot = { tab: activeTab, sub: settingsSubTab, ns: noticeSection };
  useBackLayer((isOpen || docked) && activeTab !== 'home', () => setActiveTab('home'), 'menu-page', () => {
    setSettingsSubTab(pageSnapshot.sub);
    setNoticeSection(pageSnapshot.ns);
    setActiveTab(pageSnapshot.tab);
  });

  if (!isOpen && !docked) return null;

  const activeVersion =
    versionProfiles.find(v => v.id === activeVersionId) || versionProfiles[versionProfiles.length - 1];


  const handleCreateVersionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionName.trim()) return;
    onCreateVersionProfile(newVersionName.trim());
    setNewVersionName('');
    setShowNewVersionInput(false);
  };

  // Speichern der Material-Trocknungsparameter

  // Zurücksetzen der Material-Trocknungsparameter

  // Speichern der Hersteller-Tara

  // Zurücksetzen der Hersteller-Tara

  // Speichern der Eibos-Beutel-Tara

  const handleCopyPairLink = async () => {
    try {
      await navigator.clipboard.writeText(pairUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  const isThemesTab = activeTab === 'settings' && settingsSubTab === 'themes';

  // Menü als Liste: jeder Punkt öffnet seine Seite, oben links „Zurück“. App = ohne G-Code-Rechner und Material,
  // Windows-App/Browser = alles (im Browser zusätzlich „Handy“).
  const notice = (ns: NoticeSection) => () => {
    setNoticeSection(ns);
    setActiveTab('notices');
  };
  const settings = (sub: 'themes' | 'presets' | 'connections') => () => {
    setSettingsSubTab(sub);
    setActiveTab('settings');
  };
  // 1.191: Menü neu sortiert, flach (jeder Punkt öffnet direkt seine Seite). Werkstatt aufgelöst: Statistik/Etiketten hier und
  // oben in der Leiste, Status-LED bei den Geräten, Mitteilungs-Einstellungen in einzelne Seiten aufgeteilt.
  const homeItems: { key: string; icon: React.ComponentType<{ className?: string }>; title: string; sub: string; go: () => void; group: string }[] = [
    { key: 'stats', group: 'Werkzeuge', icon: BarChart3, title: 'Statistik', sub: 'Verbrauch, Drucke, Lager', go: () => onOpenWorkshop?.('stats') },
    { key: 'labels', group: 'Werkzeuge', icon: QrCode, title: 'Etiketten', sub: 'QR-Etiketten für Spulen drucken', go: () => onOpenWorkshop?.('labels') },
    ...(APP ? [] : [{ key: 'gcode', group: 'Werkzeuge', icon: FileCode2, title: 'G-Code und Kosten', sub: 'Filament und Druckkosten berechnen', go: () => setActiveTab('gcode') }]),
    { key: 'ai', group: 'Werkzeuge', icon: Bot, title: 'KI-Assistent', sub: 'Fragen zu deinen Spulen stellen', go: () => setActiveTab('ai') },
    { key: 'inbox', group: 'Mitteilungen', icon: Bell, title: 'Postfach', sub: 'Alle Meldungen ansehen', go: () => onOpenWorkshop?.('inbox') },
    { key: 'n-print', group: 'Mitteilungen', icon: Printer, title: 'Druck', sub: 'Start, fertig, Fehler, Spulen-Check', go: notice('print') },
    { key: 'n-dry', group: 'Mitteilungen', icon: Waves, title: 'Trocknen und Feuchte', sub: 'Trockner, Feuchte-Alarm, Sensoren', go: notice('dry') },
    { key: 'n-spools', group: 'Mitteilungen', icon: PackageMinus, title: 'Fast leere Spulen', sub: 'Grenze und Markierung', go: notice('spools') },
    { key: 'n-device', group: 'Mitteilungen', icon: Smartphone, title: 'Aufs Handy', sub: 'Benachrichtigungen, Test-Mitteilung', go: notice('device') },
    { key: 'n-adv', group: 'Mitteilungen', icon: SlidersHorizontal, title: 'Zeiten und Grenzen', sub: 'Wartezeiten und Schwellen', go: notice('advanced') },
    { key: 'connections', group: 'Geräte', icon: Plug, title: 'Verbindungen', sub: 'Drucker, Home Assistant, Cloud, NFC-Leser', go: settings('connections') },
    { key: 'led', group: 'Geräte', icon: Lightbulb, title: 'Status-LED', sub: 'Farben, Helligkeit, Test', go: () => setActiveTab('led') },
    { key: 'test', group: 'Geräte', icon: FlaskConical, title: 'Testmenü', sub: 'NFC-Leser, Tag, Taster, LEDs, Feuchte prüfen', go: () => setActiveTab('test') },
    // „Handy“ (App installieren, QR) nur im Browser: in den Apps steckt es unter Verbindungen
    ...(APP || IS_DESKTOP ? [] : [{ key: 'connect', group: 'Geräte', icon: Smartphone, title: 'Handy', sub: 'App installieren, QR-Code', go: () => setActiveTab('connect') }]),
    { key: 'themes', group: 'Einstellungen', icon: Palette, title: 'Aussehen', sub: 'Design, Farben, Größe der Kacheln', go: settings('themes') },
    ...(APP ? [] : [{ key: 'presets', group: 'Einstellungen', icon: FlaskConical, title: 'Material', sub: 'Trocknung und Leergewichte je Material', go: settings('presets') }]),
    { key: 'tools', group: 'Einstellungen', icon: DatabaseBackup, title: 'Sichern und Laden', sub: 'Backup, Import, Cloud-Abgleich', go: () => setActiveTab('tools') },
    { key: 'funfacts', group: 'Info', icon: Sparkles, title: 'Fun Facts', sub: 'Echte Zahlen zu Druckzeit, Lager und Code', go: () => setShowFunFacts(true) }
  ];
  const TONES: Record<string, string> = {
    Werkzeuge: 'text-violet-400 bg-violet-500/15 border-violet-500/30',
    Mitteilungen: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    'Geräte': 'text-sky-400 bg-sky-500/15 border-sky-500/30',
    Einstellungen: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    Info: 'text-rose-400 bg-rose-500/15 border-rose-500/30'
  };
  const NOTICE_TITLES: Record<NoticeSection, string> = {
    print: 'Mitteilungen: Druck',
    dry: 'Mitteilungen: Trocknen und Feuchte',
    spools: 'Mitteilungen: Fast leere Spulen',
    device: 'Mitteilungen: Aufs Handy',
    advanced: 'Mitteilungen: Zeiten und Grenzen'
  };
  const pageTitle =
    activeTab === 'ai' ? 'KI-Assistent'
    : activeTab === 'gcode' || activeTab === 'calc' ? 'G-Code und Kosten'
    : activeTab === 'tools' ? 'Sichern und Laden'
    : activeTab === 'connect' ? 'Handy'
    : activeTab === 'led' ? 'Status-LED'
    : activeTab === 'test' ? 'Testmenü'
    : activeTab === 'notices' ? NOTICE_TITLES[noticeSection]
    : settingsSubTab === 'themes' ? 'Aussehen'
    : settingsSubTab === 'presets' ? 'Material'
    : 'Verbindungen';

  return (
    <div className={docked ? 'contents' : 'fixed inset-0 z-50 flex'}>
      {/* Klickbare rechte Fläche schließt das Menü SOFORT (nicht bei der festen Seitenleiste) */}
      {!docked && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity cursor-pointer"
          title="Klick auf die freie Fläche schließt das Menü sofort"
        />
      )}

      {/* Menü-Drawer links - immer geblurred an der Seite außer im Themes-Tab für unverfälschte Farbwahrnehmung */}
      <aside
        onClick={e => e.stopPropagation()}
        className={
          docked
            ? 'sticky top-0 z-20 w-[400px] shrink-0 border-r h-screen flex flex-col justify-between overflow-hidden'
            : `relative z-10 w-[460px] max-w-[94vw] border-r h-full flex flex-col justify-between shadow-2xl overflow-hidden transition-all duration-200 ${
                isThemesTab ? 'backdrop-blur-none' : 'backdrop-blur-2xl'
              }`
        }
        style={{
          backgroundColor: docked || isThemesTab
            ? 'var(--app-card)'
            : 'color-mix(in srgb, var(--app-card) 85%, transparent)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Drawer Header: Schlank & Kompakt */}
        <div
          className="px-3.5 py-2.5 border-b flex items-center justify-between transition-colors shrink-0"
          style={{
            backgroundColor: isThemesTab
              ? 'var(--app-card-sub)'
              : 'color-mix(in srgb, var(--app-card-sub) 85%, transparent)',
            borderColor: 'var(--app-border)'
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-sm text-white shrink-0">
              <Disc className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="fh-serif font-extrabold text-sm tracking-tight" style={{ color: 'var(--app-text)' }}>
                  Menü
                </span>
                <span className="text-[10px] font-mono-num font-bold px-1.5 py-0.2 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  {activeVersion?.id}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {docked ? (
              <button
                onClick={onToggleDock}
                className="p-1 rounded-lg hover:opacity-80 transition cursor-pointer"
                style={{ color: 'var(--app-text-muted)' }}
                title="Seitenleiste einklappen"
                aria-label="Seitenleiste einklappen"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:opacity-80 transition cursor-pointer"
                style={{ color: 'var(--app-text-muted)' }}
                title="Menü schließen (oder rechts außerhalb klicken)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* KOMPAKTE VERSIONSAUSWAHL: 5-Zeilen scrollbares Profil-Ausklappmenü */}
        <div
          className="relative px-3.5 py-2 border-b flex flex-col gap-1 transition-colors shrink-0"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)'
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
              <Layers className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>Stand:</span>
            </div>

            {/* Ausklappbarer Profil-Button */}
            <div ref={profileDropdownRef} className="flex-1 min-w-0 relative">
              <button
                type="button"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between gap-1.5 border cursor-pointer transition shadow-sm text-left"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: isProfileDropdownOpen ? 'var(--app-accent)' : 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
                title="Revisionen und eigene Sicherungen"
              >
                <span className="truncate">
                  {versionProfiles.find(v => v.id === activeVersionId)?.label || activeVersionId}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-orange-400 shrink-0 transition-transform duration-200 ${
                    isProfileDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Ausklappliste: Genau 5 Zeilen hoch (max-h-[195px]), scrollbar */}
              {isProfileDropdownOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border shadow-2xl max-h-[195px] overflow-y-auto divide-y divide-black/5 dark:divide-white/5 scrollbar-thin animate-in fade-in slide-in-from-top-1 duration-150"
                  style={{
                    backgroundColor: 'var(--app-card)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  {sortedVersionProfiles.map((v: VersionProfile) => {
                    const isActive = v.id === activeVersionId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          if (isOfficialRevision(v.id) && !isActive) setInfoRevId(v.id);
                          else onSelectVersion(v.id);
                          setIsProfileDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between gap-2 transition cursor-pointer min-h-[38px] ${
                          isActive
                            ? 'bg-orange-500/15 text-orange-400 font-bold'
                            : 'hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                        style={{
                          color: isActive ? undefined : 'var(--app-text)'
                        }}
                      >
                        <span className="truncate">{v.label}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowNewVersionInput(!showNewVersionInput);
                setIsProfileDropdownOpen(false);
              }}
              className="text-[11px] font-bold px-2 py-1.5 rounded-lg border transition cursor-pointer shrink-0"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-accent-text)'
              }}
              title="Neuen Snapshot/Profil sichern"
            >
              {showNewVersionInput ? 'Abbrechen' : '+ Neu'}
            </button>
          </div>
        </div>

        {infoRev && (
          <div
            className="px-3.5 py-2.5 border-b shrink-0 text-[11px] space-y-1.5"
            style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold">{infoRev.label} · {infoRev.releaseDate}</div>
              <button type="button" onClick={() => setInfoRevId(null)} className="p-0.5 cursor-pointer" style={{ color: 'var(--app-text-muted)' }} aria-label="Schließen">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p style={{ color: 'var(--app-text-muted)' }}>{infoRev.description}</p>
            <ul className="space-y-0.5 max-h-28 overflow-y-auto scrollbar-thin">
              {infoRev.features.slice(0, 8).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            <p className="rounded-lg px-2 py-1.5" style={{ backgroundColor: 'var(--app-input-bg)', color: 'var(--app-text-muted)' }}>
              Alter Stand, nur zum Nachlesen. Die App läuft immer auf dem neuesten Code. Eigene Daten sicherst du mit „+ Neu“ und lädst sie hier wieder.
            </p>
          </div>
        )}

        {showNewVersionInput && (
          <form
            onSubmit={handleCreateVersionSubmit}
            className="px-3.5 py-2 border-b flex gap-2 transition-colors shrink-0"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <input
              type="text"
              placeholder="Profilname (z.B. Werkstatt Setup)..."
              value={newVersionName}
              onChange={e => setNewVersionName(e.target.value)}
              className="flex-1 px-2.5 py-1 rounded-lg text-xs outline-none border"
              style={{
                backgroundColor: 'var(--app-input-bg)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)'
              }}
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              Sichern
            </button>
          </form>
        )}

        {/* Zurück-Leiste (nicht auf der Startliste) */}
        {activeTab !== 'home' && (
          <div
            className="px-2.5 py-2 border-b shrink-0 flex items-center gap-2 transition-colors"
            style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
          >
            <button
              onClick={() => setActiveTab('home')}
              className="px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:opacity-80"
              style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Menü
            </button>
            <h3 className="fh-serif text-sm font-extrabold truncate" style={{ color: 'var(--app-text)' }}>
              {pageTitle}
            </h3>
          </div>
        )}

        {/* TAB-INHALTE: Großzügig, scrollbar & passt sich 100% dem Theme an */}
        <div
          className="flex-1 overflow-y-auto p-3.5 space-y-3.5 transition-colors"
          style={{
            backgroundColor: 'var(--app-card)',
            color: 'var(--app-text)'
          }}
        >
          {/* START: Menü-Liste in Gruppen */}
          {activeTab === 'home' && (
            <div className="space-y-4">
              {Array.from(new Set(homeItems.map(i => i.group))).map(group => (
                <div key={group} className="space-y-1.5">
                  <div className="fh-eyebrow px-1 flex items-center justify-between"><span>{group}</span><span className="opacity-60 font-mono-num">{homeItems.filter(i => i.group === group).length}</span></div>
                  <div className="rounded-xl border overflow-hidden divide-y divide-[var(--app-border)]" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
                    {homeItems
                      .filter(i => i.group === group)
                      .map(item => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            onClick={item.go}
                            className="w-full px-3 py-2.5 flex items-center gap-3 text-left cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99] transition"
                          >
                            <span
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${TONES[item.group] || TONES.Einstellungen}`}
                            >
                              <Icon className="w-4 h-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-bold leading-tight" style={{ color: 'var(--app-text)' }}>{item.title}</span>
                              <span className="block text-[11px] leading-snug truncate" style={{ color: 'var(--app-text-muted)' }}>{item.sub}</span>
                            </span>
                            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 1: ZENTRALER EINSTELLUNGS-HUB */}
          {activeTab === 'settings' && (
            <div className="space-y-3">
              {/* BEREICH 1: THEMES & DESIGN */}
              {settingsSubTab === 'themes' && <SettingsThemesPanel themeBrightness={themeBrightness} themeAccent={themeAccent} onSetBrightness={onSetBrightness} onSetAccent={onSetAccent} />}

              {/* BEREICH: KACHEL-GRÖSSE (SLIDER) */}
              {settingsSubTab === 'themes' && (
                <div
                  className="rounded-2xl border p-4 space-y-3.5 shadow-sm transition-colors"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-xl border flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: 'var(--app-accent-sub)',
                          borderColor: 'var(--app-accent)',
                          color: 'var(--app-accent-text)'
                        }}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs" style={{ color: 'var(--app-text)' }}>
                          Größe der Filament-Kacheln
                        </h4>
                        <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                          Karten stufenlos verkleinern oder vergrößern
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-xs font-mono font-black px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: 'var(--app-accent-sub)',
                        borderColor: 'var(--app-accent)',
                        color: 'var(--app-accent-text)'
                      }}
                    >
                      {appSettings.cardSize || 340} px
                    </span>
                  </div>

                  {/* Regler: darunter klein/groß und wie viele Kacheln pro Reihe (eigene Zeile, nichts überlappt) */}
                  <div className="space-y-1.5">
                    <input
                      type="range"
                      min={200}
                      max={540}
                      step={10}
                      value={appSettings.cardSize || 340}
                      onChange={e => onUpdateCardSize?.(Number(e.target.value))}
                      aria-label="Kachelgröße"
                      className="w-full cursor-pointer"
                      style={{ accentColor: 'var(--app-accent)' }}
                    />
                    <div className="flex justify-between items-center text-[10px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                      <span>klein</span>
                      <span className="font-extrabold" style={{ color: 'var(--app-accent-text)' }}>
                        {(appSettings.cardSize || 340) <= 250
                          ? '4–5 Kacheln pro Reihe'
                          : (appSettings.cardSize || 340) <= 330
                          ? '3–4 Kacheln pro Reihe'
                          : (appSettings.cardSize || 340) <= 420
                          ? '2–3 Kacheln pro Reihe'
                          : '1–2 Kacheln pro Reihe'}
                      </span>
                      <span>groß</span>
                    </div>
                  </div>

                  {/* Schnellauswahl-Buttons: Jeder Button mit anderer Größe UND Spaltenmenge */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {[
                      { count: '4–5 pro Reihe', label: 'Kompakt', size: 230 },
                      { count: '3–4 pro Reihe', label: 'Standard', size: 310 },
                      { count: '2–3 pro Reihe', label: 'Groß', size: 390 },
                      { count: '1–2 pro Reihe', label: 'Maxi', size: 490 }
                    ].map(preset => {
                      const isSelected = (appSettings.cardSize || 340) === preset.size;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => onUpdateCardSize?.(preset.size)}
                          className={`py-1.5 px-1.5 rounded-xl text-center border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                            isSelected
                              ? 'text-white shadow-sm'
                              : 'hover:opacity-80'
                          }`}
                          style={{
                            backgroundColor: isSelected ? 'var(--app-accent)' : 'var(--app-card)',
                            borderColor: isSelected ? 'var(--app-accent)' : 'var(--app-border)',
                            color: isSelected ? '#ffffff' : 'var(--app-text-muted)'
                          }}
                        >
                          <span className="text-[11px] font-extrabold">{preset.label}</span>
                          <span className="text-[9.5px] opacity-80">{preset.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BEREICH 2: MATERIAL & TARA (PRESETS) */}
              {!APP && settingsSubTab === 'presets' && <SettingsPresetsPanel selectedMaterial={selectedMaterial} setSelectedMaterial={setSelectedMaterial} appSettings={appSettings} matInterval={matInterval} setMatInterval={setMatInterval} matTemp={matTemp} setMatTemp={setMatTemp} matHours={matHours} setMatHours={setMatHours} handleSaveMaterial={handleSaveMaterial} matSavedSuccess={matSavedSuccess} handleResetMaterial={handleResetMaterial} eibosTaraInput={eibosTaraInput} setEibosTaraInput={setEibosTaraInput} handleSaveEibosTara={handleSaveEibosTara} eibosSavedSuccess={eibosSavedSuccess} selectedBrand={selectedBrand} setSelectedBrand={setSelectedBrand} brandTara={brandTara} setBrandTara={setBrandTara} brandDefaultPrice={brandDefaultPrice} setBrandDefaultPrice={setBrandDefaultPrice} handleSaveBrand={handleSaveBrand} brandSavedSuccess={brandSavedSuccess} handleResetBrand={handleResetBrand} />}

              {/* BEREICH 3: VERBINDUNGEN (aufgeräumte Liste, zeigt nur was es auf diesem Gerät gibt) */}
              {settingsSubTab === 'connections' && (
                <ConnectionsPanel
                  cloudDbUrl={cloudDbUrl}
                  onCloudUrlChange={onCloudUrlChange}
                  onOpenBambu={() => setShowBambuSettings(true)}
                  onOpenPhone={() => setActiveTab('connect')}
                  onOpenPWAInstall={onOpenPWAInstall}
                  onClose={onClose}
                />
              )}
            </div>
          )}

          {/* TAB 2: VERBINDEN & APK */}
          {activeTab === 'connect' && <ConnectTab qrCodeDataUrl={qrCodeDataUrl} handleCopyPairLink={handleCopyPairLink} copiedLink={copiedLink} onOpenPWAInstall={onOpenPWAInstall} />}

          {/* TAB 3: KI-AGENT */}
          {activeTab === 'ai' && <AiAgentTab setAiInput={setAiInput} chatMessages={chatMessages} handleAiSubmit={handleAiSubmit} aiInput={aiInput} />}

          {/* TAB 4: G-CODE & RECHNER (VEREINT) */}
          {!APP && (activeTab === 'gcode' || activeTab === 'calc') && <GcodeCalcTab handlePullGcodeFromPrinter={handlePullGcodeFromPrinter} printerFetchLoading={printerFetchLoading} handleGcodeFileChange={handleGcodeFileChange} gcodeData={gcodeData} calcSpoolId={calcSpoolId} setCalcSpoolId={setCalcSpoolId} spools={spools} onDeductWeight={onDeductWeight} setCalcPricePerKg={setCalcPricePerKg} calcGrams={calcGrams} setCalcGrams={setCalcGrams} calcPricePerKg={calcPricePerKg} calcPrintHours={calcPrintHours} setCalcPrintHours={setCalcPrintHours} calcPrinterWatts={calcPrinterWatts} setCalcPrinterWatts={setCalcPrinterWatts} filamentCost={filamentCost} powerCost={powerCost} totalCost={totalCost} />}

          {/* Status-LED und Mitteilungs-Einstellungen als eigene Seiten */}
          {activeTab === 'led' && <StatusLedCard />}
          {activeTab === 'test' && <TestTab />}
          {activeTab === 'notices' && <NoticesTab section={noticeSection} />}

          {/* TAB 6: TOOLS & BACKUP */}
          {activeTab === 'tools' && <ToolsTab full={!APP} onSyncCloud={onSyncCloud} onExportBackup={onExportBackup} onImportBackup={onImportBackup} onRestoreDefaultSpools={onRestoreDefaultSpools} onClearAllSpools={onClearAllSpools} />}
        </div>

        {haActionToast && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 shrink-0" style={{ backgroundColor: 'var(--app-accent-sub)', borderColor: 'var(--app-accent)', color: 'var(--app-text)' }}>
            <span className="min-w-0">{haActionToast}</span>
            <button onClick={() => setHaActionToast(null)} className="cursor-pointer text-xs shrink-0" aria-label="Schließen">✕</button>
          </div>
        )}
        <ApkUpdateRow />
        {/* Drawer Footer */}
        <div
          className="p-3 border-t flex items-center justify-between text-xs shrink-0 transition-colors"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)',
            color: 'var(--app-text-muted)'
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus.ok ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-[11px]">{syncStatus.label}</span>
          </div>

          <button
            onClick={() => onOpenNewSpool()}
            className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Spule hinzufügen</span>
          </button>
        </div>
      </aside>

      {/* Fun Facts & Self-Hosting Modals */}
      <Suspense fallback={null}>
        {showBambuSettings && <BambuSettingsModal isOpen onClose={() => setShowBambuSettings(false)} />}
        {showFunFacts && <FunFactsModal isOpen onClose={() => setShowFunFacts(false)} spools={spools} />}
      </Suspense>
    </div>
  );
};
