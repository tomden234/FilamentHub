import { describe, expect, it } from 'vitest';
import { dedupePrintLog, samePrint, type PrintRecord } from './printLog';

const rec = (p: Partial<PrintRecord>): PrintRecord => ({
  id: 'x',
  name: 'ESP32-WROOM_Case',
  startMs: 0,
  endMs: 1_000_000,
  state: 'FINISH',
  missed: false,
  percent: 100,
  durationMin: 0,
  spools: [],
  grams: 0,
  cost: 0,
  hasPhoto: false,
  ...p
});

describe('Druckliste: doppelte Einträge', () => {
  it('gleicher Druck zweimal erkannt → ein Eintrag, der mit mehr Infos bleibt', () => {
    const a = rec({ id: 'a', endMs: 1_000_000 });
    const b = rec({ id: 'b', endMs: 1_000_000 + 60_000, durationMin: 49 });
    const out = dedupePrintLog([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].durationMin).toBe(49);
  });
  it('gleicher Name, anderer Tag → zwei Drucke', () => {
    const out = dedupePrintLog([rec({ id: 'a' }), rec({ id: 'b', endMs: 1_000_000 + 24 * 3600_000 })]);
    expect(out).toHaveLength(2);
  });
  it('Name mit Endung zählt gleich', () => {
    expect(samePrint({ name: 'Case.gcode.3mf', endMs: 0 }, { name: 'case', endMs: 5 * 60_000 })).toBe(true);
  });
});
