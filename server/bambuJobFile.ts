// Gewicht je Filament aus der Druckdatei holen, die der Drucker selbst gespeichert hat (nur LAN-Modus).
// Bambu Studio schickt die Datei (<Name>.gcode.3mf) per FTPS (Port 990, Benutzer bblp, Passwort = Zugangscode) an den Drucker.
// Darin steht Metadata/slice_info.config mit used_g je Filament. So braucht es keine Cloud und keine Handeingabe.
import { Client } from 'basic-ftp';
import { Readable, Writable } from 'stream';
import { unzipSync, strFromU8 } from 'fflate';

/** Höchstgröße einer Druckdatei beim Herunterladen vom Drucker (Schutz vor Speichererschöpfung) */
const MAX_DOWNLOAD = 300 * 1024 * 1024;

export interface JobFilament {
  id: number;
  type: string;
  colorHex: string;
  grams: number;
}

interface JobWeights {
  fileName: string;
  plate: number;
  filaments: JobFilament[];
  totalGrams: number;
}

const DIRS = ['/', '/cache', '/sdcard', '/sdcard/cache'];
const SKIP_DIRS = /^(timelapse|ipcam|logs?|recorder|image|firmware|model|system|\.)/i;
let lastDirs = '';
let dirCache: { at: number; dirs: string[] } | null = null;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.gcode\.3mf$|\.3mf$|\.gcode$/g, '')
    .trim();

/** slice_info.config lesen (ohne XML-Bibliothek: nur die Filament- und Plate-Zeilen) */
function parseSliceInfo(xml: string, plate = 1): { plate: number; filaments: JobFilament[]; predSec?: number } {
  const plates = xml.match(/<plate>[\s\S]*?<\/plate>/g) || [];
  const idxOf = (blk: string) => Number((blk.match(/key="index"\s+value="(\d+)"/) || [])[1]) || 0;
  const blk = plates.find(b => idxOf(b) === plate) || plates[0] || xml;
  const filaments: JobFilament[] = [];
  const re = /<filament\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blk))) {
    const attrs = m[1];
    const get = (k: string) => (attrs.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1] || '';
    const grams = parseFloat(get('used_g'));
    if (!(grams > 0)) continue;
    filaments.push({
      id: Number(get('id')) || filaments.length + 1,
      type: get('type'),
      colorHex: ('#' + get('color').replace('#', '').slice(0, 6)).toUpperCase(),
      grams: Math.round(grams * 100) / 100
    });
  }
  const pred = Number((blk.match(/key="prediction"\s+value="(\d+(?:\.\d+)?)"/) || [])[1]);
  return { plate: idxOf(blk) || plate, filaments, predSec: pred > 0 ? Math.round(pred) : undefined };
}

/** 1.272: Alle Platten einer .3mf mit Filament (für „alle Platten einreihen“), nach Plattennummer sortiert */
export function platesFromThreeMf(data: Uint8Array): { plate: number; filaments: JobFilament[]; predSec?: number }[] {
  const files = unzipSync(data, { filter: f => f.name.toLowerCase().endsWith('slice_info.config') && f.originalSize <= 4_000_000 });
  const key = Object.keys(files).find(k => k.toLowerCase().endsWith('slice_info.config'));
  if (!key) return [];
  const xml = strFromU8(files[key]);
  const idxs = (xml.match(/<plate>[\s\S]*?<\/plate>/g) || []).map(b => Number((b.match(/key="index"\s+value="(\d+)"/) || [])[1]) || 0).filter(n => n > 0);
  const out: { plate: number; filaments: JobFilament[]; predSec?: number }[] = [];
  for (const i of Array.from(new Set(idxs)).sort((a, b) => a - b)) {
    const r = parseSliceInfo(xml, i);
    if (r.plate === i && r.filaments.length) out.push(r);
  }
  return out;
}

