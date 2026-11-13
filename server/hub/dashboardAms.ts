// Druckerbild fürs Dashboard: Foto von vorn, die vier AMS-Spulen und ihr Schimmer im Gehäuse in den echten Farben (SVG-Filter, ohne Bildbibliothek);
// leere Plätze zeigen eine Spalte aus einem Foto des leeren AMS.
// Das Foto steckt im SVG selbst, weil Home Assistant das Bild als <img> lädt (dort lädt ein SVG keine anderen Dateien nach).
import { EMPTY_COLS, FRONT_WEBP_BASE64, LOW_WEBP_BASE64, SHADE_WEBP_BASE64 } from './dashboardPhoto.js';
import { FONT_FILES } from './dashboardFonts.js';

/** Spalten der vier Spulen im Foto (x von/bis, Bildpunkte) */
const COLS: [number, number][] = [
  [40, 114],
  [114, 198],
  [198, 284],
  [284, 360]
];
/** Mitte der Spulen in % der Bildbreite (für die Beschriftung im Dashboard) */
export const SPOOL_X = [18.2, 39.1, 60.5, 82.1];

/** Spulen-Schild am AMS (Mitte y, Größe in Bildpunkten): Pille mit Rand in Spulenfarbe, Material groß, Restgewicht darunter (alles im Bild) */
export const SPOOL_TAG = { y: 150, w: 58, h: 34 };
export interface SpoolLabel {
  mat: string;
  rest: string;
}
const dark = (c: string) => {
  const [r, g, b] = rgb(c);
  return 0.3 * r + 0.59 * g + 0.11 * b < 0.2;
};
const tagsSvg = (colors: (string | null)[], labels: (SpoolLabel | null)[]) =>
  colors
    .map((c, i) => {
      const col = c ? spoolColor(c) : null;
      if (!col) return '';
      const x = (SPOOL_X[i]! / 100) * 397;
      const l = labels[i];
      const y = SPOOL_TAG.y;
      return (
        `<rect x="${f3(x - SPOOL_TAG.w / 2)}" y="${y - SPOOL_TAG.h / 2}" width="${SPOOL_TAG.w}" height="${SPOOL_TAG.h}" rx="14" fill="#0a0e12" fill-opacity=".86" stroke="${dark(col) ? '#9aa0a6' : col}" stroke-width="2"/>` +
        (l ? `<text x="${f3(x)}" y="${y - 1}" class="m">${xml(l.mat.slice(0, 8))}</text><text x="${f3(x)}" y="${y + 11}" class="r">${xml(l.rest.slice(0, 9))}</text>` : '')
      );
    })
    .join('');

/** Bild der Temperatur-Karten (fest, ändert sich nie): Düse 1, Düse 2 nebeneinander, Bett darunter */
export const TEMPS = { w: 397, h: 204 };
export const TEMP_TILES = [
  { x: 8, y: 6, w: 186, h: 104 },
  { x: 203, y: 6, w: 186, h: 104 },
  { x: 8, y: 118, w: 381, h: 78 }
];
export const tempsSvg = (): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TEMPS.w}" height="${TEMPS.h}" viewBox="0 0 ${TEMPS.w} ${TEMPS.h}">` +
  '<filter id="tsd" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-opacity=".4"/></filter>' +
  TEMP_TILES.map(t => `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="16" fill="#181a1e" fill-opacity=".93" stroke="#5ff0cf" stroke-opacity=".35" filter="url(#tsd)"/>`).join('') +
  '</svg>';

const HEX = /^#?[0-9a-fA-F]{6}$/;
const rgb = (h: string) => [0, 2, 4].map(i => parseInt(h.replace('#', '').slice(i, i + 2), 16) / 255) as [number, number, number];
const f3 = (n: number) => String(Math.round(n * 1000) / 1000);

/** Farbe aus dem Drucker (#RRGGBB oder RRGGBBAA) prüfen; ungültig/leer = null (Platz leer) */
export function spoolColor(v: unknown): string | null {
  const s = String(v || '').trim().slice(0, 7);
  const h = s.startsWith('#') ? s : `#${s.slice(0, 6)}`;
  return HEX.test(h) ? h.toUpperCase() : null;
}

