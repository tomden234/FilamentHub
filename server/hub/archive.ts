// 1.274: Datei-Archiv auf dem Pi. Jede Druckdatei (.3mf), die in die Warteschlange kommt, wird zusätzlich gespeichert,
// mit Titelbild, Material, Gramm, Zeit und Platten. Ein Nachdruck geht auch, wenn die Datei vom Drucker gelöscht wurde.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from '../paths.js';
import { readJsonWithPrev, saveJsonConfig, writeFileAtomic } from '../jsonConfig.js';
import { platesFromThreeMf, setupFromThreeMf, thumbFromThreeMf } from '../bambuJobFile.js';

export interface ArchivePlate {
  plate: number;
  grams: number;
  sec: number;
  types: string[];
}

export interface ArchiveEntry {
  id: string;
  /** Anzeigename (ohne .gcode.3mf) */
  name: string;
  /** Dateiname beim Senden */
  fileName: string;
  size: number;
  addedAt: number;
  lastUsed: number;
  /** Wie oft aus dem Archiv gedruckt (Nachdruck) */
  printCount: number;
  fav: boolean;
  /** Materialien aller Platten (z. B. „PLA“, „PETG“) */
  materials: string[];
  /** Farben aller Filamente (Hex) */
  colors: string[];
  grams: number;
  sec: number;
  plates: ArchivePlate[];
  bed?: string;
  nozzles?: number[];
  thumb: boolean;
}

/** Grenzen: bei Überschreitung fliegen die ältesten (nicht markierten) Dateien raus */
export const MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_FILES = 400;

const dir = () => path.join(dataDir, 'archive');
const indexFile = () => path.join(dir(), 'index.json');
const filePath = (id: string) => path.join(dir(), `${id}.3mf`);
const thumbFile = (id: string) => path.join(dir(), `${id}.png`);

let cache: ArchiveEntry[] | null = null;

export function loadArchive(): ArchiveEntry[] {
  if (!cache) {
    const v = readJsonWithPrev<ArchiveEntry[]>(indexFile(), d => Array.isArray(d));
    cache = Array.isArray(v) ? v.filter(e => e && typeof e.id === 'string' && /^[0-9a-f]{16}$/.test(e.id)) : [];
  }
  return cache;
}

function saveArchive(): void {
  fs.mkdirSync(dir(), { recursive: true });
  saveJsonConfig(indexFile(), loadArchive(), 'Archiv', { pretty: false, keepPrev: true });
}

/** Anzeigename aus dem Dateinamen. Von uns umbenannte Dateien (fh_…) haben keinen schönen Namen. */
export function displayNameOf(fileName: string): string {
  return path.basename(fileName).replace(/\.gcode\.3mf$|\.3mf$/i, '');
}
export const isOurRename = (fileName: string) => /^fh_[0-9a-f]{12}(\.gcode)?\.3mf$/i.test(path.basename(fileName));

/** Reine Auswertung einer .3mf (testbar, ohne Dateien) */
export function describeThreeMf(bytes: Uint8Array): Pick<ArchiveEntry, 'materials' | 'colors' | 'grams' | 'sec' | 'plates' | 'bed' | 'nozzles'> {
  const plates = platesFromThreeMf(bytes);
  const materials: string[] = [];
  const colors: string[] = [];
  let grams = 0;
  let sec = 0;
  const outPlates: ArchivePlate[] = plates.map(p => {
    const g = p.filaments.reduce((a, f) => a + f.grams, 0);
    const types = Array.from(new Set(p.filaments.map(f => String(f.type || '').toUpperCase()).filter(Boolean)));
    for (const t of types) if (!materials.includes(t)) materials.push(t);
    for (const f of p.filaments) if (f.colorHex && !colors.includes(f.colorHex)) colors.push(f.colorHex);
    grams += g;
    sec += p.predSec || 0;
    return { plate: p.plate, grams: Math.round(g * 10) / 10, sec: p.predSec || 0, types };
  });
  let bed: string | undefined;
  let nozzles: number[] | undefined;
  try {
    const s = setupFromThreeMf(bytes);
    bed = s?.bed || undefined;
    nozzles = s?.nozzles?.length ? s.nozzles : undefined;
  } catch {
    /* ohne Angabe */
  }
  return { materials, colors: colors.slice(0, 8), grams: Math.round(grams * 10) / 10, sec, plates: outPlates, bed, nozzles };
}

