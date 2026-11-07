import React from 'react';
import { Flame, Edit3, Thermometer, Wind } from 'lucide-react';
import type { PrinterExpandedPanelProps as ParentProps } from './PrinterExpandedPanel';
import { NumInput } from '../ui/NumInput';

interface TemperatureCardsProps {
  isPrinterConnected: ParentProps['isPrinterConnected'];
  setActionToast: ParentProps['setActionToast'];
  setTempModalTarget: ParentProps['setTempModalTarget'];
  setTempModalValue: ParentProps['setTempModalValue'];
  liveState: ParentProps['liveState'];
  inlineNozzle1Temp: ParentProps['inlineNozzle1Temp'];
  isPrinterPowerOff: ParentProps['isPrinterPowerOff'];
  setInlineNozzle1Temp: ParentProps['setInlineNozzle1Temp'];
  handleSendGcodeLine: ParentProps['handleSendGcodeLine'];
  actionLoading: ParentProps['actionLoading'];
  inlineNozzle2Temp: ParentProps['inlineNozzle2Temp'];
  setInlineNozzle2Temp: ParentProps['setInlineNozzle2Temp'];
  inlineBedTemp: ParentProps['inlineBedTemp'];
  setInlineBedTemp: ParentProps['setInlineBedTemp'];
}

