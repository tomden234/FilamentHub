import { describe, it, expect } from 'vitest';
import { SEED_CATALOG } from '../../server/hub/seedCatalog';
import { matchCatalog, cleanSpec } from '../../server/hub/productLink';

const entries = SEED_CATALOG.map(s => ({ ...s, at: 0 }));
describe('Seed-Katalog', () => {
  it('ASINs sind gültig und eindeutig', () => {
    expect(SEED_CATALOG.every(s => /^[A-Z0-9]{10}$/.test(s.asin))).toBe(true);
    expect(new Set(SEED_CATALOG.map(s => s.asin)).size).toBe(SEED_CATALOG.length);
  });
  it('findet Spulen nach Marke und Farbe', () => {
    const m = (brand: string, material: string, colorName: string) => matchCatalog(entries, cleanSpec({ brand, material, name: '', colorName }))?.asin;
    expect(m('Elegoo', 'PLA', 'Marmor')).toBe('B0CM6C7W84');
    expect(m('Overture', 'TPU', 'Schwarz')).toBe('B08X6P6YNC');
    expect(m('eSUN', 'PLA+', 'Kiefergrün')).toBe('B07FQD3VL5');
    expect(m('Jayo', 'PLA', 'Schwarz')).toBe('B097D4T2BQ');
    expect(m('Elegoo', 'PLA', 'Schwarz')).toBeUndefined();
  });
});
