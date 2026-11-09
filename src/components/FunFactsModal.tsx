import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Code2,
  MessageSquare,
  MessagesSquare,
  Layers,
  Printer,
  Flame,
  Maximize2,
  Package,
  Ruler,
  Palette,
  Nfc,
  CalendarDays
} from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';
import type { HistoryEntry, Spool } from '../types/filament';
import { INITIAL_VERSION_PROFILES } from '../data/versions';
import { STORAGE_KEY_HISTORY } from '../utils/storageKeys';
import { fetchPrintStats, type PiStatEntry } from '../utils/recorderServer';
import { buckets, topUses, type PrintSpan, type UseEntry } from '../utils/funStats';
import { PrintStatsModal } from './PrintStatsModal';
import { APP_REVISION } from '../utils/env';

interface FunFactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spools?: Spool[];
}

// Woher die Zahlen kommen:
//  LIVE      = jedes Mal neu aus deinen Daten oder der Bambu Cloud berechnet
//  BAUEN     = beim Bauen der App gezählt (Codezeilen)
//  GEZÄHLT   = von Claude beim letzten Update gezählt (Chats, Commits)
//  SCHÄTZUNG = ungefähr, genauer geht es nicht
type Source = 'LIVE' | 'BAUEN' | 'GEZÄHLT' | 'SCHÄTZUNG';

// Von Claude beim Update auf v1.259 gezählt (Commits, Chats); Nachrichten und Wörter zuletzt bei v1.231
const CHATS = 20; // Chats im Projekt „filament webseite“
const MESSAGES = 466; // deine Nachrichten in diesen Chats (ca.)
const WORDS = 40250; // deine Wörter (ca., lange Sprachnachrichten zählen voll)
const COMMITS = 282; // Commits auf GitHub (main)
const PROJECT_START = new Date('2026-10-19T00:00:00');

