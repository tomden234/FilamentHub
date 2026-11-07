import React from 'react';
import { Flame, X, RefreshCw } from 'lucide-react';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { NumInput } from '../ui/NumInput';

interface TemperatureModalProps {
  setTempModalTarget: any;
  tempModalTarget: any;
  setTempModalValue: any;
  tempModalValue: any;
  handleSetTemperature: (...args: any[]) => any;
  actionLoading: any;
}

export const TemperatureModal: React.FC<TemperatureModalProps> = ({
  setTempModalTarget,
  tempModalTarget,
  setTempModalValue,
  tempModalValue,
  handleSetTemperature,
  actionLoading
}) => {
  useEscapeClose(() => setTempModalTarget(null));
  return (
<div
          onClick={() => setTempModalTarget(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <h4 className="font-extrabold text-sm">
                  {tempModalTarget === 'nozzle1'
                    ? 'Düse 1 (Links) Temperatur einstellen'
                    : tempModalTarget === 'nozzle2'
                    ? 'Düse 2 (Rechts) Temperatur einstellen'
                    : 'Druckbett Temperatur einstellen'}
                </h4>
              </div>
              <button onClick={() => setTempModalTarget(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Wähle eine Schnellwahltemperatur oder gib einen benutzerdefinierten Wert ein.
            </p>

            {/* Schnellwahltasten */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                Schnellwahl:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {tempModalTarget === 'bed'
                  ? [
                      { label: 'Aus (0°C)', val: 0 },
                      { label: '50° PLA', val: 50 },
                      { label: '55° PLA+', val: 55 },
                      { label: '65° PETG', val: 65 },
                      { label: '75° PETG', val: 75 },
                      { label: '90° ABS', val: 90 }
                    ].map(b => (
                      <button
                        key={b.val}
                        onClick={() => setTempModalValue(String(b.val))}
                        className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                          tempModalValue === String(b.val)
                            ? 'bg-rose-500/25 border-rose-500 text-rose-300 font-extrabold'
                            : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-accent-sub)]'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))
                  : [
                      { label: 'Aus (0°C)', val: 0 },
                      { label: '190° PLA', val: 190 },
                      { label: '210° PLA', val: 210 },
                      { label: '220° PLA', val: 220 },
                      { label: '240° PETG', val: 240 },
                      { label: '255° ABS', val: 255 }
                    ].map(b => (
                      <button
                        key={b.val}
                        onClick={() => setTempModalValue(String(b.val))}
                        className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                          tempModalValue === String(b.val)
                            ? 'bg-orange-500/25 border-orange-500 text-orange-300 font-extrabold'
                            : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-accent-sub)]'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
              </div>
            </div>

            {/* Manuelle Eingabe */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                Genauer Wert (°C):
              </label>
              <div className="flex items-center gap-2">
                <NumInput
                  type="number"
                  min="0"
                  max={tempModalTarget === 'bed' ? 120 : 300}
                  value={tempModalValue}
                  onChange={e => setTempModalValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border font-mono-num text-sm font-bold outline-none text-center"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
                <span className="text-sm font-bold text-[var(--app-text-muted)]">°C</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button
                onClick={() => setTempModalTarget(null)}
                className="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleSetTemperature(tempModalTarget, Number(tempModalValue))}
                disabled={Boolean(actionLoading)}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-400 hover:to-orange-400 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
                <span>Temperatur setzen</span>
              </button>
            </div>
          </div>
        </div>
  );
};
