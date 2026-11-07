import { LabelPrintButton } from './LabelPrintButton';
import { useNow } from '../hooks/useNow';
import { useSpoolAms } from '../hooks/useSpoolAms';
import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Copy,
  Pencil,
  Trash2,
  ShoppingCart,
  Package,
  Check,
  Thermometer,
  Wind,
  Gauge,
  Tag,
  Sun
} from 'lucide-react';
import { AppSettings, DryingStatus, Spool, ViewMode } from '../types/filament';
import { getBrandInfo, getDryingStatus, getSpoolLink } from '../utils/shopLinks';
import { isInEibos, spoolTara } from '../utils/spoolState';
import { getBambuProfile, formatBambuParametersText } from '../data/bambuParameters';
import { SpoolBadges } from './workshop/SpoolBadges';
import { SpoolTile, SpoolIcon } from './SpoolTile';
import { NumInput } from './ui/NumInput';

interface SpoolCardProps {
  spool: Spool;
  viewMode: ViewMode;
  now: number;
  onDeduct: (spoolId: string, grams: number) => void;
  onAdd?: (spoolId: string, grams: number) => void;
  onApplyScale: (spoolId: string, grossWeight: number) => void;
  onMarkDried: (spoolId: string) => void;
  onDuplicate?: (spoolId: string) => void;
  onEdit: (spoolId: string) => void;
  onDelete: (spoolId: string) => void;
  onWriteNfc?: (spoolId: string) => void;
  appSettings?: AppSettings;
}

/** Sekunden-Countdown bis zum nächsten Trocknen: tickt selbst, damit nicht die ganze App jede Sekunde neu zeichnet */
const DryCountdown: React.FC<{ spool: Spool }> = ({ spool }) => {
  const t = useNow(1000);
  const d = getDryingStatus(spool, t);
  return (
    <span className={`font-mono-num ${d.isOverdue ? 'text-rose-500 font-bold' : 'font-semibold'}`}>
      {d.isOverdue ? `Trocknen überfällig seit ${d.days}d ${d.hours}h ${d.mins}m ${d.secs}s` : `Nächstes Trocknen in ${d.days}d ${d.hours}h ${d.mins}m ${d.secs}s`}
    </span>
  );
};

