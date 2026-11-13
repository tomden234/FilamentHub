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

/** Darstellung der Spulen (matt, vom Nutzer gewählt): gain = Helligkeit der Farbe, base = Grundanteil, gloss = Glanz */
const look = { gain: 1.0, base: 0.3, gloss: 0.7 };

/** Filter und Spulen-Schichten für ein Bild; p = Kennung, damit mehrere Bilder in einem SVG stehen können */
function layers(colors: (string | null)[], p: string): { defs: string; body: string } {
  const defs: string[] = [];
  const body: string[] = [];
  COLS.forEach(([x0, x1], i) => {
    defs.push(`<clipPath id="${p}c${i}"><rect x="${x0}" y="14" width="${x1 - x0}" height="90"/></clipPath>`);
    const c = colors[i] ? spoolColor(colors[i]) : null;
    if (c) {
      const [r, g, b] = rgb(c);
      const lift = r + g + b < 0.4 ? 0.08 : 0; // schwarze Spulen nicht ganz absaufen lassen
      const k = look.gain;
      const o = (v: number) => f3(v * look.base + lift);
      defs.push(`<filter id="${p}t${i}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${f3(r * k)} 0 0 0 ${o(r)} 0 ${f3(g * k)} 0 0 ${o(g)} 0 0 ${f3(b * k)} 0 ${o(b)} 0 0 0 1 0"/></filter>`);
    }
    body.push(`<g clip-path="url(#${p}c${i})"><use href="#sh" filter="url(#${c ? `${p}t${i}` : 'e'})"/>${c ? '<use href="#sh" filter="url(#hl)"/>' : ''}</g>`);
  });
  return { defs: defs.join(''), body: body.join('') };
}

const BASE_DEFS =
  // Glanz: helle Stellen der Schattierung als weißer Schimmer; e = leerer Platz (hellgrau, kein Filament)
  `<filter id="hl" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 ${f3(look.gloss)} 0 0 1 ${f3(-1.35 - look.gloss * 0.57)}"/></filter>` +
  '<filter id="e" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .62 0 0 0 0 .66 0 0 0 0 .68 0 0 0 .78 0"/></filter>' +
  `<image id="sh" x="40" y="14" width="320" height="90" href="data:image/webp;base64,${SHADE_WEBP_BASE64}"/>` +
  `<image id="ph" width="397" height="700" href="data:image/webp;base64,${FRONT_WEBP_BASE64}"/>`;

/** SVG mit Foto und umgefärbten Spulen. colors: 4 Einträge, null = leerer Platz (hellgrau, kein Filament) */
export function amsSvg(colors: (string | null)[]): string {
  const l = layers(colors, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="397" height="700" viewBox="0 0 397 700"><defs>${BASE_DEFS}${l.defs}</defs><use href="#ph"/>${l.body}</svg>`;
}

const xml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Testbild: jede Spule aus der App einmal im AMS (alle vier Plätze in ihrer Farbe), mit Name und Farbwert */
export function amsTestSheet(spools: { label: string; color: string }[]): string {
  const cols = 3;
  const tw = 360;
  const th = 150;
  const list = spools.filter(s => spoolColor(s.color));
  const w = cols * tw + 20;
  const h = Math.max(1, Math.ceil(list.length / cols)) * th + 60;
  const defs: string[] = [];
  const tiles = list.map((s, i) => {
    const x = 10 + (i % cols) * tw;
    const y = 50 + Math.floor(i / cols) * th;
    const c = spoolColor(s.color)!;
    const l = layers([c, c, c, c], `s${i}`);
    defs.push(l.defs);
    return (
      `<rect x="${x}" y="${y}" width="${tw - 10}" height="${th - 10}" rx="12" fill="#ffffff" fill-opacity=".13" stroke="#ffffff" stroke-opacity=".25"/>` +
      `<svg x="${x + 5}" y="${y + 5}" width="${tw - 20}" height="100" viewBox="36 8 328 100" preserveAspectRatio="xMidYMid slice"><use href="#ph"/>${l.body}</svg>` +
      `<circle cx="${x + 16}" cy="${y + 122}" r="7" fill="${c}" stroke="#fff"/>` +
      `<text x="${x + 30}" y="${y + 127}" fill="#fff" font-size="14" font-weight="600">${xml(s.label.slice(0, 38))}</text>` +
      `<text x="${x + tw - 18}" y="${y + 127}" fill="#fff" fill-opacity=".75" font-size="12" text-anchor="end">${c}</text>`
    );
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Roboto,Arial,sans-serif">` +
    `<defs>${BASE_DEFS}${defs.join('')}<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c2a28f"/><stop offset=".5" stop-color="#8fa8a6"/><stop offset="1" stop-color="#5e8590"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#bg)"/><text x="14" y="32" fill="#fff" font-size="20" font-weight="700">Testbild: ${list.length} Spulen aus der App im AMS</text>${tiles.join('')}</svg>`
  );
}
