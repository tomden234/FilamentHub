import { slotLabel } from '../utils/slotLabel';
import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Tag, Sun, ShoppingCart, ExternalLink, ChevronDown, Minus, Plus, Check } from 'lucide-react';
import type { AppSettings, Spool } from '../types/filament';
import { getDryingStatus, getSpoolLink } from '../utils/shopLinks';
import { useSpoolAms } from '../hooks/useSpoolAms';
import { SpoolBadges } from './workshop/SpoolBadges';
import { isLowSpool } from '../utils/spoolAlerts';
import { useWorkshopSettings } from '../utils/workshopSettings';
import { LabelPrintButton } from './LabelPrintButton';
import { openShop } from '../utils/productPage';
import { IncomingChips } from './workshop/IncomingChips';
import { NumInput } from './ui/NumInput';

// Spulen-Kachel: Spulen-Symbol in der Filamentfarbe (Füllung zeigt den Rest), Name, großes Gewicht, durchgehender Füllstandsbalken.
// Antippen klappt die Aktionen auf.

interface SpoolTileProps {
  spool: Spool;
  now: number;
  appSettings?: AppSettings;
  onDeduct: (id: string, grams: number) => void;
  onAdd?: (id: string, grams: number) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onWriteNfc?: (id: string) => void;
  onMarkDried?: (id: string) => void;
}

/** Durchgehender Füllstandsbalken */
const LevelBar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <span className="block relative h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-card-sub)' }} aria-hidden="true">
    <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
  </span>
);

/** Spule von der Seite: Flansch, Filament (Dicke = Rest), Nabe mit Löchern. Farbe = Filamentfarbe. */
export const SpoolIcon: React.FC<{ hex: string; pct: number; size?: number }> = ({ hex, pct, size = 60 }) => {
  const hub = 9; // Nabe
  const full = 21; // Filament ganz voll
  const r = hub + 1.5 + ((full - hub - 1.5) * Math.max(0, Math.min(100, pct))) / 100;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="shrink-0" aria-hidden="true">
      {/* Flansch (Spulenkörper) */}
      <circle cx="24" cy="24" r="23" fill={`color-mix(in srgb, ${hex} 18%, color-mix(in srgb, var(--app-text) 10%, var(--app-card-sub)))`} stroke="color-mix(in srgb, var(--app-text) 28%, transparent)" strokeWidth="1" />
      {/* Filament */}
      {pct > 0 && <circle cx="24" cy="24" r={r} fill={hex} stroke="rgba(0,0,0,0.3)" strokeWidth="0.9" />}
      {pct > 0 && (
        <>
          <circle cx="24" cy="24" r={Math.max(hub + 1, r - 3)} fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth="0.7" />
          <circle cx="24" cy="24" r={Math.max(hub + 1, r - 6)} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="0.7" />
        </>
      )}
      {/* Glanz */}
      {pct > 0 && <path d={`M ${24 - r * 0.7} ${24 - r * 0.7} A ${r} ${r} 0 0 1 ${24 + r * 0.2} ${24 - r * 0.95}`} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round" />}
      {/* Nabe */}
      <circle cx="24" cy="24" r={hub} fill="var(--app-card)" stroke="color-mix(in srgb, var(--app-text) 30%, transparent)" strokeWidth="1" />
      <circle cx="24" cy="24" r="3.2" fill="color-mix(in srgb, var(--app-text) 22%, var(--app-card-sub))" />
      {[0, 120, 240].map(a => (
        <circle key={a} cx={24 + 6 * Math.cos((a * Math.PI) / 180)} cy={24 + 6 * Math.sin((a * Math.PI) / 180)} r="1.3" fill="color-mix(in srgb, var(--app-text) 22%, var(--app-card-sub))" />
      ))}
    </svg>
  );
};

const quick = [10, 25, 50, 100];

