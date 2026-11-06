// Gewicht je Filament aus der Druckdatei holen, die der Drucker selbst gespeichert hat (nur LAN-Modus).
// Bambu Studio schickt die Datei (<Name>.gcode.3mf) per FTPS (Port 990, Benutzer bblp, Passwort = Zugangscode) an den Drucker.
// Darin steht Metadata/slice_info.config mit used_g je Filament. So braucht es keine Cloud und keine Handeingabe.
import { Client } from 'basic-ftp';
import { Writable } from 'stream';
import { unzipSync, strFromU8 } from 'fflate';

export interface JobFilament {
  id: number;
  type: string;
  colorHex: string;
  grams: number;
}

export interface JobWeights {
  fileName: string;
  plate: number;
  filaments: JobFilament[];
  totalGrams: number;
}

const DIRS = ['/', '/cache', '/sdcard', '/sdcard/cache'];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.gcode\.3mf$|\.3mf$|\.gcode$/g, '')
    .trim();

/** slice_info.config lesen (ohne XML-Bibliothek: nur die Filament- und Plate-Zeilen) */
export function parseSliceInfo(xml: string, plate = 1): { plate: number; filaments: JobFilament[] } {
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
  return { plate: idxOf(blk) || plate, filaments };
}

/** Titelbild der Platte (Metadata/plate_N.png) aus einer .3mf */
export function thumbFromThreeMf(data: Uint8Array, plate = 1): Uint8Array | null {
  const want = `metadata/plate_${Math.max(1, plate)}.png`;
  const files = unzipSync(data, { filter: f => f.name.toLowerCase() === want || f.name.toLowerCase() === 'metadata/plate_1.png' });
  const key = Object.keys(files).find(k => k.toLowerCase() === want) || Object.keys(files).find(k => k.toLowerCase() === 'metadata/plate_1.png');
  return key ? files[key] : null;
}

/** Aus den Bytes einer .3mf das Gewicht lesen */
export function weightsFromThreeMf(data: Uint8Array, plate = 1): { plate: number; filaments: JobFilament[] } | null {
  const files = unzipSync(data, { filter: f => f.name.toLowerCase().endsWith('slice_info.config') });
  const key = Object.keys(files).find(k => k.toLowerCase().endsWith('slice_info.config'));
  if (!key) return null;
  const r = parseSliceInfo(strFromU8(files[key]), plate);
  return r.filaments.length ? r : null;
}

export async function fetchJobWeights(opts: { ip: string; code: string; jobName: string; plate?: number }): Promise<JobWeights | { error: string }> {
  const want = norm(opts.jobName);
  if (!want) return { error: 'Kein Auftragsname.' };
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
        if (norm(f.name) !== want) continue;
        const time = f.modifiedAt ? f.modifiedAt.getTime() : 0;
        if (!best || time >= best.time) best = { path: (dir === '/' ? '' : dir) + '/' + f.name, name: f.name, time };
      }
    }
    if (!best) return { error: `Auf dem Drucker keine Datei „${opts.jobName}.3mf“ gefunden (Druck evtl. direkt vom Slicer-Cache oder Gcode ohne 3mf).` };

    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
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

// Immer nur EINE FTP-Sitzung zum Drucker gleichzeitig (Suche alle 3 s, Datei lesen, Umbenennen, Gewicht holen).
// Der Drucker erlaubt nur wenige Sitzungen; mehrere parallel führen zu „421 too many connections“.
let ftpChain: Promise<unknown> = Promise.resolve();
let ftpUsers = 0;
/** Läuft gerade eine FTP-Sitzung oder wartet eine? (Die 3-s-Suche lässt dann eine Runde aus.) */
export const ftpBusy = (): boolean => ftpUsers > 0;
async function withFtp<T>(ip: string, code: string, fn: (c: Client) => Promise<T>): Promise<T> {
  ftpUsers++;
  const run = ftpChain.then(async () => {
    const client = await ftp(ip, code);
    // Notbremse: hängt eine Sitzung über 3 Minuten, wird sie getrennt, sonst warteten alle anderen für immer
    const guard = setTimeout(() => client.close(), 180_000);
    try {
      return await fn(client);
    } finally {
      clearTimeout(guard);
      await closeFtp(client);
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
    for (const dir of DIRS) {
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
export async function readJobFile(ip: string, code: string, path: string, plate = 1): Promise<{ plate: number; filaments: JobFilament[]; thumb: Uint8Array | null } | null> {
  return withFtp(ip, code, async client => {
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
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
    return { ...w, thumb };
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
