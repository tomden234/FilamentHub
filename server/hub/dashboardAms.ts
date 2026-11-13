// Druckerbild fürs Dashboard: Foto von vorn, die vier AMS-Spulen in den echten Farben (SVG-Filter auf der Schattierung, ohne Bildbibliothek).
// Das Foto steckt im SVG selbst, weil Home Assistant das Bild als <img> lädt (dort lädt ein SVG keine anderen Dateien nach).
import { FRONT_WEBP_BASE64, SHADE_WEBP_BASE64 } from './dashboardPhoto.js';

/** Spalten der vier Spulen im Foto (x von/bis, Bildpunkte) */
const COLS: [number, number][] = [
  [40, 114],
  [114, 198],
  [198, 284],
  [284, 360]
];
/** Mitte der Spulen in % der Bildbreite (für die Beschriftung im Dashboard) */
export const SPOOL_X = [18.2, 39.1, 60.5, 82.1];

const HEX = /^#?[0-9a-fA-F]{6}$/;
const rgb = (h: string) => [0, 2, 4].map(i => parseInt(h.replace('#', '').slice(i, i + 2), 16) / 255) as [number, number, number];
const f3 = (n: number) => String(Math.round(n * 1000) / 1000);

/** Farbe aus dem Drucker (#RRGGBB oder RRGGBBAA) prüfen; ungültig/leer = null (Platz leer) */
export function spoolColor(v: unknown): string | null {
  const s = String(v || '').trim().slice(0, 7);
  const h = s.startsWith('#') ? s : `#${s.slice(0, 6)}`;
  return HEX.test(h) ? h.toUpperCase() : null;
}

/** SVG mit Foto und umgefärbten Spulen. colors: 4 Einträge, null = leerer Platz (dunkel) */
export function amsSvg(colors: (string | null)[]): string {
  const defs: string[] = [
    // Glanz: helle Stellen der Schattierung als weißer Schimmer
    '<filter id="hl" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.4 0 0 1 -2.15"/></filter>',
    '<filter id="e" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .13 0 0 0 0 .14 0 0 0 0 .15 0 0 0 .95 0"/></filter>'
  ];
  const body: string[] = [];
  const shade = `<use href="#sh"`;
  COLS.forEach(([x0, x1], i) => {
    defs.push(`<clipPath id="c${i}"><rect x="${x0}" y="14" width="${x1 - x0}" height="90"/></clipPath>`);
    const c = colors[i] ? spoolColor(colors[i]) : null;
    if (c) {
      const [r, g, b] = rgb(c);
      const lift = r + g + b < 0.4 ? 0.1 : 0; // schwarze Spulen nicht ganz absaufen lassen
      defs.push(`<filter id="t${i}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${f3(r * 1.1)} 0 0 0 ${lift} 0 ${f3(g * 1.1)} 0 0 ${lift} 0 0 ${f3(b * 1.1)} 0 ${lift} 0 0 0 1 0"/></filter>`);
    }
    body.push(`<g clip-path="url(#c${i})">${shade} filter="url(#${c ? `t${i}` : 'e'})"/>${c ? `${shade} filter="url(#hl)"/>` : ''}</g>`);
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="397" height="700" viewBox="0 0 397 700">` +
    `<defs>${defs.join('')}<image id="sh" x="40" y="14" width="320" height="90" href="data:image/webp;base64,${SHADE_WEBP_BASE64}"/></defs>` +
    `<image width="397" height="700" href="data:image/webp;base64,${FRONT_WEBP_BASE64}"/>${body.join('')}</svg>`
  );
}
