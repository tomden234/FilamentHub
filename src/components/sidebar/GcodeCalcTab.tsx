import { SpoolSelect } from '../SpoolPicker';
import React from 'react';
import { FileCode2, RefreshCw, UploadCloud, Check, Calculator } from 'lucide-react';
import type { SidebarProps as ParentProps } from '../Sidebar';
import { SpoolFitList } from '../workshop/SpoolFitList';
import { NumInput } from '../ui/NumInput';

interface GcodeCalcTabProps {
  handlePullGcodeFromPrinter: (...args: any[]) => any;
  printerFetchLoading: any;
  handleGcodeFileChange: (...args: any[]) => any;
  gcodeData: any;
  calcSpoolId: any;
  setCalcSpoolId: any;
  spools: ParentProps['spools'];
  onDeductWeight: ParentProps['onDeductWeight'];
  setCalcPricePerKg: any;
  calcGrams: any;
  setCalcGrams: any;
  calcPricePerKg: any;
  calcPrintHours: any;
  setCalcPrintHours: any;
  calcPrinterWatts: any;
  setCalcPrinterWatts: any;
  filamentCost: any;
  powerCost: any;
  totalCost: any;
}

export const GcodeCalcTab: React.FC<GcodeCalcTabProps> = ({
  handlePullGcodeFromPrinter,
  printerFetchLoading,
  handleGcodeFileChange,
  gcodeData,
  calcSpoolId,
  setCalcSpoolId,
  spools,
  onDeductWeight,
  setCalcPricePerKg,
  calcGrams,
  setCalcGrams,
  calcPricePerKg,
  calcPrintHours,
  setCalcPrintHours,
  calcPrinterWatts,
  setCalcPrinterWatts,
  filamentCost,
  powerCost,
  totalCost
}) => {
  return (
<div className="space-y-3.5">
              <div
                className="rounded-xl border p-3.5 space-y-2.5 transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                    <FileCode2 className="w-4 h-4 text-orange-400" />
                    <span>G-Code Datei & X2D Live-Sync</span>
                  </div>
                  <span className="text-[10px] font-mono-num text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Auto-Analyse
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                  Lade eine <strong>.gcode</strong>-Datei hoch oder ziehe dir die aktuell druckende Datei direkt per Klick aus dem Bambu Lab X2D. Gewicht und Druckzeit werden automatisch in den Rechner übertragen.
                </p>

                {/* Button: Direkt vom X2D Drucker holen */}
                <button
                  type="button"
                  onClick={handlePullGcodeFromPrinter}
                  disabled={printerFetchLoading}
                  className="w-full py-2 px-3 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${printerFetchLoading ? 'animate-spin' : ''}`} />
                  <span>{printerFetchLoading ? 'Lese X2D Daten...' : 'Aktuelle Druckdatei vom X2D übernehmen'}</span>
                </button>

                {/* Upload Button */}
                <label
                  className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition hover:border-orange-500/50"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-card)'
                  }}
                >
                  <UploadCloud className="w-6 h-6 text-orange-400 mb-1" />
                  <span className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                    .gcode Datei manuell auswählen
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                    Bambu Studio, OrcaSlicer, PrusaSlicer, Cura
                  </span>
                  <input
                    type="file"
                    accept=".gcode,.gco,.g"
                    onChange={handleGcodeFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Erfolgreich erkannter G-Code */}
              {gcodeData && (
                <div
                  className="rounded-xl border p-3.5 space-y-3 transition-colors animate-fadeIn"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Analyse Erfolgreich
                      </span>
                      <h4 className="text-xs font-bold truncate max-w-[240px]" style={{ color: 'var(--app-text)' }}>
                        {gcodeData.fileName}
                      </h4>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                      {gcodeData.material}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-lg border" style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)' }}>
                      <span className="text-[10px] block" style={{ color: 'var(--app-text-muted)' }}>Gewicht</span>
                      <span className="text-base font-extrabold font-mono-num text-orange-400">
                        {gcodeData.weightGrams} g
                      </span>
                    </div>
                    <div className="p-2 rounded-lg border" style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)' }}>
                      <span className="text-[10px] block" style={{ color: 'var(--app-text-muted)' }}>Druckdauer</span>
                      <span className="text-base font-extrabold font-mono-num text-sky-400">
                        {gcodeData.timeHours.toFixed(1)} h
                      </span>
                    </div>
                  </div>

                  <SpoolFitList spools={spools} grams={gcodeData.weightGrams} material={gcodeData.material} />

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] block" style={{ color: 'var(--app-text-muted)' }}>
                      Direkt von Spule abziehen:
                    </label>
                    <SpoolSelect spools={spools} value={calcSpoolId} onChange={setCalcSpoolId} title="Von welcher Spule abziehen?" className="w-full" />

                    <button
                      onClick={() => {
                        if (!calcSpoolId) return;
                        onDeductWeight(calcSpoolId, gcodeData.weightGrams);
                      }}
                      className="w-full mt-1.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{gcodeData.weightGrams} g jetzt abziehen</span>
                    </button>
                  </div>
                </div>
              )}

              {/* INTEGRIERTER DRUCKKOSTEN-KALKULATOR */}
              <div className="space-y-3 pt-1">
                <div
                  className="rounded-xl border p-3 space-y-1 transition-colors"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                    <Calculator className="w-4 h-4 text-orange-400" />
                    <span>Druckkosten-Kalkulator</span>
                  </span>
                  <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    Berechnet Material-, Strom- und Gesamtkosten live basierend auf deinen Spulen und G-Code Werten.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Spule:</label>
                    <SpoolSelect
                      spools={spools}
                      value={calcSpoolId}
                      onChange={id => {
                        setCalcSpoolId(id);
                        const sp = spools.find(x => x.id === id);
                        if (sp) setCalcPricePerKg(sp.pricePerKg);
                      }}
                      title="Spule für die Kostenrechnung"
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Verbrauch (g):</label>
                      <NumInput
                        type="number"
                        value={calcGrams}
                        onChange={e => setCalcGrams(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border font-mono-num text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Filament (€/kg):</label>
                      <NumInput
                        type="number"
                        step="0.1"
                        value={calcPricePerKg}
                        onChange={e => setCalcPricePerKg(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border font-mono-num text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Druckdauer (h):</label>
                      <NumInput
                        type="number"
                        step="0.1"
                        value={calcPrintHours}
                        onChange={e => setCalcPrintHours(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border font-mono-num text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] block mb-1" style={{ color: 'var(--app-text-muted)' }}>Leistung (W):</label>
                      <NumInput
                        type="number"
                        value={calcPrinterWatts}
                        onChange={e => setCalcPrinterWatts(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border font-mono-num text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Kosten-Ergebnisbox */}
                <div
                  className="rounded-xl border p-3.5 space-y-2 transition-colors"
                  style={{
                    backgroundColor: 'var(--app-card-sub)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span style={{ color: 'var(--app-text-muted)' }}>Material:</span>
                    <span className="font-mono-num font-bold" style={{ color: 'var(--app-text)' }}>{filamentCost.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span style={{ color: 'var(--app-text-muted)' }}>Strom:</span>
                    <span className="font-mono-num font-bold" style={{ color: 'var(--app-text)' }}>{powerCost.toFixed(2)} €</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between items-center" style={{ borderColor: 'var(--app-border)' }}>
                    <span className="font-bold text-xs" style={{ color: 'var(--app-text)' }}>Gesamtkosten:</span>
                    <span className="text-lg font-extrabold font-mono-num text-orange-400">
                      {totalCost.toFixed(2)} €
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (!calcSpoolId) return;
                      onDeductWeight(calcSpoolId, calcGrams);
                    }}
                    className="w-full mt-2 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer shadow-md"
                  >
                    {calcGrams} g abziehen
                  </button>
                </div>
              </div>
            </div>
  );
};
