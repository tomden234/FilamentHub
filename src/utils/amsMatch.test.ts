import { describe, it, expect } from 'vitest';
import { activeSlotFromPrinter } from './amsMatch';

describe('activeSlotFromPrinter', () => {
  it('X2D: fh_active 5 = externe Spule', () => {
    expect(activeSlotFromPrinter({ tray_now: '255', fh_active: 5 })).toBe(5);
  });
  it('X2D: fh_active 3 = Slot 3', () => {
    expect(activeSlotFromPrinter({ fh_active: 3 })).toBe(3);
  });
  it('X2D: fh_active 0 = nichts aktiv', () => {
    expect(activeSlotFromPrinter({ tray_now: '0', fh_active: 0 })).toBeNull();
  });
  it('ohne Düsen-Daten gilt tray_now wie bisher', () => {
    expect(activeSlotFromPrinter({ tray_now: '254' })).toBe(5);
    expect(activeSlotFromPrinter({ tray_now: '2' })).toBe(3);
    expect(activeSlotFromPrinter({ tray_now: '255' })).toBeNull();
  });
});
