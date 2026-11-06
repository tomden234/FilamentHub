// Warteschlange auf dem Pi: Drucke (Dateien auf dem Drucker) vormerken. Der Taster „Platte frei“ am AMS-ESP startet den nächsten.
// Ein LED-Streifen (10 LEDs) zeigt, wie viele warten. Blinkt rot = nichts gestartet (Drucker druckt noch, Material fehlt, Drucker aus).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from '../paths.js';
import { listJobFiles, readJobFile, renameJobFile, type JobFilament } from '../bambuJobFile.js';
import { allTrays, mapFilaments, trayLabel, type Mapping } from './hubLogic.js';
import { haAvailable, haSetNumber, haStates } from './ha.js';
import { resolveAms } from '../../src/utils/amsEntities.js';

export interface QueueItem {
  id: string;
  /** Titelbild der Platte vorhanden (Datei queue-thumbs/<id>.png) */
  thumb?: boolean;
  path: string;
  /** Pfad|Größe|Zeit der Datei beim Vormerken: erkennt eine neu gesendete Datei mit gleichem Namen */
  fkey?: string;
  name: string;
  plate: number;
  filaments: JobFilament[];
  addedAt: number;
}

export interface QueuePort {
  getStatus: () => { connected: boolean; receivingData?: boolean; data?: any };
  getLanAccess: () => { ip: string; code: string } | null;
  startProject: (p: { path: string; plate: number; name: string; amsMapping: number[]; amsMapping2: { ams_id: number; slot_id: number }[]; useAms: boolean; url?: string }) => Promise<unknown>;
  cleanError?: (code: number) => Promise<unknown>;
}

// Start-URL: Druckermodelle erwarten verschiedene Formen. Der Drucker meldet bei falscher Form 0500-4002 („Nicht unterstützter Dateipfad oder Name“).
// Wir probieren der Reihe nach und merken uns die Form, die geklappt hat.
const BAD_PATH = 0x05004002;
const urlVariants = (p: string): { key: string; url: string }[] => {
  const abs = p.startsWith('/') ? p : `/${p}`;
  const noSd = abs.replace(/^\/sdcard(?=\/)/, '');
  return [
    { key: 'ftp', url: `ftp://${abs}` },
    { key: 'file-sdcard', url: `file:///sdcard${noSd}` },
    { key: 'ftp-nosd', url: `ftp://${noSd}` },
    { key: 'file-mnt-sdcard', url: `file:///mnt/sdcard${noSd}` },
    { key: 'file-abs', url: `file://${abs}` }
  ];
};
let urlKey = '';

