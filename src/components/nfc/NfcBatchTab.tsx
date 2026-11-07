import React from 'react';
import { NfcFormatPicker } from './NfcFormatPicker';
import type { NfcWriteFormat } from '../../utils/nfcManager';
import { Tag, Sparkles, RotateCcw, CheckCircle2, AlertCircle, Zap, SkipForward, Check } from 'lucide-react';
import type { NfcModalProps as ParentProps } from '../NfcModal';

interface NfcBatchTabProps {
  writeFormat: NfcWriteFormat;
  setWriteFormat: (format: NfcWriteFormat) => void;
  writtenCount: any;
  totalCount: any;
  progressPct: any;
  allCompleted: any;
  onResetAllNfcWritten: ParentProps['onResetAllNfcWritten'];
  currentBatchSpool: any;
  batchLastSuccessMessage: any;
  batchErrorMessage: any;
  handleSimulateBatchTagContact: (...args: any[]) => any;
  isBatchWriting: any;
  handleSkipCurrentBatchSpool: (...args: any[]) => any;
  spools: ParentProps['spools'];
  setBatchTargetSpoolId: any;
}

export const NfcBatchTab: React.FC<NfcBatchTabProps> = ({
  writeFormat,
  setWriteFormat,
  writtenCount,
  totalCount,
  progressPct,
  allCompleted,
  onResetAllNfcWritten,
  currentBatchSpool,
  batchLastSuccessMessage,
  batchErrorMessage,
  handleSimulateBatchTagContact,
  isBatchWriting,
  handleSkipCurrentBatchSpool,
  spools,
  setBatchTargetSpoolId
}) => {
  return (
<div className="space-y-4 text-xs">
              <NfcFormatPicker writeFormat={writeFormat} setWriteFormat={setWriteFormat} />

              {/* Fortschritts-Header */}
              <div className="p-3.5 rounded-2xl bg-[var(--app-card-sub)] border border-[var(--app-border)] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[var(--app-text)] flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-orange-400" />
                      <span>NFC Massen-Schreibmodus</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">
                      Fortlaufend
                    </span>
                  </div>
                  <span className="font-mono-num font-bold text-emerald-400 text-sm">
                    {writtenCount} / {totalCount} ({progressPct}%)
                  </span>
                </div>

                {/* Fortschrittsbalken */}
                <div className="w-full h-2.5 rounded-full bg-[var(--app-card-sub)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--app-accent)] rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-[var(--app-text-muted)] pt-0.5">
                  <span>🟢 {writtenCount} Spulen codiert</span>
                  <span>🔴 {totalCount - writtenCount} Spulen noch offen</span>
                </div>
              </div>

              {/* KEINE SPULEN: erst Spulen eintragen */}
              {totalCount === 0 ? (
                <div className="p-6 rounded-2xl bg-[var(--app-card-sub)] border border-[var(--app-border)] text-center space-y-1">
                  <h3 className="text-sm font-extrabold text-[var(--app-text)]">Noch keine Spulen</h3>
                  <p className="text-xs text-[var(--app-text-muted)] max-w-sm mx-auto leading-relaxed">
                    Trag zuerst deine Spulen ein. Danach beschreibst du hier alle Tags nacheinander.
                  </p>
                </div>
              ) : /* CELEBRATION CARD WENN ALLE BESCHRIEBEN */ allCompleted ? (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 text-center space-y-3 animate-in fade-in zoom-in-95">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-[var(--app-text)]">
                      Alle {totalCount} Spulen haben jetzt einen NFC-Tag!
                    </h3>
                    <p className="text-xs text-[var(--app-text)] max-w-sm mx-auto leading-relaxed">
                      Jeder NFC-Tag ist erfolgreich codiert. Alle Filamente leuchten in deiner Filament-Übersicht jetzt grün.
                    </p>
                  </div>
                  <div className="pt-2 flex justify-center gap-2">
                    {onResetAllNfcWritten && (
                      <button
                        onClick={onResetAllNfcWritten}
                        className="px-3 py-1.5 rounded-xl bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-rose-400 border border-rose-500/30 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Alle auf unbeschrieben (rot) zurücksetzen</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* AKTIVER TAG-SCHREIB-FOKUS */
                <div className="p-5 rounded-2xl bg-[var(--app-card-sub)] border-2 border-orange-500/50 space-y-4 text-center shadow-lg">
                  {/* Radar/Wellen Animation */}
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-orange-500/25 animate-ping duration-1000" />
                    <div
                      className="relative w-16 h-16 rounded-2xl flex items-center justify-center border-2 shadow-xl"
                      style={{
                        backgroundColor: currentBatchSpool?.colorHex || '#f97316',
                        borderColor: 'rgba(255, 255, 255, 0.4)'
                      }}
                    >
                      <Tag className="w-8 h-8 text-white drop-shadow" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      Nächste Spule zum Beschreiben
                    </span>
                    <h3 className="text-base font-extrabold text-[var(--app-text)]">
                      {currentBatchSpool?.brand} {currentBatchSpool?.name}
                    </h3>
                    <div className="flex items-center justify-center gap-2 text-xs text-[var(--app-text)] flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-[var(--app-card-sub)] border border-[var(--app-border)] font-bold">
                        {currentBatchSpool?.material}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[var(--app-card-sub)] border border-[var(--app-border)]">
                        Farbe: {currentBatchSpool?.colorName || 'Standard'}
                      </span>
                      <span className="font-mono-num font-bold text-emerald-400">
                        {currentBatchSpool?.remainingWeight}g Rest
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--app-input-bg)]/70 border border-[var(--app-border)] text-xs text-[var(--app-text)] max-w-sm mx-auto leading-relaxed">
                    <strong>Halte jetzt einen NFC-Tag an dein Handy.</strong> Sobald der Tag berührt wird, beschreibt FilamentHub diesen Tag, gibt ein Signal und schaltet automatisch auf die nächste Spule!
                  </div>

                  {/* Letzter Erfolg oder Fehlermeldung */}
                  {batchLastSuccessMessage && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{batchLastSuccessMessage}</span>
                    </div>
                  )}

                  {batchErrorMessage && (
                    <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{batchErrorMessage}</span>
                    </div>
                  )}

                  {/* Steuerungsleiste für Desktop-Test & Überspringen */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-[var(--app-border)]">
                    <button
                      onClick={handleSimulateBatchTagContact}
                      disabled={isBatchWriting}
                      className="px-4 py-2.5 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Tag-Kontakt ausführen (Spule schreiben)</span>
                    </button>

                    <button
                      onClick={handleSkipCurrentBatchSpool}
                      className="px-3 py-2 rounded-xl bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-[var(--app-text)] border border-[var(--app-border)] text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                      title="Diese Spule überspringen und nächste wählen"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Überspringen</span>
                    </button>
                  </div>
                </div>
              )}

              {/* LISTE ALLER SPULEN MIT STATUS ROT / GRÜN */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[var(--app-text)]">
                    Spulen-Übersicht ({spools.length} Filamente):
                  </span>
                  <span className="text-[11px] text-[var(--app-text-muted)]">
                    Tippe auf eine Spule, um sie direkt anzusteuern
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-[var(--app-border)] rounded-xl p-1.5 bg-[var(--app-input-bg)]/60 divide-y divide-[var(--app-border)]">
                  {spools.map((s, idx) => {
                    const isTarget = currentBatchSpool?.id === s.id;
                    const isWritten = s.nfcWritten;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setBatchTargetSpoolId(s.id)}
                        className={`p-2 rounded-xl transition cursor-pointer flex items-center justify-between gap-2 ${
                          isTarget
                            ? 'bg-orange-500/20 border-2 border-orange-500 shadow-sm'
                            : 'hover:bg-[var(--app-accent-sub)] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-5 h-5 rounded-full border border-white/20 shrink-0 shadow-sm"
                            style={{ backgroundColor: s.colorHex || '#f97316' }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono-num text-[var(--app-text-muted)]">
                                #{idx + 1}
                              </span>
                              <span className="text-[10px] font-extrabold uppercase text-orange-400">
                                {s.brand}
                              </span>
                              <span className="text-[10px] px-1 py-0.2 rounded bg-[var(--app-card-sub)] text-[var(--app-text)] font-bold">
                                {s.material}
                              </span>
                            </div>
                            <div className="font-semibold text-xs text-[var(--app-text)] truncate">
                              {s.name}
                            </div>
                          </div>
                        </div>

                        {/* Status-Badge: Rot / Grün */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isWritten ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Beschrieben</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                              <Tag className="w-3 h-3 text-rose-400" />
                              <span>Unbeschrieben</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
  );
};
