// Warteschlange auf dem Pi: Drucke (Dateien auf dem Drucker) vormerken. Der Taster „Platte frei“ am AMS-ESP startet den nächsten.
// Ein LED-Streifen (10 LEDs) zeigt, wie viele warten. Blinkt rot = nichts gestartet (Drucker druckt noch, Material fehlt, Drucker aus).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from '../paths.js';
import { readJsonWithPrev, saveJsonConfig, writeFileAtomic } from '../jsonConfig.js';
import { ftpBusy, listJobFiles, readJobFile, renameJobFile, type JobFilament } from '../bambuJobFile.js';
import { allTrays, mapFilaments, trayKey, trayLabel, type Mapping } from './hubLogic.js';
import { getHubConfig } from './core.js';
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
  /** Eigene Wahl: Filament-Nummer der Datei → Platz „amsId:slotId“ (leer = automatisch nach Material und Farbe) */
  pick?: Record<string, string>;
}

export interface QueuePort {
  getStatus: () => { connected: boolean; receivingData?: boolean; data?: any };
  getLanAccess: () => { ip: string; code: string } | null;
  startProject: (p: { path: string; plate: number; name: string; amsMapping: number[]; amsMapping2: { ams_id: number; slot_id: number }[]; useAms: boolean; url?: string }) => Promise<unknown>;
  cleanError?: (code: number) => Promise<unknown>;
  command?: (cmd: 'pause' | 'resume' | 'stop') => Promise<unknown>;
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
  return readJsonWithPrev<StartedJob[]>(startedFile(), v => Array.isArray(v)) || [];
}
function rememberStarted(it: QueueItem): void {
  const now = Date.now();
  const names = Array.from(new Set([jobKey(it.name), jobKey(path.posix.basename(it.path))]));
  const list = [{ path: it.path, names, filaments: it.filaments, at: now }, ...loadStarted().filter(x => now - x.at < 7 * 86400_000)].slice(0, 50);
  saveJsonConfig(startedFile(), list, 'gestartete Drucke', { pretty: false, keepPrev: true });
}
/** Pfad der Datei eines Drucks, den die Warteschlange gestartet hat (auch nach dem Umbenennen) */
function startedJobPath(name: string): string | null {
  const k = jobKey(name);
  return (k && loadStarted().find(x => x.names.includes(k))?.path) || null;
}
/** 1.227: Druck ohne Namen: hat die Warteschlange um diese Zeit (±15 min) etwas gestartet? */
export function startedJobNear(startMs: number): { name: string; filaments: JobFilament[] } | null {
  if (!(startMs > 0)) return null;
  const j = loadStarted().find(x => Math.abs(x.at - startMs) < 15 * 60_000 && x.filaments.length);
  return j ? { name: j.names[0] || '', filaments: j.filaments } : null;
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
    writeFileAtomic(urlKeyFile(), k);
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
    writeFileAtomic(path.join(thumbDir(), `${id}.png`), bytes, { mode: 0o644 });
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
const QUEUE_COUNT_ENTITY = 'number.filament_ams_warteschlange';
const QUEUE_MODE_ENTITY = 'number.filament_ams_warteschlange_modus';
const BUTTON_ENTITY = 'binary_sensor.filament_ams_platte_frei';

const DOUBLE_ENTITY = 'binary_sensor.filament_ams_taster_doppelt';

const found = { count: QUEUE_COUNT_ENTITY, mode: QUEUE_MODE_ENTITY, button: BUTTON_ENTITY, double: DOUBLE_ENTITY, at: 0 };
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
  found.double = dev.roles.buttonDouble || found.button.replace(/platte_frei/, 'taster_doppelt');
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
  // 1.231: kaputte Datei (Stromausfall) → Vorversion
  const v = readJsonWithPrev<any>(file(), d => Boolean(d && Array.isArray(d.items)));
  items = Array.isArray(v?.items) ? v.items : [];
  seen = Array.isArray(v?.seen) ? new Set<string>(v.seen) : null;
  autoOn = v?.auto !== false;
  return items!;
}

function save(): void {
  saveJsonConfig(file(), { items: load(), seen: seen ? Array.from(seen).slice(-500) : undefined, auto: autoOn }, 'Warteschlange', { pretty: false, keepPrev: true });
}

const printerData = () => port?.getStatus().data || {};
const currentMapping = (it: QueueItem): Mapping => {
  const d = printerData();
  return mapFilaments(it.filaments, allTrays(d.ams, d.vt_tray), it.pick);
};

export interface SlotChoice {
  id: number;
  type: string;
  colorHex: string;
  grams: number;
  /** Gewählter Platz (Schlüssel „amsId:slotId“, leer = keiner passt) und ob er automatisch gewählt wurde */
  tray: string;
  trayLabel: string;
  trayType: string;
  trayColor: string;
  auto: boolean;
  /** Alle belegten Plätze zur Auswahl */
  options: { key: string; label: string; type: string; colorHex: string }[];
}

