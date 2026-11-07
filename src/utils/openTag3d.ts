// OpenTag3D (offener NFC-Standard für Filamentspulen), Spezifikation 2.004, https://opentag3d.info/spec.html
// NDEF-MIME-Typ: application/opentag3d. Der Payload ist eine feste Speicherkarte von 0x00 bis 0xDF (224 Byte).
// Ganzzahlen sind vorzeichenlos und Big Endian, Texte UTF-8, Temperaturen werden als °C / 5 gespeichert.
// Mindestens NTAG215 (504 Byte) nötig, NTAG213 ist seit Version 2.000 nicht mehr zulässig.
import type { MaterialType, Spool } from '../types/filament';

export const OPENTAG3D_MIME = 'application/opentag3d';
const OPENTAG3D_VERSION = 2004; // 2.004, drei implizite Dezimalstellen
const OPENTAG3D_SIZE = 0xe0; // 224 Byte

/** Offsets laut Spezifikation */
const OFF = {
  version: 0x00,
  baseMaterial: 0x02, // 5
  modifier: 0x07, // 5
  manufacturer: 0x0c, // 16
  colorName: 0x1c, // 32
  color1: 0x3c, // RGBA
  color2: 0x40,
  color3: 0x44,
  color4: 0x48,
  serial: 0x4c, // 32
  sku: 0x6c, // 16
  diameter: 0x8c, // µm
  printTemp: 0x90,
  printTempMin: 0x91,
  printTempMax: 0x92,
  chamberTemp: 0x93,
  bedTemp: 0x94,
  bedTempMin: 0x95,
  bedTempMax: 0x96,
  dryTemp: 0x9a,
  dryTime: 0x9b,
  density: 0x9c, // g/cm³ / 0,001
  targetWeight: 0x9e, // g
  emptySpoolWeight: 0xa0, // g
  url: 0xb8 // 32, ASCII ohne https://
} as const;

interface MaterialProfile {
  base: string;
  modifier: string;
  print: [number, number, number]; // Ziel, min, max in °C
  bed: [number, number, number];
  chamber: number;
  density: number; // g/cm³
}

/** Typische Werte je Material, weil die App keine Druckprofile pro Spule speichert */
const PROFILES: Record<MaterialType, MaterialProfile> = {
  'PLA': { base: 'PLA', modifier: '', print: [210, 190, 230], bed: [60, 50, 70], chamber: 0, density: 1.24 },
  'PLA+': { base: 'PLA', modifier: '+', print: [215, 195, 235], bed: [60, 50, 70], chamber: 0, density: 1.24 },
  'PETG': { base: 'PETG', modifier: '', print: [240, 220, 260], bed: [75, 70, 85], chamber: 0, density: 1.27 },
  'TPU': { base: 'TPU', modifier: '', print: [225, 200, 240], bed: [50, 30, 60], chamber: 0, density: 1.21 },
  'ABS': { base: 'ABS', modifier: '', print: [250, 240, 270], bed: [100, 90, 110], chamber: 0, density: 1.04 },
  'ASA': { base: 'ASA', modifier: '', print: [255, 240, 270], bed: [100, 90, 110], chamber: 0, density: 1.07 },
  'PA / Nylon': { base: 'PA', modifier: '', print: [270, 250, 290], bed: [80, 70, 100], chamber: 0, density: 1.14 },
  'PC': { base: 'PC', modifier: '', print: [270, 260, 300], bed: [100, 90, 110], chamber: 0, density: 1.2 },
  'PET-CF / PA-CF': { base: 'PET', modifier: 'CF', print: [280, 260, 300], bed: [80, 70, 100], chamber: 0, density: 1.3 }
};

/** Schneidet einen Text auf höchstens n Byte (UTF-8), ohne ein Zeichen zu zerreißen */
function truncateUtf8(text: string, n: number): Uint8Array {
  const enc = new TextEncoder();
  let out = '';
  for (const ch of text) {
    if (enc.encode(out + ch).length > n) break;
    out += ch;
  }
  return enc.encode(out);
}

function putText(buf: Uint8Array, offset: number, length: number, text: string | undefined) {
  if (!text) return;
  buf.set(truncateUtf8(text, length), offset);
}

function putU16(buf: Uint8Array, offset: number, value: number) {
  const v = Math.max(0, Math.min(0xffff, Math.round(value || 0)));
  buf[offset] = (v >> 8) & 0xff;
  buf[offset + 1] = v & 0xff;
}

function putTemp(buf: Uint8Array, offset: number, celsius: number) {
  buf[offset] = Math.max(0, Math.min(255, Math.round((celsius || 0) / 5)));
}

function hexToRgba(hex: string | undefined): [number, number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return [0x80, 0x80, 0x80, 0xff];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 0xff];
}

