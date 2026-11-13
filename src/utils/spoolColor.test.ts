import { describe, expect, it } from 'vitest';
import { colorDist, filamentColor, productImageUrl } from '../../server/hub/spoolColorLogic';

/** Kunstbild: weißer Hintergrund, Pappspule, Filament in Schatten und Licht */
function image(fil: [number, number, number], n = 600): number[] {
  const px: number[] = [];
  for (let i = 0; i < n; i++) px.push(250, 250, 250); // Hintergrund
  for (let i = 0; i < n / 2; i++) px.push(205, 175, 135); // Pappe
  for (let i = 0; i < n; i++) {
    const f = 0.45 + (i / n) * 0.75; // dunkel bis hell
    px.push(...(fil.map(v => Math.min(255, v * f)) as [number, number, number]));
  }
  return px;
}
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

describe('Echte Spulenfarbe aus dem Shop-Bild', () => {
  it('findet das Filament, nicht Hintergrund oder Pappe', () => {
    const got = filamentColor(image([30, 95, 70]), '#166534')!;
    expect(got).toMatch(/^#[0-9A-F]{6}$/);
    expect(colorDist(rgb(got), [30, 95, 70])).toBeLessThan(60);
  });

  it('Weiß und Schwarz', () => {
    const w = filamentColor(image([240, 240, 236]), '#F8FAFC')!;
    expect(rgb(w)[0]).toBeGreaterThan(200);
    const px: number[] = [];
    for (let i = 0; i < 400; i++) px.push(250, 250, 250);
    for (let i = 0; i < 400; i++) px.push(20 + (i % 30), 20 + (i % 30), 22 + (i % 30));
    const b = filamentColor(px, '#18181B')!;
    expect(rgb(b)[0]).toBeLessThan(70);
  });

  it('ganz andere Farbe oder zu wenig = App-Farbe behalten (null)', () => {
    expect(filamentColor(image([30, 95, 70]), '#EF4444')).toBeNull();
    expect(filamentColor(image([30, 95, 70]), 'kaputt')).toBeNull();
    expect(filamentColor([1, 2, 3], '#166534')).toBeNull();
  });

  it('Produktbild aus der Shop-Seite', () => {
    expect(productImageUrl('<script>"hiRes":"https://m.media-amazon.com/images/I/abc.jpg"</script>')).toBe('https://m.media-amazon.com/images/I/abc.jpg');
    expect(productImageUrl('<meta property="og:image" content="//cdn.shopify.com/x.png?v=1&amp;w=800">')).toBe('https://cdn.shopify.com/x.png?v=1&w=800');
    expect(productImageUrl('<meta content="https://a.de/b.jpg" property="og:image">')).toBe('https://a.de/b.jpg');
    expect(productImageUrl('<meta property="og:image" content="http://unsicher.de/b.jpg">')).toBeNull();
    expect(productImageUrl('nichts')).toBeNull();
  });
});
