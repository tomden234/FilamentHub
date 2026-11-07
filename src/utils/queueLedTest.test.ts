import { describe, it, expect } from 'vitest';
import { ledTestSteps, LED_LEGEND } from './queueLedTest';

describe('LED-Test der Warteschlange', () => {
  it('Ablauf: Stapel wächst, dann orange, grün, rot, zurück auf normal', () => {
    const s = ledTestSteps(3);
    expect(s[0]).toMatchObject({ count: 0, mode: 0 });
    expect(s.filter(x => x.mode === 0 && x.count > 0 && x.count <= 3).map(x => x.count).slice(0, 3)).toEqual([1, 2, 3]);
    const modes = s.map(x => x.mode);
    expect(modes.indexOf(3)).toBeLessThan(modes.indexOf(2));
    expect(modes.indexOf(2)).toBeLessThan(modes.indexOf(1));
    expect(s[s.length - 1].mode).toBe(0);
  });
  it('Zahl der LEDs bleibt zwischen 1 und 10', () => {
    expect(Math.max(...ledTestSteps(99).map(x => x.count))).toBe(10);
    expect(Math.max(...ledTestSteps(0).map(x => x.count))).toBe(1);
  });
  it('Legende hat die fünf echten Farben', () => {
    expect(LED_LEGEND.map(l => l.color)).toEqual(['rgb(0,90,255)', 'rgb(150,210,255)', 'rgb(255,70,0)', 'rgb(0,255,0)', 'rgb(255,0,0)']);
  });
});
