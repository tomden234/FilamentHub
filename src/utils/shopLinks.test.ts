import { beforeEach, describe, expect, it } from 'vitest';
import { findKnownProductUrl, generateAutoShopUrl, registerSpoolLinks, shopQuery } from './shopLinks';
import type { Spool } from '../types/filament';

const sp = (o: Partial<Spool>) => ({ brand: 'Bambu Lab', material: 'PLA', name: 'PLA Basic', colorName: 'Schwarz', ...o }) as Spool;

describe('Produktlink', () => {
  beforeEach(() => registerSpoolLinks([]));
  it('Suchbegriff ohne doppelte Wörter', () => {
    expect(shopQuery('Bambu Lab', 'PLA', 'PLA Basic', 'Schwarz Schwarz')).toBe('Bambu Lab PLA Basic Schwarz');
  });
  it('nimmt gemerkte Produktseite derselben Sorte', () => {
    registerSpoolLinks([sp({ productUrl: 'https://eu.store.bambulab.com/de/products/pla-basic?id=1' })]);
    expect(findKnownProductUrl('bambu lab', 'PLA', 'PLA Basic', 'Schwarz')).toBe('https://eu.store.bambulab.com/de/products/pla-basic?id=1');
    expect(generateAutoShopUrl('Bambu Lab', 'PLA', 'PLA Basic', 'Schwarz')).toContain('products/pla-basic');
  });
  it('andere Farbe oder Material trifft nicht', () => {
    registerSpoolLinks([sp({ productUrl: 'https://shop.example/a' })]);
    expect(findKnownProductUrl('Bambu Lab', 'PETG', 'PETG HF', 'Rot')).toBeNull();
  });
  it('ohne Treffer: Shop-Suche mit genauem Begriff, kein Raten', () => {
    expect(generateAutoShopUrl('Bambu Lab', 'PLA', 'PLA Basic', 'Rot')).toContain('eu.store.bambulab.com/de/search?q=');
    expect(generateAutoShopUrl('Elegoo', 'PETG', 'Rapid', 'Blau')).toContain('amazon.de/s?k=Elegoo');
  });
  it('unsichere Adresse wird ignoriert', () => {
    registerSpoolLinks([sp({ productUrl: 'javascript:alert(1)' })]);
    expect(findKnownProductUrl('Bambu Lab', 'PLA', 'PLA Basic', 'Schwarz')).toBeNull();
  });
});
