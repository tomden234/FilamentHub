// Stehende Mitteilung (Android): Druck- oder Trocknungsstand mit Balken, Restzeit und Uhrzeit, wann es fertig ist.
// Reine Rechenlogik, darum ohne Browser testbar.
import { ACTIVE_STATES } from './printSession';
import { DRY_OFF_SETTLE_MS } from './dryAutoOff';

export interface LiveStatusInput {
  connected: boolean;
  gcodeState?: string;
  percent: number;
  remainingMin: number;
  jobName?: string;
  layer?: number;
  totalLayers?: number;
  /** Restzeit der AMS-Trocknung in Minuten (0 = trocknet nicht) */
  dryMinLeft: number;
  /** Gesamtdauer der laufenden Trocknung in Minuten (0 = unbekannt) */
  dryTotalMin: number;
  /** „Danach Drucker ausschalten“: Ende der Trocknung (0 = kein Zähler) */
  dryOffEndedAt: number;
  now: number;
  /** Wartezeit bis zum Ausschalten in ms (Standard 3 Minuten) */
  settleMs?: number;
}

export interface LiveStatus {
  kind: 'print' | 'dry' | 'dryoff';
  title: string;
  text: string;
  sub: string;
  /** 0 bis 100, -1 = unbekannt */
  progress: number;
  /** Zeitpunkt, an dem es fertig ist (ms), 0 = unbekannt */
  etaMs: number;
  /** Kurztext für die Statusleiste */
  shortText: string;
}

export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m >= 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
  return `${m} min`;
}

/** „18:42 Uhr“, an einem anderen Tag mit „morgen“ oder Wochentag */
export function fmtClock(ts: number, now: number): string {
  const d = new Date(ts);
  const n = new Date(now);
  const hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const dayDiff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) / 86400000);
  if (dayDiff <= 0) return `${hm} Uhr`;
  if (dayDiff === 1) return `morgen ${hm} Uhr`;
  return `${d.toLocaleDateString('de-DE', { weekday: 'short' })} ${hm} Uhr`;
}

export function buildLiveStatus(i: LiveStatusInput): LiveStatus | null {
  if (!i.connected) return null;
  const printing = ACTIVE_STATES.has(String(i.gcodeState || ''));
  const drying = i.dryMinLeft > 0;
  const dryEta = drying ? i.now + i.dryMinLeft * 60_000 : 0;
  const dryProgress = drying && i.dryTotalMin > 0 ? Math.max(0, Math.min(99, Math.round(((i.dryTotalMin - i.dryMinLeft) / i.dryTotalMin) * 100))) : -1;
  const dryLine = drying ? `Trocknen: fertig ${fmtClock(dryEta, i.now)} (noch ${fmtDuration(i.dryMinLeft)})` : '';

  if (printing) {
    const paused = i.gcodeState === 'PAUSE';
    const prepare = i.gcodeState === 'PREPARE';
    const pct = Math.max(0, Math.min(100, Math.round(i.percent || 0)));
    const eta = i.remainingMin > 0 ? i.now + i.remainingMin * 60_000 : 0;
    const title = paused ? `⏸️ Druck pausiert (${pct} %)` : prepare ? '🧊 Druck wird vorbereitet' : `🧊 Druck ${pct} %`;
    const main = eta ? `Fertig ${fmtClock(eta, i.now)} · noch ${fmtDuration(i.remainingMin)}` : 'Restzeit wird berechnet';
    const layers = i.totalLayers && i.totalLayers > 0 ? `Schicht ${i.layer || 0}/${i.totalLayers}` : '';
    return {
      kind: 'print',
      title,
      text: [main, dryLine].filter(Boolean).join('\n'),
      sub: [i.jobName, layers].filter(Boolean).join(' · '),
      progress: prepare ? -1 : pct,
      etaMs: paused ? 0 : eta,
      shortText: paused ? 'Pause' : prepare ? '…' : `${pct} %`
    };
  }

  if (i.dryOffEndedAt > 0 && !drying) {
    const settle = i.settleMs ?? DRY_OFF_SETTLE_MS;
    const left = Math.max(0, i.dryOffEndedAt + settle - i.now);
    if (left > 0) {
      const sec = Math.ceil(left / 1000);
      return {
        kind: 'dryoff',
        title: '✅ Trocknung fertig',
        text: `Drucker geht aus in ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`,
        sub: 'In der App „Abbrechen“ drücken, um ihn anzulassen',
        progress: Math.round(((settle - left) / settle) * 100),
        etaMs: i.dryOffEndedAt + settle,
        shortText: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
      };
    }
  }

  if (drying) {
    return {
      kind: 'dry',
      title: dryProgress >= 0 ? `💧 Trocknung ${dryProgress} %` : '💧 Trocknung läuft',
      text: `Fertig ${fmtClock(dryEta, i.now)} · noch ${fmtDuration(i.dryMinLeft)}`,
      sub: 'AMS',
      progress: dryProgress,
      etaMs: dryEta,
      shortText: fmtDuration(i.dryMinLeft).replace(' min', 'm').replace(' h ', 'h ')
    };
  }
  return null;
}
