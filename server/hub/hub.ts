// FilamentHub-Hub: läuft nur im Home-Assistant-Add-on (FILAMENTHUB_HUB=1) rund um die Uhr und erledigt, was sonst eine offene App brauchte:
//  1. Push aufs Handy (Home-Assistant-App) bei Druck fertig / abgebrochen / Warnungen
//  2. Kamerafoto am Druckende (abrufbar für die Druckliste)
//  3. Abzug der Gramm direkt in der Cloud – genau EINMAL je Druck (serverDeducts + Prüfung der Druckliste)
//  4. „Aus nach Druck“ und „Aus nach Trocknen“ (Steckdose über Home Assistant)
//  7. Warnung, wenn ein Druck viel länger dauert als gewohnt
//  8. Spulen-Check beim Druckstart (reicht das Filament?)
// 10. Tägliche Sicherung des Cloud-Dokuments (Spulen, Verlauf, Druckliste) auf dem Pi
// Die Apps schicken ihre Einstellungen (Cloud-Zugang, Slot-Zuordnung, Steckdose …) über /api/hub/config.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from '../paths.js';
import { fetchJobWeights } from '../bambuJobFile.js';
import { getPrinterFrame } from '../printerCameraStream.js';
import { printRecorder, nameKey, type RecordedPrint } from '../printRecorder.js';
import { readExternal, readTrays, activeSlotFromPrinter } from '../../src/utils/amsMatch.js';
import { dryOffAction } from '../../src/utils/dryAutoOff.js';
import { applyDeduction, deductedIn, expectedMinutes, planParts, shortages, tooLong, type Part, type PrintInfo, type TrayLite } from './deductPlan.js';
import { cloudReady, loadDoc, saveDoc } from './cloud.js';
import { haAvailable, haCameraJpeg, haListen, haPowerW, haPush, haState, haSwitch, type PushOptions } from './ha.js';
import { addEnergy, allTrays, inQuietHours, missingMaterials, stalled, weekKey, weeklyReport, type EnergyWeek } from './hubLogic.js';
import { attachQueue, autoScanTick, onHaEvent as queueEvent, refreshLeds, startedJobFilaments, startedJobNear, type QueuePort } from './queue.js';
import { isGenericPrintName } from '../../src/utils/printMatch.js';
import { espInfo as espInfoFn, publishImage, syncEspYaml } from './esphome.js';
import { rootDir } from '../paths.js';
import { readJsonWithPrev, saveJsonConfig, writeFileAtomic } from '../jsonConfig.js';

export const hubEnabled = (): boolean => process.env.FILAMENTHUB_HUB === '1';

// ---------- Einstellungen (von den Apps) ----------

interface HubConfig {
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
  updatedAt: 0
};

const cfgFile = () => path.join(dataDir, 'hub-config.json');
const stateFile = () => path.join(dataDir, 'hub-state.json');
const photoDir = () => path.join(dataDir, 'photos');
const backupDir = () => path.join(dataDir, 'backups');

let cfg: HubConfig | null = null;

export function getHubConfig(): HubConfig {
  if (cfg) return cfg;
  const raw = readJsonWithPrev<any>(cfgFile(), d => Boolean(d && typeof d === 'object'));
  cfg = raw ? { ...DEFAULT_CFG, ...raw, push: { ...DEFAULT_CFG.push, ...(raw?.push || {}) } } : { ...DEFAULT_CFG };
  return cfg!;
}

/** 1.231: gemeinsamer sicherer Schreib-Helfer (fsync, 0600: enthält z. B. den Gist-Token), Vorversion als Rückfall */
const writeJson = (file: string, v: unknown): void => void saveJsonConfig(file, v, path.basename(file), { pretty: false, keepPrev: true });

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
  set('cloudUrl', str(body?.cloudUrl, 200));
  set('gistToken', str(body?.gistToken, 200));
  set('amsSlots', cleanMap(body?.amsSlots, (x): x is string => typeof x === 'string' && x.length < 100, 10));
  set('jobGrams', cleanMap(body?.jobGrams, (x): x is number => typeof x === 'number' && x > 0 && x < 10000));
  set('switchEntity', str(body?.switchEntity, 120));
  set('cameraEntity', str(body?.cameraEntity, 120));
  set('deduct', bool(body?.deduct));
  set('lowWeightG', num(body?.lowWeightG, 0, 1000));
  set('dryOffDelayMin', num(body?.dryOffDelayMin, 1, 60));
  set('kwhPrice', num(body?.kwhPrice, 0, 5));
  set('quietFrom', num(body?.quietFrom, 0, 23));
  set('quietTo', num(body?.quietTo, 0, 23));
  set('materialGuard', bool(body?.materialGuard));
  if (body?.push && typeof body.push === 'object') {
    c.push = { ...c.push };
    for (const k of ['done', 'failed', 'warn', 'low'] as const) if (typeof body.push[k] === 'boolean') c.push[k] = body.push[k];
  }
  c.updatedAt = Date.now();
  cfg = c;
  writeJson(cfgFile(), c);
  return c;
}

/** Vom Server erledigte „Aus nach Druck“-Schalter (armedAt) */
const doneArms = new Set<number>();

