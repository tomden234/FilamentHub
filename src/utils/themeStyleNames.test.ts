import { describe, it, expect } from 'vitest';
import { normalizeThemeStyle, VISIBLE_STYLES } from './themeStyleNames';

describe('normalizeThemeStyle', () => {
  it('behält sichtbare Designs', () => {
    for (const s of VISIBLE_STYLES) expect(normalizeThemeStyle(s)).toBe(s);
  });
  it('stellt dunkle ausgemusterte Designs auf Nacht', () => {
    for (const s of ['cozy', 'mocha', 'glass', 'glass-green', 'glass-purple']) expect(normalizeThemeStyle(s)).toBe('night');
  });
  it('stellt helle ausgemusterte und leere Werte auf Sand', () => {
    expect(normalizeThemeStyle('glass-cream')).toBe('sand');
    expect(normalizeThemeStyle(null)).toBe('sand');
    expect(normalizeThemeStyle('quatsch')).toBe('sand');
  });
});