/** Baut den 224-Byte-Payload aus einer Spule */
export function encodeOpenTag3d(spool: Spool): Uint8Array {
  const buf = new Uint8Array(OPENTAG3D_SIZE); // Nicht belegte Bytes bleiben 0x00 (= leer)
  const p = PROFILES[spool.material] || PROFILES['PLA'];

  putU16(buf, OFF.version, OPENTAG3D_VERSION);
  putText(buf, OFF.baseMaterial, 5, p.base);
  putText(buf, OFF.modifier, 5, p.modifier);
  putText(buf, OFF.manufacturer, 16, spool.brand);
  putText(buf, OFF.colorName, 32, spool.colorName);
  buf.set(hexToRgba(spool.colorHex), OFF.color1); // Farben 2 bis 4 bleiben transparentes Schwarz
  putText(buf, OFF.serial, 32, spool.id);

  putU16(buf, OFF.diameter, 1750);
  putTemp(buf, OFF.printTemp, p.print[0]);
  putTemp(buf, OFF.printTempMin, p.print[1]);
  putTemp(buf, OFF.printTempMax, p.print[2]);
  putTemp(buf, OFF.chamberTemp, p.chamber);
  putTemp(buf, OFF.bedTemp, p.bed[0]);
  putTemp(buf, OFF.bedTempMin, p.bed[1]);
  putTemp(buf, OFF.bedTempMax, p.bed[2]);
  putTemp(buf, OFF.dryTemp, spool.dryTemp);
  buf[OFF.dryTime] = Math.max(0, Math.min(255, Math.round(spool.dryHours || 0)));

  putU16(buf, OFF.density, p.density * 1000);
  putU16(buf, OFF.targetWeight, spool.initialWeight);
  putU16(buf, OFF.emptySpoolWeight, spool.emptySpoolWeight);

  const url = (spool.productUrl || '').replace(/^https?:\/\//i, '');
  if (url && /^[\x20-\x7e]+$/.test(url) && url.length <= 32) putText(buf, OFF.url, 32, url);

  return buf;
}

interface OpenTag3dData {
  version: number;
  baseMaterial: string;
  modifier: string;
  manufacturer: string;
  colorName: string;
  colorHex: string;
  serial: string;
  diameterUm: number;
  printTemp: number;
  bedTemp: number;
  dryTemp: number;
  dryHours: number;
  density: number;
  targetWeight: number;
  emptySpoolWeight: number;
  material: MaterialType;
}

function getText(buf: Uint8Array, offset: number, length: number): string {
  const slice = buf.slice(offset, offset + length);
  const end = slice.indexOf(0);
  return new TextDecoder().decode(end >= 0 ? slice.slice(0, end) : slice).trim();
}

function getU16(buf: Uint8Array, offset: number): number {
  return ((buf[offset] || 0) << 8) | (buf[offset + 1] || 0);
}

/** Ordnet Basismaterial und Modifier einem Material der App zu */
function materialFromOpenTag(base: string, modifier: string): MaterialType {
  const b = base.toUpperCase();
  const m = modifier.toUpperCase();
  if (b === 'PLA') return m === '+' || m === 'PLUS' || m === 'PRO' ? 'PLA+' : 'PLA';
  if (b === 'PETG') return 'PETG';
  if (b === 'TPU') return 'TPU';
  if (b === 'ABS') return 'ABS';
  if (b === 'ASA') return 'ASA';
  if (b === 'PC') return 'PC';
  if (b === 'PET' || (b === 'PA' && m === 'CF')) return 'PET-CF / PA-CF';
  if (b === 'PA') return 'PA / Nylon';
  return 'PLA';
}

/** Liest einen Payload. Zu kurze Payloads werden mit 0x00 aufgefüllt, wie die Spezifikation es verlangt. */
export function decodeOpenTag3d(bytes: Uint8Array): OpenTag3dData {
  const buf = new Uint8Array(OPENTAG3D_SIZE);
  buf.set(bytes.slice(0, OPENTAG3D_SIZE));
  const rgb = (i: number) => buf[i].toString(16).padStart(2, '0');
  const baseMaterial = getText(buf, OFF.baseMaterial, 5);
  const modifier = getText(buf, OFF.modifier, 5);
  return {
    version: getU16(buf, OFF.version) / 1000,
    baseMaterial,
    modifier,
    manufacturer: getText(buf, OFF.manufacturer, 16),
    colorName: getText(buf, OFF.colorName, 32),
    colorHex: `#${rgb(OFF.color1)}${rgb(OFF.color1 + 1)}${rgb(OFF.color1 + 2)}`,
    serial: getText(buf, OFF.serial, 32),
    diameterUm: getU16(buf, OFF.diameter),
    printTemp: buf[OFF.printTemp] * 5,
    bedTemp: buf[OFF.bedTemp] * 5,
    dryTemp: buf[OFF.dryTemp] * 5,
    dryHours: buf[OFF.dryTime],
    density: getU16(buf, OFF.density) / 1000,
    targetWeight: getU16(buf, OFF.targetWeight),
    emptySpoolWeight: getU16(buf, OFF.emptySpoolWeight),
    material: materialFromOpenTag(baseMaterial, modifier)
  };
}
