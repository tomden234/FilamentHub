// Warteschlange auf dem Pi: Drucke (Dateien auf dem Drucker) vormerken. Der Taster „Platte frei“ am AMS-ESP startet den nächsten.
// Ein LED-Streifen (10 LEDs) zeigt, wie viele warten. Blinkt rot = nichts gestartet (Drucker druckt noch, Material fehlt, Drucker aus).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from '../paths.js';
import { listJobFiles, readJobFile, type JobFilament } from '../bambuJobFile.js';
import { allTrays, mapFilaments, trayLabel, type Mapping } from './hubLogic.js';
import { haAvailable, haSetNumber } from './ha.js';

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
let port: QueuePort | null = null;
let notify: (title: string, text: string) => Promise<unknown> = async () => undefined;

/** Namen der ESPHome-Regler (Gerät „Filament AMS“) */
export const QUEUE_COUNT_ENTITY = 'number.filament_ams_warteschlange';
export const QUEUE_MODE_ENTITY = 'number.filament_ams_warteschlange_modus';
export const BUTTON_ENTITY = 'binary_sensor.filament_ams_platte_frei';

export function attachQueue(p: QueuePort, n: (title: string, text: string) => Promise<unknown>): void {
  port = p;
  notify = n;
}

function load(): QueueItem[] {
  if (items) return items;
  try {
    const v = JSON.parse(fs.readFileSync(file(), 'utf-8'));
    items = Array.isArray(v?.items) ? v.items : [];
  } catch {
    items = [];
  }
  return items!;
}

function save(): void {
  try {
    fs.writeFileSync(file(), JSON.stringify({ items: load() }), 'utf-8');
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
  await haSetNumber(QUEUE_COUNT_ENTITY, Math.min(10, load().length));
  await haSetNumber(QUEUE_MODE_ENTITY, mode);
  if (modeTimer) clearTimeout(modeTimer);
  if (mode) modeTimer = setTimeout(() => void haSetNumber(QUEUE_MODE_ENTITY, 0), 6000);
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
  if (ev.event_type !== 'state_changed' || ev.data?.entity_id !== BUTTON_ENTITY) return;
  if (ev.data?.new_state?.state === 'on' && ev.data?.old_state?.state === 'off') void startNext('Taster');
}

/** Beim Start: LEDs auf den aktuellen Stand bringen */
export function refreshLeds(): void {
  void showLeds(0);
}

export { trayLabel };
