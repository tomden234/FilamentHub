// Echte Filamentfarbe aus einem Produktbild (Shop): reine Rechnung ohne Netz, getestet.
// Eingabe: kleine RGB-Bildpunkte (z. B. 64×64 von ffmpeg) und die Farbe der Spule aus der App als Hinweis.
// Weißer Hintergrund und Pappspule fallen weg; gewählt wird die größte Farbgruppe, die zum Hinweis passt.

const HEX = /^#?[0-9a-fA-F]{6}$/;
const rgbOf = (h: string): [number, number, number] => [0, 2, 4].map(i => parseInt(h.replace('#', '').slice(i, i + 2), 16)) as [number, number, number];
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Farbton (0-360), Sättigung und Helligkeit (0-1) */
export function hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r / 255) h = ((g - b) / 255 / d) % 6;
    else if (mx === g / 255) h = (b - r) / 255 / d + 2;
    else h = (r - g) / 255 / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

/** Abstand zweier Farben, nach Augenempfinden gewichtet (0 … ~765) */
export function colorDist(a: [number, number, number], b: [number, number, number]): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

const isBackground = (r: number, g: number, b: number) => Math.min(r, g, b) > 228 && Math.max(r, g, b) - Math.min(r, g, b) < 18;
/** Pappspule/Etikett: helles Beige */
const isCardboard = (r: number, g: number, b: number) => {
  const [h, s, v] = hsv(r, g, b);
  return h >= 22 && h <= 48 && s >= 0.12 && s <= 0.55 && v >= 0.5;
};

/**
 * Filamentfarbe aus Bildpunkten (RGB nacheinander). hint = Farbe aus der App. null = nichts Passendes gefunden (dann Hinweis behalten).
 * Genommen werden die Punkte der passenden Farbfamilie (Farbton nah am Hinweis, bei Grau/Schwarz/Weiß wenig Sättigung),
 * davon die beleuchteten (55.–85. Helligkeits-Perzentil): so sieht das Filament im Regal aus, nicht im Schatten.
 */
export function filamentColor(px: Uint8Array | number[], hint: string): string | null {
  if (!HEX.test(hint) || px.length < 3) return null;
  const [hh, hs, hv] = hsv(...rgbOf(hint));
  const grey = hs < 0.18;
  const whiteHint = grey && hv > 0.8;
  const beigeHint = hh >= 15 && hh <= 50 && hs >= 0.2;
  const pts: { v: number; r: number; g: number; b: number }[] = [];
  for (let i = 0; i + 2 < px.length; i += 3) {
    const r = px[i]!;
    const g = px[i + 1]!;
    const b = px[i + 2]!;
    if (!whiteHint && isBackground(r, g, b)) continue;
    if (!beigeHint && isCardboard(r, g, b)) continue;
    const [h, sat, v] = hsv(r, g, b);
    if (grey) {
      if (sat > 0.22) continue;
      if (whiteHint ? v < 0.55 : hv < 0.35 ? v > 0.35 : v < 0.25 || v > 0.9) continue; // weiß: hell, schwarz: dunkel, grau: mittel
    } else {
      const dh = Math.min(Math.abs(h - hh), 360 - Math.abs(h - hh));
      if (dh > 28 || sat < 0.15 || v < 0.12) continue;
    }
    pts.push({ v, r, g, b });
  }
  if (pts.length < 20) return null;
  pts.sort((x, y) => x.v - y.v);
  const lit = pts.slice(Math.floor(pts.length * 0.55), Math.max(Math.floor(pts.length * 0.55) + 1, Math.floor(pts.length * 0.85)));
  const avg = (k: 'r' | 'g' | 'b') => lit.reduce((t, p) => t + p[k], 0) / lit.length;
  const c: [number, number, number] = [avg('r'), avg('g'), avg('b')];
  return colorDist(c, rgbOf(hint)) <= 330 ? hex(...c) : null; // ganz andere Farbe: falsches Bild, App-Farbe behalten
}

/** Erstes Produktbild aus einer Shop-Seite (Open Graph, Amazon-Hauptbild, Shopify) */
export function productImageUrl(html: string): string | null {
  const s = String(html || '');
  const pick = (re: RegExp) => re.exec(s)?.[1]?.replace(/&amp;/g, '&') || null;
  const url =
    pick(/"hiRes"\s*:\s*"(https:[^"]+)"/) ||
    pick(/data-old-hires="(https:[^"]+)"/) ||
    pick(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
    pick(/"landingImageUrl"\s*:\s*"(https:[^"]+)"/);
  if (!url) return null;
  const abs = url.startsWith('//') ? `https:${url}` : url;
  return /^https:\/\//.test(abs) ? abs : null;
}
