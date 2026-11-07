// Supvan/Katasymbol Funk-Protokoll (T50-Familie, dazu gehört der E10).
// Nachgebaut nach dem MIT-lizenzierten Reverse-Engineering-Treiber heeen/supvan-cups.
// LZMA: LZMA-JS (MIT, N. Rugg) mit kleiner 8-KiB-Wörterbuch-Erweiterung, siehe lzma.js.
// Wird erst beim ersten Drucken geladen (ca. 110 KB), damit die App schneller startet.
let lzmaLib: any = null;
async function loadLzma(): Promise<any> {
  if (!lzmaLib) lzmaLib = (await import('./lzma.js')).default;
  return lzmaLib;
}

export const CMD = {
  BUF_FULL: 0x10,
  INQUIRY_STA: 0x11,
  CHECK_DEVICE: 0x12,
  START_PRINT: 0x13,
  STOP_PRINT: 0x14,
  RD_DEV_NAME: 0x16,
  PAPER_SKIP: 0x2e,
  RETURN_MAT: 0x30,
  NEXT_ZIPPEDBULK: 0x5c,
  READ_FWVER: 0xc5
} as const;

const M1 = 0x7e;
const M2 = 0x5a;

function sum(b: Uint8Array, from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += b[i];
  return s & 0xffff;
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** 16-Byte-Befehl */
export function makeCmd(cmd: number, param = 0, param2 = 0): Uint8Array {
  const p = new Uint8Array(16);
  p[0] = M1;
  p[1] = M2;
  p[2] = 0x0c;
  p[4] = 0x10;
  p[5] = 0x01;
  p[6] = 0xaa;
  p[7] = cmd;
  p[11] = 0x01;
  p[12] = param & 0xff;
  p[13] = (param >> 8) & 0xff;
  p[14] = param2 & 0xff;
  p[15] = (param2 >> 8) & 0xff;
  const c = sum(p, 10, 16);
  p[8] = c & 0xff;
  p[9] = (c >> 8) & 0xff;
  return p;
}

const DATA_PAYLOAD = 500;

/** Komprimierte Daten in 512-Byte-Rahmen (je 500 Nutzbytes) */
export function buildDataFrames(data: Uint8Array): Uint8Array[] {
  const count = Math.ceil(data.length / DATA_PAYLOAD);
  const frames: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const f = new Uint8Array(512);
    f[0] = M1;
    f[1] = M2;
    f[2] = 508 & 0xff;
    f[3] = 508 >> 8;
    f[4] = 0x10;
    f[5] = 0x02;
    f[6] = 0xaa;
    f[7] = 0xbb;
    f[10] = i;
    f[11] = count;
    f.set(data.subarray(i * DATA_PAYLOAD, (i + 1) * DATA_PAYLOAD), 12);
    const c = sum(f, 10, 512);
    f[8] = c & 0xff;
    f[9] = (c >> 8) & 0xff;
    frames.push(f);
  }
  return frames;
}

// --- Druckpuffer ---------------------------------------------------------------
const BUF_SIZE = 4096;
const BUF_HEADER = 14;
const MAX_BUF_DATA = 4074;
const MAX_DENSITY = 15;

function buildPrintBuffer(
  image: Uint8Array,
  perLineByte: number,
  cols: number,
  pageStart: boolean,
  pageEnd: boolean,
  density: number
): Uint8Array {
  const buf = new Uint8Array(BUF_SIZE);
  const d = Math.max(0, Math.min(MAX_DENSITY, density));
  buf[2] = (pageStart ? 0x02 : 0) | (pageEnd ? 0x04 | 0x08 : 0);
  buf[3] = (d << 2) | (1 << 6);
  buf[4] = cols & 0xff;
  buf[5] = cols >> 8;
  buf[6] = perLineByte;
  buf[8] = 1;
  buf[10] = 1;
  buf[12] = d;
  buf.set(image.subarray(0, BUF_SIZE - BUF_HEADER), BUF_HEADER);
  const dataEnd = cols * perLineByte + BUF_HEADER;
  let c = sum(buf, 2, 14);
  for (let i = 1; i <= Math.floor(dataEnd / 256); i++) c += buf[i * 256 - 1];
  buf[0] = c & 0xff;
  buf[1] = (c >> 8) & 0xff;
  return buf;
}

/** Spaltenweises Raster in 4-KiB-Puffer aufteilen */
export function splitIntoBuffers(raster: Uint8Array, perLineByte: number, totalCols: number, density: number): Uint8Array[] {
  const maxCols = Math.floor(MAX_BUF_DATA / perLineByte);
  const out: Uint8Array[] = [];
  for (let start = 0; start < totalCols; start += maxCols) {
    const cols = Math.min(maxCols, totalCols - start);
    out.push(
      buildPrintBuffer(
        raster.subarray(start * perLineByte, (start + cols) * perLineByte),
        perLineByte,
        cols,
        start === 0,
        start + cols >= totalCols,
        density
      )
    );
  }
  return out;
}

function compressLzma(data: Uint8Array): Uint8Array {
  if (!lzmaLib) throw new Error("LZMA ist noch nicht geladen (zuerst compressBuffers aufrufen).");
  const out = lzmaLib.compress(data, { s: 13, f: 128, m: 1 }) as number[];
  return Uint8Array.from(out, b => b & 0xff);
}

