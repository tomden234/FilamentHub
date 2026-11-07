import React from 'react';
import { CheckCircle2, Minus, Plus, Trash2, RotateCw } from 'lucide-react';
import { NumInput } from '../ui/NumInput';

interface NfcInspectTabProps {
  activeTargetSpool: any;
  handleAdjustTargetSpoolWeight: (...args: any[]) => any;
  adjustGramsInput: any;
  setAdjustGramsInput: any;
  writeSuccessMessage: any;
  writeErrorMessage: any;
  handleDeleteTargetSpoolTag: (...args: any[]) => any;
  isWriting: any;
  setWriteSuccessMessage: any;
  setWriteErrorMessage: any;
  setActiveTab: any;
}

export const NfcInspectTab: React.FC<NfcInspectTabProps> = ({
  activeTargetSpool,
  handleAdjustTargetSpoolWeight,
  adjustGramsInput,
  setAdjustGramsInput,
  writeSuccessMessage,
  writeErrorMessage,
  handleDeleteTargetSpoolTag,
  isWriting,
  setWriteSuccessMessage,
  setWriteErrorMessage,
  setActiveTab
}) => {
  return (
<div className="space-y-4 text-xs">
              {/* Grünes Status Banner */}
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between gap-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>NFC-Tag beschrieben & einsatzbereit</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono-num font-bold border border-emerald-500/40">
                  Status: Grün
                </span>
              </div>

              {/* Was ist auf dem Tag gespeichert? */}
              <div className="p-4 rounded-2xl bg-[var(--app-card-sub)] border border-[var(--app-border)] space-y-3">
                <span className="text-xs font-extrabold text-[var(--app-text)] block">
                  Gespeicherte Daten auf diesem NFC-Tag:
                </span>

                <div className="p-3 rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-xl border border-white/20 shrink-0 shadow-inner"
                    style={{ backgroundColor: activeTargetSpool.colorHex || '#f97316' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase text-orange-400">
                        {activeTargetSpool.brand}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--app-card-sub)] text-[var(--app-text)] font-bold border border-[var(--app-border)]">
                        {activeTargetSpool.material}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-[var(--app-text)] truncate">
                      {activeTargetSpool.name}
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono-num font-extrabold text-sm text-emerald-400 block">
                      {Math.round(Number(activeTargetSpool.remainingWeight) || 0)}g
                    </span>
                    <span className="text-[10px] text-[var(--app-text-muted)]">von {activeTargetSpool.initialWeight}g</span>
                  </div>
                </div>

                {/* Detail-Gitter */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)]">
                    <span className="text-[var(--app-text-muted)] text-[10px] block">Farbe & Hex:</span>
                    <span className="font-bold text-[var(--app-text)] flex items-center gap-1.5 mt-0.5">
                      <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: activeTargetSpool.colorHex }} />
                      <span>{activeTargetSpool.colorName || 'Standard'} ({activeTargetSpool.colorHex})</span>
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)]">
                    <span className="text-[var(--app-text-muted)] text-[10px] block">Kilopreis:</span>
                    <span className="font-mono-num font-bold text-[var(--app-text)] block mt-0.5">
                      {activeTargetSpool.pricePerKg?.toFixed(2).replace('.', ',')} €/kg
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)]">
                    <span className="text-[var(--app-text-muted)] text-[10px] block">Spulen-Tara (Leer):</span>
                    <span className="font-mono-num font-bold text-[var(--app-text)] block mt-0.5">
                      {activeTargetSpool.emptySpoolWeight || 200} g
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)]">
                    <span className="text-[var(--app-text-muted)] text-[10px] block">Trocknung:</span>
                    <span className="font-bold text-[var(--app-text)] block mt-0.5">
                      {activeTargetSpool.dryTemp || 50}°C / {activeTargetSpool.dryHours || 6}h
                    </span>
                  </div>
                </div>
              </div>

              {/* Schnelle Gewichtsanpassung (+/-) direkt hier */}
              <div className="p-3.5 rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] space-y-3">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-[var(--app-text)] block">
                    ⚡ Gewicht direkt anpassen (+ / -):
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono-num font-extrabold">
                    Aktuell: {Math.round(Number(activeTargetSpool.remainingWeight) || 0)}g
                  </span>
                </div>

                {/* Zeile 1: Schnelltasten Abziehen (-) */}
                <div className="space-y-1">
                  <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                    <Minus className="w-3 h-3 text-rose-400" />
                    <span>Gramm abziehen (-):</span>
                  </span>
                  <div className="grid grid-cols-6 gap-1">
                    {[5, 10, 25, 50, 100, 250].map(amt => (
                      <button
                        key={amt}
                        onClick={() => handleAdjustTargetSpoolWeight(-amt)}
                        className="py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-mono-num font-bold text-[11px] border border-rose-500/30 transition cursor-pointer text-center active:scale-95 shadow-xs"
                        title={`${amt}g abziehen`}
                      >
                        -{amt}g
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zeile 2: Schnelltasten Hinzufügen (+) */}
                <div className="space-y-1 pt-1.5 border-t border-[var(--app-border)]">
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <Plus className="w-3 h-3 text-emerald-400" />
                    <span>Gramm hinzufügen (+ Korrektur):</span>
                  </span>
                  <div className="grid grid-cols-6 gap-1">
                    {[5, 10, 25, 50, 100, 250].map(amt => (
                      <button
                        key={amt}
                        onClick={() => handleAdjustTargetSpoolWeight(amt)}
                        className="py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-mono-num font-bold text-[11px] border border-emerald-500/30 transition cursor-pointer text-center active:scale-95 shadow-xs"
                        title={`${amt}g hinzufügen`}
                      >
                        +{amt}g
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zeile 3: Manuelle Eingabe */}
                <div className="pt-2 border-t border-[var(--app-border)] space-y-1.5">
                  <span className="text-[10px] text-[var(--app-text-muted)] font-semibold block">
                    Beliebigen Betrag anpassen:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(1, parseInt(adjustGramsInput) || 0);
                        handleAdjustTargetSpoolWeight(-val);
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/40 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>Abziehen</span>
                    </button>

                    <div className="relative flex-1">
                      <NumInput
                        type="number"
                        min="1"
                        max="3000"
                        value={adjustGramsInput}
                        onChange={e => setAdjustGramsInput(e.target.value)}
                        placeholder="Gramm..."
                        className="w-full text-center px-3 py-2 rounded-xl bg-[var(--app-card-sub)] border border-[var(--app-border)] text-xs font-mono-num font-bold text-[var(--app-text)] focus:outline-none focus:border-orange-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono-num text-[var(--app-text-muted)] pointer-events-none">
                        g
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(1, parseInt(adjustGramsInput) || 0);
                        handleAdjustTargetSpoolWeight(val);
                      }}
                      className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Hinzufügen</span>
                    </button>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[var(--app-card-sub)]/80 border border-[var(--app-border)] text-[10px] text-[var(--app-text-muted)] flex items-center justify-between">
                  <span>🔄 Direkt synchronisiert:</span>
                  <span className="font-mono-num font-bold text-[var(--app-text)]">
                    {Math.round(Number(activeTargetSpool.remainingWeight) || 0)}g Netto ({Math.round((activeTargetSpool.remainingWeight / (activeTargetSpool.initialWeight || 1000)) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Erfolgs- oder Fehlermeldung */}
              {writeSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                  {writeSuccessMessage}
                </div>
              )}
              {writeErrorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {writeErrorMessage}
                </div>
              )}

              {/* Aktionen: LÖSCHEN (ROT) & ÜBERSCHREIBEN */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleDeleteTargetSpoolTag}
                  disabled={isWriting}
                  className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isWriting ? 'Lösche NFC-Tag...' : 'NFC-Tag löschen & leeren'}</span>
                </button>
                <p className="text-[10px] text-[var(--app-text-muted)] text-center">
                  Entfernt die Daten vom Tag und setzt die Spule wieder auf rot (unbeschrieben).
                </p>

                <button
                  onClick={() => {
                    setWriteSuccessMessage('');
                    setWriteErrorMessage('');
                    setActiveTab('write-direct');
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-[var(--app-text)] font-semibold text-xs border border-[var(--app-border)] flex items-center justify-center gap-1.5 transition cursor-pointer mt-1"
                >
                  <RotateCw className="w-3.5 h-3.5 text-orange-400" />
                  <span>Tag neu überschreiben</span>
                </button>
              </div>
            </div>
  );
};
