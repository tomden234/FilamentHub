// Hub-Kern (1.231 aus hub.ts herausgelöst): Einstellungen, Zustand je Druck, Drucker-Zugang, Push.
import path from 'path';
import { dataDir } from '../paths.js';
import { readExternal, readTrays } from '../../src/utils/amsMatch.js';
import { type Part, type TrayLite } from './deductPlan.js';
import { cloudReady } from './cloud.js';
import { haAvailable, haPush, type PushOptions } from './ha.js';
import { inQuietHours, type EnergyWeek } from './hubLogic.js';
import { type QueuePort } from './queue.js';
import { readJsonWithPrev, saveJsonConfig } from '../jsonConfig.js';

export const hubEnabled = (): boolean => process.env.FILAMENTHUB_HUB === '1';

// ---------- Einstellungen (von den Apps) ----------

export interface HubConfig {
  cloudUrl: string;
  gistToken: string;
  amsSlots: Record<string, string>;
  jobGrams: Record<string, number>;
  switchEntity: string;
  cameraEntity: string;
  /** Abzug auf dem Server (aus = Apps ziehen ab wie bisher) */
  deduct: boolean;
  lowWeightG: number;
  dryOffDelayMin: number;
  push: { done: boolean; failed: boolean; warn: boolean; low: boolean };
  autoOff: { armed: boolean; jobName: string; armedAt: number };
  dryOff: { armed: boolean; armedAt: number };
  /** Strompreis €/kWh */
  kwhPrice: number;
  /** Ruhezeit: Push lautlos von … bis … Uhr */
  quietFrom: number;
  quietTo: number;
  /** Material fehlt im AMS → Druck pausieren */
  materialGuard: boolean;
  /** Taster doppelt gedrückt: pause = Druck pausieren/fortsetzen, rotate = ersten Eintrag der Warteschlange nach hinten, none = nichts */
  doubleAction: 'pause' | 'rotate' | 'none';
  updatedAt: number;
}

const DEFAULT_CFG: HubConfig = {
  cloudUrl: '',
  gistToken: '',
  amsSlots: {},
  jobGrams: {},
  switchEntity: 'switch.3d_drucker_steckdose',
  cameraEntity: '',
  deduct: true,
  lowWeightG: 100,
  dryOffDelayMin: 3,
  push: { done: true, failed: true, warn: true, low: true },
  autoOff: { armed: false, jobName: '', armedAt: 0 },
  dryOff: { armed: false, armedAt: 0 },
  kwhPrice: 0.35,
  quietFrom: 22,
  quietTo: 7,
  materialGuard: true,
  doubleAction: 'pause',
  updatedAt: 0
};

export const cfgFile = () => path.join(dataDir, 'hub-config.json');
const stateFile = () => path.join(dataDir, 'hub-state.json');
export const photoDir = () => path.join(dataDir, 'photos');
export const backupDir = () => path.join(dataDir, 'backups');

export let cfg: HubConfig | null = null;

export function getHubConfig(): HubConfig {
  if (cfg) return cfg;
  const raw = readJsonWithPrev<any>(cfgFile(), d => Boolean(d && typeof d === 'object'));
  cfg = raw ? { ...DEFAULT_CFG, ...raw, push: { ...DEFAULT_CFG.push, ...(raw?.push || {}) } } : { ...DEFAULT_CFG };
  return cfg!;
}

/** Neue Einstellungen merken und sicher speichern */
export function storeHubConfig(c: HubConfig): void {
  cfg = c;
  writeJson(cfgFile(), c);
}

/** 1.231: gemeinsamer sicherer Schreib-Helfer (fsync, 0600: enthält z. B. den Gist-Token), Vorversion als Rückfall */
export const writeJson = (file: string, v: unknown): void => void saveJsonConfig(file, v, path.basename(file), { pretty: false, keepPrev: true });

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
const num = (v: unknown, lo: number, hi: number) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : undefined);

function cleanMap<T>(v: unknown, ok: (x: unknown) => x is T, maxKeys = 300): Record<string, T> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, T> = {};
  // 1.231: die NEUESTEN behalten (neue Einträge stehen hinten). Vorher slice(0, …): ab 300 Druck-Namen wurde nichts Neues mehr gemerkt.
  for (const [k, x] of Object.entries(v as Record<string, unknown>).filter(([, x]) => ok(x)).slice(-maxKeys)) out[String(k).slice(0, 200)] = x as T;
  return out;
}

