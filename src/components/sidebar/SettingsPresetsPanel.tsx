import React from 'react';
import { Flame, Check, RotateCcw, Scale, Package } from 'lucide-react';
import { MaterialType } from '../../types/filament';
import { MATERIAL_PRESETS, BRAND_DATABASE } from '../../data/defaultSpools';
import type { SidebarProps as ParentProps } from '../Sidebar';
import { NumInput } from '../ui/NumInput';

const MATERIAL_OPTIONS: MaterialType[] = [
  'PLA',
  'PLA+',
  'PETG',
  'TPU',
  'ABS',
  'ASA',
  'PA / Nylon',
  'PC',
  'PET-CF / PA-CF'
];

interface SettingsPresetsPanelProps {
  selectedMaterial: any;
  setSelectedMaterial: any;
  appSettings: ParentProps['appSettings'];
  matInterval: any;
  setMatInterval: any;
  matTemp: any;
  setMatTemp: any;
  matHours: any;
  setMatHours: any;
  handleSaveMaterial: (...args: any[]) => any;
  matSavedSuccess: any;
  handleResetMaterial: (...args: any[]) => any;
  eibosTaraInput: any;
  setEibosTaraInput: any;
  handleSaveEibosTara: (...args: any[]) => any;
  eibosSavedSuccess: any;
  selectedBrand: any;
  setSelectedBrand: any;
  brandTara: any;
  setBrandTara: any;
  brandDefaultPrice: any;
  setBrandDefaultPrice: any;
  handleSaveBrand: (...args: any[]) => any;
  brandSavedSuccess: any;
  handleResetBrand: (...args: any[]) => any;
}