/** Titelbild der Platte (Metadata/plate_N.png) aus einer .3mf */
export function thumbFromThreeMf(data: Uint8Array, plate = 1): Uint8Array | null {
  const want = `metadata/plate_${Math.max(1, plate)}.png`;
  const files = unzipSync(data, { filter: f => (f.name.toLowerCase() === want || f.name.toLowerCase() === 'metadata/plate_1.png') && f.originalSize <= 8_000_000 }); // 1.233: Zip-Bomben-Schutz
  const key = Object.keys(files).find(k => k.toLowerCase() === want) || Object.keys(files).find(k => k.toLowerCase() === 'metadata/plate_1.png');
  return key ? files[key] : null;
}

/** 1.270: Was die Datei braucht: Druckplatte und Düse(n) */
export interface JobSetup {
  /** Kurzer deutscher Name der Druckplatte (leer = unbekannt) */
  bed: string;
  /** Düsendurchmesser in mm, je Extruder (leer = unbekannt) */
  nozzles: number[];
  /** 1.273: Düsentemperatur je Filament der Datei (Reihenfolge = Filament-Nummer, leer = unbekannt) */
  temps: number[];
}

const BEDS: [RegExp, string][] = [
  [/textured pei/i, 'Texturierte PEI'],
  [/smooth pei|cool plate \(supertack\)|supertack/i, 'Glatte PEI'],
  [/engineering/i, 'Engineering'],
  [/high temp/i, 'Hochtemperatur'],
  [/cool plate/i, 'Cool Plate']
];
export const bedLabel = (raw: string): string => {
  const t = String(raw || '').trim();
  if (!t) return '';
  return BEDS.find(([re]) => re.test(t))?.[1] || t.slice(0, 40);
};

/** project_settings.config (JSON) lesen: curr_bed_type und nozzle_diameter. Fehlt etwas, bleibt es leer. */
export function parseSetup(json: string): JobSetup {
  try {
    const j = JSON.parse(json);
    const raw = j?.curr_bed_type ?? j?.bed_type ?? '';
    const nd = Array.isArray(j?.nozzle_diameter) ? j.nozzle_diameter : j?.nozzle_diameter != null ? [j.nozzle_diameter] : [];
    const nozzles = nd.map((x: unknown) => Math.round(parseFloat(String(x)) * 100) / 100).filter((x: number) => x > 0 && x < 3);
    const tr = Array.isArray(j?.nozzle_temperature) ? j.nozzle_temperature : [];
    const temps = tr.map((x: unknown) => Math.round(parseFloat(String(x)))).map((x: number) => (x >= 150 && x <= 400 ? x : 0));
    return { bed: bedLabel(String(raw)), nozzles, temps: temps.some((x: number) => x > 0) ? temps : [] };
  } catch {
    return { bed: '', nozzles: [], temps: [] };
  }
}

/** Aus den Bytes einer .3mf Platte und Düse lesen (null = steht nicht drin) */
export function setupFromThreeMf(data: Uint8Array): JobSetup | null {
  const files = unzipSync(data, { filter: f => f.name.toLowerCase().endsWith('project_settings.config') && f.originalSize <= 4_000_000 });
  const key = Object.keys(files).find(k => k.toLowerCase().endsWith('project_settings.config'));
  if (!key) return null;
  const r = parseSetup(strFromU8(files[key]));
  return r.bed || r.nozzles.length || r.temps.length ? r : null;
}

/** Aus den Bytes einer .3mf das Gewicht lesen */
export function weightsFromThreeMf(data: Uint8Array, plate = 1): { plate: number; filaments: JobFilament[]; predSec?: number } | null {
  const files = unzipSync(data, { filter: f => f.name.toLowerCase().endsWith('slice_info.config') && f.originalSize <= 4_000_000 }); // 1.233
  const key = Object.keys(files).find(k => k.toLowerCase().endsWith('slice_info.config'));
  if (!key) return null;
  const r = parseSliceInfo(strFromU8(files[key]), plate);
  return r.filaments.length ? r : null;
}

