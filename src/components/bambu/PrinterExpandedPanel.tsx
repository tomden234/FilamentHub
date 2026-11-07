import React from 'react';
import {
  Power,
  Layers,
  Clock,
  RefreshCw,
  Pause,
  Play,
  Square,
  Droplets
} from 'lucide-react';

import type { BambuPrinterWidgetProps as ParentProps } from '../BambuPrinterWidget';
import { AmsSection } from './AmsSection';
import { TemperatureCards } from './TemperatureCards';

export interface PrinterExpandedPanelProps {
  /** Handy-Ansicht: Druckauftrag-Kasten und Temperaturen ausblenden */
  compact?: boolean;
  isSocketOff: any;
  haCreds: any;
  handleToggleSwitch: (...args: any[]) => any;
  haSwitchLoading: any;
  isPrinterPowerOff: any;
  isPrinterConnected: any;
  liveState: any;
  setActionToast: any;
  setTempModalTarget: any;
  setTempModalValue: any;
  inlineNozzle1Temp: any;
  setInlineNozzle1Temp: any;
  handleSendGcodeLine: (...args: any[]) => any;
  actionLoading: any;
  inlineNozzle2Temp: any;
  setInlineNozzle2Temp: any;
  inlineBedTemp: any;
  setInlineBedTemp: any;
  isPrinting: any;
  handleSendCommand: (...args: any[]) => any;
  setShowStopPinModal: any;
  setAmsSlots: any;
  activeSlot: any;
  amsSlots: any;
  spools: ParentProps['spools'];
  handleSetActiveSlot: (...args: any[]) => any;
  setEditingAmsSlot: any;
  setAmsEditColor: any;
  setAmsEditMaterial: any;
  handleSetAmsSlot: (...args: any[]) => any;
  onApplyDryingCredit: ParentProps['onApplyDryingCredit'];
  amsDryTemp: any;
  isDryingActive: any;
  getHumidityDisplay: (...args: any[]) => any;
  calcRemainingTime: (...args: any[]) => any;
  setAmsDryHours: any;
  amsDryHours: any;
  setAmsDryTemp: any;
  handleToggleAmsDrying: (...args: any[]) => any;
  nfcInfo?: { readers: number; unknown: number[]; tags?: Record<number, string>; status?: Record<number, string>; lastTag?: string };
  dryLoading: any;
  /** Ein Druck läuft (auch vorbereiten/pausiert) */
  printActive?: boolean;
  /** „Nach Druck ausschalten“ ist gewählt */
  autoOffArmed?: boolean;
  onToggleAutoOff?: () => void;
  /** „Nach Druck trocknen“ ist gewählt */
  dryAfterArmed?: boolean;
  onToggleDryAfter?: () => void;
}