export const SettingsPresetsPanel: React.FC<SettingsPresetsPanelProps> = ({
  selectedMaterial,
  setSelectedMaterial,
  appSettings,
  matInterval,
  setMatInterval,
  matTemp,
  setMatTemp,
  matHours,
  setMatHours,
  handleSaveMaterial,
  matSavedSuccess,
  handleResetMaterial,
  eibosTaraInput,
  setEibosTaraInput,
  handleSaveEibosTara,
  eibosSavedSuccess,
  selectedBrand,
  setSelectedBrand,
  brandTara,
  setBrandTara,
  brandDefaultPrice,
  setBrandDefaultPrice,
  handleSaveBrand,
  brandSavedSuccess,
  handleResetBrand
}) => {
  return (
<div className="space-y-3">
                  <div
                    className="rounded-xl border p-3 space-y-1 transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>Material-Trocknungszeiten & Temperatur</span>
                    </span>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                      Wähle ein Material aus dem Dropdown, um Trocknungsintervall, Temperatur und Dauer anzupassen.
                    </p>
                  </div>

                  <div
                    className="rounded-xl border p-3.5 space-y-3 text-xs transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <div>
                      <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--app-text)' }}>
                        Material auswählen:
                      </label>
                      <select
                        value={selectedMaterial}
                        onChange={e => setSelectedMaterial(e.target.value as MaterialType)}
                        className="w-full px-3 py-2 rounded-lg border text-xs font-bold outline-none cursor-pointer"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      >
                        {MATERIAL_OPTIONS.map(mat => (
                          <option key={mat} value={mat}>
                            {mat} – {appSettings.materialPresets[mat]?.intervalDays ?? MATERIAL_PRESETS[mat]?.intervalDays ?? 30} Tage ({appSettings.materialPresets[mat]?.temp ?? MATERIAL_PRESETS[mat]?.temp ?? 50}°C)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] block mb-1 font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          Intervall (Tage):
                        </label>
                        <NumInput
                          type="number"
                          min="1"
                          max="365"
                          value={matInterval}
                          onChange={e => setMatInterval(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] block mb-1 font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          Temp (°C):
                        </label>
                        <NumInput
                          type="number"
                          min="30"
                          max="120"
                          value={matTemp}
                          onChange={e => setMatTemp(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] block mb-1 font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          Dauer (Std.):
                        </label>
                        <NumInput
                          type="number"
                          min="1"
                          max="48"
                          value={matHours}
                          onChange={e => setMatHours(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveMaterial}
                        className="flex-1 py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                      >
                        {matSavedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{matSavedSuccess ? 'Gespeichert!' : `Für ${selectedMaterial} speichern`}</span>
                      </button>
                      <button
                        onClick={handleResetMaterial}
                        title="Standard-Werkseinstellungen wiederherstellen"
                        className="py-2 px-3 rounded-lg border font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                        style={{
                          backgroundColor: 'var(--app-card)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text-muted)'
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>

                  {/* Hersteller-Tara & Eibos-Vakuumbeutel */}
                  <div
                    className="rounded-xl border p-3 space-y-1 transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                      <Scale className="w-4 h-4 text-emerald-400" />
                      <span>Hersteller-Tara & Eibos-Vakuumbeutel</span>
                    </span>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                      Leerspulengewichte für Küchenwaage-Abzüge und Eibos-Beutel-Tara.
                    </p>
                  </div>

                  {/* Eibos-Beutel */}
                  <div
                    className="rounded-xl border p-3.5 space-y-2 text-xs transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold flex items-center gap-1.5 text-xs text-sky-400">
                        <Package className="w-4 h-4" />
                        <span>Eibos-Vakuumbeutel Tara</span>
                      </span>
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
                        Aktuell: {appSettings.eibosBagTara} g
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <NumInput
                        type="number"
                        min="0"
                        max="200"
                        value={eibosTaraInput}
                        onChange={e => setEibosTaraInput(Number(e.target.value))}
                        className="flex-1 px-3 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      />
                      <button
                        onClick={handleSaveEibosTara}
                        className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition cursor-pointer"
                      >
                        {eibosSavedSuccess ? 'Gespeichert!' : 'Übernehmen'}
                      </button>
                    </div>
                  </div>

                  {/* Hersteller Tara */}
                  <div
                    className="rounded-xl border p-3.5 space-y-3 text-xs transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <div>
                      <label className="text-[11px] font-bold block mb-1" style={{ color: 'var(--app-text)' }}>
                        Hersteller auswählen:
                      </label>
                      <select
                        value={selectedBrand}
                        onChange={e => setSelectedBrand(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-xs font-bold outline-none cursor-pointer"
                        style={{
                          backgroundColor: 'var(--app-input-bg)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text)'
                        }}
                      >
                        {BRAND_DATABASE.map(b => {
                          const conf = appSettings.brandPresets[b.name];
                          return (
                            <option key={b.name} value={b.name}>
                              {b.name} (Tara: {conf?.tara ?? b.tara}g · {conf?.defaultPrice ?? b.defaultPrice} €/kg)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] block mb-1 font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          Leerspule Tara (g):
                        </label>
                        <NumInput
                          type="number"
                          min="0"
                          max="500"
                          value={brandTara}
                          onChange={e => setBrandTara(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] block mb-1 font-semibold" style={{ color: 'var(--app-text-muted)' }}>
                          Standardpreis (€/kg):
                        </label>
                        <NumInput
                          type="number"
                          step="0.5"
                          min="5"
                          max="150"
                          value={brandDefaultPrice}
                          onChange={e => setBrandDefaultPrice(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
                          style={{
                            backgroundColor: 'var(--app-input-bg)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)'
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveBrand}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {brandSavedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{brandSavedSuccess ? 'Gespeichert!' : `Für ${selectedBrand} speichern`}</span>
                      </button>
                      <button
                        onClick={handleResetBrand}
                        className="py-2 px-3 rounded-lg border font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                        style={{
                          backgroundColor: 'var(--app-card)',
                          borderColor: 'var(--app-border)',
                          color: 'var(--app-text-muted)'
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>
                </div>
  );
};
