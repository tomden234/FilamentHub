// Statistik-Hilfen (rein, testbar): Drucke je Woche und Kosten je Monat.

export function weekStartMs(t: number): number {
  const x = new Date(t);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Montag
  return x.getTime();
}

/** Drucke je Woche (letzte n Wochen, älteste zuerst): fertig und abgebrochen getrennt */
export function weeklyPrints(prints: { endMs: number; state: string }[], now: number, n = 8): { start: number; done: number; failed: number }[] {
  const wk = weekStartMs(now);
  const out: { start: number; done: number; failed: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(wk);
    d.setDate(d.getDate() - i * 7);
    const start = d.getTime();
    const e = new Date(start);
    e.setDate(e.getDate() + 7);
    const inWeek = prints.filter(p => p.endMs >= start && p.endMs < e.getTime());
    out.push({ start, done: inWeek.filter(p => p.state === 'FINISH').length, failed: inWeek.filter(p => p.state !== 'FINISH').length });
  }
  return out;
}

/** Gramm und Euro je Monat (letzte n Monate, älteste zuerst) aus dem Abzugs-Verlauf */
export function monthlyUse(hist: { grams: number; timestamp: string; spoolId: string }[], priceOf: (spoolId: string) => number, now: number, n = 6): { start: number; grams: number; cost: number }[] {
  const ref = new Date(now);
  const out: { start: number; grams: number; cost: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(ref.getFullYear(), ref.getMonth() - i, 1).getTime();
    const end = new Date(ref.getFullYear(), ref.getMonth() - i + 1, 1).getTime();
    let grams = 0;
    let cost = 0;
    for (const h of hist) {
      const t = Date.parse(h.timestamp);
      if (!(h.grams > 0) || !(t >= start && t < end)) continue;
      grams += h.grams;
      cost += (h.grams / 1000) * priceOf(h.spoolId);
    }
    out.push({ start, grams, cost });
  }
  return out;
}

/** Erfolgsquote in Prozent (null = keine Drucke) */
export function successRate(prints: { state: string }[]): number | null {
  if (!prints.length) return null;
  return Math.round((prints.filter(p => p.state === 'FINISH').length / prints.length) * 100);
}
