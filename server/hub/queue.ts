// Warteschlange auf dem Pi: Drucke (Dateien auf dem Drucker) vormerken. Der Taster „Platte frei“ am AMS-ESP startet den nächsten.
// Ein LED-Streifen (10 LEDs) zeigt, wie viele warten. Blinkt rot = nichts gestartet (Drucker druckt noch, Material fehlt, Drucker aus).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from '../paths.js';
import { listJobFiles, readJobFile, type JobFilament } from '../bambuJobFile.js';
import { allTrays, mapFilaments, trayLabel, type Mapping } from './hubLogic.js';
import { haAvailable, haSetNumber, haStates } from './ha.js';
import { resolveAms } from '../../src/utils/amsEntities.js';

export interface QueueItem {
  id: string;
  path: string;
  name: string;
  plate: number;
  filaments: JobFilament[];
  addedAt: number;
}

export interface QueuePort {
  getStatus: () => { connected: boolean; receivingData?: boolean; data?: any };
  getLanAccess: () => { ip: string; code: string } | null;
  startProject: (p: { path: string; plate: number; name: string; amsMapping: number[]; amsMapping2: { ams_id: number; slot_id: number }[]; useAms: boolean }) => Promise<unknown>;
}

const file = () => path.join(dataDir, 'hub-queue.json');
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

export async function queueAdd(filePath: string, plate = 1): Promise<QueueItem & { mapping: string[]; missing: string[] }> {
  const lan = port?.getLanAccess();
  if (!lan) throw new Error('Drucker nicht im LAN-Modus verbunden');
  if (!/^\/[\w .\-()/äöüÄÖÜß+&,]+\.3mf$/i.test(filePath) || filePath.includes('..')) throw new Error('Ungültiger Dateiname');
  const r = await readJobFile(lan.ip, lan.code, filePath, plate);
  if (!r || !r.filaments.length) throw new Error('In der Datei steht kein Filament (nicht geslict?)');
  const it: QueueItem = {
    id: crypto.randomBytes(6).toString('hex'),
    path: filePath,
    name: path.basename(filePath).replace(/\.gcode\.3mf$|\.3mf$/i, ''),
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
export async function autoScan(): Promise<void> {
  load();
  const lan = port?.getLanAccess();
  const st = port?.getStatus();
  if (!autoOn || scanning || !lan || !st?.connected) return;
  scanning = true;
  try {
    const files = await listJobFiles(lan.ip, lan.code);
    if (seen === null) {
      seen = new Set(files.map(fileKey));
      save();
      return;
    }
    const known = seen;
    const fresh = files.filter(f => !known.has(fileKey(f)) && /\.gcode\.3mf$|\.3mf$/i.test(f.name));
    if (!fresh.length) return;
    const d: any = st.data || {};
    const printing = ['RUNNING', 'PREPARE', 'PAUSE', 'SLICING'].includes(String(d.gcode_state || ''));
    const nowName = `${d.subtask_name || ''} ${d.gcode_file || ''}`.toLowerCase();
    // Älteste zuerst, damit die Reihenfolge stimmt
    for (const f of fresh.sort((a, b) => a.time - b.time)) {
      known.add(fileKey(f));
      if (printing && nowName.includes(baseOf(f.name))) continue; // wird schon gedruckt
      if (load().some(x => x.path === f.path)) continue; // schon vorgemerkt
      try {
        const it = await queueAdd(f.path, 1);
        await notify('➕ In der Warteschlange', `${it.name} (automatisch aus Bambu Studio)\n${it.mapping.join('\n')}${it.missing.length ? `\n⚠️ Im AMS fehlt: ${it.missing.join(', ')}` : ''}`);
        console.log(`[Warteschlange] automatisch vorgemerkt: ${it.name}`);
      } catch (e) {
        console.warn('[Warteschlange] Auto-Vormerken fehlgeschlagen:', (e as Error)?.message || e);
      }
    }
    save();
  } catch (e) {
    console.warn('[Warteschlange] Scan fehlgeschlagen:', (e as Error)?.message || e);
  } finally {
    scanning = false;
  }
}

export function queueRemove(id: string): boolean {
  const before = load().length;
  items = load().filter(x => x.id !== id);
  save();
  void showLeds(0);
  return items.length < before;
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
/** LEDs: Anzahl + Modus (0 = normal, 1 = rot blinken, 2 = grün = startet). Modus 1/2 geht nach 6 s zurück. */
async function showLeds(mode: 0 | 1 | 2): Promise<void> {
  if (!haAvailable()) return;
  await resolveIds();
  await haSetNumber(found.count, Math.min(10, load().length));
  await haSetNumber(found.mode, mode);
  if (modeTimer) clearTimeout(modeTimer);
  if (mode) modeTimer = setTimeout(() => void haSetNumber(found.mode, 0), 6000);
}

let starting = false;
/** Nächsten Druck starten (Taster am ESP oder Knopf in der App). Gibt zurück, was passiert ist. */
export async function startNext(source: 'Taster' | 'App'): Promise<{ ok: boolean; text: string }> {
  if (starting) return { ok: false, text: 'Startet schon.' };
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
    await port!.startProject({ path: it.path, plate: it.plate, name: it.name, amsMapping: m!.amsMapping, amsMapping2: m!.amsMapping2, useAms: true });
    items = list.slice(1);
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
