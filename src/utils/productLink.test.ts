import { describe, expect, it } from 'vitest';
import { amazonQuery, bestShopUrl, cleanSpec, hasRealLink, isSearchUrl, parseAmazonResults, pickAmazonHit, pickProductUrl, specKey } from '../../server/hub/productLink';
import { getSpoolLink, isSearchUrl as clientIsSearch, parseFilamentText, shopQuery } from './shopLinks';
import type { Spool } from '../types/filament';

const prusa = ['prusament-pla-filament', 'prusament-pla-filament-nfc', 'prusament-pla-high-speed', 'refill-prusament-pla', 'prusament-petg-filament', 'prusament-pla-filament-samples', 'prusament-pc-blend-carbon-fiber-filament'].map(s => `https://www.prusa3d.com/de/produkt/${s}/`);
const bambu = ['pla-basic-filament', 'pla-basic-gradient', 'pla-matte', 'pla-glow', 'petg-hf', 'pet-cf', 'pa6-cf', 'tpu-95a-hf', 'bambu-textured-pei-plate'].map(s => `https://us.store.bambulab.com/products/${s}`);
const sp = (o: Partial<{ brand: string; material: string; name: string; colorName: string; refill: boolean }>) => ({ brand: 'Bambu Lab', material: 'PLA', name: 'PLA Basic', colorName: 'Schwarz', ...o });

describe('Produktseite aus der Shop-Liste', () => {
  it('Prusament: Materialseite mit 1-kg-Auswahl, Refill, keine Proben', () => {
    expect(bestShopUrl(prusa, sp({ brand: 'Prusament', name: 'PLA Galaxy Black' }))).toBe('https://www.prusa3d.com/de/produkt/prusament-pla-filament/');
    expect(bestShopUrl(prusa, sp({ brand: 'Prusament', name: 'PLA Galaxy Black', refill: true }))).toBe('https://www.prusa3d.com/de/produkt/refill-prusament-pla/');
    expect(bestShopUrl(prusa, sp({ brand: 'Prusament', material: 'PETG', name: 'PETG Prusa Orange', colorName: 'Orange' }))).toContain('prusament-petg-filament');
  });
  it('Bambu: richtige Linie, Name schlägt Material', () => {
    expect(bestShopUrl(bambu, sp({}))).toContain('/pla-basic-filament');
    expect(bestShopUrl(bambu, sp({ name: 'PLA' }))).toContain('/pla-basic-filament');
    expect(bestShopUrl(bambu, sp({ name: 'PLA Matte Charcoal' }))).toContain('/pla-matte');
    expect(bestShopUrl(bambu, sp({ name: 'PLA Glow', colorName: 'Glow Blau' }))).toContain('/pla-glow');
    expect(bestShopUrl(bambu, sp({ material: 'PET-CF / PA-CF', name: 'PA6-CF' }))).toContain('/pa6-cf');
    expect(bestShopUrl(bambu, sp({ material: 'PETG', name: 'PETG HF Blau', colorName: 'Blau' }))).toContain('/petg-hf');
  });
  it('nichts Passendes gibt null', () => {
    expect(bestShopUrl(bambu, sp({ material: 'ASA', name: 'ASA Aero' }))).toBeNull();
    expect(bestShopUrl([], sp({}))).toBeNull();
  });
});

const amazonHtml = `
<div data-asin="" class="s-result-item">Kopf</div>
<div role="listitem" data-asin="B0SPONSOR1" data-component-type="s-search-result" class="s-result-item AdHolder"><img class="s-image" alt="GEEETECH PLA Filament Schwarz"><h2 aria-label="Gesponsert: GEEETECH PLA"><span>GEEETECH PLA Filament 1,75 mm Schwarz</span></h2></div>
<div role="listitem" data-asin="B0ERYGLOWB" data-component-type="s-search-result" class="s-result-item"><h2 class="a-size-base-plus"><a href="/dp/B0ERYGLOWB"><span>ERYONE Glow in the Dark PLA Filament 1,75 mm, Leuchtend Blau, 1 kg</span></a></h2></div>
<div role="listitem" data-asin="B0ERYGLOWG" data-component-type="s-search-result" class="s-result-item"><h2><span>ERYONE Glow in the Dark PLA Filament 1,75 mm Grün &amp; 1 kg</span></h2></div>`;

