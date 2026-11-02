// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { getCustomize, setCustomize, resetCustomize, setActiveCustomizeStyle, CUSTOM_DEFAULT } from './customize';

describe('Customize je Design (1.169)', () => {
  it('Werte eines Designs wirken nicht auf ein anderes', () => {
    setActiveCustomizeStyle('glass-green');
    setCustomize({ tintOn: true, tintHue: 140, color: 40 });
    expect(getCustomize().tintHue).toBe(140);
    setActiveCustomizeStyle('glass-purple');
    expect(getCustomize()).toEqual(CUSTOM_DEFAULT);
    setCustomize({ accentOn: true, accentHue: 280 });
    setActiveCustomizeStyle('glass-green');
    expect(getCustomize().tintHue).toBe(140);
    expect(getCustomize().accentOn).toBe(false);
  });
  it('Zurücksetzen betrifft nur das aktuelle Design', () => {
    setActiveCustomizeStyle('glass-green');
    resetCustomize();
    expect(getCustomize()).toEqual(CUSTOM_DEFAULT);
    setActiveCustomizeStyle('glass-purple');
    expect(getCustomize().accentHue).toBe(280);
  });
});
