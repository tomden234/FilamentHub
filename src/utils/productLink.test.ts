import { describe, expect, it } from 'vitest';
import { cleanSpec, pickProductUrl, specKey } from '../../server/hub/productLink';

describe('Produktseite am Pi', () => {
  it('kürzt Amazon-Treffer auf /dp/ASIN und ignoriert Suchseiten', () => {
    const u = ['https://www.amazon.de/s?k=yxpolyer', 'https://www.amazon.de/Nylon-kohlefaser-Filament/dp/B0DRCR8FZP/ref=sr_1_1?th=1', 'https://example.com/dp/B0DRCR8FZP'];
    expect(pickProductUrl(u, 'yxpolyer')).toBe('https://www.amazon.de/dp/B0DRCR8FZP');
  });
  it('eigene Marke: offizieller Shop zuerst, sonst Amazon', () => {
    const u = ['https://www.amazon.de/dp/B0CAAAAAAA', 'https://eu.store.bambulab.com/de/products/pla-basic-filament?id=1#x', 'https://eu.store.bambulab.com/de/search?q=pla'];
    expect(pickProductUrl(u, 'Bambu Lab')).toBe('https://eu.store.bambulab.com/de/products/pla-basic-filament?id=1');
    expect(pickProductUrl(u, 'Elegoo')).toBe('https://www.amazon.de/dp/B0CAAAAAAA');
  });
  it('nichts Brauchbares gibt null, unsichere Adressen fliegen raus', () => {
    expect(pickProductUrl(['http://www.amazon.de/dp/B0DRCR8FZP', 'javascript:alert(1)', 'kein url'], 'x')).toBeNull();
    expect(pickProductUrl([], 'x')).toBeNull();
  });
  it('Eingaben säubern, gleicher Schlüssel für gleiche Sorte', () => {
    const s = cleanSpec({ brand: 'YXPOLYER <b>', material: 'PA', name: 'x'.repeat(200), colorName: ' Schwarz ' });
    expect(s.brand).not.toContain('<');
    expect(s.name).toHaveLength(80);
    expect(specKey(cleanSpec({ brand: 'Bambu Lab', material: 'PLA', name: 'PLA Basic', colorName: 'Schwarz' }))).toBe(specKey(cleanSpec({ brand: 'bambu  lab', material: 'pla', name: 'PLA-Basic', colorName: 'schwarz' })));
  });
});
