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
import { applyDeduction, deductedIn, expectedMinutes, planParts, shortages, tooLong, type Part, type TrayLite } from './deductPlan.js';
import { cloudReady, loadDoc, saveDoc } from './cloud.js';
import { haAvailable, haCameraJpeg, haPush, haState, haSwitch } from './ha.js';

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
  updatedAt: 0
};

const cfgFile = () => path.join(dataDir, 'hub-config.json');
const stateFile = () => path.join(dataDir, 'hub-state.json');
export const photoDir = () => path.join(dataDir, 'photos');
export const backupDir = () => path.join(dataDir, 'backups');

let cfg: HubConfig | null = null;

export function getHubConfig(): HubConfig {
  if (cfg) return cfg;
  try {
    const raw = JSON.parse(fs.readFileSync(cfgFile(), 'utf-8'));
    cfg = { ...DEFAULT_CFG, ...raw, push: { ...DEFAULT_CFG.push, ...(raw?.push || {}) } };
  } catch {
    cfg = { ...DEFAULT_CFG };
  }
  return cfg!;
}

function writeJson(file: string, v: unknown): void {
  try {
    fs.writeFileSync(file + '.tmp', JSON.stringify(v), 'utf-8');
    fs.renameSync(file + '.tmp', file);
  } catch (e) {
    console.warn('[Hub] Konnte nicht speichern:', (e as Error)?.message || e);
  }
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
const num = (v: unknown, lo: number, hi: number) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : undefined);

function cleanMap<T>(v: unknown, ok: (x: unknown) => x is T, maxKeys = 300): Record<string, T> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, T> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, maxKeys)) if (ok(x)) out[String(k).slice(0, 200)] = x;
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

export type DeductState = 'pending' | 'working' | 'done' | 'ask' | 'skip' | 'off';

export interface PrintMeta {
  deduct: DeductState;
  tries: number;
  lastTry: number;
  reason?: string;
  texts?: string[];
  parts?: Part[];
  photo: boolean;
  pushed: boolean;
  /** Fächer beim Druckende (für den Abzug) */
  trays?: TrayLite[];
  resolved?: boolean;
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
}

let st: HubState | null = null;
function state(): HubState {
  if (st) return st;
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile(), 'utf-8'));
    st = { prints: {}, lastBackupDay: '', openKey: '', startChecked: false, warned: false, expectedMin: 0, pausedMs: 0, ...raw };
  } catch {
    st = { prints: {}, lastBackupDay: '', openKey: '', startChecked: false, warned: false, expectedMin: 0, pausedMs: 0 };
  }
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

export interface PrinterPort {
  getStatus: () => { connected: boolean; receivingData?: boolean; data?: any };
  getLanAccess: () => { ip: string; code: string } | null;
  stopDrying: () => Promise<boolean>;
}
let port: PrinterPort | null = null;
export function attachPrinter(p: PrinterPort): void {
  port = p;
}

