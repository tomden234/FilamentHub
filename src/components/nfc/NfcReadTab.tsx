import React from 'react';
import { Tag, X, PenTool, Check, Minus, Plus, Trash2, RotateCcw, Pencil, Radio } from 'lucide-react';
import type { NfcModalProps as ParentProps } from '../NfcModal';
import { LabelPrintButton } from '../LabelPrintButton';
import { NumInput } from '../ui/NumInput';

export interface NfcReadTabProps {
  unwrittenTagDetected: any;
  setUnwrittenTagDetected: any;
  startNfcScan: (...args: any[]) => any;
  detectedTagUid: any;
  renderSpoolPicker: (...args: any[]) => any;
  targetSpool: any;
  handleWriteSpoolToCurrentTag: (...args: any[]) => any;
  isWriting: any;
  loadedSpool: any;
  activeLoadedSpool: any;
  adjustFeedbackMessage: any;
  handleAdjustLoadedSpoolWeight: (...args: any[]) => any;
  adjustGramsInput: any;
  setAdjustGramsInput: any;
  handleDeleteLoadedTag: (...args: any[]) => any;
  onSelectSpoolForEdit: ParentProps['onSelectSpoolForEdit'];
  onAssignToSlot?: ParentProps['onAssignToSlot'];
  onClose: ParentProps['onClose'];
  scanStatusMessage: any;
  handleSimulateUnwrittenTag: (...args: any[]) => any;
  handleSimulateLoadedTag: (...args: any[]) => any;
  /** Spule, die gerade auf den Tag geschrieben wird (wartet auf den Tag) */
  waitingSpool: any;
  /** Löschen läuft (wartet auf den Tag) */
  waitingErase: boolean;
  cancelWaiting: () => void;
  writeSuccessMessage: string;
  writeErrorMessage: string;
  /** „Spule ändern“: Auswahl aller Spulen offen */
  changePicker: boolean;
  setChangePicker: (v: boolean) => void;
  openChangePicker: () => void;
}

/** Wartet im selben Fenster auf den Tag und schreibt/löscht, sobald er am Handy ist */
const WaitBox: React.FC<{ title: string; hint: string; error?: string; onCancel: () => void }> = ({ title, hint, error, onCancel }) => (
  <div className="p-4 rounded-2xl bg-orange-500/10 border-2 border-orange-500/40 text-center space-y-3">
    <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" />
      <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
        <Radio className="w-7 h-7 animate-pulse" />
      </div>
    </div>
    <div className="space-y-1">
      <h4 className="font-extrabold text-sm text-[var(--app-text)]">{title}</h4>
      <p className="text-[11px] text-[var(--app-text-muted)] max-w-xs mx-auto leading-relaxed">{hint}</p>
    </div>
    {error && <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] text-left">{error}</div>}
    <button
      type="button"
      onClick={onCancel}
      className="px-4 py-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-[var(--app-text)] text-xs font-bold cursor-pointer"
    >
      Abbrechen
    </button>
  </div>
);

