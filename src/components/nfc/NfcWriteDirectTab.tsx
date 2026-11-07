import React from 'react';
import { CheckCircle2, Tag, PenTool } from 'lucide-react';
import type { NfcModalProps as ParentProps } from '../NfcModal';

interface NfcWriteDirectTabProps {
  targetSpool: any;
  writeSuccessMessage: any;
  onClose: ParentProps['onClose'];
  writeErrorMessage: any;
  handleWriteSpoolToCurrentTag: (...args: any[]) => any;
  isWriting: any;
}

export const NfcWriteDirectTab: React.FC<NfcWriteDirectTabProps> = ({
  targetSpool,
  writeSuccessMessage,
  onClose,
  writeErrorMessage,
  handleWriteSpoolToCurrentTag,
  isWriting
}) => {
  return (
<div className="space-y-4 text-xs">
              {/* Spulen-Preview */}
              <div className="p-4 rounded-2xl bg-[var(--app-card-sub)] border border-[var(--app-border)] space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-xl border border-white/20 shrink-0 shadow-md"
                    style={{ backgroundColor: targetSpool.colorHex || '#f97316' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase text-orange-400">
                        {targetSpool.brand}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--app-card-sub)] text-[var(--app-text)] font-bold border border-[var(--app-border)]">
                        {targetSpool.material}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                        Noch unbeschrieben
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base text-[var(--app-text)] truncate mt-0.5">
                      {targetSpool.name}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono-num font-extrabold text-sm text-emerald-400 block">
                      {targetSpool.remainingWeight}g
                    </span>
                    <span className="text-[10px] text-[var(--app-text-muted)]">Netto</span>
                  </div>
                </div>
              </div>

              {/* Status & Feedback */}
              {writeSuccessMessage ? (
                <div className="p-5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-emerald-300">
                      Erfolgreich auf NFC-Tag geschrieben!
                    </h4>
                    <p className="text-xs text-[var(--app-text)]">
                      Der Tag ist nun mit <strong>„{targetSpool.brand} {targetSpool.name}“</strong> verknüpft und leuchtet ab jetzt grün.
                    </p>
                  </div>
                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      onClick={onClose}
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
                    >
                      Fertig & Schließen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[var(--app-card-sub)] border border-[var(--app-border)] text-center space-y-4">
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white shadow-xl shadow-orange-500/30">
                      <Tag className="w-8 h-8" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-[var(--app-text)]">
                      Halte den NFC-Tag an dein Smartphone
                    </h4>
                    <p className="text-xs text-[var(--app-text-muted)] max-w-xs mx-auto">
                      Klicke auf den Button unten oder halte den NFC-Tag an die Rückseite deines Geräts.
                    </p>
                  </div>

                  {writeErrorMessage && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                      {writeErrorMessage}
                    </div>
                  )}

                  <button
                    onClick={() => handleWriteSpoolToCurrentTag(targetSpool)}
                    disabled={isWriting}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold text-xs shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>{isWriting ? 'Schreibe NFC-Tag...' : 'Spule jetzt auf NFC-Tag schreiben'}</span>
                  </button>
                </div>
              )}
            </div>
  );
};
