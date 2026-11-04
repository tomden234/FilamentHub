import { describe, expect, it, beforeEach } from 'vitest';
import { alreadyDeducted, recordDeduct, slotFromTask, DEDUCT_LOG_KEY } from './printUsage';
import { safeStorage } from './safeStorage';

describe('Abzug nur einmal je Druck', () => {
  beforeEach(() => safeStorage.removeItem(DEDUCT_LOG_KEY));
  it('gleicher Name und Ende innerhalb 45 min = schon abgezogen', () => {
    const t = Date.now();
    recordDeduct('Halter_v2.gcode.3mf', t, 'lan');
    expect(alreadyDeducted('Halter_v2', t + 20 * 60_000)).toBe(true);
    expect(alreadyDeducted('halter_v2.3mf', t - 10 * 60_000)).toBe(true);
  });
  it('anderer Name oder viel später = neuer Druck', () => {
    const t = Date.now();
    recordDeduct('Halter', t, 'cloud');
    expect(alreadyDeducted('Deckel', t)).toBe(false);
    expect(alreadyDeducted('Halter', t + 3 * 3600_000)).toBe(false);
  });
});

describe('Slot aus Bambu-Auftrag', () => {
  it('erstes AMS 0-3 → Slot 1-4, extern → 5, zweites AMS → keiner', () => {
    expect(slotFromTask(0)).toBe(1);
    expect(slotFromTask(3)).toBe(4);
    expect(slotFromTask(254 * 4)).toBe(5);
    expect(slotFromTask(255 * 4 + 0)).toBe(5);
    expect(slotFromTask(4)).toBe(null);
    expect(slotFromTask(undefined)).toBe(null);
  });
});
