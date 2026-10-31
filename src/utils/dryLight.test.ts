import { describe, expect, it } from 'vitest';
import { DRY_LIGHT_HOLD_MS, dryIdleSituation, dryLightShouldTurnOff, type DryLightInput } from './dryLight';

const ok: DryLightInput = { enabled: true, connected: true, dryingNow: true, gcodeState: 'IDLE', lightOn: true, alreadyDone: false, heldMs: DRY_LIGHT_HOLD_MS };
const with_ = (x: Partial<DryLightInput>): DryLightInput => ({ ...ok, ...x });

describe('dryLightShouldTurnOff', () => {
  it('schaltet aus: Trocknung läuft, kein Druck, Licht an, Lage hält', () => {
    expect(dryLightShouldTurnOff(ok)).toBe(true);
    expect(dryLightShouldTurnOff(with_({ gcodeState: 'FINISH' }))).toBe(true);
  });
  it('wartet kurz ab (Datenaussetzer)', () => {
    expect(dryLightShouldTurnOff(with_({ heldMs: DRY_LIGHT_HOLD_MS - 1 }))).toBe(false);
  });
  it('nicht beim Drucken, Vorbereiten oder in der Pause', () => {
    for (const gcodeState of ['RUNNING', 'PREPARE', 'PAUSE']) expect(dryLightShouldTurnOff(with_({ gcodeState }))).toBe(false);
  });
  it('nicht ohne Trocknung, ohne Verbindung, bei ausgeschalteter Einstellung oder wenn das Licht schon aus ist', () => {
    expect(dryLightShouldTurnOff(with_({ dryingNow: false }))).toBe(false);
    expect(dryLightShouldTurnOff(with_({ connected: false }))).toBe(false);
    expect(dryLightShouldTurnOff(with_({ enabled: false }))).toBe(false);
    expect(dryLightShouldTurnOff(with_({ lightOn: false }))).toBe(false);
  });
  it('nur einmal je Trocknung: wer das Licht danach anmacht, behält es', () => {
    expect(dryLightShouldTurnOff(with_({ alreadyDone: true }))).toBe(false);
  });
});

describe('dryIdleSituation', () => {
  it('Trocknung ohne Druck', () => {
    expect(dryIdleSituation(true, true, 'IDLE')).toBe(true);
    expect(dryIdleSituation(true, true, undefined)).toBe(true);
    expect(dryIdleSituation(true, true, 'RUNNING')).toBe(false);
    expect(dryIdleSituation(false, true, 'IDLE')).toBe(false);
    expect(dryIdleSituation(true, false, 'IDLE')).toBe(false);
  });
});
