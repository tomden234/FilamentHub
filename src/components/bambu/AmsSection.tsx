import React, { useState } from 'react';
import { Box, RefreshCw, Droplets, Sun, Square, Nfc, AlertTriangle, Thermometer } from 'lucide-react';
import { safeStorage } from '../../utils/safeStorage';
import { addSystemLog } from '../../utils/logService';
import type { PrinterExpandedPanelProps as ParentProps } from './PrinterExpandedPanel';
import { readTrays, readExternal, activeSlotFromPrinter, syncSlots, mismatch, EXTERNAL_SLOT } from '../../utils/amsMatch';
import { SpoolPicker } from '../SpoolPicker';
import { SlotTagSheet } from './SlotTagSheet';
import { useHumidity, amsHumidityPercent } from '../../utils/humidity';
import { armDryOff, disarmDryOff, useDryOff } from '../../utils/dryAutoOff';
import { getHaCredentials } from '../../utils/haClient';
import { getHaDryOffInfo, getHaDryOffJson, installHaDryOff, setHaDryOff } from '../../utils/haDryOff';
import { updateWorkshopSettings, useWorkshopSettings } from '../../utils/workshopSettings';
import { Toggle } from '../workshop/ui';

export interface AmsSectionProps {
  compact?: boolean;
  setAmsSlots: ParentProps['setAmsSlots'];
  setActionToast: ParentProps['setActionToast'];
  activeSlot: ParentProps['activeSlot'];
  amsSlots: ParentProps['amsSlots'];
  spools: ParentProps['spools'];
  liveState: ParentProps['liveState'];
  handleSetActiveSlot: ParentProps['handleSetActiveSlot'];
  setEditingAmsSlot: ParentProps['setEditingAmsSlot'];
  setAmsEditColor: ParentProps['setAmsEditColor'];
  setAmsEditMaterial: ParentProps['setAmsEditMaterial'];
  handleSetAmsSlot: ParentProps['handleSetAmsSlot'];
  onApplyDryingCredit: ParentProps['onApplyDryingCredit'];
  amsDryTemp: ParentProps['amsDryTemp'];
  isDryingActive: ParentProps['isDryingActive'];
  getHumidityDisplay: ParentProps['getHumidityDisplay'];
  calcRemainingTime: ParentProps['calcRemainingTime'];
  setAmsDryHours: ParentProps['setAmsDryHours'];
  amsDryHours: ParentProps['amsDryHours'];
  setAmsDryTemp: ParentProps['setAmsDryTemp'];
  handleToggleAmsDrying: ParentProps['handleToggleAmsDrying'];
  dryLoading: ParentProps['dryLoading'];
  nfcInfo?: { readers: number; unknown: number[] };
}

// Gemessen: Box-Sensor (ESP32 über Home Assistant) und AMS selbst, alles in °C
const humTone = (h: number | null | undefined) => (h === null || h === undefined || !Number.isFinite(h) ? 'var(--app-text-muted)' : h <= 40 ? '#10b981' : h <= 60 ? '#f59e0b' : '#f43f5e');

const Metric: React.FC<{ icon: React.ReactNode; value: string; unit: string; color?: string }> = ({ icon, value, unit, color }) => (
  <div className="min-w-0 rounded-lg px-2 py-1.5 flex flex-col gap-0.5" style={{ backgroundColor: 'var(--app-card)' }}>
    <span className="opacity-80">{icon}</span>
    <span className="leading-none whitespace-nowrap">
      <span className="text-base font-extrabold tabular-nums" style={{ color: color || 'var(--app-text)' }}>{value}</span>
      <span className="text-[10px] font-bold ml-0.5" style={{ color: 'var(--app-text-muted)' }}>{unit}</span>
    </span>
  </div>
);

