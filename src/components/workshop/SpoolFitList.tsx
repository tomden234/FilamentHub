import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { Spool } from '../../types/filament';
import { checkSpoolFit, FIT_RESERVE, neededGrams } from '../../utils/spoolCheck';

interface Props {
  spools: Spool[];
  grams: number;
  material?: string;
  amsSlots?: Record<number, string>;
  /** Nur diese Spulen prüfen (z. B. die im AMS) */
  onlyIds?: string[];
  title?: string;
  maxRows?: number;
}

/** "Reicht die Spule?": zeigt für einen Bedarf in Gramm, welche Spulen genug Rest haben. */
export const SpoolFitList: React.FC<Props> = ({ spools, grams, material, amsSlots, onlyIds, title, maxRows = 5 }) => {
  if (!grams || grams <= 0) return null;
  const pool = onlyIds ? spools.filter(s => onlyIds.includes(s.id)) : spools;
  const all = checkSpoolFit(pool, grams, material, amsSlots);
  const same = all.filter(f => f.sameMaterial);
  const rows = (same.length > 0 ? same : all).slice(0, maxRows);
  const anyOk = all.some(f => f.ok && f.sameMaterial);
  const need = neededGrams(grams);

  return (
    <div
      className="rounded-xl border p-3 space-y-2"
      style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-extrabold">{title || 'Reicht die Spule?'}</span>
        <span className="text-[10px] font-mono-num text-right" style={{ color: 'var(--app-text-muted)' }}>
          Bedarf ≈ {need} g
          <br />
          inkl. {Math.round(FIT_RESERVE * 100)} % Reserve
        </span>
      </div>

      {same.length === 0 && (
        <p className="text-[11px] text-amber-400">
          Keine {material || ''}-Spule im Bestand. Hier die übrigen Spulen zum Vergleich.
        </p>
      )}
      {same.length > 0 && !anyOk && (
        <p className="text-[11px] font-bold text-rose-400">Keine passende Spule hat genug Rest. Neue Spule nötig oder Druck teilen.</p>
      )}

      <div className="space-y-1">
        {rows.map(f => (
          <div
            key={f.spool.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px]"
            style={{ backgroundColor: 'var(--app-card)', borderColor: f.ok ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)' }}
          >
            {f.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="w-3 h-3 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: f.spool.colorHex }} />
            <span className="min-w-0 flex-1 truncate font-bold">
              {f.spool.name}
              {f.amsSlot ? <span className="ml-1 text-[#00AE42]">{f.amsSlot === 5 ? 'Extern' : `AMS ${f.amsSlot}`}</span> : null}
            </span>
            <span className="font-mono-num shrink-0" style={{ color: f.ok ? '#34d399' : '#fb7185' }}>
              {f.ok ? `Rest danach ${Math.round(f.diff)} g` : `fehlt ${Math.abs(Math.round(f.diff))} g`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