const file = () => path.join(dataDir, 'hub-queue.json');
const urlKeyFile = () => path.join(dataDir, 'hub-start-url.txt');
function loadUrlKey(): string {
  try {
    return fs.readFileSync(urlKeyFile(), 'utf-8').trim();
  } catch {
    return '';
  }
}
// Gestartete Drucke mit Filament-Gewicht merken: Der Abzug am Druckende braucht die Gramm, findet die Datei aber nicht,
// wenn sie vor dem Start umbenannt wurde (fh_….gcode.3mf). 7 Tage, höchstens 50.
interface StartedJob {
  path?: string;
  names: string[];
  filaments: JobFilament[];
  at: number;
}
const startedFile = () => path.join(dataDir, 'hub-started.json');
const jobKey = (n: string) => String(n || '').toLowerCase().replace(/\.gcode\.3mf$|\.3mf$|\.gcode$/i, '').trim();
function loadStarted(): StartedJob[] {
  try {
    const v = JSON.parse(fs.readFileSync(startedFile(), 'utf-8'));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function rememberStarted(it: QueueItem): void {
  const now = Date.now();
  const names = Array.from(new Set([jobKey(it.name), jobKey(path.posix.basename(it.path))]));
  const list = [{ path: it.path, names, filaments: it.filaments, at: now }, ...loadStarted().filter(x => now - x.at < 7 * 86400_000)].slice(0, 50);
  try {
    fs.writeFileSync(startedFile(), JSON.stringify(list), 'utf-8');
  } catch {
    /* egal */
  }
}
/** Pfad der Datei eines Drucks, den die Warteschlange gestartet hat (auch nach dem Umbenennen) */
export function startedJobPath(name: string): string | null {
  const k = jobKey(name);
  return (k && loadStarted().find(x => x.names.includes(k))?.path) || null;
}
/** Filament-Gewichte eines Drucks, den die Warteschlange gestartet hat (null = unbekannt) */
export function startedJobFilaments(name: string): JobFilament[] | null {
  const k = jobKey(name);
  if (!k) return null;
  const j = loadStarted().find(x => x.names.includes(k));
  return j && j.filaments.length ? j.filaments : null;
}

function saveUrlKey(k: string): void {
  try {
    fs.writeFileSync(urlKeyFile(), k, 'utf-8');
  } catch {
    /* egal */
  }
}
const thumbDir = () => path.join(dataDir, 'queue-thumbs');
export const thumbPath = (id: string): string | null => {
  if (!/^[0-9a-f]{12}$/.test(id)) return null;
  const p = path.join(thumbDir(), `${id}.png`);
  return fs.existsSync(p) ? p : null;
};
function saveThumb(id: string, bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 100 || bytes.length > 2_000_000) return false;
  try {
    fs.mkdirSync(thumbDir(), { recursive: true });
    fs.writeFileSync(path.join(thumbDir(), `${id}.png`), bytes);
    return true;
  } catch {
    return false;
  }
}
function dropThumb(id: string): void {
  try {
    fs.rmSync(path.join(thumbDir(), `${id}.png`), { force: true });
  } catch {
    /* egal */
  }
}
let items: QueueItem[] | null = null;
/** Schon gesehene Dateien („Pfad|Größe|Zeit“): nur neue kommen automatisch in die Warteschlange. null = noch nie gescannt. */
let seen: Set<string> | null = null;
let autoOn = true;
let port: QueuePort | null = null;
let notify: (title: string, text: string) => Promise<unknown> = async () => undefined;

/** Übliche Namen der ESPHome-Regler (Gerät „Filament AMS“). Die echten werden in Home Assistant gesucht (resolveAms). */
export const QUEUE_COUNT_ENTITY = 'number.filament_ams_warteschlange';
export const QUEUE_MODE_ENTITY = 'number.filament_ams_warteschlange_modus';
export const BUTTON_ENTITY = 'binary_sensor.filament_ams_platte_frei';

const found = { count: QUEUE_COUNT_ENTITY, mode: QUEUE_MODE_ENTITY, button: BUTTON_ENTITY, at: 0 };
/** Echte IDs suchen (höchstens alle 5 Minuten): Home Assistant behält alte IDs, wenn das Gerät früher anders hieß */
async function resolveIds(force = false): Promise<void> {
  if (!force && Date.now() - found.at < 5 * 60_000) return;
  found.at = Date.now();
  const states = await haStates();
  const dev = states ? resolveAms(states) : null;
  if (!dev) return;
  found.count = dev.roles.queue || QUEUE_COUNT_ENTITY;
  found.mode = dev.roles.queueMode || QUEUE_MODE_ENTITY;
  found.button = dev.roles.button || BUTTON_ENTITY;
}

export function attachQueue(p: QueuePort, n: (title: string, text: string) => Promise<unknown>): void {
  port = p;
  notify = n;
  // Druckende erkennen: danach leuchtet „Platte räumen“, bis der Taster gedrückt wird oder der nächste Druck startet
  let lastGs = '';
  setInterval(() => {
    const gs = String(port?.getStatus().data?.gcode_state || '');
    if (!gs || gs === lastGs) return;
    const prev = lastGs;
    lastGs = gs;
    if (!prev) return;
    if ((gs === 'FINISH' || gs === 'FAILED') && ['RUNNING', 'PAUSE', 'PREPARE'].includes(prev)) setPlateClear(true);
    else if (gs === 'RUNNING' || gs === 'PREPARE') setPlateClear(false);
  }, 3000).unref();
}

function load(): QueueItem[] {
  if (items) return items;
  try {
    const v = JSON.parse(fs.readFileSync(file(), 'utf-8'));
    items = Array.isArray(v?.items) ? v.items : [];
    seen = Array.isArray(v?.seen) ? new Set<string>(v.seen) : null;
    autoOn = v?.auto !== false;
  } catch {
    items = [];
  }
  return items!;
}

function save(): void {
  try {
    fs.writeFileSync(file(), JSON.stringify({ items: load(), seen: seen ? Array.from(seen).slice(-500) : undefined, auto: autoOn }), 'utf-8');
  } catch (e) {
    console.warn('[Warteschlange] Speichern fehlgeschlagen:', (e as Error)?.message || e);
  }
}

const printerData = () => port?.getStatus().data || {};
const currentMapping = (it: QueueItem): Mapping => {
  const d = printerData();
  return mapFilaments(it.filaments, allTrays(d.ams, d.vt_tray));
};

export function queueList(): (QueueItem & { mapping: string[]; missing: string[] })[] {
  return load().map(it => {
    const m = currentMapping(it);
    return { ...it, mapping: m.lines, missing: m.missing };
  });
}

export async function printerFiles() {
  const lan = port?.getLanAccess();
  if (!lan) throw new Error('Drucker nicht im LAN-Modus verbunden');
  return listJobFiles(lan.ip, lan.code);
}

export async function queueAdd(filePath: string, plate = 1, fkey?: string, displayName?: string): Promise<QueueItem & { mapping: string[]; missing: string[] }> {
  const lan = port?.getLanAccess();
  if (!lan) throw new Error('Drucker nicht im LAN-Modus verbunden');
  if (!/^\/[\w .\-()/äöüÄÖÜß+&,]+\.3mf$/i.test(filePath) || filePath.includes('..')) throw new Error('Ungültiger Dateiname');
  const r = await readJobFile(lan.ip, lan.code, filePath, plate);
  if (!r || !r.filaments.length) throw new Error('In der Datei steht kein Filament (nicht geslict?)');
  const id = crypto.randomBytes(6).toString('hex');
  const it: QueueItem = {
    id,
    thumb: saveThumb(id, r.thumb),
    path: filePath,
    fkey,
    name: displayName || path.basename(filePath).replace(/\.gcode\.3mf$|\.3mf$/i, ''),
    plate: r.plate,
    filaments: r.filaments,
    addedAt: Date.now()
  };
  load().push(it);
  save();
  void showLeds(0);
  const m = currentMapping(it);
  return { ...it, mapping: m.lines, missing: m.missing };
}

/** „Nochmal drucken“ aus dem Verlauf: dieselbe Datei auf dem Drucker noch einmal vormerken */
export async function queueReprint(name: string): Promise<QueueItem & { mapping: string[]; missing: string[] }> {
  const files = await printerFiles();
  const k = jobKey(name);
  let f = files.find(x => jobKey(x.name) === k);
  if (!f) {
    const sp = startedJobPath(name);
    if (sp) f = files.find(x => x.path === sp);
  }
  if (!f) throw new Error('Die Datei liegt nicht mehr auf dem Drucker. Bitte in Bambu Studio noch einmal „Senden“.');
  return queueAdd(f.path, 1, fileKey(f), name);
}

export const autoAddOn = (): boolean => (load(), autoOn);
export function setAutoAdd(on: boolean): void {
  load();
  autoOn = on;
  // Beim Einschalten alles Vorhandene als „gesehen“ merken, sonst käme der ganze Altbestand in die Warteschlange
  if (on) seen = null;
  save();
}

const fileKey = (f: { path: string; size: number; time: number }) => `${f.path}|${f.size}|${f.time}`;
const baseOf = (n: string) => n.replace(/\.gcode\.3mf$|\.3mf$/i, '').toLowerCase();

/**
 * Neue Dateien auf dem Drucker (Bambu Studio „Senden“) selbst in die Warteschlange stellen.
 * Der erste Durchlauf merkt sich nur, was schon da ist. Eine Datei, die gerade gedruckt wird („Drucken“ statt „Senden“), kommt nicht in die Warteschlange.
 */
let scanning = false;
let scanStarted = 0;
let scanBlockedUntil = 0;
export interface ScanResult {
  ok: boolean;
  text: string;
  added: number;
}
/** force = Knopf „Aktualisieren“ in der App: ignoriert die Pause nach einem Fehler und einen hängenden Scan, und sagt, was passiert ist. */
export async function autoScan(force = false): Promise<ScanResult> {
  load();
  const quiet = (text: string, ok = true): ScanResult => ({ ok, text, added: 0 });
  // Hängt ein Scan länger als 60 s (Drucker antwortet nicht mehr), wird er freigegeben
  if (scanning && Date.now() - scanStarted > (force ? 5_000 : 60_000)) scanning = false;
  if (!force && Date.now() < scanBlockedUntil) return quiet('Pause nach Fehler');
  const lan = port?.getLanAccess();
  const st = port?.getStatus();
  if (!lan || !st?.connected) return quiet('Drucker nicht im LAN-Modus verbunden', false);
  if (!autoOn && !force) return quiet('Automatik aus');
  if (scanning) return quiet('Scan läuft gerade, gleich nochmal drücken', false);
  scanning = true;
  scanStarted = Date.now();
  let added = 0;
  try {
    const files = await Promise.race([
      listJobFiles(lan.ip, lan.code),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Drucker antwortet nicht (Zeitüberschreitung)')), 40_000))
    ]);
    if (seen === null) {
      seen = new Set(files.map(fileKey));
      save();
      return quiet(`Erster Abgleich: ${files.length} Dateien auf dem Drucker gemerkt. Neue Dateien kommen jetzt automatisch.`);
    }
    const known = seen;
    const fresh = files.filter(f => !known.has(fileKey(f)) && /\.gcode\.3mf$|\.3mf$/i.test(f.name) && !/^fh_[0-9a-f]{12}\.gcode\.3mf$/i.test(f.name)); // fh_… = von uns umbenannt
    if (!fresh.length) return quiet(`Nichts Neues (${files.length} Dateien auf dem Drucker geprüft)`);
    const d: any = st.data || {};
    const printing = ['RUNNING', 'PREPARE', 'PAUSE', 'SLICING'].includes(String(d.gcode_state || ''));
    const nowName = `${d.subtask_name || ''} ${d.gcode_file || ''}`.toLowerCase();
    // Älteste zuerst, damit die Reihenfolge stimmt
    for (const f of fresh.sort((a, b) => a.time - b.time)) {
      known.add(fileKey(f));
      if (printing && nowName.includes(baseOf(f.name))) continue; // wird schon gedruckt
      if (load().some(x => x.fkey === fileKey(f))) continue; // genau diese Datei schon vorgemerkt
      try {
        const it = await queueAdd(f.path, 1, fileKey(f));
        added++;
        await notify('➕ In der Warteschlange', `${it.name} (automatisch aus Bambu Studio)\n${it.mapping.join('\n')}${it.missing.length ? `\n⚠️ Im AMS fehlt: ${it.missing.join(', ')}` : ''}`);
        console.log(`[Warteschlange] automatisch vorgemerkt: ${it.name}`);
      } catch (e) {
        console.warn('[Warteschlange] Auto-Vormerken fehlgeschlagen:', (e as Error)?.message || e);
      }
    }
    save();
    return { ok: true, added, text: added ? `${added} neue Datei(en) vorgemerkt` : 'Neue Datei war schon in der Warteschlange oder wird gerade gedruckt' };
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    scanBlockedUntil = Date.now() + 90_000; // nach Fehler 90 s Pause, damit der Drucker seine Sitzungen freigeben kann
    console.warn('[Warteschlange] Scan fehlgeschlagen (nächster Versuch in 90 s):', msg);
    return { ok: false, added, text: msg };
  } finally {
    scanning = false;
  }
}

/** Eintrag kopieren: gleiche Datei noch einmal direkt darunter einreihen (mit Titelbild) */
export function queueDuplicate(id: string): boolean {
  const list = load();
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return false;
  const nid = crypto.randomBytes(6).toString('hex');
  let thumb = false;
  const src = thumbPath(id);
  if (src) {
    try {
      fs.copyFileSync(src, path.join(thumbDir(), `${nid}.png`));
      thumb = true;
    } catch {
      /* ohne Bild */
    }
  }
  list.splice(i + 1, 0, { ...list[i], id: nid, thumb, addedAt: Date.now() });
  save();
  void showLeds(0);
  return true;
}

export function queueRemove(id: string): boolean {
  const before = load().length;
  items = load().filter(x => x.id !== id);
  if (items.length < before) dropThumb(id);
  save();
  void showLeds(0);
  return items.length < before;
}

/** Neue Reihenfolge übernehmen (Ziehen in der App): nur bekannte IDs, nichts geht verloren */
export function queueReorder(order: string[]): void {
  const list = load();
  const byId = new Map(list.map(x => [x.id, x]));
  const next: QueueItem[] = [];
  for (const id of order) {
    const it = byId.get(id);
    if (it) {
      next.push(it);
      byId.delete(id);
    }
  }
  next.push(...byId.values());
  items = next;
  save();
  void showLeds(0);
}

export function queueMove(id: string, dir: -1 | 1): void {
  const list = load();
  const i = list.findIndex(x => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  save();
  void showLeds(0);
}

let modeTimer: ReturnType<typeof setTimeout> | null = null;
/** Druck ist fertig, die Platte ist noch nicht frei: die freien LEDs oben leuchten orange (Modus 3), bis der Taster gedrückt wird oder ein Druck startet */
let plateClear = false;
function setPlateClear(on: boolean): void {
  if (plateClear === on) return;
  plateClear = on;
  void showLeds(0);
}
const baseMode = (): 0 | 3 => (plateClear ? 3 : 0);

/** LEDs: Anzahl + Modus (0 = normal, 1 = rot blinken, 2 = grün = startet, 3 = Platte räumen). Modus 1/2 gehen nach 6 s zurück. */
async function showLeds(mode: 0 | 1 | 2): Promise<void> {
  if (!haAvailable()) return;
  await resolveIds();
  await haSetNumber(found.count, Math.min(10, load().length));
  await haSetNumber(found.mode, mode || baseMode());
  if (modeTimer) clearTimeout(modeTimer);
  if (mode) modeTimer = setTimeout(() => void haSetNumber(found.mode, baseMode()), 6000);
}

let starting = false;
/** Nächsten Druck starten (Taster am ESP oder Knopf in der App). Gibt zurück, was passiert ist. */
export async function startNext(source: 'Taster' | 'App'): Promise<{ ok: boolean; text: string }> {
  if (starting) return { ok: false, text: 'Startet schon.' };
  setPlateClear(false); // Taster/Knopf = Platte ist frei
  starting = true;
  try {
    const list = load();
    const st = port?.getStatus();
    const live = Boolean(st?.connected && st?.receivingData !== false);
    const gs = String(st?.data?.gcode_state || '');
    let fail = '';
    if (!list.length) fail = 'Warteschlange ist leer.';
    else if (!live) fail = 'Drucker ist aus oder nicht verbunden.';
    else if (['RUNNING', 'PREPARE', 'PAUSE', 'SLICING'].includes(gs)) fail = 'Drucker druckt noch.';
    const it = list[0];
    let m: Mapping | null = null;
    if (!fail) {
      m = currentMapping(it);
      if (m.missing.length) fail = `Im AMS fehlt: ${m.missing.join(', ')}.`;
    }
    if (fail) {
      await showLeds(1);
      if (source === 'Taster' && list.length) await notify('⛔ Nicht gestartet', `${it?.name || ''}: ${fail}`);
      return { ok: false, text: fail };
    }
    // Der Drucker lehnt den Start mit „Nicht unterstützter Dateipfad oder Name“ (0500-4002) ab, wenn der Name Klammern, Leerzeichen,
    // Umlaute oder Sonderzeichen hat. Dann die Datei auf dem Drucker einmal auf einen sicheren Namen umbenennen.
    const lan = port!.getLanAccess();
    if (lan && !/^[A-Za-z0-9_.\-]+$/.test(path.posix.basename(it.path))) {
      try {
        it.path = await renameJobFile(lan.ip, lan.code, it.path, `fh_${it.id}.gcode.3mf`);
        save();
      } catch (e) {
        console.warn('[Warteschlange] Umbenennen auf dem Drucker fehlgeschlagen:', (e as Error)?.message || e);
      }
    }
    const variants = urlVariants(it.path);
    if (!urlKey) urlKey = loadUrlKey();
    variants.sort((a, b) => (a.key === urlKey ? -1 : b.key === urlKey ? 1 : 0));
    let started = false;
    let lastErr = '';
    for (const v of variants) {
      await port!.startProject({ path: it.path, plate: it.plate, name: it.name, amsMapping: m!.amsMapping, amsMapping2: m!.amsMapping2, useAms: true, url: v.url });
      // Bis 12 s warten: lehnt der Drucker ab (0500-4002), nächste Form probieren
      let rejected = false;
      for (let t = 0; t < 24; t++) {
        await new Promise(r => setTimeout(r, 500));
        const d: any = port!.getStatus().data || {};
        if (Number(d.print_error) === BAD_PATH) {
          rejected = true;
          break;
        }
        if (['RUNNING'].includes(String(d.gcode_state)) || (t >= 16 && String(d.gcode_state) === 'PREPARE')) break;
      }
      if (!rejected) {
        started = true;
        if (urlKey !== v.key) {
          urlKey = v.key;
          saveUrlKey(v.key);
          console.log(`[Warteschlange] Start-Pfad „${v.key}“ (${v.url}) funktioniert`);
        }
        break;
      }
      lastErr = `Drucker lehnt Pfad ab (${v.url})`;
      console.warn(`[Warteschlange] ${lastErr}, probiere nächste Form`);
      await port!.cleanError?.(BAD_PATH);
      await new Promise(r => setTimeout(r, 1500));
    }
    if (started) rememberStarted(it);
    if (!started) {
      await showLeds(1);
      await notify('⛔ Nicht gestartet', `${it.name}: Drucker lehnt alle Pfad-Formen ab. Bitte Log schicken.`);
      return { ok: false, text: lastErr || 'Start abgelehnt' };
    }
    items = list.slice(1);
    dropThumb(it.id);
    save();
    await showLeds(2);
    const rest = items.length ? ` Noch ${items.length} in der Warteschlange.` : '';
    await notify('▶️ Nächster Druck gestartet', `${it.name} (${source})\n${m!.lines.join('\n')}${rest}`);
    console.log(`[Warteschlange] gestartet: ${it.name} (${source})`);
    return { ok: true, text: `„${it.name}“ gestartet.${rest}` };
  } catch (e) {
    await showLeds(1);
    return { ok: false, text: `Start fehlgeschlagen: ${(e as Error)?.message || e}` };
  } finally {
    starting = false;
  }
}

/** Taster am ESP gedrückt? (Ereignis aus Home Assistant) */
export function onHaEvent(ev: { event_type: string; data: any }): void {
  if (ev.event_type !== 'state_changed' || ev.data?.entity_id !== found.button) return;
  // Auch der erste Druck nach einem ESP-Neustart zählt (alter Zustand dann „unknown“/„unavailable“)
  if (ev.data?.new_state?.state === 'on' && ev.data?.old_state?.state !== 'on') void startNext('Taster');
}

/** Beim Start: LEDs auf den aktuellen Stand bringen */
export function refreshLeds(): void {
  void resolveIds(true).then(() => showLeds(0));
}

export { trayLabel };
