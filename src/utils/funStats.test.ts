import { describe, expect, it } from 'vitest';
import { buckets, smoothPath, startOfWeek, topUses } from './funStats';

const now = new Date(2026, 10, 7, 12, 0).getTime(); // Sa 07.11.2026
const h = 3_600_000;

describe('Fun Facts selbst gezählt', () => {
  it('Woche: Mo–So, Druck über Mitternacht wird geteilt', () => {
    const fr = new Date(2026, 10, 6, 22, 0).getTime();
    const b = buckets('Woche', [{ startMs: fr, endMs: fr + 4 * h }], [], now);
    expect(b.map(x => x.label)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    expect(b[4].hours).toBeCloseTo(2);
    expect(b[5].hours).toBeCloseTo(2);
    expect(b[5].current).toBe(true);
  });
  it('Jahr hat 12 Monate, Gewicht landet im richtigen Monat', () => {
    const b = buckets('Jahr', [], [{ ms: now, grams: 50, label: 'PLA Weiß', colorHex: '#fff' }], now);
    expect(b).toHaveLength(12);
    expect(b[11].grams).toBe(50);
  });
  it('Am meisten verdruckt: sortiert, Rest als Andere', () => {
    const u = (label: string, grams: number) => ({ ms: now, grams, label, colorHex: '#000' });
    const t = topUses([u('A', 10), u('B', 50), u('C', 5), u('B', 20)], 0, 2);
    expect(t.map(x => x.label)).toEqual(['B', 'A', 'Andere']);
    expect(Math.round(t[0].pct)).toBe(82);
  });
  it('Wochenstart ist Montag', () => {
    expect(new Date(startOfWeek(now)).getDay()).toBe(1);
  });
  it('Kurve bleibt im Bild', () => {
    const d = smoothPath([[0, 0], [10, 50], [20, 0]], 50);
    expect(d.startsWith('M0,0')).toBe(true);
    expect(d).not.toMatch(/-\d/);
  });
});