/** Je Filament der Datei: Gramm, gewählter Platz und alle möglichen Plätze (für die Auswahl in der App) */
function slotChoices(it: QueueItem, m: Mapping): SlotChoice[] {
  const d = printerData();
  const options = allTrays(d.ams, d.vt_tray).map(t => ({ key: trayKey(t), label: trayLabel(t), type: t.type, colorHex: t.colorHex }));
  return it.filaments.map(f => {
    const c = m.chosen[f.id];
    return { id: f.id, type: f.type, colorHex: f.colorHex, grams: f.grams, tray: c?.key || '', trayLabel: c?.label || '', trayType: c?.type || '', trayColor: c?.colorHex || '', auto: c ? c.auto : true, options };
  });
}

export type QueueView = QueueItem & { mapping: string[]; missing: string[]; slots: SlotChoice[] };

export function queueList(): QueueView[] {
  return load().map(it => {
    const m = currentMapping(it);
    return { ...it, mapping: m.lines, missing: m.missing, slots: slotChoices(it, m) };
  });
}

/** 1.239: Platz für ein Filament der Datei wählen (tray leer = wieder automatisch). Gilt beim Start, die Datei selbst bleibt unverändert. */
export function queuePick(id: string, filamentId: number, tray: string): boolean {
  const it = load().find(x => x.id === id);
  if (!it || !it.filaments.some(f => f.id === filamentId)) return false;
  if (tray) {
    const d = printerData();
    if (!allTrays(d.ams, d.vt_tray).some(t => trayKey(t) === tray)) return false;
  }
  const pick = { ...(it.pick || {}) };
  if (tray) pick[String(filamentId)] = tray;
  else delete pick[String(filamentId)];
  it.pick = Object.keys(pick).length ? pick : undefined;
  save();
  return true;
}

export async function printerFiles() {
  const lan = port?.getLanAccess();
  if (!lan) throw new Error('Drucker nicht im LAN-Modus verbunden');
  return listJobFiles(lan.ip, lan.code);
}

