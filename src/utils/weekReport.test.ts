import { describe, expect, it } from 'vitest';
import { weekRangeLabel, weekStartBack, weeklyReport } from '../../server/hub/hubLogic';

// Mittwoch 11.11.2026 12:00 Ortszeit
const NOW = new Date(2026, 10, 11, 12, 0, 0).getTime();
const at = (d: number, h = 10) => new Date(2026, 10, d, h, 0, 0).getTime();
const base = { now: NOW, spools: [], energy: undefined, kwhPrice: 0.3, lowWeightG: 0 };
const prints = [
  { name: 'a', endMs: at(10), state: 'FINISH' }, // diese Woche
  { name: 'b', endMs: at(4), state: 'FINISH' }, // letzte Woche
  { name: 'c', endMs: at(5), state: 'FAILED' } // letzte Woche
];

describe('Wochenbericht mit früheren Wochen', () => {
  it('Montage stimmen', () => {
    expect(new Date(weekStartBack(NOW, 0)).getDate()).toBe(9);
    expect(new Date(weekStartBack(NOW, 1)).getDate()).toBe(2);
    expect(weekRangeLabel(weekStartBack(NOW, 1))).toBe('02.–08.11.');
  });
  it('Monatswechsel im Label', () => {
    expect(weekRangeLabel(new Date(2026, 9, 26).getTime())).toBe('26.10.–01.11.');
  });
  it('diese Woche zählt nur ihre Drucke', () => {
    const r = weeklyReport({ ...base, prints, history: [] });
    expect(r.text).toContain('1 Drucke');
    expect(r.title).toBe('📊 Deine 3D-Druck-Woche');
  });
  it('letzte Woche zählt volle Woche und hat eigenen Titel', () => {
    const r = weeklyReport({ ...base, prints, history: [], offset: 1 });
    expect(r.text).toContain('2 Drucke (1 fertig, 1 abgebrochen)');
    expect(r.title).toBe('📊 3D-Druck-Woche 02.–08.11.');
  });
  it('Verbrauch nur aus der gewählten Woche', () => {
    const history = [
      { grams: 100, timestamp: new Date(at(10)).toISOString(), spoolId: 's' },
      { grams: 40, timestamp: new Date(at(4)).toISOString(), spoolId: 's' }
    ];
    expect(weeklyReport({ ...base, prints: [], history, offset: 1 }).text).toContain('40 g');
    expect(weeklyReport({ ...base, prints: [], history }).text).toContain('100 g');
  });
  it('„Fast leer“ nur in der aktuellen Woche', () => {
    const spools = [{ id: 's', brand: 'X', name: 'Y', remainingWeight: 20 }];
    expect(weeklyReport({ ...base, spools, lowWeightG: 50, prints: [], history: [] }).text).toContain('Fast leer');
    expect(weeklyReport({ ...base, spools, lowWeightG: 50, prints: [], history: [], offset: 1 }).text).not.toContain('Fast leer');
  });
});
