import { describe, expect, it } from 'vitest';
import { samePrint, betterPrintName } from './printMatch';
import { mergePrintSources } from './haPrintHistory';
import { planParts } from '../../server/hub/deductPlan';

const T = Date.parse('2026-11-06T02:29:00Z');

describe('Doppelte Drucke (1.225)', () => {
  it('„Druckauftrag“ aus HA und echter Name vom Pi = derselbe Druck', () => {
    const pi = { name: 'Air_Up_Fake_Pod(2)', startMs: T - 61 * 60_000, endMs: T };
    const ha = { name: 'Druckauftrag', startMs: T - 62 * 60_000, endMs: T + 20_000 };
    expect(samePrint(pi, ha, 10 * 60_000)).toBe(true);
    expect(betterPrintName('Druckauftrag', pi.name)).toBe(pi.name);
  });

  it('zwei echte Drucke hintereinander bleiben getrennt', () => {
    const a = { name: 'Air_Up_Fake_Pod(2)', startMs: T - 61 * 60_000, endMs: T };
    const b = { name: 'Druckauftrag', startMs: T - 150 * 60_000, endMs: T - 135 * 60_000 };
    expect(samePrint(a, b, 10 * 60_000)).toBe(false);
  });

  it('Quellen zusammenführen: nur ein Eintrag mit echtem Namen', () => {
    const merged = mergePrintSources([
      [{ name: 'Air_Up_Fake_Pod(2)', startMs: T - 61 * 60_000, endMs: T, state: 'FINISH', percent: 100, slots: { '1': 3600 } }],
      [{ name: 'Druckauftrag', startMs: T - 62 * 60_000, endMs: T + 30_000, state: 'FINISH', percent: 100, slots: {} }]
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Air_Up_Fake_Pod(2)');
  });
});

describe('Mehrfarbdruck (1.225)', () => {
  it('zwei Farben gleiches Material = zwei Spulen', () => {
    const parts = planParts({
      filaments: [
        { type: 'PLA', colorHex: '#FFFFFF', grams: 30 },
        { type: 'PLA', colorHex: '#EEEEEE', grams: 5 }
      ],
      trays: [
        { slot: 1, type: 'PLA', colorHex: '#FFFFFF' },
        { slot: 2, type: 'PLA', colorHex: '#000000' }
      ],
      usedSlots: [1],
      mainSlot: 1,
      amsSlots: { '1': 'weiss', '2': 'schwarz' },
      spools: [
        { id: 'weiss', material: 'PLA', colorHex: '#FFFFFF', remainingWeight: 500 },
        { id: 'schwarz', material: 'PLA', colorHex: '#000000', remainingWeight: 500 }
      ],
      knownGrams: 0
    });
    expect(parts).toEqual(expect.arrayContaining([{ spoolId: 'weiss', grams: 30 }, { spoolId: 'schwarz', grams: 5 }]));
  });
});