export const NfcReadTab: React.FC<NfcReadTabProps> = ({
  unwrittenTagDetected,
  setUnwrittenTagDetected,
  startNfcScan,
  detectedTagUid,
  renderSpoolPicker,
  targetSpool,
  handleWriteSpoolToCurrentTag,
  isWriting,
  loadedSpool,
  activeLoadedSpool,
  adjustFeedbackMessage,
  handleAdjustLoadedSpoolWeight,
  adjustGramsInput,
  setAdjustGramsInput,
  handleDeleteLoadedTag,
  onSelectSpoolForEdit,
  onAssignToSlot,
  onClose,
  scanStatusMessage,
  handleSimulateUnwrittenTag,
  handleSimulateLoadedTag,
  waitingSpool,
  waitingErase,
  cancelWaiting,
  writeSuccessMessage,
  writeErrorMessage,
  changePicker,
  setChangePicker,
  openChangePicker
}) => {
  return (
<div className="space-y-4 text-xs">
              {unwrittenTagDetected ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 space-y-3.5 text-center">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Unbeschriebener Tag erkannt</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setUnwrittenTagDetected(false);
                        startNfcScan();
                      }}
                      className="px-2.5 py-1 rounded-lg border border-amber-500/40 hover:bg-amber-500/20 text-amber-300 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                      title="Diesen Tag ignorieren und nach beschriebenen Spulen weitersuchen"
                    >
                      <X className="w-3 h-3" />
                      <span>Weiter scannen</span>
                    </button>
                  </div>
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow">
                    <Tag className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono-num px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      UID: {detectedTagUid}
                    </span>
                    <h4 className="font-extrabold text-sm text-[var(--app-text)]">
                      Neuer / unbeschriebener NFC-Tag erkannt!
                    </h4>
                    <p className="text-[11px] text-[var(--app-text)] max-w-sm mx-auto">
                      Wähle eine Spule aus deinem Bestand, um diesen Tag sofort zu verknüpfen (oder klicke oben auf „Weiter scannen“):
                    </p>
                  </div>

                  {waitingSpool ? (
                    <WaitBox
                      title="Halte den Tag jetzt ans Handy"
                      hint={`Sobald der Tag da ist, schreibe ich „${waitingSpool.brand} ${waitingSpool.name}“ sofort drauf. Nichts weiter drücken.`}
                      error={writeErrorMessage}
                      onCancel={cancelWaiting}
                    />
                  ) : (
                    <div className="text-left space-y-2">
                      {renderSpoolPicker()}

                      {writeErrorMessage && (
                        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px]">{writeErrorMessage}</div>
                      )}

                      {targetSpool && (
                        <button
                          onClick={() => handleWriteSpoolToCurrentTag(targetSpool)}
                          disabled={isWriting}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Diesen Tag mit „{targetSpool.brand} {targetSpool.name}“ beschreiben</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : loadedSpool ? (
                <div className="p-4 rounded-2xl bg-[var(--app-card-sub)] border border-[var(--app-border)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Tag erfolgreich gelesen & zugeordnet</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {detectedTagUid && (
                        <span className="font-mono-num text-[10px] text-[var(--app-text-muted)]">
                          UID: {detectedTagUid}
                        </span>
                      )}
                      {activeLoadedSpool && <LabelPrintButton spool={activeLoadedSpool} compact />}
                    </div>
                  </div>

                  {activeLoadedSpool && (
                    <>
                      <div className="p-3 rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] flex items-center gap-3">
                        <span
                          className="w-8 h-8 rounded-xl border border-white/20 shrink-0 shadow-inner"
                          style={{ backgroundColor: activeLoadedSpool.colorHex || '#f97316' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-extrabold uppercase text-orange-400">
                              {activeLoadedSpool.brand}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--app-card-sub)] text-[var(--app-text)] font-bold border border-[var(--app-border)]">
                              {activeLoadedSpool.material}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-[var(--app-text)] truncate">
                            {activeLoadedSpool.name}
                          </h4>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono-num font-extrabold text-sm text-emerald-400 block">
                            {Math.round(Number(activeLoadedSpool.remainingWeight) || 0)}g
                          </span>
                          <span className="text-[10px] text-[var(--app-text-muted)]">von {activeLoadedSpool.initialWeight || 1000}g Netto</span>
                        </div>
                      </div>

                      {/* Live Feedback bei Gewichtsänderung */}
                      {adjustFeedbackMessage && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{adjustFeedbackMessage}</span>
                        </div>
                      )}

                      {/* Schnellabzug & Hinzufügen (direkt vom Filament abgezogen oder hinzugefügt) */}
                      <div className="p-3.5 rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] space-y-3">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-extrabold text-[var(--app-text)] flex items-center gap-1.5">
                            <span>⚡ Direkt vom Filament abziehen / hinzufügen:</span>
                          </span>
                          <span className="text-[11px] text-emerald-400 font-mono-num font-extrabold">
                            Rest: {Math.round(Number(activeLoadedSpool.remainingWeight) || 0)}g
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
                                onClick={() => handleAdjustLoadedSpoolWeight(-amt)}
                                className="py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-mono-num font-bold text-[11px] border border-rose-500/30 transition cursor-pointer text-center active:scale-95 shadow-xs"
                                title={`${amt}g direkt von ${activeLoadedSpool.name} abziehen`}
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
                            <span>Gramm wieder hinzufügen (+ Korrektur):</span>
                          </span>
                          <div className="grid grid-cols-6 gap-1">
                            {[5, 10, 25, 50, 100, 250].map(amt => (
                              <button
                                key={amt}
                                onClick={() => handleAdjustLoadedSpoolWeight(amt)}
                                className="py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-mono-num font-bold text-[11px] border border-emerald-500/30 transition cursor-pointer text-center active:scale-95 shadow-xs"
                                title={`${amt}g direkt zu ${activeLoadedSpool.name} hinzufügen`}
                              >
                                +{amt}g
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Zeile 3: Beliebigen Betrag manuell abziehen oder hinzufügen */}
                        <div className="pt-2 border-t border-[var(--app-border)] space-y-1.5">
                          <span className="text-[10px] text-[var(--app-text-muted)] font-semibold block">
                            Benutzerdefinierte Gramm-Anzahl:
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const val = Math.max(1, parseInt(adjustGramsInput) || 0);
                                handleAdjustLoadedSpoolWeight(-val);
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
                                handleAdjustLoadedSpoolWeight(val);
                              }}
                              className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Hinzufügen</span>
                            </button>
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-[var(--app-card-sub)]/80 border border-[var(--app-border)] text-[10px] text-[var(--app-text-muted)] flex items-center justify-between">
                          <span>🔄 Echtzeit-Bestand:</span>
                          <span className="font-mono-num font-bold text-[var(--app-text)]">
                            {Math.round(Number(activeLoadedSpool.remainingWeight) || 0)}g Netto ({Math.round((activeLoadedSpool.remainingWeight / (activeLoadedSpool.initialWeight || 1000)) * 100)}%)
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {writeSuccessMessage && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{writeSuccessMessage}</span>
                    </div>
                  )}

                  {/* „Spule ändern“: alle Spulen zur Auswahl, Tag wird auf die gewählte Spule umgeschrieben */}
                  {changePicker && !waitingSpool && !waitingErase && (
                    <div className="p-3 rounded-xl border border-orange-500/40 bg-orange-500/5 space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-orange-400">Andere Spule für diesen Tag wählen</span>
                        <button
                          type="button"
                          onClick={() => setChangePicker(false)}
                          className="p-1 rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] cursor-pointer"
                          title="Auswahl schließen"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {renderSpoolPicker()}
                      {writeErrorMessage && (
                        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px]">{writeErrorMessage}</div>
                      )}
                      {targetSpool && targetSpool.id !== loadedSpool.id && (
                        <button
                          onClick={() => handleWriteSpoolToCurrentTag(targetSpool, loadedSpool.id)}
                          disabled={isWriting}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Tag auf „{targetSpool.brand} {targetSpool.name}“ umschreiben</span>
                        </button>
                      )}
                    </div>
                  )}

                  {waitingSpool && (
                    <WaitBox
                      title="Halte den Tag jetzt ans Handy"
                      hint={`Sobald der Tag da ist, schreibe ich „${waitingSpool.brand} ${waitingSpool.name}“ sofort drauf. Nichts weiter drücken.`}
                      error={writeErrorMessage}
                      onCancel={cancelWaiting}
                    />
                  )}

                  {/* Tag Löschen: wartet im selben Fenster auf den Tag */}
                  {waitingErase ? (
                    <WaitBox
                      title="Halte den Tag jetzt ans Handy"
                      hint="Sobald der Tag da ist, lösche und formatiere ich ihn sofort. Nichts weiter drücken."
                      error={writeErrorMessage}
                      onCancel={cancelWaiting}
                    />
                  ) : (
                    !waitingSpool && (
                      <div className="pt-0.5">
                        <button
                          onClick={handleDeleteLoadedTag}
                          disabled={isWriting}
                          className="w-full py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 shadow-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Diesen NFC-Tag löschen & formatieren</span>
                        </button>
                      </div>
                    )
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      onClick={startNfcScan}
                      className="text-xs font-semibold text-[var(--app-text-muted)] hover:text-[var(--app-text)] flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Weiteren Tag scannen</span>
                    </button>

                    {onAssignToSlot && (
                      <button
                        onClick={() => {
                          onClose();
                          onAssignToSlot(loadedSpool);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-emerald-400 font-bold text-xs border border-[var(--app-border)] transition cursor-pointer flex items-center gap-1"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Einem AMS-Slot zuweisen</span>
                      </button>
                    )}
                    <button
                      onClick={openChangePicker}
                      disabled={isWriting}
                      className="px-3 py-1.5 rounded-xl bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-orange-400 font-bold text-xs border border-[var(--app-border)] transition cursor-pointer flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Spule ändern</span>
                    </button>
                    {onSelectSpoolForEdit && (
                      <button
                        onClick={() => {
                          onClose();
                          onSelectSpoolForEdit(loadedSpool);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-[var(--app-text)] font-bold text-xs border border-[var(--app-border)] transition cursor-pointer flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Spule bearbeiten</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* SCANNER RADAR ANIMATION */
                <div className="p-6 rounded-2xl bg-[var(--app-card-sub)] border border-[var(--app-border)] text-center space-y-4">
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white shadow-xl shadow-orange-500/30">
                      <Radio className="w-8 h-8 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-[var(--app-text)]">NFC-Scanner aktiv</h4>
                    <p className="text-xs text-[var(--app-text-muted)] max-w-xs mx-auto leading-relaxed">
                      {scanStatusMessage}
                    </p>
                  </div>

                  {/* Desktop Schnelltest */}
                  <div className="pt-2 border-t border-[var(--app-border)] space-y-1.5">
                    <span className="text-[10px] text-[var(--app-text-muted)] block uppercase font-bold">
                      Schnelltest (Simulation):
                    </span>
                    <div className="flex justify-center gap-2 flex-wrap">
                      <button
                        onClick={handleSimulateUnwrittenTag}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-amber-400 border border-[var(--app-border)] text-[11px] font-semibold cursor-pointer"
                      >
                        🧪 Neuer Tag simulieren
                      </button>
                      <button
                        onClick={handleSimulateLoadedTag}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-emerald-400 border border-[var(--app-border)] text-[11px] font-semibold cursor-pointer"
                      >
                        🧪 Spule erkannt simulieren
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
  );
};
