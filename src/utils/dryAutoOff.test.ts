import { describe, expect, it } from 'vitest';
import { DRY_OFF_SETTLE_MS, dryOffAction, type DryOffInput } from './dryAutoOff';

const T0 = 1_000_000_000_000;
const base: DryOffInput = { armedAt: T0, now: T0, lastDryingAt: 0, dryingNow: false, gcodeState: 'IDLE', switchState: 'on' };
const at = (extra: Partial<DryOffInput>): DryOffInput => ({ ...base, ...extra });

describe('dryOffAction', () => {
  it('wartet, solange getrocknet wird', () => {
    expect(dryOffAction(at({ now: T0 + 60_000, dryingNow: true, lastDryingAt: T0 + 60_000 }))).toBe('wait');
  });
  it('wartet, solange die Trocknung noch nicht gestartet wurde (auch tagelang)', () => {
    expect(dryOffAction(at({ now: T0 + 5 * 60_000 }))).toBe('wait');
    expect(dryOffAction(at({ now: T0 + 5 * 24 * 3600_000 }))).toBe('wait');
  });
  it('schaltet erst 3 Minuten nach dem Ende der Trocknung aus', () => {
    const end = T0 + 6 * 3600_000;
    expect(dryOffAction(at({ now: end + 60_000, lastDryingAt: end }))).toBe('wait');
    expect(dryOffAction(at({ now: end + DRY_OFF_SETTLE_MS, lastDryingAt: end }))).toBe('switch-off');
  });
  it('schaltet auch nach FINISH oder FAILED aus, nicht nur bei IDLE', () => {
    const end = T0 + 3600_000;
    for (const gcodeState of ['IDLE', 'FINISH', 'FAILED', undefined]) {
      expect(dryOffAction(at({ now: end + DRY_OFF_SETTLE_MS, lastDryingAt: end, gcodeState }))).toBe('switch-off');
    }
  });
  it('startet nach der Trocknung ein Druck, bleibt der Drucker an', () => {
    const end = T0 + 3600_000;
    for (const gcodeState of ['PREPARE', 'RUNNING', 'PAUSE']) {
      expect(dryOffAction(at({ now: end + 60_000, lastDryingAt: end, gcodeState }))).toBe('cancel-print');
    }
  });
  it('läuft ein Druck neben der Trocknung, wird nie ausgeschaltet', () => {
    expect(dryOffAction(at({ now: T0 + 3600_000, lastDryingAt: T0 + 3600_000, dryingNow: true, gcodeState: 'RUNNING' }))).toBe('wait');
  });
  it('Steckdose schon aus (von Hand): erledigt', () => {
    const end = T0 + 3600_000;
    expect(dryOffAction(at({ now: end + 10_000, lastDryingAt: end, switchState: 'off' }))).toBe('cancel-socket-off');
  });
  it('ist die Steckdose vor der Trocknung aus, passiert nichts', () => {
    expect(dryOffAction(at({ now: T0 + 60_000, switchState: 'off' }))).toBe('wait');
  });
});