/** Darstellung der Spulen (matt, vom Nutzer gewählt): gain = Helligkeit der Farbe, base = Grundanteil, gloss = Glanz, low = Stärke des Schimmers unten */
const look = { gain: 1.0, base: 0.3, gloss: 0.7, low: 0.55 };

/** Filter und Spulen-Schichten für ein Bild; p = Kennung, damit mehrere Bilder in einem SVG stehen können */
function layers(colors: (string | null)[], p: string): { defs: string; body: string } {
  const defs: string[] = [];
  const body: string[] = [];
  COLS.forEach(([x0, x1], i) => {
    const c = colors[i] ? spoolColor(colors[i]) : null;
    if (!c) {
      body.push(`<use href="#e${i}"/>`);
      return;
    }
    const [r, g, b] = rgb(c);
    const lift = r + g + b < 0.4 ? 0.08 : 0; // schwarze Spulen nicht ganz absaufen lassen
    const m = (a: number) => `${f3(r * look.gain)} 0 0 0 ${f3(r * look.base + lift)} 0 ${f3(g * look.gain)} 0 0 ${f3(g * look.base + lift)} 0 0 ${f3(b * look.gain)} 0 ${f3(b * look.base + lift)} 0 0 0 ${a} 0`;
    defs.push(`<clipPath id="${p}c${i}"><rect x="${x0}" y="14" width="${x1 - x0}" height="90"/></clipPath>`);
    defs.push(`<filter id="${p}t${i}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${m(1)}"/></filter>`);
    defs.push(`<filter id="${p}u${i}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${m(look.low)}"/></filter>`);
    const mid = Math.round((EMPTY_COLS[i]!.x0 + EMPTY_COLS[i]!.x1) / 2);
    body.push(`<g clip-path="url(#${p}c${i})"><use href="#sh" filter="url(#${p}t${i})"/><use href="#sh" filter="url(#hl)"/></g><use href="#lo" x="${mid - 42}" filter="url(#${p}u${i})"/>`);
  });
  return { defs: defs.join(''), body: body.join('') };
}

const BASE_DEFS =
  // Glanz: helle Stellen der Schattierung als weißer Schimmer
  `<filter id="hl" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 ${f3(look.gloss)} 0 0 1 ${f3(-1.35 - look.gloss * 0.57)}"/></filter>` +
  `<image id="sh" x="40" y="14" width="320" height="90" href="data:image/webp;base64,${SHADE_WEBP_BASE64}"/>` +
  `<image id="lo" y="104" width="84" height="82" href="data:image/webp;base64,${LOW_WEBP_BASE64}"/>` +
  EMPTY_COLS.map((e, i) => `<image id="e${i}" x="${e.x0}" width="${e.x1 - e.x0}" height="216" href="data:image/webp;base64,${e.b64}"/>`).join('') +
  `<image id="ph" width="397" height="700" href="data:image/webp;base64,${FRONT_WEBP_BASE64}"/>`;

/** Schrift Outfit (fett) im Bild selbst: ein als Bild geladenes SVG darf keine anderen Dateien nachladen */
const FONT_STYLE = `<style>@font-face{font-family:O;font-weight:700;src:url(data:font/woff2;base64,${FONT_FILES[1]!.b64}) format('woff2')}text{font-family:O,'Segoe UI',Roboto,sans-serif;text-anchor:middle;font-weight:700}.m{font-size:13px;fill:#fff}.r{font-size:9.5px;fill:#cfd8dc}</style>`;

/** SVG mit Foto, umgefärbten Spulen und Spulen-Schildern. colors: 4 Einträge, null = leerer Platz (Spalte aus dem Foto des leeren AMS) */
export function amsSvg(colors: (string | null)[], labels: (SpoolLabel | null)[] = []): string {
  const l = layers(colors, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="397" height="700" viewBox="0 0 397 700"><defs>${BASE_DEFS}${l.defs}${labels.some(Boolean) ? FONT_STYLE : ''}</defs><use href="#ph"/>${l.body}${tagsSvg(colors, labels)}</svg>`;
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