export async function fetchJobWeights(opts: { ip: string; code: string; jobName: string; plate?: number; newestBefore?: number }): Promise<JobWeights | { error: string }> {
  const want = norm(opts.jobName);
  // 1.227: ohne Namen (Drucker meldet keinen) die neueste Druckdatei nehmen, die vor dem Druckstart da war
  const newest = !want && Number(opts.newestBefore) > 0;
  if (!want && !newest) return { error: 'Kein Auftragsname.' };
  try {
    return await withFtp(opts.ip, opts.code, async client => {

    let best: { path: string; name: string; time: number } | null = null;
    for (const dir of DIRS) {
      let list;
      try {
        list = await client.list(dir);
      } catch {
        continue;
      }
      for (const f of list) {
        if (!f.isFile || !/\.3mf$/i.test(f.name)) continue;
        const time = f.modifiedAt ? f.modifiedAt.getTime() : 0;
        if (newest ? time > Number(opts.newestBefore) + 10 * 60_000 : norm(f.name) !== want) continue;
        if (!best || time >= best.time) best = { path: (dir === '/' ? '' : dir) + '/' + f.name, name: f.name, time };
      }
    }
    if (!best) return { error: `Auf dem Drucker keine Datei „${opts.jobName}.3mf“ gefunden (Druck evtl. direkt vom Slicer-Cache oder Gcode ohne 3mf).` };

    const chunks: Buffer[] = [];
    let got = 0;
    const sink = new Writable({
      write(chunk, _enc, cb) {
        got += chunk.length;
        if (got > MAX_DOWNLOAD) return cb(new Error('Datei zu groß')); // 1.233
        chunks.push(Buffer.from(chunk));
        cb();
      }
    });
    await client.downloadTo(sink, best.path);
    const parsed = weightsFromThreeMf(new Uint8Array(Buffer.concat(chunks)), opts.plate || 1);
    if (!parsed) return { error: 'In der Datei steht kein Filament-Gewicht (slice_info.config fehlt).' };
    return {
      fileName: best.name,
      plate: parsed.plate,
      filaments: parsed.filaments,
      totalGrams: Math.round(parsed.filaments.reduce((a, f) => a + f.grams, 0) * 100) / 100
    };
    });
  } catch (e: any) {
    return { error: `FTP zum Drucker fehlgeschlagen: ${e?.message || e}` };
  }
}

// Verbindungsarten zum Drucker. Normal: Port 990 mit TLS von Anfang an. Als Ausweich: Port 990 / 21 mit „AUTH TLS“ und zuletzt ohne Verschlüsselung.
const FTP_MODES: { port: number; secure: boolean | 'implicit'; label: string }[] = [
  { port: 990, secure: 'implicit', label: '990 implizit' },
  { port: 990, secure: true, label: '990 explizit' },
  { port: 21, secure: true, label: '21 explizit' },
  { port: 21, secure: false, label: '21 unverschlüsselt' }
];
let ftpModeIdx = 0;

/** Sitzung mit QUIT beenden, sonst hält der Drucker sie noch lange offen und lehnt bald alles mit „421 too many connections“ ab */
async function closeFtp(client: Client | null): Promise<void> {
  if (!client) return;
  try {
    await Promise.race([client.sendIgnoringError('QUIT'), new Promise(r => setTimeout(r, 1500))]);
  } catch {
    /* egal */
  }
  client.close();
}