export const PrinterExpandedPanel: React.FC<PrinterExpandedPanelProps> = ({
  compact = false,
  isSocketOff,
  haCreds,
  handleToggleSwitch,
  haSwitchLoading,
  isPrinterPowerOff,
  isPrinterConnected,
  liveState,
  setActionToast,
  setTempModalTarget,
  setTempModalValue,
  inlineNozzle1Temp,
  setInlineNozzle1Temp,
  handleSendGcodeLine,
  actionLoading,
  inlineNozzle2Temp,
  setInlineNozzle2Temp,
  inlineBedTemp,
  setInlineBedTemp,
  isPrinting,
  handleSendCommand,
  setShowStopPinModal,
  setAmsSlots,
  activeSlot,
  amsSlots,
  spools,
  handleSetActiveSlot,
  setEditingAmsSlot,
  setAmsEditColor,
  setAmsEditMaterial,
  handleSetAmsSlot,
  onApplyDryingCredit,
  amsDryTemp,
  isDryingActive,
  getHumidityDisplay,
  calcRemainingTime,
  setAmsDryHours,
  amsDryHours,
  setAmsDryTemp,
  handleToggleAmsDrying,
  nfcInfo,
  dryLoading,
  printActive = false,
  autoOffArmed = false,
  onToggleAutoOff,
  dryAfterArmed = false,
  onToggleDryAfter
}) => {
  return (
<div className="p-4 sm:p-5 space-y-4">
          {/* BANNER WENN STROMLOS / AUSGESCHALTET */}
          {isSocketOff && (
            <div className="p-3.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <Power className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-300">
                    Drucker ist aktuell ausgeschaltet (stromlos)
                  </p>
                  <p className="text-[11px] text-[var(--app-text-muted)]">
                    Die Home Assistant LAN-Steckdose ({haCreds.switchEntity}) ist abgeschaltet. Schalte die Steckdose ein, um den Bambu Lab X2D zu starten.
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleSwitch}
                disabled={haSwitchLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
              >
                <Power className="w-4 h-4" />
                <span>{haSwitchLoading ? 'Schaltet ein...' : 'Jetzt Drucker anschalten'}</span>
              </button>
            </div>
          )}

          {/* SECTION 1: FORTSCHRITT & JOB-DETAILS (nicht in der Handy-Ansicht) */}
          {!compact && (
          <div
            className="p-4 rounded-2xl border space-y-3 transition-colors"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                  Aktueller Druckauftrag:
                </span>
                <span className={`text-xs font-mono font-semibold break-all ${
                  isPrinterPowerOff ? 'text-[var(--app-text-muted)]' : 'text-[#00AE42]'
                }`}>
                  {isSocketOff
                    ? 'Drucker ist ausgeschaltet (kein Strom)'
                    : !isPrinterConnected
                    ? 'Drucker offline'
                    : (liveState.data.subtask_name || liveState.data.gcode_file || 'Bereit für neuen Druckauftrag')}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono-num font-bold">
                <span className="flex items-center gap-1" style={{ color: 'var(--app-text)' }}>
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    Schicht {isPrinterConnected ? `${liveState.data.layer_num} / ${liveState.data.total_layer_num || 0}` : '-- / --'}
                  </span>
                </span>
                <span className="text-[var(--app-text-muted)]">•</span>
                <span className={`flex items-center gap-1 ${isPrinterConnected ? 'text-[#00AE42]' : 'text-[var(--app-text-muted)]'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isPrinterConnected ? liveState.formatted.remainingTimeStr : '--'}</span>
                </span>
              </div>
            </div>

            {/* Fortschrittsbalken */}
            <div
              className="w-full h-3 rounded-full overflow-hidden border p-0.5 shadow-inner"
              style={{
                backgroundColor: 'var(--app-card)',
                borderColor: 'var(--app-border)'
              }}
            >
              <div
                className="h-full transition-all duration-500 rounded-full shadow-sm"
                style={{
                  width: `${isPrinterConnected ? Math.min(100, Math.max(0, liveState.data.mc_percent)) : 0}%`,
                  background: 'var(--app-accent-gradient, var(--app-accent))'
                }}
              />
            </div>
          </div>
          )}

          {/* SECTION 2: TEMPERATUR-KACHELN MIT DIREKTEM KLICK ZUM ANPASSEN (nicht in der Handy-Ansicht) */}
          {!compact && <TemperatureCards isPrinterConnected={isPrinterConnected} setActionToast={setActionToast} setTempModalTarget={setTempModalTarget} setTempModalValue={setTempModalValue} liveState={liveState} inlineNozzle1Temp={inlineNozzle1Temp} isPrinterPowerOff={isPrinterPowerOff} setInlineNozzle1Temp={setInlineNozzle1Temp} handleSendGcodeLine={handleSendGcodeLine} actionLoading={actionLoading} inlineNozzle2Temp={inlineNozzle2Temp} setInlineNozzle2Temp={setInlineNozzle2Temp} inlineBedTemp={inlineBedTemp} setInlineBedTemp={setInlineBedTemp} />}

          {/* SECTION 3: DRUCKSTEUERUNG (PAUSE, FORTSETZEN, STOPP) */}
          <div
            className="p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 transition-colors"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                Drucksteuerung:
              </span>
              <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                {isPrinterConnected ? (compact ? 'Bereit' : 'Direkte MQTTS-Befehle an Bambu Lab X2D') : 'Inaktiv (Drucker offline)'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {(printActive || autoOffArmed) && onToggleAutoOff && (
                <button
                  onClick={onToggleAutoOff}
                  title={autoOffArmed ? 'Abwählen: Drucker bleibt nach dem Druck an' : 'Steckdose ausschalten, 3 Minuten nach Druckende'}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    autoOffArmed ? 'border-sky-500/60 bg-sky-500/20 text-sky-300' : 'border-[var(--app-border)] text-[var(--app-text-muted)] hover:bg-sky-500/10'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{autoOffArmed ? 'Aus nach Druck ✓' : 'Nach Druck aus'}</span>
                </button>
              )}
              {(printActive || dryAfterArmed) && onToggleDryAfter && (
                <button
                  onClick={onToggleDryAfter}
                  title={dryAfterArmed ? 'Abwählen: nach dem Druck nicht trocknen' : 'AMS-Trocknung starten, wenn der Druck fertig ist'}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    dryAfterArmed ? 'border-amber-500/60 bg-amber-500/20 text-amber-300' : 'border-[var(--app-border)] text-[var(--app-text-muted)] hover:bg-amber-500/10'
                  }`}
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>{dryAfterArmed ? 'Danach trocknen ✓' : 'Danach trocknen'}</span>
                </button>
              )}
              {isPrinting ? (
                <button
                  onClick={() => handleSendCommand('pause')}
                  disabled={!isPrinterConnected || Boolean(actionLoading)}
                  className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'pause' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSendCommand('resume')}
                  disabled={!isPrinterConnected || Boolean(actionLoading)}
                  className="px-3 py-1.5 rounded-xl border border-[#00AE42]/40 bg-[#00AE42]/15 hover:bg-[#00AE42]/25 text-[#00AE42] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'resume' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Fortsetzen</span>
                </button>
              )}

              <button
                onClick={() => setShowStopPinModal(true)}
                disabled={!isPrinterConnected || Boolean(actionLoading)}
                className="px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Square className="w-3.5 h-3.5" />
                <span>{compact ? 'Stopp' : 'Druck abbrechen (Stopp)'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 4: AMS 1-4 SLOTS, TELEMETRIE & SPULEN-EDITOR */}
          <AmsSection compact={compact} setAmsSlots={setAmsSlots} setActionToast={setActionToast} activeSlot={activeSlot} amsSlots={amsSlots} spools={spools} liveState={liveState} handleSetActiveSlot={handleSetActiveSlot} setEditingAmsSlot={setEditingAmsSlot} setAmsEditColor={setAmsEditColor} setAmsEditMaterial={setAmsEditMaterial} handleSetAmsSlot={handleSetAmsSlot} onApplyDryingCredit={onApplyDryingCredit} amsDryTemp={amsDryTemp} isDryingActive={isDryingActive} getHumidityDisplay={getHumidityDisplay} calcRemainingTime={calcRemainingTime} setAmsDryHours={setAmsDryHours} amsDryHours={amsDryHours} setAmsDryTemp={setAmsDryTemp} handleToggleAmsDrying={handleToggleAmsDrying} dryLoading={dryLoading} nfcInfo={nfcInfo} />
        </div>
  );
};