/** „Aus nach Druck“ / „Aus nach Trocknen“ von der App setzen */
export function setPower(body: any): HubConfig {
  const c = { ...getHubConfig() };
  if (body?.autoOff && typeof body.autoOff === 'object') {
    const a = body.autoOff;
    let next = a.armed ? { armed: true, jobName: String(a.jobName || '').slice(0, 200), armedAt: Number(a.armedAt) || Date.now() } : { armed: false, jobName: '', armedAt: 0 };
    // Der Server hat diesen Schalter schon erledigt (ausgeschaltet oder Druck fehlgeschlagen): alte Meldung einer App nicht wieder scharf machen
    if (next.armed && doneArms.has(next.armedAt)) next = { armed: false, jobName: '', armedAt: 0 };
    if (!next.armed && c.autoOff.armed && body?.byServer) doneArms.add(c.autoOff.armedAt);
    // Nur bei einem neuen Schalter-Stand die Zähler neu starten (gleiche Meldung beim App-Start ändert nichts)
    if (next.armed !== c.autoOff.armed || next.armedAt !== c.autoOff.armedAt) {
      rt.finishSince = 0;
      rt.stopTries = 0;
      rt.stoppedAt = 0;
      rt.lastStopTry = 0;
      rt.lastDrying = 0;
      rt.offFails = 0;
    }
    c.autoOff = next;
  }
  if (body?.dryOff && typeof body.dryOff === 'object') {
    const d = body.dryOff;
    const was = c.dryOff;
    c.dryOff = d.armed ? { armed: true, armedAt: was.armed ? was.armedAt : Number(d.armedAt) || Date.now() } : { armed: false, armedAt: 0 };
    if (!c.dryOff.armed) rt.dryLastAt = 0;
  }
  cfg = c;
  writeJson(cfgFile(), c);
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

type Fil = { type: string; colorHex: string; grams: number };

let st: HubState | null = null;
function state(): HubState {
  if (st) return st;
  const raw = readJsonWithPrev<any>(stateFile(), d => Boolean(d && typeof d === 'object'));
  st = { prints: {}, lastBackupDay: '', openKey: '', startChecked: false, warned: false, expectedMin: 0, pausedMs: 0, energy: {}, lastReportWeek: '', printWh: 0, ...(raw || {}) };
  return st!;
}
function saveState(): void {
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

interface PrinterPort extends QueuePort {
  stopDrying: () => Promise<boolean>;
  command: (cmd: 'pause' | 'resume' | 'stop') => Promise<unknown>;
  resumeAfterError: (code: number) => Promise<unknown>;
  /** Verzögerter Druck geplant (dann ist eine Pause gewollt) */
  delayedResume: () => number;
}
let port: PrinterPort | null = null;
export function attachPrinter(p: PrinterPort): void {
  port = p;
  attachQueue(p, (title, text) => push('done', title, text, { tag: 'queue' }));
  if (hubEnabled()) {
    haListen(ev => {
      queueEvent(ev);
      onAction(ev);
    });
    setTimeout(() => refreshLeds(), 20_000);
    // Neue Dateien aus Bambu Studio suchen: 1.231 alle 20-60 s statt alle 3 s (schont den Drucker), bei Änderung am Drucker sofort
    setInterval(() => void autoScanTick(), 5_000).unref();
  }
}

// ---------- Hilfen ----------

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const durText = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${Math.round(min)} min`);
const access = () => ({ cloudUrl: getHubConfig().cloudUrl, gistToken: getHubConfig().gistToken });
const deductActive = () => hubEnabled() && getHubConfig().deduct && cloudReady(access());
const powerActive = () => hubEnabled() && haAvailable();

let lastPush: { at: number; ok: boolean; text: string } | null = null;
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

function traysOf(d: any): TrayLite[] {
  const t: TrayLite[] = readTrays(d?.ams).map(x => ({ slot: x.slot, type: x.type, colorHex: x.colorHex, empty: x.empty }));
  const ext = readExternal(d?.vt_tray);
  if (ext && !ext.empty) t.push({ slot: ext.slot, type: ext.type, colorHex: ext.colorHex, empty: false });
  return t;
}

const mainSlotOf = (slots: Record<string, number>): number | null => {
  const e = Object.entries(slots || {}).sort((a, b) => b[1] - a[1])[0];
  return e ? Number(e[0]) : null;
};

const photoFile = (id: string) => path.join(photoDir(), crypto.createHash('sha1').update(id).digest('hex').slice(0, 24) + '.jpg');

export function readPhoto(id: string): Buffer | null {
  try {
    return fs.readFileSync(photoFile(id));
  } catch {
    return null;
  }
}

let lastJpeg: Buffer | null = null;

/** Aktuelles Kamerabild für eine Push-Meldung (/local/… über Home Assistant) */
async function snapshotForPush(): Promise<string | undefined> {
  let jpeg: Buffer | null = null;
  const lan = port?.getLanAccess();
  if (lan) {
    try {
      const r = await getPrinterFrame(lan.ip, lan.code);
      if (r.ok) jpeg = r.jpeg;
    } catch {
      /* dann HA */
    }
  }
  if (!jpeg && getHubConfig().cameraEntity) jpeg = await haCameraJpeg(getHubConfig().cameraEntity);
  if (!jpeg) return undefined;
  return publishImage(jpeg, `${crypto.randomBytes(8).toString('hex')}.jpg`) || undefined;
}

async function takePhoto(id: string): Promise<boolean> {
  let jpeg: Buffer | null = null;
  const lan = port?.getLanAccess();
  if (lan) {
    try {
      const r = await getPrinterFrame(lan.ip, lan.code);
      if (r.ok) jpeg = r.jpeg;
    } catch {
      /* dann Home Assistant */
    }
  }
  const cam = getHubConfig().cameraEntity;
  if (!jpeg && cam) jpeg = await haCameraJpeg(cam);
  if (!jpeg) return false;
  lastJpeg = jpeg;
  try {
    fs.mkdirSync(photoDir(), { recursive: true });
    writeFileAtomic(photoFile(id), jpeg);
    // Höchstens 200 Fotos behalten
    const files = fs.readdirSync(photoDir()).map(f => ({ f, t: fs.statSync(path.join(photoDir(), f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const x of files.slice(200)) fs.unlinkSync(path.join(photoDir(), x.f));
    return true;
  } catch {
    return false;
  }
}

/**
 * Gewichte eines Drucks. Reihenfolge (1.227):
 * 1. von der Warteschlange gestartet (Name oder Startzeit), 2. schon beim Druckstart geholt,
 * 3. Datei auf dem Drucker per Name, 4. ohne Namen: neueste Druckdatei vor dem Start.
 */
async function jobWeights(name: string, startMs = 0, tries = 3): Promise<{ filaments: Fil[]; fileName?: string } | null> {
  const generic = isGenericPrintName(name);
  const known = generic ? null : startedJobFilaments(name);
  if (known) return { filaments: known };
  const near = startedJobNear(startMs);
  if (near) return { filaments: near.filaments, fileName: near.name };
  const of = state().openFil;
  if (of && startMs && Math.abs(of.startMs - startMs) < 5 * 60_000 && of.filaments.length) return { filaments: of.filaments, fileName: of.name };
  const lan = port?.getLanAccess();
  if (!lan) return null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetchJobWeights({ ip: lan.ip, code: lan.code, jobName: generic ? '' : name, newestBefore: generic ? startMs || Date.now() : undefined });
      if (!('error' in r) && r.filaments.length) return { filaments: r.filaments, fileName: r.fileName };
    } catch {
      /* nochmal */
    }
    if (i < tries - 1) await sleep(20_000);
  }
  return null;
}

/** 1.227: Schätzung, wenn gar nichts bekannt ist: Gramm je Minute aus deinen letzten abgezogenen Drucken */
function gramsPerMinute(): number {
  const s = state();
  let g = 0;
  let min = 0;
  const recs = printRecorder.list();
  for (const [id, m] of Object.entries(s.prints)) {
    if (m.deduct !== 'done' || !m.parts?.length || m.estimated) continue;
    const r = recs.find(p => p.id === id);
    const dur = r ? (r.endMs - r.startMs) / 60000 : 0;
    if (!r || r.state !== 'FINISH' || dur < 5) continue;
    g += m.parts.reduce((a, p) => a + p.grams, 0);
    min += dur;
  }
  return min >= 30 ? g / min : 0;
}

// ---------- Druckende ----------

/** Vom Rekorder: ein Druck ist gerade zu Ende gegangen */
export function onPrintEnd(rec: RecordedPrint, data: any): void {
  if (!hubEnabled()) return;
  const s = state();
  if (s.prints[rec.id]) return; // schon bearbeitet
  s.prints[rec.id] = { deduct: deductActive() ? 'pending' : 'off', tries: 0, lastTry: 0, photo: false, pushed: false, trays: traysOf(data), energyWh: Math.round(s.printWh), at: Date.now() };
  s.printWh = 0;
  saveState();
  void handleEnd(rec);
}

async function handleEnd(rec: RecordedPrint): Promise<void> {
  const m = state().prints[rec.id];
  if (!m) return;
  m.photo = await takePhoto(rec.id);
  saveState();
  if (m.deduct === 'pending') {
    await sleep(60_000); // Druckdatei und Cloud kurz zur Ruhe kommen lassen
    await tryDeduct(rec);
  }
  await pushEnd(rec);
}

async function pushEnd(rec: RecordedPrint): Promise<void> {
  const m = state().prints[rec.id];
  if (!m || m.pushed) return;
  if (m.deduct === 'pending' || m.deduct === 'working') return; // Push kommt nach dem Abzug
  m.pushed = true;
  saveState();
  const dur = durText((rec.endMs - rec.startMs) / 60000);
  const image = m.photo && lastJpeg ? publishImage(lastJpeg, `${crypto.randomBytes(8).toString('hex')}.jpg`) || undefined : undefined;
  if (rec.state === 'FINISH') {
    const extra = m.deduct === 'done' && m.texts?.length ? `\nAbgezogen: ${m.texts.join(', ')}` : m.deduct === 'ask' ? '\nBitte in der App bestätigen: Spule abziehen?' : '';
    await push('done', '✅ Druck fertig', `${rec.name} · ${dur}${extra}`, { tag: `print-${rec.id}`, image });
  } else {
    await push('failed', '❌ Druck abgebrochen', `${rec.name} bei ${rec.percent} % · ${dur}\nIn der App: Spule anteilig abziehen?`, { tag: `print-${rec.id}`, image });
  }
}

/** Drucke, deren Abzug gerade läuft (nie zwei Versuche gleichzeitig, sonst könnte doppelt abgezogen werden) */
const inFlight = new Set<string>();

/** Alle Schreibvorgänge ins Cloud-Dokument nacheinander (Auto- und manueller Abzug dürfen nie gleichzeitig lesen → schreiben) */
let cloudChain: Promise<unknown> = Promise.resolve();
function withCloudLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = cloudChain.then(fn, fn);
  cloudChain = run.catch(() => undefined);
  return run;
}

/** Text „x g von Spule“ aus einem schon gespeicherten Server-Abzug (falls die Antwort beim Speichern verloren ging) */
function textsFromServerDeduct(doc: any, id: string): string[] {
  const sd = (Array.isArray(doc?.serverDeducts) ? doc.serverDeducts : []).find((d: any) => d?.id === id);
  if (!sd) return [];
  const spools: any[] = Array.isArray(doc?.spools) ? doc.spools : [];
  return (sd.parts || []).map((p: Part) => {
    const sp = spools.find(s => s.id === p.spoolId);
    const label = sp ? `${sp.brand || ''} ${sp.name || ''}`.trim() || 'Spule' : 'Spule';
    return `${Math.round(p.grams)} g von ${label}${sp ? ` (${Math.round(Number(sp.remainingWeight) || 0)} g übrig)` : ''}`;
  });
}

async function tryDeduct(rec: RecordedPrint): Promise<void> {
  if (inFlight.has(rec.id)) return;
  inFlight.add(rec.id);
  try {
    await tryDeductOnce(rec);
  } finally {
    inFlight.delete(rec.id);
  }
}

async function tryDeductOnce(rec: RecordedPrint): Promise<void> {
  const s = state();
  const m = s.prints[rec.id];
  if (!m || (m.deduct !== 'pending' && m.deduct !== 'working')) return;
  const c = getHubConfig();
  if (!deductActive()) {
    m.deduct = 'off';
    return saveState();
  }
  if (rec.state === 'FAILED') {
    m.deduct = 'ask';
    m.reason = 'abgebrochen';
    return saveState();
  }
  m.tries += 1;
  m.lastTry = Date.now();
  try {
    const jw = await jobWeights(rec.name, rec.startMs);
    const filaments = jw?.filaments || null;
    // Druck ohne Namen: Namen aus der Druckdatei übernehmen (Liste zeigt dann „Air_Up_Fake_Pod“ statt „Druckauftrag“)
    if (jw?.fileName && isGenericPrintName(rec.name)) {
      const nice = jw.fileName.replace(/\.(gcode\.3mf|3mf|gcode)$/i, '');
      printRecorder.setName(rec.id, nice);
      rec = { ...rec, name: nice };
    }
    if (filaments && !isGenericPrintName(rec.name)) {
      const total = Math.round(filaments.reduce((a, f) => a + f.grams, 0) * 10) / 10;
      const k = nameKey(rec.name);
      const { [k]: _old, ...rest } = c.jobGrams; // gleicher Name rückt ans Ende (= neuester), damit er beim Kürzen nicht rausfällt
      updateHubConfig({ jobGrams: { ...rest, [k]: total } });
    }
    // Gar nichts bekannt: nach Druckzeit schätzen (deine letzten Drucke), damit trotzdem abgezogen wird
    const durMin = (rec.endMs - rec.startMs) / 60000;
    const gpm = gramsPerMinute();
    const estimate = !filaments && !(Number(c.jobGrams[nameKey(rec.name)]) > 0) && gpm > 0 && durMin >= 3 ? Math.round(gpm * durMin) : 0;
    // Lesen → rechnen → schreiben ohne Lücke: kein anderer Abzug (manuell aus der App) dazwischen
    const res = await withCloudLock(async () => {
      if (m.deduct !== 'pending' && m.deduct !== 'working') return null; // inzwischen manuell erledigt
      const doc = await loadDoc(access());
      const spools = Array.isArray(doc?.spools) ? doc.spools : [];
      const parts = planParts({
        filaments,
        trays: m.trays || [],
        usedSlots: Object.keys(rec.slots || {}).map(Number),
        mainSlot: mainSlotOf(rec.slots),
        amsSlots: getHubConfig().amsSlots,
        spools,
        knownGrams: Number(getHubConfig().jobGrams[nameKey(rec.name)]) || estimate
      });
      if (!parts.length) {
        m.deduct = 'ask';
        m.reason = 'Gewicht unbekannt';
        saveState();
        return null;
      }
      m.estimated = Boolean(estimate) && !filaments && !(Number(getHubConfig().jobGrams[nameKey(rec.name)]) > 0);
      m.deduct = 'working';
      m.parts = parts;
      saveState();
      const before = new Map<string, number>(spools.map((x: any) => [String(x.id), Number(x.remainingWeight) || 0]));
      const r = applyDeduction(doc, rec, parts, Date.now());
      if (!r.ok) {
        // Schon vom Server gebucht (Antwort beim letzten Speichern verloren): als erledigt zählen, nicht als „übersprungen“
        if (deductedIn(doc, rec) === 'server') {
          m.deduct = 'done';
          m.texts = textsFromServerDeduct(doc, rec.id);
        } else {
          m.deduct = 'skip';
          m.reason = r.reason;
        }
        console.log(`[Hub] Kein neuer Abzug für ${rec.name}: ${r.reason}`);
        saveState();
        return null;
      }
      await saveDoc(access(), r.doc);
      m.deduct = 'done';
      m.texts = m.estimated ? [...r.texts, 'geschätzt nach Druckzeit, bitte prüfen'] : r.texts;
      saveState();
      return { r, parts, before };
    });
    if (!res) return;
    const { r, parts, before } = res;
    console.log(`[Hub] Abgezogen: ${rec.name}: ${r.texts.join(', ')}`);
    // Spule fast leer?
    const low = getHubConfig().lowWeightG;
    for (const sp of r.doc.spools as any[]) {
      const prev = before.get(sp.id);
      if (prev === undefined || !parts.some(p => p.spoolId === sp.id)) continue;
      if (low > 0 && prev > low && sp.remainingWeight <= low) {
        await push('low', '🧵 Spule fast leer', `${sp.brand || ''} ${sp.name || ''}: nur noch ${sp.remainingWeight} g übrig.`.trim(), `low-${sp.id}`);
      }
    }
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.warn(`[Hub] Abzug fehlgeschlagen (${m.tries}. Versuch): ${msg}`);
    if (m.deduct === 'working') {
      // Unklar, ob gespeichert wurde: beim nächsten Versuch prüft deductedIn die Cloud
      m.deduct = 'pending';
    }
    if (m.tries >= 5) {
      m.deduct = 'ask';
      m.reason = `Cloud: ${msg}`;
    }
    saveState();
  }
}

// ---------- Manueller Abzug (aus der App, läuft auf dem Pi) ----------

/** Vorschlag für den manuellen Abzug: Gewichte aus der Datei bzw. Warteschlange und passende Spulen */
export async function deductSuggest(p: { id: string; name: string; startMs?: number; endMs?: number }): Promise<{ filaments: { type: string; colorHex: string; grams: number }[] | null; parts: Part[] }> {
  // 1.227: auch ohne Namen (Startzeit → Warteschlange, beim Start geholte Gewichte, neueste Datei); sonst nach Druckzeit schätzen
  const rec = printRecorder.list().find(x => x.id === p.id);
  const startMs = Number(p.startMs) || rec?.startMs || 0;
  const filaments = (await jobWeights(p.name, startMs, 1))?.filaments || null;
  const dur = rec ? (rec.endMs - rec.startMs) / 60000 : Number(p.endMs) && startMs ? (Number(p.endMs) - startMs) / 60000 : 0;
  const est = !filaments && dur >= 3 ? Math.round(gramsPerMinute() * dur) : 0;
  const doc: any = cloudReady(access()) ? await loadDoc(access()).catch(() => ({})) : {};
  const spools = Array.isArray(doc?.spools) ? doc.spools : [];
  const m = state().prints[p.id];
  const trays = m?.trays?.length ? m.trays : traysOf(port?.getStatus().data || {});
  const parts = planParts({
    filaments,
    trays,
    usedSlots: [],
    mainSlot: null,
    amsSlots: getHubConfig().amsSlots,
    spools,
    knownGrams: Number(getHubConfig().jobGrams[nameKey(p.name)]) || est
  });
  return { filaments, parts };
}

/** Manuell abziehen: schreibt wie der Auto-Abzug in die Cloud (Spulen, Verlauf, Druckliste). Nie doppelt. */
export async function manualDeduct(p: PrintInfo, parts: Part[]): Promise<{ ok: boolean; text: string }> {
  if (!cloudReady(access())) return { ok: false, text: 'Am Pi ist der Cloud-Abgleich nicht eingerichtet.' };
  const clean = parts.filter(x => x && typeof x.spoolId === 'string' && Number(x.grams) > 0).map(x => ({ spoolId: x.spoolId, grams: Math.round(Number(x.grams) * 10) / 10 }));
  if (!clean.length) return { ok: false, text: 'Keine Spule mit Gramm angegeben.' };
  if (inFlight.has(p.id)) return { ok: false, text: 'Der Pi zieht diesen Druck gerade selbst ab. Gleich nochmal ansehen.' };
  return withCloudLock(async () => {
    const doc = await loadDoc(access());
    const r = applyDeduction(doc, p, clean, Date.now());
    if (!r.ok) return { ok: false, text: r.reason };
    await saveDoc(access(), r.doc);
    const m = state().prints[p.id];
    if (m) {
      m.deduct = 'done';
      m.texts = r.texts;
      m.resolved = true;
      saveState();
    }
    console.log(`[Hub] Manuell abgezogen: ${p.name}: ${r.texts.join(', ')}`);
    return { ok: true, text: `Abgezogen: ${r.texts.join(', ')}` };
  });
}

// ---------- Takt (alle 30 s) ----------

const rt = { finishSince: 0, stopTries: 0, stoppedAt: 0, lastStopTry: 0, lastDrying: 0, offFails: 0, dryLastAt: 0, lastTick: 0, busy: false };

export async function tick(now = Date.now()): Promise<void> {
  if (!hubEnabled() || !port || rt.busy) return;
  rt.busy = true;
  try {
    const status = port.getStatus();
    const live = Boolean(status.connected && status.receivingData !== false);
    const d = status.data || {};
    const gs = live ? String(d.gcode_state || '') : '';
    const dt = rt.lastTick ? Math.min(120_000, now - rt.lastTick) : 0;
    rt.lastTick = now;
    await retryDeducts(now);
    await energyTick(gs, now, dt);
    await goneWatch(live, now);
    if (live) await errorWatch(gs, d, now);
    if (live) await watchPrint(gs, d, now, dt);
    await autoOff(gs, d, live, now);
    await dryOff(gs, d, live, now);
    await dailyBackup(now);
    await weeklyTick(now);
    await espTick(now);
  } catch (e) {
    console.warn('[Hub] Takt-Fehler:', (e as Error)?.message || e);
  } finally {
    rt.busy = false;
  }
}

async function retryDeducts(now: number): Promise<void> {
  const s = state();
  for (const [id, m] of Object.entries(s.prints)) {
    if (inFlight.has(id)) continue; // läuft gerade
    if (m.deduct === 'working') {
      // Server war mitten im Abzug neu gestartet: in der Cloud nachsehen
      const rec = printRecorder.list().find(p => p.id === id);
      if (!rec) continue;
      try {
        const doc = await loadDoc(access());
        if (deductedIn(doc, rec)) {
          m.deduct = 'done';
          saveState();
          continue;
        }
      } catch {
        continue;
      }
      m.deduct = 'pending';
    }
    // 1.227: „Gewicht unbekannt“ (z. B. Druck ohne Namen) einmal neu versuchen, jetzt mit Startzeit, neuester Datei und Schätzung
    if (m.deduct === 'ask' && m.reason === 'Gewicht unbekannt' && !m.resolved && !m.retried && now - m.at < 2 * 86400_000) {
      m.retried = true;
      m.pushed = false; // danach kommt eine Meldung mit dem Ergebnis
      m.deduct = 'pending';
      m.tries = 0;
      m.lastTry = 0;
      m.at = Math.min(m.at, now - 3 * 60_000);
      saveState();
    }
    // Auch „noch nie versucht“ (Pi startete in der Minute nach dem Druckende neu): sonst bliebe der Abzug für immer liegen
    if (m.deduct === 'pending' && now - (m.lastTry || m.at) > 2 * 60_000) {
      const rec = printRecorder.list().find(p => p.id === id);
      // 1.231: nicht warten. Ein Abzug kann über 1 Minute dauern (Druckdatei per FTP, 3 Versuche) und hielt sonst den ganzen Takt auf
      // (Fehler-Push mit Knöpfen, „Aus nach Druck“). inFlight verhindert doppelte Versuche, withCloudLock doppeltes Schreiben.
      if (rec) void tryDeduct(rec).then(() => pushEnd(rec)).catch(e => console.warn('[Hub] Abzug im Hintergrund:', (e as Error)?.message || e));
    }
  }
}

async function watchPrint(gs: string, d: any, now: number, dt: number): Promise<void> {
  const s = state();
  const open = printRecorder.status().open;
  if (!open || !['RUNNING', 'PREPARE', 'PAUSE'].includes(gs)) return;
  const key = `${nameKey(open.name)}|${open.startMs}`;
  if (s.openKey !== key) {
    s.openKey = key;
    s.startChecked = false;
    s.warned = false;
    s.expectedMin = 0;
    s.pausedMs = 0;
    saveState();
  }
  if (gs === 'PAUSE') s.pausedMs += dt;
  const elapsedMin = Math.max(0, (now - open.startMs - s.pausedMs) / 60000);

  // Erwartete Dauer: aus früheren Drucken, sonst Schätzung des Druckers (vergangene + Restzeit)
  if (!s.expectedMin && gs === 'RUNNING' && Number(d.mc_percent) >= 2) {
    const remain = Number(d.mc_remaining_time) || 0;
    s.expectedMin = expectedMinutes(printRecorder.list(), open.name, remain > 0 ? elapsedMin + remain : 0);
    saveState();
  }

  // 8. Reicht das Filament? (einmal, kurz nach dem Start)
  if (!s.startChecked && gs === 'RUNNING') {
    s.startChecked = true;
    saveState();
    // Läuft nebenher: das Laden der Druckdatei (FTP, bis ca. 1 Minute) hält den Takt nicht auf („Aus nach Druck“, Fehler-Push …)
    void (async () => {
      try {
        const [jw, doc] = await Promise.all([jobWeights(open.name, open.startMs), cloudReady(access()) ? loadDoc(access()).catch(() => ({})) : Promise.resolve({} as any)]);
        const filaments = jw?.filaments || null;
        // 1.227: Gewichte jetzt merken, solange der Drucker sicher an ist (am Ende ist er evtl. schon aus)
        if (filaments) {
          state().openFil = { startMs: open.startMs, name: jw?.fileName || open.name, filaments };
          saveState();
        }
        const left = Math.max(0, 1 - (Number(d.mc_percent) || 0) / 100);
        const probs = shortages({
          filaments,
          trays: traysOf(d),
          amsSlots: getHubConfig().amsSlots,
          spools: Array.isArray(doc?.spools) ? doc.spools : [],
          mainSlot: activeSlotFromPrinter(d.ams),
          knownGrams: Number(getHubConfig().jobGrams[nameKey(open.name)]) || 0,
          left
        });
        if (probs.length) await push('warn', '⚠️ Filament reicht evtl. nicht', `${open.name}\n${probs.join('\n')}`, 'spool-check');
        // Material-Wächter: fehlt ein Material der Datei im ganzen AMS? Dann gleich am Anfang anhalten
        const missing = filaments && getHubConfig().materialGuard && elapsedMin < 10 ? missingMaterials(filaments, allTrays(d.ams, d.vt_tray)) : [];
        if (missing.length && port) {
          xt.ownPauseAt = Date.now();
          await port.command('pause').catch(() => undefined);
          await askToContinue('🛑 Falsches Material', `${open.name} braucht ${missing.join(', ')}, das steckt nicht im AMS. Druck angehalten.`, 0);
        }
      } catch (e) {
        console.warn('[Hub] Spulen-Check:', (e as Error)?.message || e);
      }
    })();
  }

  // Hängt der Druck? (Fortschritt und Schicht 30 Minuten gleich)
  const progKey = `${d.mc_percent}|${d.layer_num}`;
  if (progKey !== xt.progKey || gs !== 'RUNNING') {
    xt.progKey = progKey;
    xt.progAt = now;
  } else if (stalled(xt.progAt, now) && xt.stallWarned !== key) {
    xt.stallWarned = key;
    await askToContinue('🐌 Druck hängt?', `${open.name}: seit 30 Minuten kein Fortschritt (${d.mc_percent} %, Schicht ${d.layer_num}).`, 0);
  }

  // 7. Dauert viel länger als gewohnt?
  if (!s.warned && gs === 'RUNNING' && tooLong(elapsedMin, s.expectedMin)) {
    s.warned = true;
    saveState();
    await push('warn', '⏰ Druck dauert länger als gewohnt', `${open.name} läuft seit ${durText(elapsedMin)} (normal ca. ${durText(s.expectedMin)}). Bitte kurz nachsehen.`, 'print-long');
  }
}

async function autoOff(gs: string, d: any, live: boolean, now: number): Promise<void> {
  const c = getHubConfig();
  const a = c.autoOff;
  if (!a.armed || !haAvailable()) return;
  const disarm = () => setPower({ autoOff: { armed: false }, byServer: true });
  if (now - a.armedAt > 36 * 3600_000) return void disarm();
  if (live && gs === 'FAILED') {
    disarm();
    await push('warn', 'Nicht ausgeschaltet', `„${a.jobName || 'Druck'}“ ist fehlgeschlagen. Der Drucker bleibt an, damit du nachsehen kannst.`, 'auto-off');
    return;
  }
  if (live && ['RUNNING', 'PREPARE', 'PAUSE'].includes(gs) && a.jobName && d.subtask_name && nameKey(d.subtask_name) !== nameKey(a.jobName)) return void disarm();
  if (live && gs === 'FINISH') {
    if (!rt.finishSince) rt.finishSince = now;
  } else if (live) {
    rt.finishSince = 0;
  }
  if (!rt.finishSince) return;
  const drying = live && Number(d.ams?.ams?.[0]?.dry_time) > 0;
  if (drying) {
    rt.lastDrying = now;
    if (rt.stoppedAt && now - rt.stoppedAt < 60_000) return;
    if (rt.stoppedAt) {
      disarm();
      await push('warn', 'Drucker bleibt an', 'Du hast die Trocknung neu gestartet. „Aus nach Druck“ ist abgewählt.', 'auto-off');
      return;
    }
    if (rt.stopTries < 3 && now - rt.lastStopTry >= 60_000 && port) {
      rt.lastStopTry = now;
      rt.stopTries++;
      if (await port.stopDrying().catch(() => false)) rt.stoppedAt = now;
    }
    if (now - rt.finishSince < 30 * 60_000) return;
  } else if (rt.lastDrying && now - rt.lastDrying < 3 * 60_000) {
    return;
  }
  if (now - rt.finishSince < 3 * 60_000) return;
  // 1.227: erst ausschalten, wenn der Abzug durch ist (braucht evtl. noch die Druckdatei vom Drucker), höchstens 10 min warten
  const busy = Object.values(state().prints).some(m => (m.deduct === 'pending' || m.deduct === 'working') && now - m.at < 15 * 60_000);
  if (busy && now - rt.finishSince < 10 * 60_000) return;
  const ok = await haSwitch(c.switchEntity, false);
  if (ok) {
    disarm();
    rt.finishSince = 0;
    console.log('[Hub] Drucker nach Druck ausgeschaltet.');
    await push('done', '🔌 Drucker ausgeschaltet', `Nach „${a.jobName || 'Druck'}“ automatisch ausgeschaltet.`, 'auto-off');
  } else if (++rt.offFails >= 4) {
    disarm();
    await push('warn', 'Ausschalten fehlgeschlagen', 'Home Assistant hat die Steckdose nicht ausgeschaltet. Bitte selbst ausschalten.', 'auto-off');
  }
}

async function dryOff(gs: string, d: any, live: boolean, now: number): Promise<void> {
  const c = getHubConfig();
  if (!c.dryOff.armed || !haAvailable()) return;
  const dryingNow = live && Number(d.ams?.ams?.[0]?.dry_time) > 0;
  if (dryingNow) rt.dryLastAt = now;
  if (!rt.dryLastAt) return;
  const sw = await haState(c.switchEntity);
  const switchState = sw === 'on' || sw === 'off' ? sw : 'unknown';
  const act = dryOffAction({ armedAt: c.dryOff.armedAt, now, lastDryingAt: rt.dryLastAt, dryingNow, gcodeState: gs, switchState, settleMs: c.dryOffDelayMin * 60_000 });
  if (act === 'cancel-print' || act === 'cancel-socket-off') rt.dryLastAt = 0;
  if (act !== 'switch-off') return;
  rt.dryLastAt = 0;
  if (await haSwitch(c.switchEntity, false)) {
    console.log('[Hub] Nach Trocknen ausgeschaltet.');
    await push('done', '🔌 Trocknen fertig, Drucker aus', 'Die Trocknung ist zu Ende. Der Drucker wurde ausgeschaltet.', 'dry-off');
  } else {
    await push('warn', 'Ausschalten fehlgeschlagen', 'Nach dem Trocknen hat Home Assistant die Steckdose nicht ausgeschaltet.', 'dry-off');
  }
}

// ---------- Strom, Drucker weg, Fehler mit Knöpfen, Wochenbericht, ESP-Update ----------

const xt = { goneSince: 0, goneWarned: false, errKey: '', action: null as null | { nonce: string; code: number; at: number }, ownPauseAt: 0, progKey: '', progAt: 0, stallWarned: '', lastEsp: 0, espNotified: '' };

async function energyTick(gs: string, now: number, dt: number): Promise<void> {
  if (!haAvailable() || !dt) return;
  const w = await haPowerW(getHubConfig().switchEntity);
  if (w === null) return;
  const printing = ['RUNNING', 'PREPARE', 'PAUSE'].includes(gs);
  const s = state();
  s.energy = addEnergy(s.energy || {}, now, w, dt, printing);
  if (printing && dt <= 5 * 60_000) s.printWh = (s.printWh || 0) + (w * dt) / 3600_000;
  // 1.231: Strom nur alle 5 Minuten auf die SSD schreiben (vorher alle 30 s die ganze Zustandsdatei). Andere Änderungen speichern sofort mit.
  if (now - lastEnergySave >= 5 * 60_000) {
    lastEnergySave = now;
    saveState();
  }
}
let lastEnergySave = 0;

async function goneWatch(live: boolean, now: number): Promise<void> {
  const open = printRecorder.status().open;
  if (live || !open) {
    xt.goneSince = 0;
    xt.goneWarned = false;
    return;
  }
  if (!xt.goneSince) xt.goneSince = now;
  if (!xt.goneWarned && now - xt.goneSince >= 2 * 60_000) {
    xt.goneWarned = true;
    await push('warn', '📡 Drucker antwortet nicht', `Seit 2 Minuten keine Daten vom Drucker, obwohl „${open.name}“ lief (${open.percent} %). Strom, WLAN oder Absturz?`, { tag: 'printer-gone' });
  }
}

let hmsTable: { e: Record<string, string>; h: Record<string, string> } | null = null;
function errorText(code: number, hms: any[]): string {
  try {
    if (!hmsTable) hmsTable = JSON.parse(fs.readFileSync(path.join(rootDir, 'public', 'hms_de.json'), 'utf-8'));
  } catch {
    hmsTable = { e: {}, h: {} };
  }
  const hex = (n: number) => (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
  if (code) {
    const t = hmsTable!.e?.[hex(code)];
    if (t) return t;
  }
  for (const h of hms || []) {
    const k = hex(Number(h?.attr)) + hex(Number(h?.code));
    if (hmsTable!.h?.[k]) return hmsTable!.h[k];
  }
  return code ? `Fehler ${hex(code).slice(0, 4)}_${hex(code).slice(4)}` : 'Der Drucker hat angehalten.';
}

/** Drucker hält an (z. B. Objekt auf dem Bett, KI-Fehlererkennung, Spaghetti): Push mit Foto und Knöpfen „Weiter“ / „Abbrechen“ */
async function errorWatch(gs: string, d: any, now: number): Promise<void> {
  const code = Number(d.print_error) || 0;
  // Nur ernste HMS-Meldungen (Stufe 1-2), keine Hinweise
  const hms: any[] = (Array.isArray(d.hms) ? d.hms : []).filter((h: any) => {
    const lvl = Math.floor((Number(h?.code) >>> 0) / 0x10000);
    return lvl >= 1 && lvl <= 2;
  });
  const paused = gs === 'PAUSE';
  if (!paused || (!code && !hms.length) || port?.delayedResume()) {
    if (gs === 'RUNNING' || gs === 'IDLE' || gs === 'FINISH') xt.errKey = '';
    return;
  }
  if (now - xt.ownPauseAt < 3 * 60_000) return; // Material-Wächter hat selbst pausiert und schon gemeldet
  const key = `${state().openKey}|${code}|${hms.map(h => `${h?.attr}:${h?.code}`).join(',')}`;
  if (key === xt.errKey) return;
  xt.errKey = key;
  await askToContinue('⏸️ Drucker wartet', `${d.subtask_name || 'Druck'}: ${errorText(code, hms)}`, code);
}

async function askToContinue(title: string, text: string, code: number): Promise<void> {
  const nonce = crypto.randomBytes(5).toString('hex');
  xt.action = { nonce, code, at: Date.now() };
  const image = await snapshotForPush();
  await push('warn', title, `${text}\nWeiter = am Drucker bestätigen.`, {
    tag: 'printer-wait',
    image,
    actions: [
      { action: `FH_RESUME_${nonce}`, title: '▶️ Weiter' },
      { action: `FH_STOP_${nonce}`, title: '⏹️ Abbrechen' }
    ]
  });
}

/** Knopf in der Push-Meldung gedrückt */
function onAction(ev: { event_type: string; data: any }): void {
  if (ev.event_type !== 'mobile_app_notification_action') return;
  const m = String(ev.data?.action || '').match(/^FH_(RESUME|STOP)_([0-9a-f]+)$/);
  const a = xt.action;
  if (!m || !a || m[2] !== a.nonce || Date.now() - a.at > 6 * 3600_000) return;
  xt.action = null;
  void (async () => {
    const gs = String(port?.getStatus().data?.gcode_state || '');
    if (gs !== 'PAUSE') return void push('warn', 'Nichts zu tun', 'Der Drucker wartet nicht mehr.', { tag: 'printer-wait' });
    try {
      if (m[1] === 'RESUME') {
        await port!.resumeAfterError(a.code);
        await push('done', '▶️ Weiter', 'Der Druck läuft weiter.', { tag: 'printer-wait' });
      } else {
        await port!.command('stop');
        await push('done', '⏹️ Abgebrochen', 'Der Druck wurde abgebrochen.', { tag: 'printer-wait' });
      }
    } catch (e) {
      await push('warn', 'Hat nicht geklappt', `${(e as Error)?.message || e}. Bitte am Drucker bestätigen.`, { tag: 'printer-wait' });
    }
  })();
}

async function weeklyTick(now: number): Promise<void> {
  const d = new Date(now);
  const s = state();
  if (d.getDay() !== 0 || d.getHours() < 18 || s.lastReportWeek === weekKey(now)) return;
  s.lastReportWeek = weekKey(now);
  saveState();
  let doc: any = {};
  try {
    if (cloudReady(access())) doc = await loadDoc(access());
  } catch {
    doc = {};
  }
  const c = getHubConfig();
  const r = weeklyReport({
    now,
    prints: printRecorder.list(),
    history: Array.isArray(doc?.printHistory) ? doc.printHistory : [],
    spools: Array.isArray(doc?.spools) ? doc.spools : [],
    energy: s.energy?.[weekKey(now)],
    kwhPrice: c.kwhPrice,
    lowWeightG: c.lowWeightG
  });
  await push('done', r.title, r.text, { tag: 'weekly' });
}

async function espTick(now: number): Promise<void> {
  if (now - xt.lastEsp < 6 * 3600_000) return;
  xt.lastEsp = now;
  const r = await syncEspYaml();
  if (r.changed && r.info.revision && r.info.revision !== xt.espNotified) {
    xt.espNotified = r.info.revision;
    await push('warn', '🔧 ESP-Update bereit', `Neue AMS-ESP-Fassung (Revision ${r.info.revision}). Home Assistant → ESPHome → Filament AMS → Installieren → Drahtlos.`, { tag: 'esp-update' });
  }
}

/** Sofort prüfen (Knopf in der App) */
export async function espSyncNow() {
  xt.lastEsp = Date.now();
  return syncEspYaml();
}

export function energyWeeks(): { week: string; totalWh: number; printWh: number; cost: number }[] {
  const e = state().energy || {};
  const price = getHubConfig().kwhPrice;
  return Object.keys(e)
    .sort()
    .slice(-12)
    .map(k => ({ week: k, totalWh: Math.round(e[k].totalWh), printWh: Math.round(e[k].printWh), cost: Math.round((e[k].totalWh / 1000) * price * 100) / 100 }));
}

export async function weeklyReportNow(): Promise<{ title: string; text: string }> {
  let doc: any = {};
  try {
    if (cloudReady(access())) doc = await loadDoc(access());
  } catch {
    doc = {};
  }
  const c = getHubConfig();
  const now = Date.now();
  const r = weeklyReport({
    now,
    prints: printRecorder.list(),
    history: Array.isArray(doc?.printHistory) ? doc.printHistory : [],
    spools: Array.isArray(doc?.spools) ? doc.spools : [],
    energy: state().energy?.[weekKey(now)],
    kwhPrice: c.kwhPrice,
    lowWeightG: c.lowWeightG
  });
  await push('test', r.title, r.text, { tag: 'weekly' });
  return r;
}

// ---------- 10. Sicherung ----------

const dayOf = (t: number) => {
  const x = new Date(t);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export async function backupNow(now = Date.now()): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!cloudReady(access())) return { ok: false, error: 'Cloud nicht eingerichtet (App einmal mit dem Server abgleichen)' };
  try {
    const doc = await loadDoc(access());
    if (!doc || !Array.isArray(doc.spools)) return { ok: false, error: 'Cloud-Dokument ohne Spulen' };
    fs.mkdirSync(backupDir(), { recursive: true });
    const name = `filamenthub-${dayOf(now)}.json`;
    writeFileAtomic(path.join(backupDir(), name), JSON.stringify(doc));
    const files = listBackups();
    for (const f of files.slice(30)) fs.unlinkSync(path.join(backupDir(), f.name));
    state().lastBackupDay = dayOf(now);
    saveState();
    console.log(`[Hub] Sicherung ${name} (${doc.spools.length} Spulen)`);
    return { ok: true, name };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || String(e) };
  }
}

let lastBackupTry = 0;
async function dailyBackup(now: number): Promise<void> {
  if (state().lastBackupDay === dayOf(now) || new Date(now).getHours() < 3) return;
  if (!cloudReady(access()) || now - lastBackupTry < 30 * 60_000) return;
  lastBackupTry = now;
  await backupNow(now);
}

export function listBackups(): { name: string; size: number; at: number }[] {
  try {
    return fs
      .readdirSync(backupDir())
      .filter(f => /^filamenthub-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map(f => {
        const s = fs.statSync(path.join(backupDir(), f));
        return { name: f, size: s.size, at: s.mtimeMs };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
  } catch {
    return [];
  }
}

export function readBackup(name: string): string | null {
  if (!/^filamenthub-\d{4}-\d{2}-\d{2}\.json$/.test(name)) return null;
  try {
    return fs.readFileSync(path.join(backupDir(), name), 'utf-8');
  } catch {
    return null;
  }
}

// ---------- Status für die Apps ----------

function espInfoSafe() {
  const i = espInfoFn();
  return i ? { ok: i.ok, text: i.text, revision: i.revision } : null;
}

export function hubStatus() {
  const c = getHubConfig();
  const b = listBackups();
  return {
    enabled: hubEnabled(),
    ha: hubEnabled() && haAvailable(),
    cloud: cloudReady(access()),
    deduct: deductActive(),
    power: powerActive(),
    autoOff: c.autoOff,
    dryOff: c.dryOff,
    lastPush,
    backups: b.length,
    lastBackup: b[0]?.name || '',
    configAt: c.updatedAt,
    kwhPrice: c.kwhPrice,
    quietFrom: c.quietFrom,
    quietTo: c.quietTo,
    materialGuard: c.materialGuard,
    energyWeek: energyWeeks().slice(-1)[0] || null,
    esp: espInfoSafe()
  };
}

/** Nur für Tests */
export const _test = { tryDeduct, state: () => state() };