async function ftp(ip: string, code: string): Promise<Client> {
  const errs: string[] = [];
  // Zuletzt funktionierende Art zuerst, dann der Rest
  const order = [ftpModeIdx, ...FTP_MODES.map((_, i) => i).filter(i => i !== ftpModeIdx)];
  for (const i of order) {
    const m = FTP_MODES[i];
    const client = new Client(12000);
    try {
      await client.access({ host: ip, port: m.port, user: 'bblp', password: code, secure: m.secure, secureOptions: { rejectUnauthorized: false } });
      if (i !== ftpModeIdx) console.log(`[FTP] Drucker ${ip}: Verbindungsart „${m.label}“ funktioniert`);
      ftpModeIdx = i;
      return client;
    } catch (e) {
      client.close();
      const em = (e as Error)?.message || String(e);
      errs.push(`${m.label}: ${em}`);
      if (/\b421\b|too many connections/i.test(em)) break; // Drucker voll: nicht noch mehr Verbindungen aufmachen
    }
  }
  throw new Error(`FTP zum Drucker ${ip} nicht möglich → ${errs.join(' | ')}`);
}

// Immer nur EINE FTP-Sitzung zum Drucker gleichzeitig (Suche, Datei lesen, Umbenennen, Gewicht holen).
// 1.279: Die Sitzung bleibt offen und wird wiederverwendet (vorher: neue Anmeldung bei jeder Suche, bis zu 10.000 am Tag).
// Der Drucker zählt Verbindungen je IP; Home Assistant läuft auf derselben IP. Nach 6 s ohne Nutzung wird sie sauber beendet.
let ftpChain: Promise<unknown> = Promise.resolve();
let ftpUsers = 0;
let shared: { client: Client; key: string } | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
// 1.284: nur 6 s offen halten (vorher 2 Min = bei Suche alle 20-30 s dauerhaft belegt): so bleibt für Home Assistant ein Platz frei
const IDLE_MS = 6_000;
/** Läuft gerade eine FTP-Sitzung oder wartet eine? (Die Suche lässt dann eine Runde aus.) */
export const ftpBusy = (): boolean => ftpUsers > 0;
/** Drucker hat „zu viele Verbindungen“ gemeldet */
export const isTooMany = (m: string) => /\b421\b|too many connections/i.test(m);

async function dropShared(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  const s = shared;
  shared = null;
  if (s) await closeFtp(s.client);
}

async function withFtp<T>(ip: string, code: string, fn: (c: Client) => Promise<T>): Promise<T> {
  ftpUsers++;
  const run = ftpChain.then(async () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    const key = `${ip}|${code}`;
    if (shared && (shared.key !== key || shared.client.closed)) await dropShared();
    let reused = Boolean(shared);
    if (!shared) {
      try {
        shared = { client: await ftp(ip, code), key };
      } catch (e) {
        // 421: ein anderer Zugriff (Home Assistant) belegt gerade den Platz: 4 s warten, einmal nochmal
        if (!isTooMany(String((e as Error)?.message))) throw e;
        await new Promise(r => setTimeout(r, 4_000));
        shared = { client: await ftp(ip, code), key };
      }
    }
    // Notbremse: hängt eine Sitzung über 3 Minuten, wird sie getrennt, sonst warteten alle anderen für immer
    const guard = setTimeout(() => void dropShared(), 180_000);
    try {
      try {
        return await fn(shared.client);
      } catch (e) {
        // Wiederverwendete Sitzung war vom Drucker schon beendet: einmal frisch anmelden und nochmal
        if (!reused || isTooMany(String((e as Error)?.message))) throw e;
        await dropShared();
        reused = false;
        shared = { client: await ftp(ip, code), key };
        return await fn(shared.client);
      }
    } catch (e) {
      await dropShared();
      throw e;
    } finally {
      clearTimeout(guard);
      if (shared) idleTimer = setTimeout(() => void dropShared(), IDLE_MS);
    }
  });
  ftpChain = run.catch(() => undefined);
  try {
    return await run;
  } finally {
    ftpUsers--;
  }
}

