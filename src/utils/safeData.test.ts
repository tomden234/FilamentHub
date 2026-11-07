import { describe, it, expect } from 'vitest';
import { safeHttpUrl, isTrustedCloudUrl, sanitizeSpool, sanitizeSpoolList, MAX_SPOOLS } from './safeData';
import { getSpoolLink } from './shopLinks';
import { spoolIdFromHash } from './spoolLink';
import { normalizeSpools } from './spoolState';
import { mergeById } from './syncMerge';
import type { Spool } from '../types/filament';

const base = { id: 'a', brand: 'X', name: 'N', material: 'PLA', colorName: 'rot', colorHex: '#ff0000', pricePerKg: 20, initialWeight: 1000, remainingWeight: 500, emptySpoolWeight: 200, lastDried: '', dryIntervalDays: 30, dryTemp: 50, dryHours: 4 } as unknown as Spool;

describe('Schutz vor fremden Daten (1.233)', () => {
  it('lässt nur http(s)-Links durch', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,<script>')).toBeNull();
    expect(safeHttpUrl('https://www.amazon.de/dp/1')).toBe('https://www.amazon.de/dp/1');
    expect(safeHttpUrl(42)).toBeNull();
  });
  it('Shop-Link fällt bei javascript: auf die Suche zurück', () => {
    const l = getSpoolLink({ ...base, productUrl: 'javascript:alert(1)' });
    expect(l.url.startsWith('https://')).toBe(true);
    expect(l.auto).toBe(true);
  });
  it('erlaubt nur bekannte Cloud-Adressen', () => {
    expect(isTrustedCloudUrl('https://evil.example/doc')).toBe(false);
    expect(isTrustedCloudUrl('https://api.npoint.io/abc123')).toBe(false); // npoint ist seit 1.234 abgeschaltet
    expect(isTrustedCloudUrl('pi:')).toBe(true);
    expect(isTrustedCloudUrl('https://api.npoint.io/abc/../../x')).toBe(false);
    expect(isTrustedCloudUrl('gist:abc123XYZ')).toBe(true);
  });
  it('säubert kaputte Spulen', () => {
    expect(sanitizeSpool({ ...base, id: undefined })).toBeNull();
    const s = sanitizeSpool({ ...base, name: { a: 1 }, remainingWeight: { a: 1 }, colorHex: 'url(x)', productUrl: 'javascript:1' }) as Spool;
    expect(s.name).toBe('');
    expect(s.remainingWeight).toBe(0);
    expect(s.colorHex).toBe('#888888');
    expect(s.productUrl).toBeUndefined();
  });
  it('gibt unveränderte Spulen als dasselbe Objekt zurück', () => {
    expect(sanitizeSpool(base)).toBe(base);
  });
  it('begrenzt die Anzahl', () => {
    const big = Array.from({ length: MAX_SPOOLS + 50 }, (_, i) => ({ ...base, id: 'i' + i }));
    expect(sanitizeSpoolList(big).length).toBe(MAX_SPOOLS);
    expect(normalizeSpools('x' as unknown as Spool[])).toEqual([]);
  });
  it('kaputte Spulen-Links werfen nicht', () => {
    expect(spoolIdFromHash('#s=%')).toBeNull();
    expect(spoolIdFromHash('#s=abc')).toBe('abc');
  });
  it('__proto__ aus fremdem Doc ändert den Prototyp nicht', () => {
    const remote = JSON.parse('{"id":"a","name":"R","__proto__":{"productUrl":"javascript:1"}}');
    const local = { id: 'a', name: 'L' };
    const baseRec = { id: 'a', name: 'B' };
    const out = mergeById([baseRec], [local], [remote]);
    expect((Object.getPrototypeOf(out[0]) as Record<string, unknown>).productUrl).toBeUndefined();
    expect((out[0] as Record<string, unknown>).productUrl).toBeUndefined();
  });
});