// ---------- Hilfen ----------

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const durText = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${Math.round(min)} min`);
const access = () => ({ cloudUrl: getHubConfig().cloudUrl, gistToken: getHubConfig().gistToken });
export const deductActive = () => hubEnabled() && getHubConfig().deduct && cloudReady(access());
export const powerActive = () => hubEnabled() && haAvailable();

let lastPush: { at: number; ok: boolean; text: string } | null = null;
export async function push(kind: keyof HubConfig['push'] | 'test', title: string, message: string, tag?: string): Promise<boolean> {
  if (!hubEnabled() || !haAvailable()) return false;
  if (kind !== 'test' && !getHubConfig().push[kind]) return false;
  const r = await haPush(process.env.NOTIFY_SERVICE || '', title, message, tag);
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
  try {
    fs.mkdirSync(photoDir(), { recursive: true });
    fs.writeFileSync(photoFile(id), jpeg);
    // Höchstens 200 Fotos behalten
    const files = fs.readdirSync(photoDir()).map(f => ({ f, t: fs.statSync(path.join(photoDir(), f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const x of files.slice(200)) fs.unlinkSync(path.join(photoDir(), x.f));
    return true;
  } catch {
    return false;
  }
}

async function jobWeights(name: string): Promise<{ type: string; colorHex: string; grams: number }[] | null> {
  const lan = port?.getLanAccess();
  if (!lan) return null;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetchJobWeights({ ip: lan.ip, code: lan.code, jobName: name });
      if (!('error' in r) && r.filaments.length) return r.filaments;
    } catch {
      /* nochmal */
    }
    await sleep(20_000);
  }
  return null;
}

// ---------- Druckende ----------

/** Vom Rekorder: ein Druck ist gerade zu Ende gegangen */
export function onPrintEnd(rec: RecordedPrint, data: any): void {
  if (!hubEnabled()) return;
  const s = state();
  if (s.prints[rec.id]) return; // schon bearbeitet
  s.prints[rec.id] = { deduct: deductActive() ? 'pending' : 'off', tries: 0, lastTry: 0, photo: false, pushed: false, trays: traysOf(data), at: Date.now() };
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
  if (rec.state === 'FINISH') {
    const extra = m.deduct === 'done' && m.texts?.length ? `\nAbgezogen: ${m.texts.join(', ')}` : m.deduct === 'ask' ? '\nBitte in der App bestätigen: Spule abziehen?' : '';
    await push('done', '✅ Druck fertig', `${rec.name} · ${dur}${extra}`, `print-${rec.id}`);
  } else {
    await push('failed', '❌ Druck abgebrochen', `${rec.name} bei ${rec.percent} % · ${dur}\nIn der App: Spule anteilig abziehen?`, `print-${rec.id}`);
  }
}

/** Drucke, deren Abzug gerade läuft (nie zwei Versuche gleichzeitig, sonst könnte doppelt abgezogen werden) */
const inFlight = new Set<string>();

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
    const filaments = await jobWeights(rec.name);
    if (filaments) {
      const total = Math.round(filaments.reduce((a, f) => a + f.grams, 0) * 10) / 10;
      updateHubConfig({ jobGrams: { ...c.jobGrams, [nameKey(rec.name)]: total } });
    }
    const doc = await loadDoc(access());
    const spools = Array.isArray(doc?.spools) ? doc.spools : [];
    const parts = planParts({
      filaments,
      trays: m.trays || [],
      usedSlots: Object.keys(rec.slots || {}).map(Number),
      mainSlot: mainSlotOf(rec.slots),
      amsSlots: getHubConfig().amsSlots,
      spools,
      knownGrams: Number(getHubConfig().jobGrams[nameKey(rec.name)]) || 0
    });
    if (!parts.length) {
      m.deduct = 'ask';
      m.reason = 'Gewicht unbekannt';
      return saveState();
    }
    m.deduct = 'working';
    m.parts = parts;
    saveState();
    const before = new Map<string, number>(spools.map((x: any) => [String(x.id), Number(x.remainingWeight) || 0]));
    const r = applyDeduction(doc, rec, parts, Date.now());
    if (!r.ok) {
      m.deduct = 'skip';
      m.reason = r.reason;
      console.log(`[Hub] Kein Abzug für ${rec.name}: ${m.reason}`);
      return saveState();
    }
    await saveDoc(access(), r.doc);
    m.deduct = 'done';
    m.texts = r.texts;
    saveState();
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
    if (live) await watchPrint(gs, d, now, dt);
    await autoOff(gs, d, live, now);
    await dryOff(gs, d, live, now);
    await dailyBackup(now);
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
    if (m.deduct === 'pending' && m.lastTry && now - m.lastTry > 2 * 60_000) {
      const rec = printRecorder.list().find(p => p.id === id);
      if (rec) {
        await tryDeduct(rec);
        await pushEnd(rec);
      }
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
    if (cloudReady(access())) {
      try {
        const [filaments, doc] = await Promise.all([jobWeights(open.name), loadDoc(access())]);
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
      } catch (e) {
        console.warn('[Hub] Spulen-Check:', (e as Error)?.message || e);
      }
    }
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
    fs.writeFileSync(path.join(backupDir(), name), JSON.stringify(doc), 'utf-8');
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
    configAt: c.updatedAt
  };
}

/** Nur für Tests */
export const _test = { tryDeduct, state: () => state() };
