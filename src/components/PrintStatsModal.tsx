import React, { useMemo, useState } from 'react';
import { Clock, Scale, X } from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { RANGES, buckets, rangeStart, smoothPath, topUses, type PrintSpan, type Range, type UseEntry } from '../utils/funStats';

// Großes Fenster zur Druckzeit: Zeitraum wählen (Woche, Monat, Jahr, Gesamt), weiche Kurve für Druckzeit oder Gewicht,
// darunter wer am meisten verdruckt wurde. Alles selbst gezählt (Pi-Aufzeichnung + Abzugs-Verlauf), nichts von der Bambu Cloud.

const fmt = (n: number, d = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d });
const W = 320;
const H = 120;
const PAD = 8;

interface Props {
  onClose: () => void;
  prints: PrintSpan[];
  uses: UseEntry[];
  projectStart: number;
}

export const PrintStatsModal: React.FC<Props> = ({ onClose, prints, uses, projectStart }) => {
  useEscapeClose(onClose, true);
  const [range, setRange] = useState<Range>('Woche');
  const [metric, setMetric] = useState<'h' | 'g'>('h');
  const [hover, setHover] = useState<number | null>(null);

  const b = useMemo(() => buckets(range, prints, uses, Date.now(), projectStart), [range, prints, uses, projectStart]);
  const totalH = b.reduce((s, x) => s + x.hours, 0);
  const totalG = b.reduce((s, x) => s + x.grams, 0);
  const top = useMemo(() => topUses(uses, rangeStart(range)), [uses, range]);

  const vals = b.map(x => (metric === 'h' ? x.hours : x.grams));
  const max = Math.max(0.0001, ...vals);
  const step = b.length > 1 ? (W - PAD * 2) / (b.length - 1) : 0;
  const pts: [number, number][] = vals.map((v, i) => [PAD + i * step, H - PAD - (v / max) * (H - PAD * 2)]);
  const line = smoothPath(pts, H);
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z` : '';
  const sel = hover ?? Math.max(0, b.findIndex(x => x.current));
  const cur = b[sel];
  const every = Math.max(1, Math.ceil(b.length / 7));
  const unit = (v: number) => (metric === 'h' ? `${fmt(v)} Std.` : v >= 1000 ? `${fmt(v / 1000, 2)} kg` : `${fmt(v, 0)} g`);
  const color = metric === 'h' ? '#10b981' : '#3b82f6';

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" style={{ backgroundColor: 'var(--app-card)', color: 'var(--app-text)' }}>
        <div className="p-4 sm:p-5 flex items-center justify-between">
          <h3 className="font-extrabold text-base">Druckzeit und Gewicht</h3>
          <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-full cursor-pointer hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 space-y-4 pb-5">
          {/* Zeitraum: runde Schalter */}
          <div className="flex gap-1 p-1 rounded-full" style={{ backgroundColor: 'var(--app-card-sub)' }}>
            {RANGES.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRange(r);
                  setHover(null);
                }}
                className="flex-1 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors"
                style={r === range ? { backgroundColor: 'var(--app-card)', color: 'var(--app-text)', boxShadow: '0 1px 3px rgba(0,0,0,.25)' } : { color: 'var(--app-text-muted)' }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Zwei Zahlen, antippen wechselt die Kurve */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['h', Clock, 'Druckzeit', `${fmt(totalH)} Std.`],
                ['g', Scale, 'Gewicht', totalG >= 1000 ? `${fmt(totalG / 1000, 2)} kg` : `${fmt(totalG, 0)} g`]
              ] as const
            ).map(([k, Icon, label, val]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMetric(k)}
                className="text-left p-3 rounded-2xl border cursor-pointer transition-colors"
                style={{ backgroundColor: 'var(--app-card-sub)', borderColor: metric === k ? (k === 'h' ? '#10b981' : '#3b82f6') : 'var(--app-border)' }}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </div>
                <div className="text-xl font-extrabold font-mono-num">{val}</div>
              </button>
            ))}
          </div>

          {/* Weiche Kurve mit verlaufender Fläche */}
          <div className="rounded-2xl p-3 border" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
            <div className="flex items-baseline justify-between mb-1 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
              <span className="font-bold">{cur?.label}</span>
              <span className="font-mono-num font-extrabold text-sm" style={{ color }}>{cur ? unit(metric === 'h' ? cur.hours : cur.grams) : ''}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none" role="img" aria-label="Verlauf">
              <defs>
                <linearGradient id="ps-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.45" />
                  <stop offset="60%" stopColor={color} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map(f => (
                <line key={f} x1={PAD} x2={W - PAD} y1={H - PAD - f * (H - PAD * 2)} y2={H - PAD - f * (H - PAD * 2)} stroke="var(--app-border)" strokeDasharray="2 4" />
              ))}
              {area && <path d={area} fill="url(#ps-fill)" />}
              {line && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {pts[sel] && (
                <>
                  <line x1={pts[sel][0]} x2={pts[sel][0]} y1={PAD} y2={H - PAD} stroke={color} strokeOpacity="0.35" />
                  <circle cx={pts[sel][0]} cy={pts[sel][1]} r="5" fill="var(--app-card)" stroke={color} strokeWidth="2.5" />
                </>
              )}
              {pts.map((p, i) => (
                <rect key={i} x={p[0] - Math.max(step / 2, 6)} y={0} width={Math.max(step, 12)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} onTouchStart={() => setHover(i)} />
              ))}
            </svg>
            <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--app-text-muted)' }}>
              {b.map((x, i) => (
                <span key={i} className="flex-1 text-center" style={{ visibility: i % every === 0 || x.current ? 'visible' : 'hidden', fontWeight: x.current ? 800 : 400 }}>
                  {x.label}
                </span>
              ))}
            </div>
          </div>

          {/* Am meisten verdruckt: runder Balken mit weichen Übergängen */}
          <div className="rounded-2xl p-3 border space-y-2" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
            <div className="text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>Am meisten verdruckt</div>
            {top.length === 0 ? (
              <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>In diesem Zeitraum wurde noch nichts abgezogen.</p>
            ) : (
              <>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  {top.map(s => (
                    <div key={s.label} className="transition-all duration-500" style={{ width: `${Math.max(2, s.pct)}%`, backgroundColor: s.colorHex, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.25)' }} title={`${s.label} ${fmt(s.pct, 0)} %`} />
                  ))}
                </div>
                <div className="space-y-1.5">
                  {top.map(s => (
                    <div key={s.label} className="flex items-center gap-2 text-[11px]">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.colorHex, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.3)' }} />
                      <span className="flex-1 truncate font-bold">{s.label}</span>
                      <span style={{ color: 'var(--app-text-muted)' }}>{fmt(s.pct, 0)} %</span>
                      <span className="font-mono-num font-extrabold w-16 text-right">{s.grams >= 1000 ? `${fmt(s.grams / 1000, 2)} kg` : `${fmt(s.grams, 0)} g`}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <p className="text-[10px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
            Druckzeit: Drucke, die dein Pi aufgezeichnet hat. Gewicht: Abzüge aus dem Verlauf. Ohne Bambu Cloud.
          </p>
        </div>
      </div>
    </div>
  );
};
