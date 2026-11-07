// Fun Facts: Druckzeit und Gewicht selbst gezählt (ohne Bambu Cloud).
// Druckzeit kommt aus den Drucken, die der Pi aufzeichnet; Gewicht und Material aus dem Abzugs-Verlauf.

export type Range = 'Woche' | 'Monat' | 'Jahr' | 'Gesamt';
export const RANGES: Range[] = ['Woche', 'Monat', 'Jahr', 'Gesamt'];

export interface PrintSpan {
  startMs: number;
  endMs: number;
}
export interface UseEntry {
  ms: number;
  grams: number;
  /** z. B. „PLA Weiß“ */
  label: string;
  colorHex: string;
}

export interface Bucket {
  label: string;
  hours: number;
  grams: number;
  /** Fällt „heute“ / „jetzt“ in diesen Abschnitt */
  current: boolean;
}

const DAY = 86_400_000;
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
/** Montag der Woche, 0:00 */
export const startOfWeek = (ms: number) => {
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};

/** Abschnitte je Zeitraum: Woche = Mo–So, Monat = letzte 30 Tage, Jahr = 12 Monate, Gesamt = Wochen seit Projektstart */
export function buckets(range: Range, prints: PrintSpan[], uses: UseEntry[], now = Date.now(), projectStart = now): Bucket[] {
  const edges: { from: number; to: number; label: string }[] = [];
  if (range === 'Woche') {
    const mo = startOfWeek(now);
    for (let i = 0; i < 7; i++) {
      const from = new Date(mo);
      from.setDate(from.getDate() + i);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      edges.push({ from: from.getTime(), to: to.getTime(), label: WD[from.getDay()] });
    }
  } else if (range === 'Monat') {
    const today = startOfDay(now);
    for (let i = 29; i >= 0; i--) {
      const from = new Date(today);
      from.setDate(from.getDate() - i);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      edges.push({ from: from.getTime(), to: to.getTime(), label: `${from.getDate()}.` });
    }
  } else if (range === 'Jahr') {
    const n = new Date(now);
    for (let i = 11; i >= 0; i--) {
      const from = new Date(n.getFullYear(), n.getMonth() - i, 1);
      const to = new Date(n.getFullYear(), n.getMonth() - i + 1, 1);
      edges.push({ from: from.getTime(), to: to.getTime(), label: MON[from.getMonth()] });
    }
  } else {
    const first = Math.min(projectStart, ...prints.map(p => p.startMs), ...uses.map(u => u.ms));
    let w = startOfWeek(Math.min(first, now));
    const end = startOfWeek(now);
    // höchstens 52 Wochen anzeigen, sonst wird es zu eng
    w = Math.max(w, end - 51 * 7 * DAY);
    for (; w <= end; w += 7 * DAY) {
      const d = new Date(w);
      edges.push({ from: w, to: w + 7 * DAY, label: `${d.getDate()}.${d.getMonth() + 1}.` });
    }
  }
  return edges.map(e => {
    let ms = 0;
    for (const p of prints) {
      // nur den Teil des Drucks zählen, der in den Abschnitt fällt
      const a = Math.max(e.from, p.startMs);
      const b = Math.min(e.to, p.endMs);
      if (b > a) ms += b - a;
    }
    const grams = uses.filter(u => u.ms >= e.from && u.ms < e.to).reduce((s, u) => s + u.grams, 0);
    return { label: e.label, hours: ms / 3_600_000, grams, current: now >= e.from && now < e.to };
  });
}

/** Erster Tag des Zeitraums (für die Material-Aufteilung) */
export function rangeStart(range: Range, now = Date.now()): number {
  if (range === 'Woche') return startOfWeek(now);
  if (range === 'Monat') return startOfDay(now) - 29 * DAY;
  if (range === 'Jahr') {
    const n = new Date(now);
    return new Date(n.getFullYear(), n.getMonth() - 11, 1).getTime();
  }
  return 0;
}

export interface Share {
  label: string;
  colorHex: string;
  grams: number;
  pct: number;
}
/** Am meisten verdruckt: Gramm je Material+Farbe, größte zuerst, Rest als „Andere“ */
export function topUses(uses: UseEntry[], since = 0, max = 4): Share[] {
  const m = new Map<string, Share>();
  for (const u of uses) {
    if (u.ms < since || !(u.grams > 0)) continue;
    const s = m.get(u.label) || { label: u.label, colorHex: u.colorHex, grams: 0, pct: 0 };
    s.grams += u.grams;
    m.set(u.label, s);
  }
  const all = Array.from(m.values()).sort((a, b) => b.grams - a.grams);
  const total = all.reduce((t, s) => t + s.grams, 0);
  const top = all.slice(0, max);
  const rest = all.slice(max).reduce((t, s) => t + s.grams, 0);
  if (rest > 0) top.push({ label: 'Andere', colorHex: '#9ca3af', grams: rest, pct: 0 });
  return top.map(s => ({ ...s, pct: total ? (s.grams / total) * 100 : 0 }));
}

/** Weiche Kurve durch die Punkte (Catmull-Rom → Bézier), bleibt im Bereich 0..h */
export function smoothPath(pts: [number, number][], h: number): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const clamp = (y: number) => Math.max(0, Math.min(h, y));
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, clamp(p1[1] + (p2[1] - p0[1]) * t)];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, clamp(p2[1] - (p3[1] - p1[1]) * t)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