const ClimateCard: React.FC<{ title: string; hint: string; temp: string; hum: string; humPct: number | null; error?: string }> = ({ title, hint, temp, hum, humPct, error }) => (
  <div className="min-w-0 rounded-xl border p-2" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-card-sub)' }}>
    <div className="flex items-baseline justify-between gap-1 mb-1.5 px-0.5">
      <span className="text-[11px] font-extrabold truncate" style={{ color: 'var(--app-text)' }}>{title}</span>
      <span className="text-[9px] shrink-0" style={{ color: 'var(--app-text-muted)' }}>{hint}</span>
    </div>
    {error ? (
      <div className="text-[10px] leading-snug px-0.5 py-1" style={{ color: 'var(--app-text-muted)' }}>{error}</div>
    ) : (
      <div className="grid grid-cols-2 gap-1.5">
        <Metric icon={<Thermometer className="w-3.5 h-3.5 text-orange-400" />} value={temp} unit="°C" />
        <Metric icon={<Droplets className="w-3.5 h-3.5 text-sky-400" />} value={hum} unit="%" color={humTone(humPct)} />
      </div>
    )}
  </div>
);

const BoxClimate: React.FC<{ unit: any }> = ({ unit }) => {
  const hum = useHumidity();
  const box = hum.external;
  const dryer = hum.room; // zweiter Sensor: externer Spulentrockner (5. Spule)
  const amsTemp = Number(unit?.temp);
  const amsHum = amsHumidityPercent(unit);
  const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '–' : n.toLocaleString('de-DE', { maximumFractionDigits: d }));
  return (
    <div className={`grid gap-2 ${dryer ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
      <ClimateCard
        title="Box-Sensor"
        hint="gemessen"
        temp={fmt(box?.temp ?? null)}
        hum={fmt(box?.value ?? null, 0)}
        humPct={box?.value ?? null}
        error={box?.error && box.value === null ? box.error : undefined}
      />
      <ClimateCard
        title="AMS"
        hint="Drucker"
        temp={fmt(Number.isFinite(amsTemp) && amsTemp > 0 ? amsTemp : null)}
        hum={fmt(amsHum, 0)}
        humPct={amsHum}
      />
      {dryer && (
        <div className="col-span-2 sm:col-span-1">
          <ClimateCard
            title="Trockenbox"
            hint="extern"
            temp={fmt(dryer.temp ?? null)}
            hum={fmt(dryer.value ?? null, 0)}
            humPct={dryer.value ?? null}
            error={dryer.error && dryer.value === null ? dryer.error : undefined}
          />
        </div>
      )}
    </div>
  );
};

export const AmsSection: React.FC<AmsSectionProps> = ({
  compact = false,
  setAmsSlots,
  setActionToast,
  activeSlot,
  amsSlots,
  spools,
  liveState,
  handleSetAmsSlot,
  amsDryTemp,
  isDryingActive,
  getHumidityDisplay,
  calcRemainingTime,
  setAmsDryHours,
  amsDryHours,
  setAmsDryTemp,
  handleToggleAmsDrying,
  dryLoading,
  nfcInfo
}) => {
  const dryOff = useDryOff();
  const [haInfo, setHaInfo] = useState(getHaDryOffInfo());
  const [haBusy, setHaBusy] = useState(false);
  const [workshop] = useWorkshopSettings();
  const toggleDryOff = (on: boolean) => {
    if (!on) {
      disarmDryOff();
      setActionToast({ text: 'Drucker bleibt nach dem Trocknen an.', ok: true });
      return;
    }
    const ha = getHaCredentials();
    if (!ha.url || !ha.token) {
      setActionToast({ text: 'Dafür braucht die App Home Assistant mit Steckdose (Verbindungen).', ok: false });
      return;
    }
    armDryOff();
    setActionToast({ text: 'Nach dem Trocknen schaltet die App den Drucker aus (3 Minuten nach dem Ende, nur ohne Druck).', ok: true });
  };
  const connected = Boolean(liveState.connected);
  const [pickSlot, setPickSlot] = useState<number | null>(null);
  const [tagSlot, setTagSlot] = useState<number | null>(null);
  const trays = connected ? readTrays(liveState.data.ams) : [];
  const ext = connected ? readExternal(liveState.data.vt_tray) : null;
  const hasHw = trays.length > 0;
  const printerActive = connected ? activeSlotFromPrinter(liveState.data.ams) : null;
  const shownActive = printerActive ?? activeSlot;

  // Echter Abgleich: Slots laut Drucker (Material + Farbe) → passende eigene Spulen
  const syncWithPrinter = () => {
    if (!connected) {
      setActionToast({ text: 'Drucker ist nicht verbunden. Erst verbinden, dann synchronisieren.', ok: false });
      return;
    }
    if (!hasHw) {
      setActionToast({ text: 'Der Drucker hat noch keine AMS-Daten geschickt. Kurz warten und nochmal tippen.', ok: false });
      return;
    }
    const { slots, lines: rawLines } = syncSlots(spools, ext ? [...trays, ext] : trays, amsSlots);
    const lines = rawLines.map(l => l.replace(/^Slot 5:/, 'Extern:'));
    setAmsSlots(slots);
    safeStorage.setItem('filamenthub_ams_slots_x2d', JSON.stringify(slots));
    window.dispatchEvent(new CustomEvent('filamenthub_drying_update', { detail: { sync: true } }));
    setActionToast({ text: 'Mit Drucker synchronisiert. ' + lines.join(' · '), ok: true });
    addSystemLog('drucker', 'AMS-Slots mit dem Drucker synchronisiert', lines.join(', '), 'success');
  };

  return (
<div className="space-y-3 pt-1">
            <div className="flex justify-between items-center text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                  <Box className="w-4 h-4 text-[#00AE42]" />
                  <span>{compact ? 'AMS:' : 'AMS Slots (Bambu Lab X2D):'}</span>
                </span>
                <button
                  type="button"
                  onClick={syncWithPrinter}
                  className="px-2 py-0.5 rounded-lg border border-[#00AE42]/40 bg-[#00AE42]/15 text-[#00AE42] hover:bg-[#00AE42]/25 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                  title="Liest Material und Farbe jedes Slots vom Drucker und ordnet deine passenden Spulen zu"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Mit Drucker synchronisieren</span>
                </button>
                {nfcInfo && nfcInfo.readers > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1"
                    style={{ borderColor: 'var(--app-accent)', color: 'var(--app-accent-text)', backgroundColor: 'var(--app-accent-sub)' }}
                    title="NFC-Leser im AMS ordnen Spulen automatisch zu"
                  >
                    <Nfc className="w-3 h-3" />
                    NFC-Leser: {nfcInfo.readers}
                    {nfcInfo.unknown.length > 0 ? ` · ${nfcInfo.unknown.length} unbekannt` : ''}
                  </span>
                )}
              </div>
            </div>

            {/* 4 AMS-Slots: nur Slot, Farbe, Hersteller und Material. Tippen = Spule wählen, Tag-Symbol = Tag lesen. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map(slotIdx => {
                const spool = spools.find(s => s.id === (amsSlots[slotIdx] || ''));
                const hw = trays.find(t => t.slot === slotIdx);
                const isActive = shownActive === slotIdx;
                const hwFilled = Boolean(hw && !hw.empty);
                const wrongSpool = mismatch(spool, hw);

                // Farbe, Hersteller, Material: laut Drucker, wenn dort Filament steckt; sonst die zugewiesene Spule
                const color = hwFilled ? hw!.colorHex || '#888888' : spool?.colorHex || null;
                const brand = spool ? spool.brand : hwFilled ? hw!.brand || '–' : '';
                const material = hwFilled ? hw!.type : spool ? spool.material : '';
                const missingInAms = Boolean(hw?.empty && spool); // Spule zugewiesen, aber Slot ist laut Drucker leer
                const emptyAll = !color && !brand && !material;

                return (
                  <div
                    key={slotIdx}
                    onClick={() => setPickSlot(slotIdx)}
                    title={wrongSpool ? `Zugewiesene Spule passt nicht zum Slot (${spool?.material}). Tippe auf „Mit Drucker synchronisieren“.` : 'Spule für diesen Slot wählen'}
                    className={`relative rounded-xl border px-2 py-1.5 flex items-center gap-2 cursor-pointer transition active:scale-[0.98] ${
                      isActive ? 'ring-2 ring-[#00AE42]/80' : ''
                    } ${missingInAms || emptyAll ? 'border-dashed' : ''}`}
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: color && !emptyAll ? `${color}90` : 'var(--app-border)',
                      opacity: missingInAms ? 0.75 : 1
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-black/30 shadow-sm shrink-0"
                      style={color ? { backgroundColor: color } : { border: '1px dashed var(--app-border)' }}
                    />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="text-[11px] font-extrabold flex items-center gap-1" style={{ color: 'var(--app-text)' }}>
                        Slot {slotIdx}
                        {wrongSpool && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                        {emptyAll ? 'leer' : `${brand}${brand && material ? ' · ' : ''}${material}`}
                        {missingInAms ? ' · leer im AMS' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setTagSlot(slotIdx);
                      }}
                      aria-label={`NFC-Tag für Slot ${slotIdx} lesen`}
                      title="Tag lesen und diesem Slot zuweisen"
                      className="w-7 h-7 rounded-full border flex items-center justify-center shrink-0 cursor-pointer active:scale-90"
                      style={{ borderColor: 'var(--app-accent)', color: 'var(--app-accent-text)', backgroundColor: 'var(--app-accent-sub)' }}
                    >
                      <Nfc className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 5. Spule: extern (Spulenhalter hinten). Zählt NICHT zum AMS und steht nicht in der AMS-Trocknung. */}
            {(() => {
              const spool = spools.find(s => s.id === (amsSlots[EXTERNAL_SLOT] || ''));
              const hwFilled = Boolean(ext && !ext.empty);
              const color = hwFilled ? ext!.colorHex || '#888888' : spool?.colorHex || null;
              const brand = spool ? spool.brand : hwFilled ? ext!.brand || '–' : '';
              const material = hwFilled ? ext!.type : spool ? spool.material : '';
              const emptyAll = !color && !brand && !material;
              const isActive = shownActive === EXTERNAL_SLOT;
              const wrong = mismatch(spool, ext || undefined);
              return (
                <div
                  onClick={() => setPickSlot(EXTERNAL_SLOT)}
                  title="Externe Spule (nicht im AMS). Tippen = Spule wählen"
                  className={`rounded-xl border px-2 py-1.5 flex items-center gap-2 cursor-pointer transition active:scale-[0.98] ${isActive ? 'ring-2 ring-[#00AE42]/80' : ''} ${emptyAll ? 'border-dashed' : ''}`}
                  style={{ backgroundColor: 'var(--app-card-sub)', borderColor: color && !emptyAll ? `${color}90` : 'var(--app-border)' }}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-black/30 shadow-sm shrink-0"
                    style={color ? { backgroundColor: color } : { border: '1px dashed var(--app-border)' }}
                  />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-[11px] font-extrabold flex items-center gap-1" style={{ color: 'var(--app-text)' }}>
                      Extern (5. Spule)
                      {wrong && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                      {emptyAll ? 'leer' : `${brand}${brand && material ? ' · ' : ''}${material}`} · nicht im AMS
                    </div>
                  </div>
                </div>
              );
            })()}

            {pickSlot !== null && (
              <SpoolPicker
                spools={spools}
                title={pickSlot === EXTERNAL_SLOT ? 'Spule für Extern (5.)' : `Spule für Slot ${pickSlot}`}
                selectedId={amsSlots[pickSlot] || ''}
                allowClear
                hint={(() => {
                  const t = pickSlot === EXTERNAL_SLOT ? ext : trays.find(x => x.slot === pickSlot);
                  return t && !t.empty ? { material: t.type, colorHex: t.colorHex || undefined } : undefined;
                })()}
                onClose={() => setPickSlot(null)}
                onPick={s => {
                  const slot = pickSlot;
                  setPickSlot(null);
                  handleSetAmsSlot(slot, s ? s.id : '');
                }}
              />
            )}
            {tagSlot !== null && (
              <SlotTagSheet
                slot={tagSlot}
                spools={spools}
                tray={trays.find(t => t.slot === tagSlot)}
                connected={connected}
                onAssign={(slot, spoolId) => handleSetAmsSlot(slot, spoolId)}
                onClose={() => setTagSlot(null)}
              />
            )}

            {/* AMS TROCKNUNG (FILAMENT DRYING) STEUERUNG */}
            <div
              className="p-3.5 rounded-2xl border space-y-3 transition-colors text-xs"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="font-extrabold text-sm truncate" style={{ color: 'var(--app-text)' }}>
                    AMS Trocknung
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                    isDryingActive
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 animate-pulse'
                      : 'bg-[var(--app-card-sub)] text-[var(--app-text-muted)] border-[var(--app-border)]'
                  }`}
                >
                  {isDryingActive ? '🔥 aktiv' : 'Standby'}
                </span>
              </div>
              {isDryingActive && calcRemainingTime() && (
                <div className="text-[11px] font-bold text-sky-300">⏳ Restzeit: {calcRemainingTime()}</div>
              )}

              <BoxClimate unit={liveState.data.ams?.ams?.[0]} />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1 flex-nowrap w-full">
                  {[6, 8, 12, 24].map(hrs => (
                    <button
                      key={hrs}
                      onClick={() => setAmsDryHours(hrs)}
                      className={`flex-1 min-w-0 px-1 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        amsDryHours === hrs ? 'bg-sky-500/25 border-sky-400 text-sky-300' : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                      }`}
                    >
                      {hrs}h
                    </button>
                  ))}
                  <span className="w-px h-5 mx-0.5 shrink-0" style={{ backgroundColor: 'var(--app-border)' }} />
                  {[
                    { val: 45, hint: 'TPU' },
                    { val: 50, hint: 'PLA' },
                    { val: 60, hint: 'PETG' },
                    { val: 65, hint: 'PETG/ABS' }
                  ].map(t => (
                    <button
                      key={t.val}
                      onClick={() => setAmsDryTemp(t.val)}
                      title={t.hint}
                      className={`flex-1 min-w-0 px-1 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        amsDryTemp === t.val ? 'bg-amber-500/25 border-amber-400 text-amber-300' : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                      }`}
                    >
                      {t.val}°
                    </button>
                  ))}
                </div>

                <div className="w-full text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  Gewählt: {amsDryHours} h bei {amsDryTemp}°C ·{' '}
                  {({ 45: 'TPU', 50: 'PLA', 60: 'PETG', 65: 'PETG/ABS' } as Record<number, string>)[amsDryTemp] || ''}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleAmsDrying(true)}
                    disabled={dryLoading}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50 ${
                      isDryingActive
                        ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/30 ring-2 ring-sky-300 animate-pulse'
                        : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white'
                    }`}
                  >
                    {dryLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sun className="w-3.5 h-3.5" />}
                    <span>{isDryingActive ? `🔥 Trocknung läuft (${calcRemainingTime() || `${amsDryHours}h`})` : 'Trocknen starten'}</span>
                  </button>

                  <button
                    onClick={() => {
                      disarmDryOff(); // von Hand gestoppt: der Drucker bleibt an
                      void handleToggleAmsDrying(false);
                    }}
                    disabled={dryLoading}
                    className="px-3 py-1.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stoppen</span>
                  </button>
                </div>
                <div className="w-full space-y-2.5 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
                  <Toggle
                    on={dryOff.armed}
                    onChange={toggleDryOff}
                    label="Danach Drucker ausschalten"
                    hint="Steckdose aus, 3 Minuten nach dem Ende der Trocknung. Nur ohne Druck. Home Assistant schaltet auch ohne offene App aus."
                  />
                  {dryOff.armed && (
                    <div className="text-[11px] leading-snug rounded-lg border p-2 flex items-start gap-2" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                      <span className="flex-1 min-w-0">
                        {haInfo ? (haInfo.ok ? '✅ ' : '⚠️ ') + haInfo.text : 'Home Assistant: noch nicht geprüft. Ohne Home Assistant schaltet nur die offene App aus.'}
                      </span>
                      <button
                        type="button"
                        disabled={haBusy}
                        onClick={async () => {
                          setHaBusy(true);
                          const r = await installHaDryOff();
                          setHaInfo(r);
                          if (r.ok) await setHaDryOff(true);
                          setHaBusy(false);
                        }}
                        className="shrink-0 px-2 py-1 rounded-lg border font-bold cursor-pointer disabled:opacity-50"
                        style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                      >
                        {haBusy ? '…' : 'Prüfen'}
                      </button>
                      {haInfo && !haInfo.ok && getHaDryOffJson() && (
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(getHaDryOffJson());
                            setHaInfo({ ...haInfo, text: haInfo.text.replace(/^📋 Kopiert\. /, '') });
                          }}
                          className="shrink-0 px-2 py-1 rounded-lg border font-bold cursor-pointer"
                          style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                        >
                          Automation kopieren
                        </button>
                      )}
                    </div>
                  )}
                  <Toggle
                    on={workshop.dryLightOff}
                    onChange={v => updateWorkshopSettings({ dryLightOff: v })}
                    label="Licht beim Trocknen aus"
                    hint="Läuft die Trocknung ohne Druck, geht das Bauraum-Licht von selbst aus."
                  />
                </div>
              </div>
            </div>
          </div>
  );
};
