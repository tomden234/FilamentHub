import { describe, it, expect } from 'vitest';
import { weekDelta } from './weekDelta';

const NOW = Date.parse('2026-11-08T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();

describe('weekDelta', () => {
  it('trennt diese Woche und Vorwoche', () => {
    const r = weekDelta(
      [
        { grams: 40, timestamp: daysAgo(1) },
        { grams: 10, timestamp: daysAgo(6.9) },
        { grams: 30, timestamp: daysAgo(8) },
        { grams: 99, timestamp: daysAgo(20) }
      ],
      NOW
    );
    expect(r).toEqual({ week: 50, prev: 30, diff: 20 });
  });

  it('ignoriert kaputte Zeiten, Zukunft und Null-Gramm', () => {
    const r = weekDelta(
      [
        { grams: 5, timestamp: 'kaputt' },
        { grams: 5, timestamp: daysAgo(-1) },
        { grams: 0, timestamp: daysAgo(1) },
        { grams: -3, timestamp: daysAgo(1) }
      ],
      NOW
    );
    expect(r).toEqual({ week: 0, prev: 0, diff: 0 });
  });

  it('leere Liste ergibt 0', () => {
    expect(weekDelta([], NOW).diff).toBe(0);
  });
});