export const SpoolCard: React.FC<SpoolCardProps> = ({
  spool,
  viewMode,
  now,
  onDeduct,
  onAdd,
  onApplyScale,
  onMarkDried,
  onEdit,
  onDelete,
  onWriteNfc,
  appSettings
}) => {
  const [deductInput, setDeductInput] = useState('');
  const [scaleInput, setScaleInput] = useState('');
  const [copiedParam, setCopiedParam] = useState(false);
  const [driedOk, setDriedOk] = useState(false);

  // AMS Slot & Trocknungsstatus (vom Drucker, jede Sekunde aktuell)
  const amsInfo = useSpoolAms(spool.id);

  // Eibos-Beutel Einbeziehung
  const isEibosStorage = isInEibos(spool);
  const [includeEibosBag, setIncludeEibosBag] = useState<boolean>(isEibosStorage);
  const eibosTara = appSettings?.eibosBagTara ?? 35;
  const [includeSilica, setIncludeSilica] = useState<boolean>(Boolean(spool.silicaBag));
  const silicaTara = appSettings?.silicaBagTara ?? 57;

  const initW = Number(spool.initialWeight) || 1000;
  const remW = Math.round(Number(spool.remainingWeight) || 0);
  const brandInfo = getBrandInfo(spool.brand, appSettings);
  const tara = spoolTara(spool, brandInfo.tara);
  const effectiveTara = tara + (includeEibosBag ? eibosTara : 0) + (includeSilica ? silicaTara : 0);
  const scaleNow = remW + effectiveTara;
  const pct = Math.max(0, Math.min(100, Math.round((remW / initW) * 100)));
  const dry: DryingStatus = getDryingStatus(spool, now);
  const hex = spool.colorHex || '#f97316';
  const priceKg = Number(spool.pricePerKg) || brandInfo.defaultPrice || 19.99;
  const remEuro = ((remW / 1000) * priceKg).toFixed(2).replace('.', ',');
  const link = getSpoolLink(spool);

  const isCriticalLow = pct <= 15;
  const isWarningLow = pct > 15 && pct <= 30;
  const fillBarStyle: React.CSSProperties = {
    width: `${pct}%`,
    background: isCriticalLow
      ? '#ef4444'
      : isWarningLow
      ? '#f59e0b'
      : 'var(--app-accent-gradient, var(--app-accent))'
  };

  const handleDeductSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const g = parseInt(deductInput);
    if (!g || g <= 0) return;
    onDeduct(spool.id, g);
    setDeductInput('');
  };

  const handleAddSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const g = parseInt(deductInput);
    if (!g || g <= 0) return;
    if (onAdd) {
      onAdd(spool.id, g);
    } else {
      onDeduct(spool.id, -g);
    }
    setDeductInput('');
  };

  const handleScaleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const gross = parseFloat(scaleInput);
    if (isNaN(gross) || gross < effectiveTara) return;
    // Netto-Gewicht ermitteln und Spule aktualisieren
    const net = Math.round(gross - effectiveTara);
    onApplyScale(spool.id, net + tara);
    setScaleInput('');
  };

  const handleCopyBambuParameters = async () => {
    const prof = getBambuProfile(spool.brand, spool.material);
    const text = formatBambuParametersText(prof, spool.name);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedParam(true);
      setTimeout(() => setCopiedParam(false), 2000);
    } catch {}
  };

  // =========================================================================
  // KOMPAKT: schlichte Kachel (Farbe, Name, Gewicht), Aktionen klappen beim Antippen auf
  // =========================================================================
  if (viewMode === 'simple') {
    return (
      <SpoolTile
        spool={spool}
        now={now}
        appSettings={appSettings}
        onDeduct={onDeduct}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
        onWriteNfc={onWriteNfc}
        onMarkDried={onMarkDried}
      />
    );
  }

  // =========================================================================
  // 3. ANSICHTSMODUS: PARAMETER (BAMBU STUDIO & ORCASLICER SPRECHZETTEL)
  // =========================================================================
  const bambuProfile = getBambuProfile(spool.brand, spool.material);

  if (viewMode === 'params') {
    return (
      <div
        className="fh-nest rounded-2xl border transition-all flex flex-col justify-between gap-3"
        style={{
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        <div className="flex justify-between items-start gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <SpoolIcon hex={hex} pct={pct} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-extrabold text-orange-500">
                  {spool.brand}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.2 rounded font-bold"
                  style={{ backgroundColor: 'var(--app-card-sub)' }}
                >
                  {spool.material}
                </span>
                <span className="text-[10px] font-mono-num text-emerald-500 font-bold">
                  {remW}g Rest
                </span>
                <SpoolBadges spool={spool} />
              </div>
              <h3 className="text-sm font-bold break-words leading-snug mt-1" style={{ color: 'var(--app-text)' }}>
                {spool.name}
              </h3>
              {spool.storageNote && (
                <p className="text-[11px] break-words leading-relaxed mt-1" style={{ color: 'var(--app-text-muted)' }}>
                  {spool.storageNote}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={link.label}
              className="p-1.5 rounded-lg text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition shadow-xs"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
            </a>
            <LabelPrintButton spool={spool} compact />
            {onWriteNfc && (
              <button
                onClick={() => onWriteNfc(spool.id)}
                title={spool.nfcWritten ? 'NFC-Tag beschrieben – Klicken für Details & Löschen' : 'Spule auf NFC-Tag schreiben'}
                className={`p-1.5 rounded-lg transition cursor-pointer border shadow-xs ${
                  spool.nfcWritten
                    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25'
                    : 'text-rose-400 bg-rose-500/15 border-rose-500/40 hover:bg-rose-500/25'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Hersteller-Druckparameter Gitter */}
        <div
          className="fh-nest-inner p-3 space-y-3 text-xs"
          style={{ backgroundColor: 'var(--app-card-sub)' }}
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-[11px]">
            <div className="space-y-0.5">
              <span className="text-[var(--app-text-muted)] text-[11px] flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-orange-400" />
                <span>Düse (Nozzle)</span>
              </span>
              <span className="font-mono-num font-bold text-sm text-[var(--app-text)] block">
                {bambuProfile.nozzleTempFirstLayer}°C / {bambuProfile.nozzleTempOtherLayers}°C
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[var(--app-text-muted)] text-[11px] flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-rose-400" />
                <span>Bett (PEI / Glatt)</span>
              </span>
              <span className="font-mono-num font-bold text-sm text-[var(--app-text)] block">
                {bambuProfile.bedTempTexturedPEI}°C / {bambuProfile.bedTempSmoothPlate}°C
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[var(--app-text-muted)] text-[11px] flex items-center gap-1">
                <Gauge className="w-3 h-3 text-orange-400" />
                <span>Max Flow (Speed)</span>
              </span>
              <span className="font-mono-num font-bold text-sm text-[var(--app-text)] block">
                {bambuProfile.maxVolumetricSpeed} mm³/s
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[var(--app-text-muted)] text-[11px] flex items-center gap-1">
                <Wind className="w-3 h-3 text-sky-400" />
                <span>Bauteillüfter</span>
              </span>
              <span className="font-mono-num font-bold text-sm text-[var(--app-text)] block">
                {bambuProfile.fanSpeedMin}% – {bambuProfile.fanSpeedMax}%
              </span>
            </div>
          </div>

          {bambuProfile.notes && (
            <p className="text-[11px] text-[var(--app-text-muted)] pt-2 border-t border-[var(--app-border)]">
              {bambuProfile.notes}
            </p>
          )}
        </div>

        {/* 1-Klick Kopier-Button für Bambu Studio */}
        <button
          onClick={handleCopyBambuParameters}
          className="w-full py-2.5 px-3 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          {copiedParam ? <Check key="ok" className="w-4 h-4 fh-pop" /> : <Copy className="w-4 h-4" />}
          <span>{copiedParam ? 'Kopiert' : 'Parameter für Bambu Studio kopieren'}</span>
        </button>
      </div>
    );
  }

  // =========================================================================
  // VOLLSTÄNDIGE ANSICHT (inkl. Trocknungsbalken, Waagen-Box, Restwert, Shops)
  // =========================================================================
  const grossVal = parseFloat(scaleInput);
  const netPreview = !isNaN(grossVal) ? Math.round(grossVal - effectiveTara) : null;

  return (
    <div
      className={`fh-nest rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
        dry.isOverdue ? 'overdue-card border-rose-500/70' : ''
      }`}
      style={{
        backgroundColor: 'var(--app-card)',
        borderColor: dry.isOverdue ? undefined : 'var(--app-border)',
        color: 'var(--app-text)'
      }}
    >
      {/* Header mit Farbe & Aktionen */}
      <div className="flex justify-between items-start gap-2.5">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <SpoolIcon hex={hex} pct={pct} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold" style={{ color: 'var(--app-accent-text)' }}>
                {spool.brand}
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: 'var(--app-card-sub)' }}
              >
                {spool.material}
              </span>
              {amsInfo.slot !== null && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00AE42]/20 text-[#00AE42] border border-[#00AE42]/40 font-bold">
                  {amsInfo.slot === 5 ? 'Extern (5. Spule)' : `AMS Slot ${amsInfo.slot}`}
                </span>
              )}
              {amsInfo.isDrying && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/25 text-sky-300 border border-sky-400/50 font-bold flex items-center gap-1">
                  <Sun className="w-2.5 h-2.5 text-sky-400" />
                  <span>Wird getrocknet</span>
                </span>
              )}
              <SpoolBadges spool={spool} />
            </div>
            <h3 className="text-sm font-bold break-words leading-snug mt-1" style={{ color: 'var(--app-text)' }}>
              {spool.name}
            </h3>
            </div>
          </div>

          {/* Aktionsleiste oben rechts (farblich klar differenziert) */}
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${link.label} öffnen`}
              className="p-1.5 rounded-lg text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <LabelPrintButton spool={spool} compact />
            {onWriteNfc && (
              <button
                onClick={() => onWriteNfc(spool.id)}
                title={spool.nfcWritten ? 'NFC-Tag beschrieben – Klicken für Details & Löschen' : 'Spule auf NFC-Tag schreiben'}
                className={`p-1.5 rounded-lg transition cursor-pointer border shadow-xs ${
                  spool.nfcWritten
                    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25'
                    : 'text-rose-400 bg-rose-500/15 border-rose-500/40 hover:bg-rose-500/25'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onEdit(spool.id)}
              title="Spule bearbeiten"
              className="p-1.5 rounded-lg text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(spool.id)}
              title="Spule löschen"
              className="p-1.5 rounded-lg text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      {/* Ausgeschriebene Spulen-Beschreibung & Lagerort ohne Zeilenüberlauf */}
      {spool.storageNote && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed break-words" style={{ color: 'var(--app-text-muted)' }}>
          <Package className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{spool.storageNote}</span>
        </p>
      )}

      {/* Füllstand, Restwert & Shop-Link */}
      <div
        className="fh-nest-inner p-3 space-y-2"
        style={{ backgroundColor: 'var(--app-card-sub)' }}
      >
        <div className="flex justify-between items-end gap-3">
          <span className="font-mono-num font-extrabold text-3xl leading-none tracking-tight" style={{ color: isCriticalLow ? 'var(--app-danger-text)' : 'var(--app-text)' }}>
            {remW}
            <span className="text-sm font-bold ml-1" style={{ color: 'var(--app-text-muted)' }}>g</span>
          </span>
          <span className="text-[11px] font-mono-num text-right" style={{ color: 'var(--app-text-muted)' }}>
            {pct} % von {initW} g
            {spool.colorName ? <span className="block">{spool.colorName}</span> : null}
          </span>
        </div>
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--app-bg)' }}
        >
          <div className="h-full rounded-full transition-all duration-300 shadow-sm" style={fillBarStyle} />
        </div>
        <div className="flex justify-between items-center pt-1 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
          <span>
            Restwert: <strong className="text-sky-500 font-mono-num">{remEuro} €</strong>
          </span>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-500 hover:underline font-semibold flex items-center gap-1"
          >
            <ShoppingCart className="w-3 h-3" />
            <span>{link.label}</span>
          </a>
        </div>
      </div>

      {/* KÜCHENWAAGE TARA BOX */}
      <div
        className="fh-nest-inner p-3 space-y-2"
        style={{ backgroundColor: 'var(--app-card-sub)' }}
      >
        <div className="flex justify-between items-center text-[11px]">
          <span style={{ color: 'var(--app-text-muted)' }}>
            Tara: <strong className="font-mono-num text-xs" style={{ color: 'var(--app-text)' }}>{effectiveTara} g</strong>
            <span className="text-[10px] ml-1">({tara > 0 ? `${tara}g Spule` : 'ohne Spule'}{includeEibosBag ? ` + ${eibosTara}g Beutel` : ''}{includeSilica ? ` + ${silicaTara}g Silica` : ''})</span>
          </span>
          <span style={{ color: 'var(--app-text-muted)' }}>
            Waage zeigt: <strong className="font-mono-num text-emerald-500 text-xs">≈ {scaleNow} g</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <NumInput
            type="number"
            min="0"
            placeholder="Gewicht auf Waage (g)"
            value={scaleInput}
            onChange={e => setScaleInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleScaleSubmit();
            }}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs font-mono-num outline-none border focus:border-emerald-500"
            style={{
              backgroundColor: 'var(--app-input-bg)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          />
          <button
            onClick={handleScaleSubmit}
            className="fh-cta px-3 py-1.5 text-xs whitespace-nowrap cursor-pointer"
          >
            Gewicht übernehmen
          </button>
        </div>

        {/* Eibos-Beutel Umschalter */}
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--app-border)]/20">
          <label className="flex items-center gap-1.5 cursor-pointer text-[var(--app-text)] hover:text-orange-500 select-none">
            <input
              type="checkbox"
              checked={includeEibosBag}
              onChange={e => setIncludeEibosBag(e.target.checked)}
              className="rounded text-sky-500 focus:ring-0 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3 text-sky-400" />
              <span>Im Eibos-Beutel gewogen (+{eibosTara}g)</span>
            </span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-[var(--app-text)] hover:text-orange-500 select-none">
            <input
              type="checkbox"
              checked={includeSilica}
              onChange={e => setIncludeSilica(e.target.checked)}
              className="rounded text-sky-500 focus:ring-0 cursor-pointer"
            />
            <span>Mit Silica-Beutel (+{silicaTara}g)</span>
          </label>
        </div>

        <p className="text-[11px]">
          {netPreview !== null ? (
            netPreview < 0 ? (
              <span className="text-rose-500 font-semibold">
                {grossVal} g ist weniger als die Tara ({effectiveTara} g).
              </span>
            ) : (
              <span className="text-emerald-500 font-semibold">
                {grossVal} g (Waage) − {effectiveTara} g (Tara) = {netPreview} g Netto-Filament
              </span>
            )
          ) : (
            <span style={{ color: 'var(--app-text-muted)' }}>
              Spule wiegen → Tara ({effectiveTara} g) wird automatisch abgezogen.
            </span>
          )}
        </p>
      </div>

      {/* Schnellabzug & Hinzufügen */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <NumInput
            type="number"
            placeholder="Gramm..."
            value={deductInput}
            onChange={e => setDeductInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleDeductSubmit();
            }}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs font-mono-num outline-none border focus:border-orange-500"
            style={{
              backgroundColor: 'var(--app-input-bg)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          />
          <button
            onClick={handleDeductSubmit}
            title="Gramm abziehen"
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition cursor-pointer whitespace-nowrap shrink-0 bg-rose-600 hover:bg-rose-700"
          >
            − Ab
          </button>
          <button
            onClick={handleAddSubmit}
            title="Gramm hinzufügen"
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition cursor-pointer whitespace-nowrap shrink-0 bg-emerald-700 hover:bg-emerald-800"
          >
            + Dazu
          </button>
        </div>

        {/* Schnell-Buttons: Zeile 1 Abzug / Zeile 2 Plus */}
        <div className="space-y-1">
          <div className="grid grid-cols-4 gap-1">
            {[10, 25, 50, 100].map(amt => (
              <button
                key={amt}
                onClick={() => onDeduct(spool.id, amt)}
                className="py-1 rounded text-[10px] font-mono-num font-bold transition cursor-pointer border text-rose-300 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20"
              >
                -{amt}g
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[10, 25, 50, 100].map(amt => (
              <button
                key={amt}
                onClick={() => (onAdd ? onAdd(spool.id, amt) : onDeduct(spool.id, -amt))}
                className="py-1 rounded text-[10px] font-mono-num font-bold transition cursor-pointer border text-emerald-300 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
              >
                +{amt}g
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TROCKNUNGSPROZESS & VISUELLER TROCKNUNGSBALKEN (exklusiv in vollständiger Ansicht!) */}
      <div
        className="fh-nest-inner p-3 text-xs space-y-2 border"
        style={{
          backgroundColor: 'var(--app-card-sub)',
          borderColor: amsInfo.isDrying ? '#38bdf8' : (dry.isOverdue ? 'rgba(244, 63, 94, 0.5)' : 'var(--app-border)')
        }}
      >
        {amsInfo.isDrying && (
          <div className="p-2 rounded-lg bg-sky-500/20 border border-sky-400/50 flex items-center justify-between text-xs text-sky-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-sky-400" />
              <span>Trocknet im AMS ({amsInfo.dryTemp}°C)</span>
            </span>
            <span className="font-mono-num bg-sky-500/30 px-2 py-0.5 rounded text-[11px] border border-sky-400/40">
              Rest: {amsInfo.remainingTime || 'aktiv'}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <DryCountdown spool={spool} />
          <span className="text-[10px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
            {spool.dryTemp || 50}°C / {spool.dryHours || 5}h
          </span>
        </div>

        {/* VISUELLER TROCKNUNGSBALKEN */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
            <span>Alle {spool.dryIntervalDays || 30} Tage trocknen</span>
            <span
              className={`font-mono-num font-semibold ${
                dry.isOverdue ? 'text-rose-500' : 'text-sky-500'
              }`}
            >
              {dry.isOverdue ? '0% – Jetzt trocknen!' : `${dry.dryPct}% Trocken-Reserve`}
            </span>
          </div>
          <div
            className="w-full h-2.5 rounded-full overflow-hidden p-0.5"
            style={{ backgroundColor: 'var(--app-bg)' }}
          >
            <div
              className={`h-full rounded-full ${dry.dryBarColor} transition-all duration-500`}
              style={{ width: `${dry.dryPct}%` }}
            />
          </div>
        </div>

        <div
          className="flex justify-between items-center pt-1 border-t text-[11px]"
          style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
        >
          <span>Zuletzt: {dry.lastDriedFormatted}</span>
          <button
            onClick={() => {
              onMarkDried(spool.id);
              setDriedOk(true);
              setTimeout(() => setDriedOk(false), 1600);
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer border inline-flex items-center gap-1"
            style={{
              backgroundColor: 'var(--app-bg)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-accent-text)'
            }}
          >
            {driedOk && <Check key="ok" className="w-3.5 h-3.5 fh-pop" />}
            {driedOk ? 'Gespeichert' : 'Jetzt getrocknet'}
          </button>
        </div>
      </div>
    </div>
  );
};