/** Einstellungen von einer App übernehmen (nur bekannte Felder, geprüft) */
export function updateHubConfig(body: any): HubConfig {
  const c = { ...getHubConfig() };
  const set = <K extends keyof HubConfig>(k: K, v: HubConfig[K] | undefined) => {
    if (v !== undefined) (c as any)[k] = v;
  };
  // 1.234: nur „pi:“ oder ein Gist; npoint wird nicht mehr angenommen (leer = Standard, siehe access())
  const cu = str(body?.cloudUrl, 200);
  if (cu === '' || (cu !== undefined && validCloudUrl(cu))) set('cloudUrl', cu);
  set('gistToken', str(body?.gistToken, 200));
  set('amsSlots', cleanMap(body?.amsSlots, (x): x is string => typeof x === 'string' && x.length < 100, 10));
  set('jobGrams', cleanMap(body?.jobGrams, (x): x is number => typeof x === 'number' && x > 0 && x < 10000));
  // 1.233: nur ein einzelnes Gerät im bekannten Format (sonst ließe sich über „all“ oder eine Liste jedes Gerät schalten)
  const sw = str(body?.switchEntity, 120);
  if (sw === '' || (typeof sw === 'string' && /^(switch|light|input_boolean)\.[a-z0-9_]+$/.test(sw))) set('switchEntity', sw);
  const cam = str(body?.cameraEntity, 120);
  if (cam === '' || (typeof cam === 'string' && /^camera\.[a-z0-9_]+$/.test(cam))) set('cameraEntity', cam);
  set('deduct', bool(body?.deduct));
  set('lowWeightG', num(body?.lowWeightG, 0, 1000));
  set('dryOffDelayMin', num(body?.dryOffDelayMin, 1, 60));
  set('kwhPrice', num(body?.kwhPrice, 0, 5));
  set('quietFrom', num(body?.quietFrom, 0, 23));
  set('quietTo', num(body?.quietTo, 0, 23));
  set('materialGuard', bool(body?.materialGuard));
  if (body?.doubleAction === 'pause' || body?.doubleAction === 'rotate' || body?.doubleAction === 'none') set('doubleAction', body.doubleAction);
  if (body?.push && typeof body.push === 'object') {
    c.push = { ...c.push };
    for (const k of ['done', 'failed', 'warn', 'low'] as const) if (typeof body.push[k] === 'boolean') c.push[k] = body.push[k];
  }
  c.updatedAt = Date.now();
  storeHubConfig(c);
  return c;
}

// ---------- Zustand je Druck ----------

type DeductState = 'pending' | 'working' | 'done' | 'ask' | 'skip' | 'off';

interface PrintMeta {
  deduct: DeductState;
  tries: number;
  lastTry: number;
  reason?: string;
  texts?: string[];
  /** Filament-Namen dieses Drucks (Marke Material Farbe), für 👍/👎 */
  fils?: string[];
  parts?: Part[];
  photo: boolean;
  pushed: boolean;
  /** Strom für diesen Druck (Wh) */
  energyWh?: number;
  /** Fächer beim Druckende (für den Abzug) */
  trays?: TrayLite[];
  resolved?: boolean;
  /** Gewicht nur nach Druckzeit geschätzt */
  estimated?: boolean;
  /** „Gewicht unbekannt“ wurde schon einmal neu versucht */
  retried?: boolean;
  at: number;
}

interface HubState {
  prints: Record<string, PrintMeta>;
  lastBackupDay: string;
  /** Laufender Druck: Spulen-Check / Dauer-Warnung schon erledigt */
  openKey: string;
  startChecked: boolean;
  warned: boolean;
  expectedMin: number;
  pausedMs: number;
  /** Strom je Woche (Montag = Schlüssel) */
  energy: Record<string, EnergyWeek>;
  /** Woche, für die der Bericht schon kam */
  lastReportWeek: string;
  /** Energie des laufenden Drucks (Wh) */
  printWh: number;
  /** 1.227: Gewichte des laufenden Drucks, schon beim Start geholt (Drucker ist am Ende evtl. schon aus) */
  openFil?: { startMs: number; name: string; filaments: Fil[] } | null;
}

export type Fil = { type: string; colorHex: string; grams: number };