describe('Amazon-Treffer', () => {
  it('liest ASIN, Titel und Werbung', () => {
    const h = parseAmazonResults(amazonHtml);
    expect(h.map(x => x.asin)).toEqual(['B0SPONSOR1', 'B0ERYGLOWB', 'B0ERYGLOWG']);
    expect(h[0].sponsored).toBe(true);
    expect(h[1].title).toContain('Leuchtend Blau');
    expect(h[2].title).toContain('Grün & 1 kg');
  });
  it('ohne Gemini: Marke muss passen, Farbe entscheidet', () => {
    const h = parseAmazonResults(amazonHtml);
    expect(pickAmazonHit(h, sp({ brand: 'Eryone', name: 'PLA Glow in the Dark Blau', colorName: 'Blau' }))?.asin).toBe('B0ERYGLOWB');
    expect(pickAmazonHit(h, sp({ brand: 'Elegoo', name: 'PLA Rapid' }))).toBeNull();
  });
  it('Suchbegriff ohne kaputtes Material', () => {
    expect(amazonQuery(sp({ brand: 'YXPOLYER', material: 'PET-CF / PA-CF', name: 'PA6-CF Schwarz', colorName: 'Schwarz' }))).toBe('YXPOLYER PA6-CF Schwarz Filament');
    expect(shopQuery('YXPOLYER', 'PET-CF / PA-CF', 'PA6-CF Schwarz', 'Schwarz')).toBe('YXPOLYER PA6-CF Schwarz');
  });
});

describe('Suchseiten sind keine Produktseiten', () => {
  const search = ['https://www.amazon.de/s?k=yxpolyer', 'https://www.prusa3d.com/de/search/?q=prusament', 'https://www.sunlu.com/search?q=pla', 'https://eu.store.bambulab.com/de/search?q=pla'];
  const real = ['https://www.amazon.de/dp/B0DRCR8FZP', 'https://www.prusa3d.com/de/produkt/prusament-pla-filament/', 'https://eu.store.bambulab.com/de/products/pla-basic-filament?id=1'];
  it('Server und App erkennen gleich', () => {
    for (const u of search) {
      expect(isSearchUrl(u)).toBe(true);
      expect(clientIsSearch(u)).toBe(true);
      expect(hasRealLink(u)).toBe(false);
    }
    for (const u of real) {
      expect(isSearchUrl(u)).toBe(false);
      expect(clientIsSearch(u)).toBe(false);
      expect(hasRealLink(u)).toBe(true);
    }
  });
  it('Spule mit gespeicherter Suche fragt den Pi (auto), echte Seite nicht', () => {
    const base = { brand: 'Prusament', material: 'PLA', name: 'PLA Galaxy Black', colorName: 'Schwarz' } as Spool;
    expect(getSpoolLink({ ...base, productUrl: 'https://www.prusa3d.com/de/search/?q=x' }).auto).toBe(true);
    expect(getSpoolLink({ ...base, productUrl: 'https://www.prusa3d.com/de/produkt/prusament-pla-filament/' }).auto).toBe(false);
  });
  it('Text-Erkennung speichert keine Suchadresse mehr', () => {
    expect(parseFilamentText('Bambu Lab PLA Basic Schwarz').productUrl).toBeUndefined();
    expect(parseFilamentText('https://www.amazon.de/dp/B0DRCR8FZP').productUrl).toBe('https://www.amazon.de/dp/B0DRCR8FZP');
  });
});

describe('Such-Treffer von Google', () => {
  it('Amazon auf /dp/ASIN gekürzt, eigener Shop nur zur Marke', () => {
    expect(pickProductUrl(['https://www.amazon.de/s?k=x', 'https://www.amazon.de/Nylon/dp/B0DRCR8FZP/ref=sr_1_1'], 'yxpolyer')).toBe('https://www.amazon.de/dp/B0DRCR8FZP');
    const u = ['https://www.amazon.de/dp/B0CAAAAAAA', 'https://eu.store.bambulab.com/de/products/pla-basic-filament?id=1#x'];
    expect(pickProductUrl(u, 'Bambu Lab')).toBe('https://eu.store.bambulab.com/de/products/pla-basic-filament');
    expect(pickProductUrl(u, 'Elegoo')).toBe('https://www.amazon.de/dp/B0CAAAAAAA');
    expect(pickProductUrl(['http://www.amazon.de/dp/B0DRCR8FZP', 'javascript:alert(1)'], 'x')).toBeNull();
  });
  it('Eingaben säubern, gleicher Schlüssel für gleiche Sorte', () => {
    const s = cleanSpec({ brand: 'YXPOLYER <b>', material: 'PA', name: 'x'.repeat(200), colorName: ' Schwarz ' });
    expect(s.brand).not.toContain('<');
    expect(s.name).toHaveLength(80);
    expect(specKey(cleanSpec({ brand: 'Bambu Lab', material: 'PLA', name: 'PLA Basic', colorName: 'Schwarz' }))).toBe(specKey(cleanSpec({ brand: 'bambu  lab', material: 'pla', name: 'PLA-Basic', colorName: 'schwarz' })));
  });
});