export const SpoolTile: React.FC<SpoolTileProps> = ({ spool, now, appSettings, onDeduct, onAdd, onEdit, onDelete, onWriteNfc, onMarkDried }) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [driedOk, setDriedOk] = useState(false);
  const ams = useSpoolAms(spool.id);
  const [ws] = useWorkshopSettings();
  const low = ws.lowWarning && isLowSpool(spool, ws.lowWeightG);
  const link = getSpoolLink(spool);
  const dry = getDryingStatus(spool, now);

  const initW = Math.round(Number(spool.initialWeight) || 1000);
  const remW = Math.round(Number(spool.remainingWeight) || 0);
  const pct = Math.max(0, Math.min(100, Math.round((remW / initW) * 100)));
  const barColor = pct <= 15 ? '#ef4444' : pct <= 30 ? '#f59e0b' : 'linear-gradient(90deg, var(--app-accent), var(--app-accent-bar, var(--app-accent)))';
  const hex = spool.colorHex || '#94a3b8';
  void appSettings;

  const add = (g: number) => (onAdd ? onAdd(spool.id, g) : onDeduct(spool.id, -g));
  const customG = parseInt(custom, 10);

  // 1.248: Sichtbares Feedback bei jeder Gewichtsänderung (Zahl hüpft, „−25 g“ schwebt weg)
  const prevRem = useRef(remW);
  const [delta, setDelta] = useState<{ g: number; k: number } | null>(null);
  useEffect(() => {
    const d = remW - prevRem.current;
    prevRem.current = remW;
    if (d !== 0) setDelta({ g: d, k: Date.now() });
  }, [remW]);
  useEffect(() => {
    if (!delta) return;
    const t = setTimeout(() => setDelta(null), 1100);
    return () => clearTimeout(t);
  }, [delta]);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <article
      className={`fh-lift relative overflow-hidden rounded-2xl border ${spool.incoming ? 'border-dashed border-slate-400/60 opacity-70' : dry.isOverdue ? 'border-rose-500/60' : ''}`}
      style={{
        backgroundColor: 'var(--app-card)',
        borderColor: dry.isOverdue || spool.incoming ? undefined : 'var(--app-border)',
        color: 'var(--app-text)'
      }}
    >
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left pl-3 pr-4 py-3 flex items-center gap-3 cursor-pointer" aria-expanded={open}>
        <SpoolIcon hex={hex} pct={pct} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-bold text-[13px] leading-tight truncate">{spool.name}</span>
          </span>
          <span className="block text-[11px] truncate mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
            {spool.brand} · {spool.material}
            {spool.colorName ? ` · ${spool.colorName}` : ''}
          </span>
          <span className="flex items-end justify-between gap-3 mt-2">
            <span className="relative font-mono-num font-extrabold text-2xl leading-none tracking-tight" style={{ color: pct <= 15 ? 'var(--app-danger-text)' : 'var(--app-text)' }}>
              <span key={delta?.k ?? 0} className={delta ? 'fh-bump' : undefined}>
                {remW}
              </span>
              <span className="text-xs font-bold ml-0.5" style={{ color: 'var(--app-text-muted)' }}>g</span>
              {delta && (
                <span
                  key={`f${delta.k}`}
                  className="fh-float absolute left-full ml-2 bottom-1 text-xs font-bold whitespace-nowrap"
                  style={{ color: delta.g < 0 ? 'var(--app-danger-text)' : 'var(--app-accent-text)' }}
                  aria-live="polite"
                >
                  {delta.g > 0 ? '+' : '−'}
                  {Math.abs(delta.g)} g
                </span>
              )}
            </span>
            <span className="text-[11px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
              {pct} % von {initW} g
            </span>
          </span>
          <span className="block mt-2">
            <LevelBar pct={pct} color={barColor} />
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--app-text-muted)' }} />
      </button>

      {(ams.slot !== null || ams.isDrying || dry.isOverdue || spool.needsDrying || low || spool.incoming) && !open && (
        <div className="pl-[5.25rem] pr-4 pb-3 -mt-0.5 flex flex-wrap items-center gap-1">
          <IncomingChips spool={spool} />
          {ams.slot !== null && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[#00AE42]/20 text-[#00AE42] border border-[#00AE42]/30">{slotLabel(ams.slot)}</span>}
          {ams.isDrying && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 inline-flex items-center gap-1">
              <Sun className="w-2.5 h-2.5" />
              Trocknet {ams.remainingTime ? `(${ams.remainingTime})` : ''}
            </span>
          )}
          {(dry.isOverdue || spool.needsDrying) && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-500/15 text-rose-400 border border-rose-500/40">Trocknen fällig</span>}
          {low && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-500/15 text-amber-400 border border-amber-500/40">{remW <= 0 ? 'Leer' : 'Fast leer'}</span>}
        </div>
      )}


      {!open && (
        <div className="px-3 pb-3 -mt-0.5 flex items-center justify-end gap-1" onClick={stop}>
          <a href={link.url} onClick={e => openShop(e, spool, link)} target="_blank" rel="noopener noreferrer" title={`${link.label} öffnen`} aria-label={`${link.label} öffnen`} className="p-1.5 rounded-lg text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <LabelPrintButton spool={spool} compact />
          {onWriteNfc && (
            <button
              onClick={() => onWriteNfc(spool.id)}
              title={spool.nfcWritten ? 'NFC-Tag beschrieben – Details, Löschen' : 'Spule auf NFC-Tag schreiben'}
              aria-label="NFC"
              className={`p-1.5 rounded-lg transition cursor-pointer border ${spool.nfcWritten ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25' : 'text-rose-400 bg-rose-500/15 border-rose-500/40 hover:bg-rose-500/25'}`}
            >
              <Tag className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onEdit(spool.id)} title="Spule bearbeiten" aria-label="Spule bearbeiten" className="p-1.5 rounded-lg text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(spool.id)} title="Spule löschen" aria-label="Spule löschen" className="p-1.5 rounded-lg text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {open && (
        <div className="pl-3 pr-4 pb-4 space-y-3 border-t pt-3" style={{ borderColor: 'var(--app-border)' }} onClick={stop}>
          <div className="flex flex-wrap items-center gap-1 empty:hidden">
            {ams.slot !== null && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[#00AE42]/20 text-[#00AE42] border border-[#00AE42]/30">{slotLabel(ams.slot)}</span>}
            <SpoolBadges spool={spool} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {quick.map(g => (
              <button key={`m${g}`} onClick={() => onDeduct(spool.id, g)} className="py-1.5 rounded-lg border text-[11px] font-mono-num font-bold cursor-pointer active:scale-95 text-rose-400 bg-rose-500/10 border-rose-500/30">
                −{g}
              </button>
            ))}
            {quick.map(g => (
              <button key={`p${g}`} onClick={() => add(g)} className="py-1.5 rounded-lg border text-[11px] font-mono-num font-bold cursor-pointer active:scale-95 text-emerald-500 bg-emerald-500/10 border-emerald-500/30">
                +{g}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <NumInput
              type="number"
              inputMode="numeric"
              placeholder="Gramm"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono-num outline-none"
              style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            />
            <button
              disabled={!(customG > 0)}
              onClick={() => {
                onDeduct(spool.id, customG);
                setCustom('');
              }}
              className="p-2 rounded-lg border cursor-pointer disabled:opacity-40 text-rose-400 bg-rose-500/10 border-rose-500/30"
              aria-label="Gramm abziehen"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={!(customG > 0)}
              onClick={() => {
                add(customG);
                setCustom('');
              }}
              className="p-2 rounded-lg border cursor-pointer disabled:opacity-40 text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
              aria-label="Gramm hinzufügen"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onMarkDried && (
              <button
                onClick={() => {
                  onMarkDried(spool.id);
                  setDriedOk(true);
                  setTimeout(() => setDriedOk(false), 1600);
                }}
                className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1"
                style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              >
                {driedOk ? <Check key="ok" className="w-3.5 h-3.5 text-emerald-500 fh-pop" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
                {driedOk ? 'Gespeichert' : 'Getrocknet'}
              </button>
            )}
            {onWriteNfc && (
              <button
                onClick={() => onWriteNfc(spool.id)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1 ${spool.nfcWritten ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'}`}
                title={spool.nfcWritten ? 'NFC beschrieben (Details, Löschen)' : 'NFC noch nicht beschrieben'}
              >
                <Tag className="w-3.5 h-3.5" />
                NFC
              </button>
            )}
            <LabelPrintButton spool={spool} className="py-1.5" />
            <a href={link.url} onClick={e => openShop(e, spool, link)} target="_blank" rel="noopener noreferrer" title={link.label} className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 text-cyan-500 bg-cyan-500/10 border-cyan-500/30">
              <ShoppingCart className="w-3.5 h-3.5" />
              Shop
            </a>
            <span className="flex-1" />
            <button onClick={() => onEdit(spool.id)} className="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
              <Pencil className="w-3.5 h-3.5" />
              Ändern
            </button>
            <button onClick={() => onDelete(spool.id)} className="p-1.5 rounded-lg border cursor-pointer text-rose-500 bg-rose-500/10 border-rose-500/30" aria-label="Spule löschen" title="Löschen">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