let st: HubState | null = null;
export function state(): HubState {
  if (st) return st;
  const raw = readJsonWithPrev<any>(stateFile(), d => Boolean(d && typeof d === 'object'));
  st = { prints: {}, lastBackupDay: '', openKey: '', startChecked: false, warned: false, expectedMin: 0, pausedMs: 0, energy: {}, lastReportWeek: '', printWh: 0, ...(raw || {}) };
  return st!;
}
export function saveState(): void {
  const s = state();
  // Alte Einträge (älter als 30 Tage) vergessen
  const cut = Date.now() - 30 * 86400_000;
  for (const [id, m] of Object.entries(s.prints)) if (m.at < cut) delete s.prints[id];
  writeJson(stateFile(), s);
}

export function printMeta(id: string): PrintMeta | undefined {
  return state().prints[id];
}

/** Eine App hat die Frage „Spule abziehen?“ beantwortet: andere Geräte fragen nicht mehr */
export function resolvePrint(id: string): boolean {
  const m = state().prints[id];
  if (!m) return false;
  m.resolved = true;
  saveState();
  return true;
}

// ---------- Drucker-Zugang (wird von bambuMqtt eingesteckt, kein Kreis-Import) ----------

export interface PrinterPort extends QueuePort {
  stopDrying: () => Promise<boolean>;
  command: (cmd: 'pause' | 'resume' | 'stop') => Promise<unknown>;
  resumeAfterError: (code: number) => Promise<unknown>;
  /** Soll-Temperatur senden (Dashboard-Eingabefelder; Grenzen prüft der Aufrufer) */
  setTemperature: (target: 'nozzle' | 'bed', temp: number) => Promise<unknown>;
  /** Verzögerter Druck geplant (dann ist eine Pause gewollt) */
  delayedResume: () => number;
}
export let port: PrinterPort | null = null;
/** Drucker-Zugang einstecken (von hub.attachPrinter) */
export function setPort(p: PrinterPort): void {
  port = p;
}
// ---------- Hilfen ----------

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const durText = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${Math.round(min)} min`);
/** Erlaubte Speicher-Adressen am Pi: die Datei auf dem Pi („pi:“) oder ein privater Gist */
export const validCloudUrl = (u: string): boolean => u === 'pi:' || /^gist:[0-9a-zA-Z]{6,64}$/.test(u);
/** 1.234: Im Add-on ist die Datei auf dem Pi der Standard-Speicher (auch wenn noch keine App umgestellt hat oder eine alte npoint-Adresse gespeichert ist) */
export const access = () => {
  const c = getHubConfig();
  return { cloudUrl: validCloudUrl(c.cloudUrl) ? c.cloudUrl : hubEnabled() ? 'pi:' : '', gistToken: c.gistToken };
};
export const deductActive = () => hubEnabled() && getHubConfig().deduct && cloudReady(access());
export const powerActive = () => hubEnabled() && haAvailable();

export let lastPush: { at: number; ok: boolean; text: string } | null = null;
export async function push(kind: keyof HubConfig['push'] | 'test', title: string, message: string, opts: PushOptions | string = {}): Promise<boolean> {
  if (!hubEnabled() || !haAvailable()) return false;
  if (kind !== 'test' && !getHubConfig().push[kind]) return false;
  const o: PushOptions = typeof opts === 'string' ? { tag: opts } : { ...opts };
  // Ruhezeit: trotzdem schicken, aber lautlos
  const c = getHubConfig();
  if (inQuietHours(new Date().getHours(), c.quietFrom, c.quietTo)) o.silent = true;
  const r = await haPush(process.env.NOTIFY_SERVICE || '', title, message, o);
  lastPush = { at: Date.now(), ok: r.ok, text: r.ok ? `an ${r.sent.join(', ')}` : 'kein Handy mit der Home-Assistant-App gefunden' };
  console.log(`[Hub] Push „${title}“: ${lastPush.text}`);
  return r.ok;
}

export function traysOf(d: any): TrayLite[] {
  const t: TrayLite[] = readTrays(d?.ams).map(x => ({ slot: x.slot, type: x.type, colorHex: x.colorHex, empty: x.empty }));
  const ext = readExternal(d?.vt_tray);
  if (ext && !ext.empty) t.push({ slot: ext.slot, type: ext.type, colorHex: ext.colorHex, empty: false });
  return t;
}

export const mainSlotOf = (slots: Record<string, number>): number | null => {
  const e = Object.entries(slots || {}).sort((a, b) => b[1] - a[1])[0];
  return e ? Number(e[0]) : null;
};