function calcSpeed(avg: number): number {
  if (avg > 3000) return 10;
  if (avg > 2800) return 15;
  if (avg > 2500) return 20;
  if (avg > 2000) return 25;
  if (avg > 1500) return 40;
  if (avg > 1000) return 45;
  if (avg > 500) return 55;
  return 60;
}

/** Ein Puffer pro Block (der E10 druckt je Block nur den ersten Puffer) */
export async function compressBuffers(buffers: Uint8Array[]): Promise<{ blocks: Uint8Array[]; speed: number }> {
  await loadLzma();
  const blocks = buffers.map(b => compressLzma(b));
  const avg = blocks.reduce((n, b) => n + b.length, 0) / Math.max(1, blocks.length);
  return { blocks, speed: blocks.length > 1 ? 20 : calcSpeed(avg) };
}

// --- Antworten -----------------------------------------------------------------
export interface PrinterStatus {
  bufFull: boolean;
  labelEnd: boolean;
  labelRwError: boolean;
  labelModeError: boolean;
  lowBattery: boolean;
  busy: boolean;
  headTooHot: boolean;
  coverOpen: boolean;
  printing: boolean;
  noLabel: boolean;
}

function hasHeader(d: Uint8Array, minLen: number, cmd: number): boolean {
  return d.length >= minLen && d[0] === M1 && d[1] === M2 && d[7] === cmd;
}

export function parseStatus(d: Uint8Array): PrinterStatus | null {
  if (!hasHeader(d, 20, CMD.INQUIRY_STA)) return null;
  const [b0, b1, b2, b3] = [d[14], d[15], d[16], d[17]];
  return {
    bufFull: (b0 & 0x01) !== 0,
    labelRwError: (b0 & 0x02) !== 0,
    labelEnd: (b0 & 0x04) !== 0,
    labelModeError: (b0 & 0x08) !== 0,
    lowBattery: (b0 & 0x40) !== 0,
    busy: (b1 & 0x04) !== 0,
    headTooHot: (b1 & 0x08) !== 0,
    coverOpen: (b2 & 0x08) !== 0,
    printing: (b2 & 0x40) !== 0,
    noLabel: (b3 & 0x01) !== 0
  };
}

/** Fehlertext auf Deutsch oder null */
export function statusError(s: PrinterStatus): string | null {
  const e = [
    [s.coverOpen, 'Der Deckel ist offen'],
    [s.noLabel, 'Keine Etikettenrolle eingelegt'],
    [s.labelEnd, 'Die Etikettenrolle ist leer'],
    [s.labelRwError, 'Die Etikettenrolle wird nicht erkannt'],
    [s.labelModeError, 'Die Etikettenart passt nicht'],
    [s.headTooHot, 'Der Druckkopf ist zu heiß']
  ] as const;
  const set = e.filter(([on]) => on).map(([, m]) => m);
  return set.length ? set.join(', ') : null;
}

export interface MaterialInfo {
  widthMm: number;
  lengthMm: number;
  gapMm: number;
}

const RESP = 22;

export function parseMaterial(d: Uint8Array): MaterialInfo | null {
  if (!hasHeader(d, RESP + 21, CMD.RETURN_MAT)) return null;
  const p = d.subarray(RESP);
  return { widthMm: p[18], lengthMm: p[19], gapMm: p[20] };
}

export function parseDeviceName(d: Uint8Array): string | null {
  if (!hasHeader(d, RESP + 1, CMD.RD_DEV_NAME)) return null;
  const len = (d[2] | (d[3] << 8)) - 18;
  if (len <= 0) return null;
  const name = String.fromCharCode(...d.subarray(RESP, Math.min(d.length, RESP + len))).replace(/\0+$/, '');
  return name || null;
}

/** Schneidet den Bytestrom (Bluetooth-Meldungen) in 7E-5A-Rahmen */
export class FrameReader {
  private buf: Uint8Array = new Uint8Array(0);

  private magic(): number {
    for (let i = 0; i + 1 < this.buf.length; i++) if (this.buf[i] === M1 && this.buf[i + 1] === M2) return i;
    return -1;
  }

  push(chunk: Uint8Array): Uint8Array[] {
    this.buf = concat([this.buf, chunk]);
    const frames: Uint8Array[] = [];
    for (;;) {
      const start = this.magic();
      if (start < 0) {
        this.buf = this.buf.length && this.buf[this.buf.length - 1] === M1 ? this.buf.slice(-1) : new Uint8Array(0);
        break;
      }
      if (start > 0) this.buf = this.buf.slice(start);
      if (this.buf.length < 4) break;
      const total = (this.buf[2] | (this.buf[3] << 8)) + 4;
      if (total < 8 || total > 1024) {
        this.buf = this.buf.slice(1);
        continue;
      }
      if (this.buf.length < total) break;
      frames.push(this.buf.slice(0, total));
      this.buf = this.buf.slice(total);
    }
    return frames;
  }

  flush(): Uint8Array | null {
    const partial = this.buf.length >= 8 && this.magic() === 0 ? this.buf : null;
    this.buf = new Uint8Array(0);
    return partial;
  }

  get pending(): number {
    return this.buf.length;
  }
}