export async function queueAdd(filePath: string, plate = 1, fkey?: string, displayName?: string): Promise<QueueItem & { mapping: string[]; missing: string[] }> {
  const lan = port?.getLanAccess();
  if (!lan) throw new Error('Drucker nicht im LAN-Modus verbunden');
  // Jeder Name aus Bambu Studio ist erlaubt (auch #, [ ], ' …); nur Steuerzeichen und „..“ nicht. Vor dem Start wird ohnehin sicher umbenannt.
  if (!/^\/[^\r\n\0]+\.3mf$/i.test(filePath) || filePath.includes('..')) throw new Error('Ungültiger Dateiname');
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
/** Start läuft (Taster/App) */
let starting = false;
let scanStarted = 0;
let scanBlockedUntil = 0;
interface ScanResult {
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
  // Andere FTP-Arbeit (Start, Datei lesen, Gewicht) läuft: diese Runde auslassen statt eine zweite Sitzung zu öffnen
  if (!force && (ftpBusy() || starting)) return quiet('Drucker beschäftigt, nächste Runde');
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

/**
 * 1.231: Wie lange bis zur nächsten automatischen Suche? Vorher alle 3 s eine FTPS-Anmeldung am Drucker (~28.800 am Tag,
 * Hauptgrund für „421 too many connections“). Jetzt: 20 s, ohne Neues langsamer bis 60 s, während des Druckens 60 s.
 */
export function scanIntervalMs(printing: boolean, quietRounds: number): number {
  if (printing) return 60_000;
  return Math.min(60_000, 20_000 * Math.max(1, Math.min(3, quietRounds)));
}

/** 1.239: Solange eine App die Warteschlange offen hat (fragt sie alle 2 s ab), sucht der Pi alle 8 s: „Senden“ in Bambu Studio erscheint so nach wenigen Sekunden */
const WATCH_MS = 15_000;
const FAST_SCAN_MS = 8_000;
let watchUntil = 0;
export const queueWatch = (now = Date.now()): void => {
  watchUntil = now + WATCH_MS;
};
export const scanDelayMs = (printing: boolean, quietRounds: number, watching: boolean): number => (watching ? FAST_SCAN_MS : scanIntervalMs(printing, quietRounds));

const scanLoop = { nextAt: 0, quiet: 0, sig: '' };
/** Takt der automatischen Suche (alle 5 s aufgerufen, sucht aber nur, wenn fällig). Ändert sich etwas am Drucker, sofort suchen. */
export async function autoScanTick(now = Date.now()): Promise<void> {
  const d: any = port?.getStatus().data || {};
  const gs = String(d.gcode_state || '');
  const sig = `${gs}|${d.gcode_file || ''}|${d.subtask_name || ''}`;
  if (sig !== scanLoop.sig) {
    scanLoop.sig = sig;
    scanLoop.nextAt = Math.min(scanLoop.nextAt, now + 3_000);
  }
  if (now < scanLoop.nextAt) return;
  const printing = ['RUNNING', 'PREPARE', 'PAUSE', 'SLICING'].includes(gs);
  scanLoop.nextAt = now + scanDelayMs(printing, scanLoop.quiet, now < watchUntil); // vorab setzen: kein zweiter Start, solange einer läuft
  const r = await autoScan();
  scanLoop.quiet = r.added > 0 ? 0 : scanLoop.quiet + 1;
  scanLoop.nextAt = Date.now() + scanDelayMs(printing, scanLoop.quiet, Date.now() < watchUntil);
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

/** 1.240: Während des LED-Tests in der App schreibt der Pi nichts an die Streifen. Danach zeigt er sofort die echte Warteschlange wieder. Sicherheitsende nach 5 min. */
let ledTestUntil = 0;
export function setLedTest(on: boolean): void {
  ledTestUntil = on ? Date.now() + 5 * 60_000 : 0;
  if (!on) {
    if (modeTimer) clearTimeout(modeTimer);
    void showLeds(0);
  }
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
  if (!haAvailable() || Date.now() < ledTestUntil) return; // 1.240: im LED-Test bleibt die Warteschlange außen vor
  await resolveIds();
  await haSetNumber(found.count, Math.min(10, load().length));
  await haSetNumber(found.mode, mode || baseMode());
  if (modeTimer) clearTimeout(modeTimer);
  if (mode) modeTimer = setTimeout(() => void haSetNumber(found.mode, baseMode()), 6000);
}

/** Nächsten Druck starten (Taster am ESP oder Knopf in der App). Gibt zurück, was passiert ist. */
export async function startNext(source: 'Taster' | 'App'): Promise<{ ok: boolean; text: string }> {
  if (starting) return { ok: false, text: 'Startet schon.' };
  setPlateClear(false); // Taster/Knopf = Platte ist frei
  starting = true;
  try {
    // 1.231: Leere Warteschlange: erst kurz auf dem Drucker nach neuen Dateien suchen (die Suche läuft nicht mehr alle 3 s)
    if (!load().length) await autoScan(true).catch(() => undefined);
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
    // Nach ID entfernen: während des Starts (bis ca. 1 Minute) kann sich die Liste geändert haben (neue Datei, Ziehen, Löschen)
    items = load().filter(x => x.id !== it.id);
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
/** Doppelt drücken (Einstellung in der App): Druck pausieren/fortsetzen, ersten Eintrag nach hinten schieben oder nichts */
let toggling = false;
async function togglePause(): Promise<void> {
  if (toggling) return;
  toggling = true;
  try {
    const d: any = port?.getStatus().data || {};
    const gs = String(d.gcode_state || '');
    const name = String(d.subtask_name || 'Druck');
    if (!port?.command) return;
    const act = getHubConfig().doubleAction;
    if (act === 'none') return;
    if (act === 'rotate') {
      const list = load();
      if (list.length < 2) {
        await showLeds(1);
        return;
      }
      list.push(list.shift()!);
      save();
      await showLeds(2);
      await notify('🔁 Warteschlange gedreht', `„${list[list.length - 1].name}“ steht jetzt ganz hinten, als Nächstes: „${list[0].name}“.`);
      return;
    }
    if (gs === 'RUNNING') {
      await port.command('pause');
      await notify('⏸️ Druck pausiert', `${name} (Taster doppelt gedrückt). Nochmal doppelt drücken = weiter.`);
    } else if (gs === 'PAUSE') {
      if (Number(d.print_error) > 0) {
        await notify('⚠️ Nicht fortgesetzt', `${name}: Der Drucker meldet einen Fehler. Bitte erst dort bestätigen.`);
      } else {
        await port.command('resume');
        await notify('▶️ Druck läuft weiter', `${name} (Taster doppelt gedrückt)`);
      }
    } else {
      await showLeds(1); // nichts zu pausieren: kurz rot
    }
  } catch (e) {
    console.warn('[Warteschlange] Pausieren/Fortsetzen fehlgeschlagen:', (e as Error)?.message || e);
  } finally {
    toggling = false;
  }
}

export function onHaEvent(ev: { event_type: string; data: any }): void {
  if (ev.event_type !== 'state_changed') return;
  const id = ev.data?.entity_id;
  const isOn = ev.data?.new_state?.state === 'on' && ev.data?.old_state?.state !== 'on';
  if (!isOn) return;
  // Zweiter Taster-Sensor „Taster doppelt“: gleicher Gerätename wie „Platte frei“
  if (id === found.double && id !== found.button) void togglePause();
  // Auch der erste Druck nach einem ESP-Neustart zählt (alter Zustand dann „unknown“/„unavailable“)
  else if (id === found.button) void startNext('Taster');
}

/** Beim Start: LEDs auf den aktuellen Stand bringen */
export function refreshLeds(): void {
  void resolveIds(true).then(() => showLeds(0));
}

export { trayLabel };
