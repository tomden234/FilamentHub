import React from 'react';
import { Edit3 } from 'lucide-react';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { NumInput } from '../ui/NumInput';

export interface EditUsedModalProps {
  setIsEditUsedModalOpen: any;
  editUsedInputValue: any;
  setEditUsedInputValue: any;
  handleSaveUsedGrams: (...args: any[]) => any;
}

export const EditUsedModal: React.FC<EditUsedModalProps> = ({
  setIsEditUsedModalOpen,
  editUsedInputValue,
  setEditUsedInputValue,
  handleSaveUsedGrams
}) => {
  useEscapeClose(() => setIsEditUsedModalOpen(false));
  return (
<div
          onClick={() => setIsEditUsedModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm" style={{ color: 'var(--app-text)' }}>
                    Verdrucktes Filament anpassen
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    Statistik überschreiben (z.B. auf 0 g nach Neueinrichtung)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditUsedModalOpen(false)}
                className="p-1.5 rounded-lg border text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition cursor-pointer"
                style={{ borderColor: 'var(--app-border)' }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--app-text-muted)' }}>
                  Aktueller Zählerstand (Gramm):
                </label>
                <div className="flex items-center gap-2">
                  <NumInput
                    type="number"
                    min="0"
                    step="1"
                    value={editUsedInputValue}
                    onChange={e => setEditUsedInputValue(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border font-mono text-sm font-bold outline-none"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                    placeholder="0"
                  />
                  <span className="font-bold text-sm text-[var(--app-text-muted)]">g</span>
                </div>
              </div>

              {/* 1-Klick Schnellbuttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleSaveUsedGrams(0);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-400 hover:bg-orange-500/25 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <span>✨ Sofort auf 0 g setzen</span>
                </button>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                💾 Dieser Wert wird dauerhaft im Browser-Speicher und, falls ein lokaler Server läuft, in <code className="text-orange-400">./data/filamenthub-storage.json</code> gesichert.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button
                type="button"
                onClick={() => setIsEditUsedModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border text-xs font-semibold hover:bg-[var(--app-accent-sub)] transition cursor-pointer"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(editUsedInputValue);
                  handleSaveUsedGrams(isNaN(val) || val < 0 ? 0 : Math.round(val));
                }}
                className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer shadow-md"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
  );
};