/** Datei ins Archiv legen. Gleiche Datei (gleicher Inhalt) wird nicht doppelt gespeichert, nur „zuletzt benutzt“ aktualisiert. */
export async function archiveAdd(bytes: Uint8Array, fileName: string): Promise<ArchiveEntry | null> {
  if (!bytes || bytes.length < 100 || bytes.length > MAX_BYTES / 4) return null;
  const id = crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 16);
  const list = loadArchive();
  const have = list.find(e => e.id === id);
  if (have) {
    have.lastUsed = Date.now();
    // Hatte die Datei bisher nur einen Notnamen (fh_…), den schönen Namen übernehmen
    if (isOurRename(have.fileName) && !isOurRename(fileName)) {
      have.fileName = path.basename(fileName);
      have.name = displayNameOf(fileName);
    }
    saveArchive();
    return have;
  }
  const info = describeThreeMf(bytes);
  if (!info.plates.length) return null; // nicht geslict
  fs.mkdirSync(dir(), { recursive: true });
  writeFileAtomic(filePath(id), Buffer.from(bytes) as any);
  let thumb = false;
  try {
    const t = thumbFromThreeMf(bytes, info.plates[0].plate);
    if (t) {
      writeFileAtomic(thumbFile(id), Buffer.from(t) as any);
      thumb = true;
    }
  } catch {
    /* ohne Bild */
  }
  const now = Date.now();
  const e: ArchiveEntry = { id, name: displayNameOf(fileName), fileName: path.basename(fileName), size: bytes.length, addedAt: now, lastUsed: now, printCount: 0, fav: false, thumb, ...info };
  list.unshift(e);
  evict(list);
  saveArchive();
  return e;
}

/** Zu viele oder zu große Dateien: die am längsten unbenutzten (ohne Stern) löschen */
export function pickEvictions(list: ArchiveEntry[], maxBytes = MAX_BYTES, maxFiles = MAX_FILES): string[] {
  let total = list.reduce((a, e) => a + e.size, 0);
  let count = list.length;
  const out: string[] = [];
  for (const e of [...list].filter(x => !x.fav).sort((a, b) => a.lastUsed - b.lastUsed)) {
    if (total <= maxBytes && count <= maxFiles) break;
    out.push(e.id);
    total -= e.size;
    count--;
  }
  return out;
}

function evict(list: ArchiveEntry[]): void {
  for (const id of pickEvictions(list)) removeFiles(id);
  cache = list.filter(e => fs.existsSync(filePath(e.id)));
}

function removeFiles(id: string): void {
  for (const f of [filePath(id), thumbFile(id)]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* war schon weg */
    }
  }
}

export function archiveRemove(id: string): boolean {
  const list = loadArchive();
  const i = list.findIndex(e => e.id === id);
  if (i < 0) return false;
  list.splice(i, 1);
  removeFiles(id);
  saveArchive();
  return true;
}

export function archiveFav(id: string, fav: boolean): boolean {
  const e = loadArchive().find(x => x.id === id);
  if (!e) return false;
  e.fav = fav;
  saveArchive();
  return true;
}

export function archiveRename(id: string, name: string): boolean {
  const e = loadArchive().find(x => x.id === id);
  const n = String(name || '').replace(/[\r\n\0]/g, ' ').trim().slice(0, 80);
  if (!e || !n) return false;
  e.name = n;
  saveArchive();
  return true;
}

/** Nachdruck hat stattgefunden: Zähler und „zuletzt benutzt“ */
export function archiveUsed(id: string): void {
  const e = loadArchive().find(x => x.id === id);
  if (!e) return;
  e.printCount++;
  e.lastUsed = Date.now();
  saveArchive();
}

export function archiveBytes(id: string): Buffer | null {
  if (!loadArchive().some(e => e.id === id)) return null;
  try {
    return fs.readFileSync(filePath(id));
  } catch {
    return null;
  }
}

export function archiveThumbPath(id: string): string | null {
  const e = loadArchive().find(x => x.id === id);
  return e?.thumb && fs.existsSync(thumbFile(id)) ? thumbFile(id) : null;
}