export const TemperatureCards: React.FC<TemperatureCardsProps> = ({
  isPrinterConnected,
  setActionToast,
  setTempModalTarget,
  setTempModalValue,
  liveState,
  inlineNozzle1Temp,
  isPrinterPowerOff,
  setInlineNozzle1Temp,
  handleSendGcodeLine,
  actionLoading,
  inlineNozzle2Temp,
  setInlineNozzle2Temp,
  inlineBedTemp,
  setInlineBedTemp
}) => {
  return (
<div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                <Flame className="w-4 h-4 text-orange-400" />
                <span>X2D Temperaturen {isPrinterConnected ? '(Klicke auf eine Kachel zum Einstellen):' : '(Drucker stromlos / offline):'}</span>
              </span>
              <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                {isPrinterConnected ? 'Klicke auf Hotend oder Bett zur Anpassung' : 'Werte inaktiv (--) solange Drucker offline'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Düse 1 (Links) - KLICKBAR & INLINE EINGABEFELD */}
              <div
                onClick={() => {
                  if (!isPrinterConnected) {
                    setActionToast({ text: 'Drucker ist offline oder stromlos. Keine Temperatursteuerung möglich.', ok: false });
                    return;
                  }
                  setTempModalTarget('nozzle1');
                  setTempModalValue(String(liveState.data.nozzle_target_temper || inlineNozzle1Temp));
                }}
                className={`p-3 rounded-2xl border flex flex-col justify-between transition-all group ${
                  isPrinterPowerOff ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer hover:border-orange-500 hover:ring-2 hover:ring-orange-500/30'
                }`}
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
                title={isPrinterConnected ? 'Klicke hier oder nutze das Eingabefeld, um Düse 1 (Links) per M104 S... einzustellen' : 'Drucker ist offline / stromlos'}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0 group-hover:scale-110 transition-transform">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-orange-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Düse 1 (Links)</span>
                        {isPrinterConnected && <Edit3 className="w-2.5 h-2.5 opacity-60" />}
                      </span>
                      <span className="text-[9px] text-[var(--app-text-muted)] font-mono">M104 S</span>
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-mono-num font-extrabold text-orange-400">
                        {isPrinterConnected ? `${liveState.data.nozzle_temper} °C` : '-- °C'}
                      </span>
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                        / Ziel: {isPrinterConnected ? `${liveState.data.nozzle_target_temper || 0}°` : '-- °C'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Eingabefeld M104 S<TEMP> */}
                <div
                  className="mt-2.5 pt-2 border-t flex items-center gap-1.5"
                  style={{ borderColor: 'var(--app-border)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <NumInput
                    type="number"
                    min="0"
                    max="300"
                    disabled={!isPrinterConnected}
                    value={inlineNozzle1Temp}
                    onChange={e => setInlineNozzle1Temp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && isPrinterConnected && handleSendGcodeLine(`M104 S${inlineNozzle1Temp}`)}
                    className="w-16 px-2 py-1 rounded-lg border font-mono-num text-xs font-bold text-center outline-none disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                    placeholder="210"
                  />
                  <span className="text-[11px] font-bold text-[var(--app-text-muted)]">°C</span>
                  <button
                    onClick={() => handleSendGcodeLine(`M104 S${inlineNozzle1Temp}`)}
                    disabled={!isPrinterConnected || Boolean(actionLoading)}
                    className="flex-1 py-1 px-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                    title={`Sendet M104 S${inlineNozzle1Temp} an Düse 1`}
                  >
                    <span>M104 Setzen</span>
                  </button>
                </div>
              </div>

              {/* Düse 2 (Rechts) - KLICKBAR & INLINE EINGABEFELD */}
              <div
                onClick={() => {
                  if (!isPrinterConnected) {
                    setActionToast({ text: 'Drucker ist offline oder stromlos. Keine Temperatursteuerung möglich.', ok: false });
                    return;
                  }
                  setTempModalTarget('nozzle2');
                  setTempModalValue(String(liveState.data.nozzle2_target_temper || inlineNozzle2Temp));
                }}
                className={`p-3 rounded-2xl border flex flex-col justify-between transition-all group ${
                  isPrinterPowerOff ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer hover:border-amber-500 hover:ring-2 hover:ring-amber-500/30'
                }`}
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
                title={isPrinterConnected ? 'Klicke hier oder nutze das Eingabefeld, um Düse 2 (Rechts) per M104 T0 S... einzustellen' : 'Drucker ist offline / stromlos'}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-110 transition-transform">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-amber-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Düse 2 (Rechts)</span>
                        {isPrinterConnected && <Edit3 className="w-2.5 h-2.5 opacity-60" />}
                      </span>
                      <span className="text-[9px] text-[var(--app-text-muted)] font-mono">M104 T0</span>
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-mono-num font-extrabold text-amber-400">
                        {isPrinterConnected
                          ? (liveState.data.nozzle2_temper !== null && liveState.data.nozzle2_temper !== undefined
                              ? `${liveState.data.nozzle2_temper} °C`
                              : '33 °C')
                          : '-- °C'}
                      </span>
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                        / Ziel: {isPrinterConnected ? `${liveState.data.nozzle2_target_temper || 0}°` : '-- °C'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Eingabefeld M104 T0 S<TEMP> */}
                <div
                  className="mt-2.5 pt-2 border-t flex items-center gap-1.5"
                  style={{ borderColor: 'var(--app-border)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <NumInput
                    type="number"
                    min="0"
                    max="300"
                    disabled={!isPrinterConnected}
                    value={inlineNozzle2Temp}
                    onChange={e => setInlineNozzle2Temp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && isPrinterConnected && handleSendGcodeLine(`M104 T0 S${inlineNozzle2Temp}`)}
                    className="w-16 px-2 py-1 rounded-lg border font-mono-num text-xs font-bold text-center outline-none disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                    placeholder="210"
                  />
                  <span className="text-[11px] font-bold text-[var(--app-text-muted)]">°C</span>
                  <button
                    onClick={() => handleSendGcodeLine(`M104 T0 S${inlineNozzle2Temp}`)}
                    disabled={!isPrinterConnected || Boolean(actionLoading)}
                    className="flex-1 py-1 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                    title={`Sendet M104 T0 S${inlineNozzle2Temp} an Düse 2`}
                  >
                    <span>M104 T0 Setzen</span>
                  </button>
                </div>
              </div>

              {/* Druckbett (Heatbed) - KLICKBAR & INLINE EINGABEFELD */}
              <div
                onClick={() => {
                  if (!isPrinterConnected) {
                    setActionToast({ text: 'Drucker ist offline oder stromlos. Keine Temperatursteuerung möglich.', ok: false });
                    return;
                  }
                  setTempModalTarget('bed');
                  setTempModalValue(String(liveState.data.bed_target_temper || inlineBedTemp));
                }}
                className={`p-3 rounded-2xl border flex flex-col justify-between transition-all group ${
                  isPrinterPowerOff ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer hover:border-rose-500 hover:ring-2 hover:ring-rose-500/30'
                }`}
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
                title={isPrinterConnected ? 'Klicke hier oder nutze das Eingabefeld, um das Druckbett per M140 S... einzustellen' : 'Drucker ist offline / stromlos'}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 group-hover:scale-110 transition-transform">
                    <Thermometer className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-rose-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Druckbett</span>
                        {isPrinterConnected && <Edit3 className="w-2.5 h-2.5 opacity-60" />}
                      </span>
                      <span className="text-[9px] text-[var(--app-text-muted)] font-mono">M140 S</span>
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-mono-num font-extrabold text-rose-400">
                        {isPrinterConnected ? `${liveState.data.bed_temper} °C` : '-- °C'}
                      </span>
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                        / Ziel: {isPrinterConnected ? `${liveState.data.bed_target_temper || 0}°` : '-- °C'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Eingabefeld M140 S<TEMP> */}
                <div
                  className="mt-2.5 pt-2 border-t flex items-center gap-1.5"
                  style={{ borderColor: 'var(--app-border)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <NumInput
                    type="number"
                    min="0"
                    max="120"
                    disabled={!isPrinterConnected}
                    value={inlineBedTemp}
                    onChange={e => setInlineBedTemp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && isPrinterConnected && handleSendGcodeLine(`M140 S${inlineBedTemp}`)}
                    className="w-16 px-2 py-1 rounded-lg border font-mono-num text-xs font-bold text-center outline-none disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                    placeholder="55"
                  />
                  <span className="text-[11px] font-bold text-[var(--app-text-muted)]">°C</span>
                  <button
                    onClick={() => handleSendGcodeLine(`M140 S${inlineBedTemp}`)}
                    disabled={!isPrinterConnected || Boolean(actionLoading)}
                    className="flex-1 py-1 px-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[10px] transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                    title={`Sendet M140 S${inlineBedTemp} an Druckbett`}
                  >
                    <span>M140 Setzen</span>
                  </button>
                </div>
              </div>

              {/* Bauraum (Chamber) */}
              <div
                className={`p-3 rounded-2xl border flex flex-col justify-between transition-colors ${
                  isPrinterPowerOff ? 'opacity-65' : ''
                }`}
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                    <Wind className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-sky-400">
                      Bauraum & Lüfter
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-mono-num font-extrabold text-sky-400">
                        {isPrinterConnected ? `${liveState.data.chamber_temper} °C` : '-- °C'}
                      </span>
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                        {isPrinterConnected ? `(${liveState.data.fan_gear}% Fan)` : '(-- % Fan)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-2.5 pt-2 border-t flex items-center gap-1.5"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <button
                    onClick={() => handleSendGcodeLine('M106 S255')}
                    disabled={!isPrinterConnected}
                    className="flex-1 py-1 px-1.5 rounded-lg border text-[10px] font-bold hover:bg-[var(--app-accent-sub)] transition cursor-pointer text-center text-[var(--app-text)] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    Lüfter 100%
                  </button>
                  <button
                    onClick={() => handleSendGcodeLine('M106 S0')}
                    disabled={!isPrinterConnected}
                    className="flex-1 py-1 px-1.5 rounded-lg border text-[10px] font-bold hover:bg-[var(--app-accent-sub)] transition cursor-pointer text-center text-[var(--app-text-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    Lüfter Aus
                  </button>
                </div>
              </div>
            </div>
          </div>
  );
};