const sourceStyle: Record<Source, { bg: string; fg: string; label: string }> = {
  LIVE: { bg: 'rgba(16,185,129,0.15)', fg: '#10b981', label: '● live' },
  BAUEN: { bg: 'rgba(59,130,246,0.15)', fg: '#3b82f6', label: 'beim Bauen' },
  GEZÄHLT: { bg: 'rgba(168,85,247,0.15)', fg: '#a855f7', label: 'gezählt' },
  SCHÄTZUNG: { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b', label: 'Schätzung' }
};

const fmt = (n: number, digits = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** Meter Filament aus Gramm (1,75 mm, Dichte je Material) */
function metersOf(s: Spool): number {
  const m = String(s.material || '').toUpperCase();
  const density = m.startsWith('PETG') ? 1.27 : m.startsWith('TPU') ? 1.21 : m.startsWith('ABS') ? 1.04 : m.startsWith('ASA') ? 1.07 : m.startsWith('PA') ? 1.14 : m.startsWith('PC') ? 1.2 : 1.24;
  const areaCm2 = Math.PI * 0.0875 * 0.0875;
  return (Math.max(0, s.remainingWeight || 0) / (density * areaCm2)) / 100;
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const FunFactsModal: React.FC<FunFactsModalProps> = ({ isOpen, onClose, spools = [] }) => {
  useEscapeClose(onClose, isOpen);
  const [piLog, setPiLog] = useState<PiStatEntry[]>([]);
  const [piLoading, setPiLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // 1.243/1.244: Druckzeit und Gramm selbst gezählt aus dem Dauer-Protokoll deines Pi (nicht mehr Bambu Cloud, nicht auf 200 Drucke begrenzt)
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setPiLoading(true);
    void fetchPrintStats()
      .then(r => alive && setPiLog(r))
      .finally(() => alive && setPiLoading(false));
    return () => {
      alive = false;
    };
  }, [isOpen]);

  const stats = useMemo(() => {
    const grams = spools.reduce((a, s) => a + Math.max(0, s.remainingWeight || 0), 0);
    const value = spools.reduce((a, s) => a + (Math.max(0, s.remainingWeight || 0) / 1000) * (s.pricePerKg || 0), 0);
    const meters = spools.reduce((a, s) => a + metersOf(s), 0);
    const count = (key: (s: Spool) => string) => {
      const m = new Map<string, number>();
      spools.forEach(s => {
        const k = key(s);
        if (k) m.set(k, (m.get(k) || 0) + 1);
      });
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];
    };
    const topMaterial = count(s => s.material);
    const topColor = count(s => (s.colorName || '').trim());
    const nfc = spools.filter(s => s.nfcWritten).length;
    const byId = new Map(spools.map(s => [s.id, s]));
    // Jeder Abzug im Verlauf = Gramm mit Material und Farbe der Spule (Spule gelöscht: Name aus dem Verlauf)
    const hist = readHistory().filter(h => h.grams > 0);
    const histIds = new Set(hist.map(h => h.id));
    const uses: UseEntry[] = hist.map(h => {
      const sp = byId.get(h.spoolId);
      return {
        ms: Date.parse(h.timestamp) || 0,
        grams: h.grams,
        label: sp ? `${sp.material} ${sp.colorName || ''}`.trim() : h.spoolLabel || 'Unbekannt',
        colorHex: sp?.colorHex || '#9ca3af'
      };
    });
    // Dazu das Protokoll vom Pi (kennt auch Abzüge, die in diesem Verlauf nicht mehr stehen). Doppelte erkennt die Verlaufs-ID.
    for (const p of piLog)
      for (const [label, colorHex, g, spoolId] of p.g || []) if (!histIds.has(`srv:${p.id}:${spoolId}`)) uses.push({ ms: p.e, grams: g, label, colorHex });
    const spans: PrintSpan[] = piLog.filter(p => p.e > p.s).map(p => ({ startMs: p.s, endMs: p.e }));
    const deducted = uses.reduce((a, u) => a + u.grams, 0);
    const days = Math.max(1, Math.floor((Date.now() - PROJECT_START.getTime()) / 86400000) + 1);
    return { grams, value, meters, topMaterial, topColor, nfc, deducted, days, uses, spans };
  }, [spools, isOpen, piLog]);

  if (!isOpen) return null;

  const laps = Math.round(stats.meters / 346); // Umfang Fußballfeld ≈ 346 m
  const spans = stats.spans;
  const week = buckets('Woche', spans, stats.uses, Date.now(), PROJECT_START.getTime());
  const weekH = week.reduce((a, x) => a + x.hours, 0);
  const weekMax = Math.max(0.0001, ...week.map(x => x.hours));
  const totalH = spans.reduce((a, p) => a + (p.endMs - p.startMs), 0) / 3_600_000;
  const top = topUses(stats.uses, 0, 4);
  const nfcPct = spools.length ? stats.nfc / spools.length : 0;
  const RING = 2 * Math.PI * 15;

  const tile = 'p-3.5 rounded-2xl border space-y-1.5';
  const tileStyle = { backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' };
  const Head: React.FC<{ icon: any; title: string; badge?: Source }> = ({ icon: Icon, title, badge }) => {
    // 1.248: „live“ ist der Normalfall und braucht kein Abzeichen. Nur Ausnahmen (Schätzung, gezählt, beim Bauen) bekommen eins.
    const src = badge && badge !== 'LIVE' ? sourceStyle[badge] : null;
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--app-accent-sub)', color: 'var(--app-accent-text)' }}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold truncate" style={{ color: 'var(--app-text-muted)' }}>
            {title}
          </span>
        </div>
        {src && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ backgroundColor: src.bg, color: src.fg }}>
            {src.label}
          </span>
        )}
      </div>
    );
  };
  const big = 'text-lg font-extrabold font-mono-num tracking-tight leading-tight';
  const muted = { color: 'var(--app-text-muted)' };
  const acc = { color: 'var(--app-accent-text)' };

  // Einfache Kacheln (Zahl + Satz)
  const simple: { icon: any; title: string; value: string; desc: string; source: Source }[] = [
    {
      icon: Ruler,
      title: 'So lang ist dein Filament',
      value: `${fmt(stats.meters / 1000, 1)} km`,
      desc: `Alles abgewickelt (1,75 mm). Damit läufst du ${fmt(laps)}-mal um ein Fußballfeld.`,
      source: 'LIVE'
    },
    {
      icon: MessageSquare,
      title: 'Deine Wörter an Claude',
      value: `ca. ${fmt(WORDS)} Wörter`,
      desc: `Grob gezählt über ${MESSAGES} Nachrichten. Deine langen Sprachnachrichten zählen voll mit.`,
      source: 'SCHÄTZUNG'
    },
    {
      icon: MessagesSquare,
      title: 'Gespräche',
      value: `${CHATS} Chats`,
      desc: 'Chats im Projekt „filament webseite“, dieser hier mitgezählt.',
      source: 'GEZÄHLT'
    },
    {
      icon: Layers,
      title: 'Versionen',
      value: `${INITIAL_VERSION_PROFILES.length} Versionen`,
      desc: `Von v1.00 bis v${APP_REVISION}. Jede lässt sich im Revisionsmenü wiederherstellen.`,
      source: 'LIVE'
    },
    {
      icon: CalendarDays,
      title: 'Projekt-Alter',
      value: `${stats.days} Tage`,
      desc: `Seit dem 19. Oktober 2026. Das sind ${fmt(INITIAL_VERSION_PROFILES.length / stats.days, 1)} Versionen pro Tag.`,
      source: 'LIVE'
    }
  ];

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--app-card)', color: 'var(--app-text)' }}
      >
        {/* Kopf */}
        <div className="sticky top-0 z-10 p-4 sm:p-5 text-white" style={{ background: 'var(--app-accent-gradient, var(--app-accent))' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-extrabold text-lg leading-tight flex items-center gap-2">
                  Fun Facts
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono-num">v{APP_REVISION}</span>
                </h3>
                <p className="text-[11px] text-white/85">Echte Zahlen aus deinen Spulen, deinem Drucker und unserem Projekt</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl bg-white/15 hover:bg-white/25 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Am meisten verdruckt: breiter Balken mit Farben der Spulen */}
          <div className={`${tile} sm:col-span-2`} style={tileStyle}>
            <Head icon={Flame} title="Am meisten verdruckt" badge="LIVE" />
            {top.length === 0 ? (
              <p className="text-[11px]" style={muted}>Noch nichts abgezogen. Sobald ein Druck abgezogen wird, siehst du hier, was du am meisten verbrauchst.</p>
            ) : (
              <>
                <div className={`${big} text-xl`} style={acc}>
                  {top[0].label} · {fmt(top[0].grams / 1000, 2)} kg
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                  {top.map(t => (
                    <div key={t.label} style={{ width: `${Math.max(3, t.pct)}%`, backgroundColor: t.colorHex, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.25)' }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]" style={muted}>
                  {top.map(t => (
                    <span key={t.label} className="flex items-center gap-1">
                      <i className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: t.colorHex, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.3)' }} />
                      {t.label} {fmt(t.pct, 0)} %
                    </span>
                  ))}
                </div>
                <p className="text-[11px]" style={muted}>Insgesamt {fmt(stats.deducted / 1000, 2)} kg abgezogen (Knöpfe, Waage, Auto-Abzug).</p>
              </>
            )}
          </div>

          {/* Druckzeit: Wochensäulen, antippen = großes Fenster */}
          <button type="button" onClick={() => setShowStats(true)} className={`${tile} text-left cursor-pointer hover:brightness-110 transition`} style={tileStyle} aria-label="Druckzeit und Gewicht im großen Fenster öffnen">
            <div className="flex items-start justify-between gap-2">
              <Head icon={Printer} title="Druckzeit" badge="LIVE" />
              <Maximize2 className="w-3.5 h-3.5 shrink-0 mt-1" style={muted} />
            </div>
            {piLoading && spans.length === 0 ? (
              <div className="space-y-1.5 py-0.5" aria-label="Lädt Druckzeiten vom Pi">
                <div className="fh-skeleton h-6 w-24" />
                <div className="fh-skeleton h-3 w-40" />
              </div>
            ) : (
              <>
                <div className={big} style={acc}>
                  {fmt(weekH)} Std.
                </div>
                <p className="text-[11px]" style={muted}>
                  diese Woche · {fmt(week.reduce((a, x) => a + x.grams, 0), 0)} g · gesamt {fmt(totalH, 0)} Std.
                </p>
              </>
            )}
            {/* 1.259: runde Säulen mit weicher Schiene; feste Breite, Fläche wächst von unten (kein Kreis mehr bei großer Säule) */}
            <div className="flex items-end gap-1 h-16 pt-1">
              {week.map((x, i) => {
                const pct = x.hours > 0 ? Math.max(14, (x.hours / weekMax) * 100) : 0;
                return (
                  <div key={i} className="flex-1 flex justify-center h-full" title={`${x.label}: ${fmt(x.hours)} Std.`}>
                    <div className="relative w-4 h-full rounded-full overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--app-border) 55%, transparent)' }}>
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-full transition-all duration-500"
                        style={{
                          height: x.hours > 0 ? `${pct}%` : '0.25rem',
                          background: x.current ? 'linear-gradient(180deg,#34d399,#10b981)' : 'color-mix(in srgb, var(--app-accent-bar) 45%, var(--app-border))',
                          opacity: x.hours > 0 || x.current ? 1 : 0.7
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 text-[10px]" style={muted}>
              {week.map((x, i) => (
                <span key={i} className="flex-1 text-center" style={{ fontWeight: x.current ? 800 : 400 }}>
                  {x.label}
                </span>
              ))}
            </div>
          </button>

          {/* NFC: Ring */}
          <div className={tile} style={tileStyle}>
            <Head icon={Nfc} title="NFC-Tags beschrieben" badge="LIVE" />
            <div className="flex items-center gap-3">
              <svg width="56" height="56" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--app-border)" strokeWidth="4.5" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeDasharray={`${RING * nfcPct} ${RING}`} transform="rotate(-90 18 18)" />
              </svg>
              <div>
                <div className={big} style={acc}>
                  {stats.nfc} von {spools.length}
                </div>
                <p className="text-[11px]" style={muted}>
                  {stats.nfc === spools.length && spools.length > 0 ? 'Alle Spulen haben einen Tag. Stark!' : `Noch ${spools.length - stats.nfc} Spulen ohne Tag.`}
                </p>
              </div>
            </div>
          </div>

          {/* Lager */}
          <div className={tile} style={tileStyle}>
            <Head icon={Package} title="Spulen im Lager" badge="LIVE" />
            <div className={big} style={acc}>
              {spools.length} Spulen · {fmt(stats.grams / 1000, 1)} kg
            </div>
            <p className="text-[11px]" style={muted}>
              Wert im Regal {fmt(stats.value, 0)} € (Restgewicht × Kilopreis)
            </p>
          </div>

          {/* Lieblinge im Bestand */}
          <div className={tile} style={tileStyle}>
            <Head icon={Palette} title="Lieblinge im Bestand" badge="LIVE" />
            <div className={big} style={acc}>
              {stats.topMaterial?.[0] || '–'} · {stats.topColor?.[0] || '–'}
            </div>
            <p className="text-[11px]" style={muted}>
              {stats.topMaterial?.[1] || 0} Spulen {stats.topMaterial?.[0] || ''}, {stats.topColor?.[1] || 0}× die Farbe „{stats.topColor?.[0] || '–'}“ (nach Bestand, nicht nach Verbrauch).
            </p>
          </div>

          {/* Code: große Zahl und drei kleine Kacheln */}
          <div className={`${tile} sm:col-span-2`} style={tileStyle}>
            <div className="flex items-center justify-between gap-2">
              <Head icon={Code2} title="Codezeilen" badge="BAUEN" />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-num border" style={{ borderColor: 'var(--app-border)', ...muted }}>
                v{APP_REVISION}
              </span>
            </div>
            <div className="text-3xl font-extrabold font-mono-num tracking-tight" style={acc}>
              {fmt(typeof __CODE_LINES__ === 'number' && __CODE_LINES__ > 0 ? __CODE_LINES__ : 0)}
            </div>
            <p className="text-[11px]" style={muted}>Bei jedem Bauen neu gezählt: TypeScript, React, Server und die Android-Plugins in Java.</p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                [String(CHATS), 'Chats'],
                [String(COMMITS), 'Commits'],
                [String(stats.days), 'Tage']
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl py-1.5 text-center" style={{ backgroundColor: 'var(--app-card)' }}>
                  <div className="text-sm font-extrabold font-mono-num">{v}</div>
                  <div className="text-[10px]" style={muted}>
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {simple.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title} className={tile} style={tileStyle}>
                <Head icon={Icon} title={f.title} badge={f.source} />
                <div className={big} style={acc}>
                  {f.value}
                </div>
                <p className="text-[11px] leading-snug" style={muted}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>

        <div className="px-4 sm:px-5 pb-5 text-[10px] leading-snug" style={muted}>
          <strong>live</strong> = jedes Öffnen neu berechnet · <strong>beim Bauen</strong> = beim Erstellen der Version gezählt ·{' '}
          <strong>gezählt</strong> = von Claude beim letzten Update gezählt · <strong>Schätzung</strong> = ungefähr
        </div>
      </div>
      {showStats && <PrintStatsModal onClose={() => setShowStats(false)} prints={spans} uses={stats.uses} projectStart={PROJECT_START.getTime()} />}
    </div>
  );
};