/** Alle .3mf-Dateien auf dem Drucker (neueste zuerst), für die Warteschlange */
export async function listJobFiles(ip: string, code: string): Promise<{ path: string; name: string; size: number; time: number }[]> {
  return withFtp(ip, code, async client => {
    const out: { path: string; name: string; size: number; time: number }[] = [];
    // 1.256: auch USB-Stick & weitere Ordner (eine Ebene unter „/“) durchsuchen, nicht nur feste Pfade
    // 1.279: Ordnerliste 10 Min merken; jede Liste ist eine eigene Datenverbindung zum Drucker
    let dirs = dirCache && Date.now() - dirCache.at < 10 * 60_000 ? dirCache.dirs : null;
    if (!dirs) {
      dirs = [...DIRS];
      try {
        const root = await client.list('/');
        const have = new Set(root.filter(e => e.isDirectory).map(e => '/' + e.name));
        dirs = dirs.filter(d => d === '/' || have.has(d) || (d.startsWith('/sdcard/') && have.has('/sdcard')));
        for (const e of root) {
          if (!e.isDirectory || SKIP_DIRS.test(e.name)) continue;
          const d = '/' + e.name;
          if (!dirs.includes(d) && dirs.length < 12) dirs.push(d);
        }
      } catch {
        /* feste Ordner reichen */
      }
      dirCache = { at: Date.now(), dirs };
    }
    if (dirs.join('|') !== lastDirs) {
      lastDirs = dirs.join('|');
      console.log(`[Warteschlange] Suche in: ${lastDirs}`);
    }
    for (const dir of dirs) {
      let list;
      try {
        list = await client.list(dir);
      } catch {
        continue;
      }
      for (const f of list) {
        if (!f.isFile || !/\.3mf$/i.test(f.name)) continue;
        const p = (dir === '/' ? '' : dir) + '/' + f.name;
        if (out.some(x => x.path === p)) continue;
        out.push({ path: p, name: f.name, size: f.size, time: f.modifiedAt ? f.modifiedAt.getTime() : 0 });
      }
    }
    return out.sort((a, b) => b.time - a.time).slice(0, 100);
  });
}

/** Filament je Platte aus einer Datei auf dem Drucker */
export async function readJobFile(ip: string, code: string, path: string, plate = 1): Promise<{ plate: number; filaments: JobFilament[]; predSec?: number; thumb: Uint8Array | null; setup: JobSetup | null; bytes: Uint8Array } | null> {
  return withFtp(ip, code, async client => {
    const chunks: Buffer[] = [];
    let got = 0;
    const sink = new Writable({
      write(chunk, _enc, cb) {
        got += chunk.length;
        if (got > MAX_DOWNLOAD) return cb(new Error('Datei zu groß')); // 1.233
        chunks.push(Buffer.from(chunk));
        cb();
      }
    });
    await client.downloadTo(sink, path);
    const bytes = new Uint8Array(Buffer.concat(chunks));
    const w = weightsFromThreeMf(bytes, plate);
    if (!w) return null;
    let thumb: Uint8Array | null = null;
    try {
      thumb = thumbFromThreeMf(bytes, w.plate);
    } catch {
      /* ohne Bild */
    }
    let setup: JobSetup | null = null;
    try {
      setup = setupFromThreeMf(bytes);
    } catch {
      /* ohne Angabe */
    }
    return { ...w, thumb, setup, bytes };
  });
}

/** Datei auf dem Drucker umbenennen (im selben Ordner). Gibt den neuen Pfad zurück. */
export async function renameJobFile(ip: string, code: string, filePath: string, newName: string): Promise<string> {
  return withFtp(ip, code, async client => {
    const dir = filePath.slice(0, filePath.lastIndexOf('/')) || '';
    const to = `${dir}/${newName}`;
    await client.rename(filePath, to);
    return to;
  });
}

/** 1.229: Datei aus der App per FTPS auf den Drucker laden (Wurzelordner). Gibt den Pfad auf dem Drucker zurück. */
export async function uploadJobFile(ip: string, code: string, name: string, bytes: Buffer): Promise<string> {
  const safe = name.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 120) || 'upload.gcode';
  return withFtp(ip, code, async client => {
    await client.uploadFrom(Readable.from(bytes), `/${safe}`);
    return `/${safe}`;
  });
}
