import { describe, expect, it } from 'vitest';
import { monthlyUse, successRate, weeklyPrints } from './printStats';

const now = new Date(2026, 10, 5, 12, 0).getTime(); // Do 05.11.2026

describe('Statistik', () => {
  it('Drucke je Woche, fertig und abgebrochen getrennt', () => {
    const w = weeklyPrints(
      [
        { endMs: new Date(2026, 10, 3).getTime(), state: 'FINISH' },
        { endMs: new Date(2026, 10, 4).getTime(), state: 'FAILED' },
        { endMs: new Date(2026, 9, 28).getTime(), state: 'FINISH' }
      ],
      now
    );
    expect(w).toHaveLength(8);
    expect(w[7]).toMatchObject({ done: 1, failed: 1 });
    expect(w[6]).toMatchObject({ done: 1, failed: 0 });
    expect(new Date(w[7].start).getDay()).toBe(1); // Montag
  });
  it('Kosten je Monat', () => {
    const m = monthlyUse(
      [
        { grams: 100, timestamp: new Date(2026, 10, 2).toISOString(), spoolId: 'a' },
        { grams: 500, timestamp: new Date(2026, 9, 15).toISOString(), spoolId: 'b' },
        { grams: -50, timestamp: new Date(2026, 10, 2).toISOString(), spoolId: 'a' }
      ],
      id => (id === 'a' ? 20 : 10),
      now
    );
    expect(m).toHaveLength(6);
    expect(m[5]).toMatchObject({ grams: 100, cost: 2 });
    expect(m[4]).toMatchObject({ grams: 500, cost: 5 });
  });
  it('Erfolgsquote', () => {
    expect(successRate([])).toBeNull();
    expect(successRate([{ state: 'FINISH' }, { state: 'FAILED' }, { state: 'FINISH' }, { state: 'FINISH' }])).toBe(75);
  });
});
