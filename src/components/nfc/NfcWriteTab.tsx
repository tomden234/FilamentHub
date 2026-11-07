import React from 'react';
import { NfcFormatPicker } from './NfcFormatPicker';
import type { NfcWriteFormat } from '../../utils/nfcManager';
import { Tag, CheckCircle2, AlertCircle, PenTool } from 'lucide-react';

interface NfcWriteTabProps {
  writeFormat: NfcWriteFormat;
  setWriteFormat: (format: NfcWriteFormat) => void;
  renderSpoolPicker: (...args: any[]) => any;
  targetSpool: any;
  writeSuccessMessage: any;
  writeErrorMessage: any;
  handleManualWriteSubmit: (...args: any[]) => any;
  isWriting: any;
}

export const NfcWriteTab: React.FC<NfcWriteTabProps> = ({
  writeFormat,
  setWriteFormat,
  renderSpoolPicker,
  targetSpool,
  writeSuccessMessage,
  writeErrorMessage,
  handleManualWriteSubmit,
  isWriting
}) => {
  return (
<div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-[11px] text-[var(--app-text)] space-y-1">
                <span className="font-bold text-orange-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Einzelne Spule auf NFC-Tag schreiben</span>
                </span>
                <p>
                  Wähle unten die Spule aus. Klicke dann auf <strong>„Spule auf NFC-Tag schreiben“</strong> und halte den Tag an dein Smartphone.
                </p>
              </div>

              <NfcFormatPicker writeFormat={writeFormat} setWriteFormat={setWriteFormat} />

              {renderSpoolPicker()}

              {targetSpool && (
                <div className="p-3 rounded-xl bg-[var(--app-card-sub)] border border-[var(--app-border)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-6 h-6 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: targetSpool.colorHex || '#f97316' }}
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-[var(--app-text)] block truncate">{targetSpool.brand} {targetSpool.name}</span>
                      <span className="text-[10px] text-[var(--app-text-muted)]">{targetSpool.material} • {Math.round(Number(targetSpool.remainingWeight) || 0)}g Netto</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {targetSpool.nfcWritten ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        Bereits beschrieben
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                        Noch unbeschrieben
                      </span>
                    )}
                  </div>
                </div>
              )}

              {writeSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{writeSuccessMessage}</span>
                </div>
              )}

              {writeErrorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{writeErrorMessage}</span>
                </div>
              )}

              <button
                onClick={handleManualWriteSubmit}
                disabled={isWriting || !targetSpool}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold text-xs shadow-lg shadow-orange-500/25 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <PenTool className="w-4 h-4" />
                <span>{isWriting ? 'Halte den NFC-Tag an dein Smartphone...' : 'Spule jetzt auf NFC-Tag schreiben'}</span>
              </button>
            </div>
  );
};
