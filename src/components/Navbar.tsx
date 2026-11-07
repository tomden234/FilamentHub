import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Undo2,
  Redo2,
  History,
  PlusCircle,
  Smartphone,
  Monitor,
  ChevronDown,
  Tag,
  FileText,
  BarChart3,
  Bell,
  ListOrdered
} from 'lucide-react';
import { ThreeDPrinterIcon } from './ThreeDPrinterIcon';
import { ViewMode, VersionProfile } from '../types/filament';
import { isAppShell } from '../utils/env';
import { useUnreadCount } from '../utils/inbox';
import { openWorkshop } from '../utils/uiEvents';

export type DeviceMode = 'app' | 'desktop';

interface NavbarProps {
  onOpenMenu: () => void;
  /** Menü ist als feste Seitenleiste offen: dann braucht es keinen Menü-Knopf */
  menuDocked?: boolean;
  deviceMode: DeviceMode;
  onSetDeviceMode: (mode: DeviceMode) => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenQr: () => void;
  onSyncCloud: () => void;
  isSyncing: boolean;
  syncOk: boolean;
  onOpenHistory: () => void;
  onOpenWorkshop?: () => void;
  historyCount: number;
  onOpenNewSpool: () => void;
  onOpenNfc: () => void;
  activeVersionLabel: string;
  versionProfiles?: VersionProfile[];
  activeVersionId?: string;
  onSelectVersion?: (versionId: string) => void;
  onCreateVersionProfile?: (versionName: string) => void;
  onRestoreDefault?: () => void;
  onOpenCamera: () => void;
  onOpenPWAInstall: () => void;
  onOpenConnectPrinter?: () => void;
  /** Warteschlange vom Pi (null = kein Pi mit Hub: Knopf bleibt weg) */
  queueCount?: number | null;
  onOpenQueue?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMenu,
  menuDocked = false,
  deviceMode,
  onSetDeviceMode,
  viewMode,
  onSetViewMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenHistory,
  onOpenWorkshop,
  historyCount,
  onOpenNewSpool,
  onOpenNfc,
  activeVersionId = 'v1.61',
  onOpenCamera,
  onOpenConnectPrinter,
  queueCount,
  onOpenQueue
}) => {
  // Installierte Web-App oder Android-App: Browser-Hilfen (Umschalter, Webseite öffnen, QR) sind dort überflüssig
  const appShell = isAppShell();
  const unread = useUnreadCount();
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNewDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-xl border-b transition-colors shadow-sm"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        backgroundColor: 'var(--app-card)',
        borderColor: 'var(--app-border)',
        color: 'var(--app-text)'
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Zone 1: Brand & Menu Trigger & Eingebettete Version oben */}
        <div className="flex items-center gap-2">
          {!menuDocked && (
            <button
              onClick={onOpenMenu}
              title="Menü: KI-Assistent, Tools, Einstellungen, Versionen"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition shadow-sm cursor-pointer"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)'
              }}
            >
              <Menu className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-bold hidden sm:inline">Menü</span>
            </button>
          )}

          <img
            src={`${import.meta.env.BASE_URL || '/'}pwa-192x192.png`}
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 rounded-[10px] shrink-0 shadow-md"
            draggable={false}
          />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm sm:text-base font-extrabold tracking-tight whitespace-nowrap" style={{ color: 'var(--app-text)' }}>
              FilamentHub
            </span>

            {/* Eingebettete Versionsanzeige in sauberer App-Schrift (Plus Jakarta Sans) */}
            <span
              className="text-xs font-bold tracking-tight px-2 py-0.5 rounded-lg border border-orange-500/30 text-orange-400 bg-orange-500/15 shrink-0 select-none shadow-sm"
              title={`FilamentHub ${activeVersionId || 'v1.61'}`}
            >
              {activeVersionId || 'v1.61'}
            </span>
          </div>
        </div>

        {/* Zone 2: App vs. Desktop Toggle & Parameter-Switch (nur im Browser) */}
        {!appShell && (
        <div className="hidden sm:flex items-center gap-2">
          {/* Umschalter zwischen App und Desktop mit kleinen Icons */}
          <div
            className="inline-flex items-center rounded-xl p-0.5 border shadow-inner transition-colors"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
            title="Umschalten zwischen Smartphone-App und Desktop-Modus"
          >
            <button
              onClick={() => onSetDeviceMode('app')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                deviceMode === 'app'
                  ? 'bg-[var(--app-accent)] text-white shadow-sm'
                  : 'hover:text-[var(--app-text)]'
              }`}
              style={{
                color: deviceMode === 'app' ? '#ffffff' : 'var(--app-text-muted)'
              }}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>App</span>
            </button>
            <button
              onClick={() => onSetDeviceMode('desktop')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                deviceMode === 'desktop'
                  ? 'bg-[var(--app-accent)] text-white shadow-sm'
                  : 'hover:text-[var(--app-text)]'
              }`}
              style={{
                color: deviceMode === 'desktop' ? '#ffffff' : 'var(--app-text-muted)'
              }}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
          </div>

          {/* Switch mit Parametern (im Desktop-Modus wieder sichtbar) */}
          {deviceMode === 'desktop' && (
            <div
              className="inline-flex items-center rounded-xl p-0.5 border shadow-inner transition-colors"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
              title="Ansichts-Modus: Vollständig (mit Trocknungsbalken) | Kompakt | Parameter (Bambu Studio Slicer-Werte)"
            >
              <button
                onClick={() => onSetViewMode('full')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'full' ? 'text-white shadow-sm' : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: viewMode === 'full' ? 'var(--app-accent)' : 'transparent',
                  color: viewMode === 'full' ? '#ffffff' : 'var(--app-text-muted)'
                }}
              >
                Voll
              </button>
              <button
                onClick={() => onSetViewMode('simple')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'simple' ? 'text-white shadow-sm' : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: viewMode === 'simple' ? 'var(--app-accent)' : 'transparent',
                  color: viewMode === 'simple' ? '#ffffff' : 'var(--app-text-muted)'
                }}
              >
                Kompakt
              </button>
              <button
                onClick={() => onSetViewMode('params')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'params' ? 'text-white shadow-sm' : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: viewMode === 'params' ? 'var(--app-accent)' : 'transparent',
                  color: viewMode === 'params' ? '#ffffff' : 'var(--app-text-muted)'
                }}
              >
                Parameter
              </button>
            </div>
          )}
        </div>
        )}

        {/* Zone 3: App/QR Kombi, Undo/Redo & Neu-Dropdown */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Undo / Redo */}
          <div
            className="inline-flex items-center rounded-xl border overflow-hidden"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Rückgängig (Strg+Z)"
              className="p-1.5 hover:opacity-80 text-xs transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              style={{ color: 'var(--app-text)' }}
            >
              <Undo2 className="w-3.5 h-3.5 text-sky-400" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Wiederholen (Strg+Y)"
              className="p-1.5 hover:opacity-80 text-xs transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-l"
              style={{
                color: 'var(--app-text)',
                borderColor: 'var(--app-border)'
              }}
            >
              <Redo2 className="w-3.5 h-3.5 text-sky-400" />
            </button>
          </div>

          {/* Druck-Verlauf Log */}
          <button
            onClick={onOpenHistory}
            title="Verlauf: Drucke vom Drucker und Abzüge"
            aria-label="Verlauf öffnen"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <History className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-mono-num text-[11px]">{historyCount}</span>
          </button>

          {/* Mitteilungen: Postfach mit Zähler */}
          <button
            onClick={() => openWorkshop('inbox')}
            title="Mitteilungen: Trocknen fertig, Druck fertig, ..."
            aria-label={unread > 0 ? `${unread} ungelesene Mitteilungen` : 'Mitteilungen öffnen'}
            className="relative inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer"
            style={{ backgroundColor: 'var(--app-card-sub)', borderColor: unread > 0 ? 'var(--app-accent)' : 'var(--app-border)', color: 'var(--app-text)' }}
          >
            <Bell className="w-3.5 h-3.5" style={{ color: unread > 0 ? 'var(--app-accent-text)' : undefined }} />
            {unread > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 text-center font-extrabold text-white" style={{ backgroundColor: 'var(--app-accent)' }}>
                {unread}
              </span>
            )}
          </button>

          {/* Warteschlange vom Pi: Fach rechts */}
          {onOpenQueue && queueCount !== null && queueCount !== undefined && (
            <button
              onClick={onOpenQueue}
              title="Warteschlange: nächste Drucke"
              aria-label={`Warteschlange öffnen (${queueCount})`}
              className="relative inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer"
              style={{ backgroundColor: 'var(--app-card-sub)', borderColor: queueCount > 0 ? 'var(--app-accent)' : 'var(--app-border)', color: 'var(--app-text)' }}
            >
              <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono-num text-[11px]">{queueCount}</span>
            </button>
          )}

          {/* Statistik: eigenes Fenster (Etiketten und Status-LED sind im Menü) */}
          {onOpenWorkshop && (
            <button
              onClick={onOpenWorkshop}
              title="Statistik: Verbrauch, Drucke, Lager"
              aria-label="Statistik öffnen"
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)'
              }}
            >
              <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline text-[11px]">Statistik</span>
            </button>
          )}

          {/* NEU BUTTON */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowNewDropdown(!showNewDropdown)}
              className="fh-cta inline-flex items-center gap-1.5 px-3.5 py-2 text-xs transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Neu</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNewDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showNewDropdown && (
              <div
                className="absolute right-0 mt-1.5 w-60 rounded-2xl border p-1.5 shadow-2xl z-50 text-xs backdrop-blur-xl"
                style={{
                  backgroundColor: 'var(--app-card)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                <button
                  onClick={() => {
                    setShowNewDropdown(false);
                    onOpenNewSpool();
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2.5 cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg bg-orange-500/15 text-orange-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold block" style={{ color: 'var(--app-text)' }}>1. Spule anlegen</span>
                    <span className="text-[10px] block truncate" style={{ color: 'var(--app-text-muted)' }}>Schnell oder mit allen Details</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowNewDropdown(false);
                    onOpenCamera();
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2.5 cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold block" style={{ color: 'var(--app-text)' }}>2. Foto-Erkennung</span>
                    <span className="text-[10px] block truncate" style={{ color: 'var(--app-text-muted)' }}>Aufkleber per Kamera scannen</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowNewDropdown(false);
                    onOpenNfc();
                  }}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2.5 cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold block" style={{ color: 'var(--app-text)' }}>3. NFC-Tag</span>
                    <span className="text-[10px] block truncate" style={{ color: 'var(--app-text-muted)' }}>Tag scannen & verknüpfen</span>
                  </div>
                </button>

                {onOpenConnectPrinter && (
                  <button
                    onClick={() => {
                      setShowNewDropdown(false);
                      onOpenConnectPrinter();
                    }}
                    className="w-full p-2.5 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-2.5 cursor-pointer border-t"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400 shrink-0">
                      <ThreeDPrinterIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold block" style={{ color: 'var(--app-text)' }}>4. Drucker hinzufügen</span>
                      <span className="text-[10px] block truncate" style={{ color: 'var(--app-text-muted)' }}>Bambu Lab X2D, P1S, A1...</span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
