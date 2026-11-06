// Gleicher Druck? Rein (ohne Netz), gilt in App UND auf dem Pi.
// Ein Drucker druckt immer nur eins. Darum ist es derselbe Druck, wenn
//  1. Name gleich und Ende nah beieinander, oder
//  2. eine Quelle kennt den Namen nicht („Druckauftrag“, z. B. Home-Assistant-Verlauf) und das Ende ist nah (5 min), oder
//  3. die Laufzeiten überlappen sich zum größten Teil (Datei umbenannt, anderer Name in anderer Quelle).

export const printNameKey = (n: string) =>
  String(n || '')
    .toLowerCase()
    .replace(/\.(gcode\.3mf|3mf|gcode)$/g, '')
    .trim();

/** Name ohne Wissen („Druckauftrag“, leer) */
export const isGenericPrintName = (n: string): boolean => /^(druckauftrag|druck|print|job|)$/.test(printNameKey(n));

export interface PrintTimes {
  name: string;
  endMs: number;
  startMs?: number;
}

export function samePrint(a: PrintTimes, b: PrintTimes, windowMs = 45 * 60_000): boolean {
  const ae = Number(a.endMs);
  const be = Number(b.endMs);
  const endGap = Math.abs(ae - be);
  if (printNameKey(a.name) === printNameKey(b.name)) return endGap < windowMs;
  if ((isGenericPrintName(a.name) || isGenericPrintName(b.name)) && endGap < Math.min(windowMs, 5 * 60_000)) return true;
  const as = Number(a.startMs) || 0;
  const bs = Number(b.startMs) || 0;
  if (as > 0 && bs > 0 && ae > as && be > bs && endGap < Math.min(windowMs, 10 * 60_000)) {
    const overlap = Math.min(ae, be) - Math.max(as, bs);
    const shorter = Math.min(ae - as, be - bs);
    return overlap > 0.8 * shorter;
  }
  return false;
}

/** Den besseren Namen behalten (echter Name statt „Druckauftrag“) */
export const betterPrintName = (a: string, b: string): string => (isGenericPrintName(a) && !isGenericPrintName(b) ? b : a);
