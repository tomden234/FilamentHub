// FilamentHub Server (Home-Assistant-Add-on): zeichnet Drucke rund um die Uhr auf. Die App holt die Liste und trägt Fehlendes nach.
import { safeStorage } from './safeStorage';
import type { HaPrint } from './haPrintHistory';
import { getHubInfo as getHubInfoLite, saveHubInfo } from './serverDeducts';
import { STORAGE_KEY_CLOUD_URL } from './storageKeys';
import { getGistToken, isGistUrl } from './gistStore';
import { isAutoDeductOn, readJobGrams } from './printUsage';
import { getHaCredentials } from './haClient';
import { getWorkshopSettings } from './workshopSettings';
import { SERVER_KEY_KEY, SERVER_URL_KEY, getServerKey, getServerUrl, normalizeServerUrl, serverBase } from './serverEndpoint';

export { getServerKey, getServerUrl, normalizeServerUrl };

const base = serverBase;

/** Gibt es einen Server zum Fragen? (eingetragener Pi oder die App kommt selbst vom Pi / aus der Windows-App) */
export const hasServer = (): boolean => base() !== null;

export function saveServer(url: string, key: string): void {
  safeStorage.setItem(SERVER_URL_KEY, normalizeServerUrl(url));
  safeStorage.setItem(SERVER_KEY_KEY, key.trim());
  try {
    window.dispatchEvent(new CustomEvent('filamenthub:ha-history-sync'));
  } catch {
    /* ohne Fenster egal */
  }
}

async function get(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<any> {
  const b = base();
  if (b === null) throw new Error('keine Adresse');
  const key = getServerKey();
  const headers: Record<string, string> = key ? { 'x-api-key': key } : {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${b}${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs || 8000)
  });
  if (res.status === 401) throw new Error('Schlüssel fehlt oder falsch. Er steht in Home Assistant → FilamentHub Server → Protokoll.');
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(`Antwort ${res.status}`);
  return res.json();
}

/** Stand des Abzugs auf dem Server: done = erledigt, ask = App soll fragen, pending/working = Server arbeitet noch, off/skip = App wie bisher */
export type ServerDeductState = 'pending' | 'working' | 'done' | 'ask' | 'skip' | 'off';

interface ServerPrint extends HaPrint {
  deduct: ServerDeductState;
  resolved: boolean;
  photo: boolean;
}

interface ServerPrints {
  /** Adresse eingetragen (oder eigener Server vorhanden) */
  configured: boolean;
  prints: ServerPrint[] | null;
  error?: string;
}

/** Drucke, die der Server aufgezeichnet hat (letzte 7 Tage). Wirft nie. */
export async function fetchServerPrints(now = Date.now()): Promise<ServerPrints> {
  const explicit = Boolean(getServerUrl());
  if (base() === null) return { configured: false, prints: null };
  try {
    const j = await get(`/api/recorder/prints?since=${now - 7 * 24 * 3600_000}`);
    if (!j?.success || !Array.isArray(j.prints)) throw new Error('unerwartete Antwort');
    if (j.hub) saveHubInfo(j.hub);
    const prints: ServerPrint[] = j.prints
      .filter((p: any) => p && typeof p.name === 'string' && Number.isFinite(Number(p.endMs)))
      .map((p: any) => ({
        name: p.name,
        startMs: Number(p.startMs) || Number(p.endMs),
        endMs: Number(p.endMs),
        state: p.state === 'FAILED' ? 'FAILED' : 'FINISH',
        percent: Number(p.percent) || (p.state === 'FAILED' ? 0 : 100),
        slots: p.slots && typeof p.slots === 'object' ? p.slots : {},
        trayRaw: '',
        deduct: (['pending', 'working', 'done', 'ask', 'skip', 'off'].includes(p.deduct) ? p.deduct : 'off') as ServerDeductState,
        resolved: Boolean(p.resolved),
        photo: Boolean(p.photo)
      }));
    return { configured: true, prints };
  } catch (e: any) {
    // Eigener Server ohne Adresse (z. B. Seite ohne Rekorder): still ignorieren
    return { configured: explicit, prints: null, error: `FilamentHub Server: ${String(e?.message || e)}` };
  }
}

/** 1.244: Dauer-Protokoll vom Pi (Start, Ende, Gramm je Material), ohne Obergrenze von 200 Drucken. Leer ohne Pi-Hub. */
export interface PiStatEntry {
  id: string;
  s: number;
  e: number;
  st: 'F' | 'X';
  g?: [string, string, number, string][];
}
export async function fetchPrintStats(): Promise<PiStatEntry[]> {
  if (base() === null) return [];
  try {
    const j = await get('/api/recorder/stats', { timeoutMs: 15000 });
    return j?.success && Array.isArray(j.items) ? j.items : [];
  } catch {
    return [];
  }
}

interface ServerCheck {
  ok: boolean;
  text: string;
}

/** Für „Prüfen“ in den Verbindungen */
export async function checkServer(): Promise<ServerCheck> {
  if (!getServerUrl()) return { ok: false, text: 'Keine Adresse eingetragen.' };
  try {
    const j = await get('/api/recorder/status');
    if (!j?.success || j.server !== 'filamenthub') throw new Error('kein FilamentHub Server');
    const printer = j.printerConnected ? (j.receivingData ? 'Drucker verbunden' : 'Drucker verbunden, aber aus') : 'Drucker nicht verbunden';
    const open = j.open ? ` · läuft: ${j.open.name} (${j.open.percent} %)` : '';
    if (j.hub) saveHubInfo(j.hub);
    if (j.hub?.enabled) await pushHubConfig(true).catch(() => undefined);
    const old = j.hub?.enabled ? '' : ' · Update verfügbar: Home Assistant → Apps → FilamentHub Server → Aktualisieren';
    return { ok: true, text: `Server erreichbar · ${printer} · ${j.count} Drucke gespeichert${open}${old}` };
  } catch (e: any) {
    const m = String(e?.message || e);
    return {
      ok: false,
      text: /Failed to fetch|NetworkError|Load failed|aborted|timeout/i.test(m)
        ? 'Server nicht erreichbar. Adresse prüfen, Gerät im Heimnetz oder Tailscale an? (Auf GitHub Pages geht nur https, dort bitte die Handy- oder Windows-App nutzen.)'
        : m
    };
  }
}

// ---------- Hub: Einstellungen an den Pi schicken, Steckdose, Foto, Push-Test, Sicherung ----------

const HUB_SENT_KEY = 'filamenthub_hub_sent';

function readSlots(): Record<string, string> {
  try {
    const v = JSON.parse(safeStorage.getItem('filamenthub_ams_slots_x2d') || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** Was der Pi braucht, um ohne App abzuziehen, zu schalten und zu warnen */
function hubConfigPayload() {
  const ha = getHaCredentials();
  const ws = getWorkshopSettings();
  const cloudUrl = safeStorage.getItem(STORAGE_KEY_CLOUD_URL) || '';
  return {
    cloudUrl,
    // Token nur schicken, wenn wirklich ein Gist genutzt wird (bei „pi:“ wird ein alter Token am Pi gelöscht)
    gistToken: isGistUrl(cloudUrl) ? getGistToken() : '',
    amsSlots: readSlots(),
    jobGrams: readJobGrams(),
    switchEntity: ha.switchEntity || '',
    cameraEntity: ha.cameraEntity || '',
    deduct: isAutoDeductOn(),
    lowWeightG: ws.lowWarning ? ws.lowWeightG : 0,
    dryOffDelayMin: ws.dryOffDelayMin,
    ...getHubSettings()
  };
}

// --- Einstellungen nur für den Pi (Strompreis, Ruhezeit, Material-Wächter) ---
const HUB_SETTINGS_KEY = 'filamenthub_hub_settings';
interface HubSettings {
  kwhPrice: number;
  quietFrom: number;
  quietTo: number;
  materialGuard: boolean;
  doubleAction: 'pause' | 'rotate' | 'none';
}
/** Strompreis: Durchschnitt Nürnberg Nov. 2026 (Grundversorgung 38,6 ct, günstige Tarife ca. 33 ct) */
const DEFAULT_HUB_SETTINGS: HubSettings = { kwhPrice: 0.35, quietFrom: 22, quietTo: 7, materialGuard: true, doubleAction: 'pause' };
export function getHubSettings(): HubSettings {
  try {
    return { ...DEFAULT_HUB_SETTINGS, ...(JSON.parse(safeStorage.getItem(HUB_SETTINGS_KEY) || '{}') || {}) };
  } catch {
    return { ...DEFAULT_HUB_SETTINGS };
  }
}
export function saveHubSettings(s: Partial<HubSettings>): HubSettings {
  const next = { ...getHubSettings(), ...s };
  safeStorage.setItem(HUB_SETTINGS_KEY, JSON.stringify(next));
  void pushHubConfig().catch(() => undefined);
  return next;
}

/** Einstellungen an den Pi schicken (nur wenn sich etwas geändert hat, außer force) */
export async function pushHubConfig(force = false): Promise<boolean> {
  // Nur an einen Pi mit Hub (nicht an den Server in der Windows-App)
  if (!hasServer() || !getHubInfoLite()?.enabled) return false;
  const payload = hubConfigPayload();
  const sig = JSON.stringify(payload);
  if (!force && safeStorage.getItem(HUB_SENT_KEY) === sig) return true;
  const j = await get('/api/hub/config', { method: 'POST', body: payload });
  if (!j?.success) return false;
  saveHubInfo(j);
  safeStorage.setItem(HUB_SENT_KEY, sig);
  return true;
}

/** „Aus nach Druck“ / „Aus nach Trocknen“ an den Pi melden */
export async function pushHubPower(power: { autoOff?: { armed: boolean; jobName?: string; armedAt?: number }; dryOff?: { armed: boolean; armedAt?: number } }): Promise<boolean> {
  if (!hasServer() || !getHubInfoLite()?.enabled) return false;
  try {
    const j = await get('/api/hub/power', { method: 'POST', body: power });
    return Boolean(j?.success);
  } catch {
    return false;
  }
}

/** Verzögerter Druck: auch der Pi setzt fort (Sicherheitsnetz, wenn alle Apps zu sind) */
export async function delayResumeOnServer(resumeAt: number): Promise<boolean> {
  // Ohne eingetragenen Pi macht das schon usePrintPlan über den eigenen Server
  if (!getServerUrl()) return false;
  try {
    const j = await get('/api/printer/delay-resume', { method: 'POST', body: { resumeAt } });
    return Boolean(j?.success);
  } catch {
    return false;
  }
}

/** Frage „Spule abziehen?“ beantwortet: andere Geräte fragen nicht mehr */
export async function resolveOnServer(id: string): Promise<void> {
  if (!hasServer() || !id) return;
  try {
    await get('/api/hub/resolve', { method: 'POST', body: { id } });
  } catch {
    /* egal */
  }
}

/** Foto vom Druckende, das der Pi gemacht hat */
export async function fetchServerPhoto(id: string): Promise<Blob | null> {
  const b = base();
  if (b === null || !getHubInfoLite()?.enabled) return null;
  try {
    const key = getServerKey();
    const res = await fetch(`${b}/api/recorder/photo?id=${encodeURIComponent(id)}`, { headers: key ? { 'x-api-key': key } : {}, signal: AbortSignal.timeout(10000) });
    if (!res.ok || !String(res.headers.get('content-type') || '').includes('image')) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/** Alle Test-Meldungen, die der Pi kennt (1.261) */
export async function pushTestKinds(): Promise<{ id: string; label: string }[]> {
  try {
    const j = await get('/api/hub/push-tests');
    return Array.isArray(j?.tests) ? j.tests : [];
  } catch {
    return [];
  }
}

export interface ServerReport {
  id: string;
  at: number;
  title: string;
  text: string;
  /** Adresse der Berichtsseite am Pi (leer, wenn der Pi seine Adresse noch nicht kennt) */
  url: string;
}

/** Letzte Wochenberichte vom Pi, neueste zuerst (1.261) */
export async function serverReports(): Promise<ServerReport[]> {
  try {
    const j = await get('/api/hub/reports');
    return Array.isArray(j?.reports) ? j.reports : [];
  } catch {
    return [];
  }
}

export async function testServerPush(kind = 'basic'): Promise<ServerCheck> {
  try {
    const j = await get('/api/hub/test-push', { method: 'POST', body: { kind }, timeoutMs: 30000 });
    if (j) saveHubInfo(j);
    if (!j?.enabled) return { ok: false, text: 'Der Server ist zu alt. In Home Assistant die App „FilamentHub Server“ aktualisieren.' };
    if (!j.ha) return { ok: false, text: 'Der Server erreicht Home Assistant nicht. App „FilamentHub Server“ aktualisieren und neu starten.' };
    if (!j.success && j.info && /^Noch kein/.test(j.info)) return { ok: false, text: j.info };
    return j.success ? { ok: true, text: j.info ? `Push gesendet mit: ${j.info}` : `Push gesendet ${j.lastPush?.text || ''}`.trim() } : { ok: false, text: `Kein Push: ${j.lastPush?.text || 'unbekannt'}. Ist die Home-Assistant-App auf dem Handy angemeldet?` };
  } catch (e: any) {
    return { ok: false, text: String(e?.message || e) };
  }
}

export interface ServerBackup {
  name: string;
  size: number;
  at: number;
}

export async function listServerBackups(): Promise<ServerBackup[]> {
  try {
    const j = await get('/api/hub/backups');
    return Array.isArray(j?.backups) ? j.backups : [];
  } catch {
    return [];
  }
}

export async function serverBackupNow(): Promise<ServerCheck> {
  try {
    await pushHubConfig(true);
    const j = await get('/api/hub/backup-now', { method: 'POST', body: {}, timeoutMs: 30000 });
    return j?.result?.ok ? { ok: true, text: `Gesichert: ${j.result.name}` } : { ok: false, text: `Sicherung fehlgeschlagen: ${j?.result?.error || 'unbekannt'}` };
  } catch (e: any) {
    return { ok: false, text: String(e?.message || e) };
  }
}

/** Sicherung herunterladen (als Datei) */
export async function downloadServerBackup(name: string): Promise<boolean> {
  const b = base();
  if (b === null) return false;
  try {
    const key = getServerKey();
    const res = await fetch(`${b}/api/hub/backup?name=${encodeURIComponent(name)}`, { headers: key ? { 'x-api-key': key } : {}, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch {
    return false;
  }
}

// ---------- Strom, Wochenbericht, ESP-Update ----------

export interface EnergyWeekInfo {
  week: string;
  totalWh: number;
  printWh: number;
  cost: number;
}

export async function fetchEnergyWeeks(): Promise<EnergyWeekInfo[]> {
  if (!hasServer() || !getHubInfoLite()?.enabled) return [];
  try {
    const j = await get('/api/hub/energy');
    return Array.isArray(j?.weeks) ? j.weeks : [];
  } catch {
    return [];
  }
}

export interface ServerWeek {
  /** 0 = diese Woche, 1 = letzte Woche … */
  offset: number;
  weekStart: number;
  title: string;
  text: string;
}

/** Letzte Wochen mit Text vom Pi (1.262) */
export async function serverWeeks(n = 8): Promise<ServerWeek[]> {
  try {
    const j = await get(`/api/hub/weeks?n=${n}`);
    return Array.isArray(j?.weeks) ? j.weeks : [];
  } catch {
    return [];
  }
}

export async function weeklyReportNow(offset = 0): Promise<ServerCheck> {
  try {
    const j = await get('/api/hub/report-now', { method: 'POST', body: { offset }, timeoutMs: 30000 });
    return j?.report ? { ok: true, text: `${j.report.title}\n${j.report.text}` } : { ok: false, text: 'Kein Bericht' };
  } catch (e: any) {
    return { ok: false, text: String(e?.message || e) };
  }
}

export async function espSyncNow(): Promise<ServerCheck> {
  try {
    const j = await get('/api/hub/esp-sync', { method: 'POST', body: {}, timeoutMs: 30000 });
    return { ok: Boolean(j?.success), text: String(j?.info?.text || 'unbekannt') + (j?.changed ? ' → In Home Assistant: ESPHome → Filament AMS → Installieren → Drahtlos.' : '') };
  } catch (e: any) {
    return { ok: false, text: String(e?.message || e) };
  }
}

// ---------- Warteschlange auf dem Pi ----------

export interface PiQueueItem {
  id: string;
  path: string;
  name: string;
  plate: number;
  filaments: { id: number; type: string; colorHex: string; grams: number }[];
  mapping: string[];
  missing: string[];
  addedAt: number;
  thumb?: boolean;
  /** 1.239: je Filament der Datei: Gramm, gewählter Platz und alle möglichen Plätze */
  slots?: PiQueueSlot[];
  /** 1.260: reicht die Spule im gewählten Platz? */
  enough?: PiQueueEnough[];
  /** 1.270: Platte und Düse der Datei, dazu was sich zum Druck davor ändert */
  setup?: { bed: string; nozzles: number[]; changes: string[] };
  /** 1.271: Zeit laut Slicer und berechnete Zeit (Sekunden), Faktor gelernt?, voraussichtlich fertig (ms) */
  /** 1.272: Teil einer Datei mit mehreren Platten */
  project?: { id: string; total: number; part: number };
  time?: { slicerSec: number; calcSec: number; learned: boolean; n: number; endAt?: number };
}

export interface PiQueueEnough {
  id: number;
  need: number;
  have: number | null;
  ok: boolean;
  spoolId: string;
  spoolLabel: string;
  missing: number;
  alternatives: { id: string; label: string; remaining: number; colorHex: string }[];
  buy?: { brand: string; material: string; name: string; colorName: string; url: string };
  /** 1.273: Temperatur der Datei weicht von der Spule ab */
  tempNote?: string;
}

export interface PiQueueSlot {
  id: number;
  type: string;
  colorHex: string;
  grams: number;
  tray: string;
  trayLabel: string;
  trayType: string;
  trayColor: string;
  auto: boolean;
  options: { key: string; label: string; type: string; colorHex: string }[];
}

export interface PrinterFile {
  path: string;
  name: string;
  size: number;
  time: number;
}

/** LED-Test an/aus: solange er läuft, ignoriert der Pi die Warteschlange; danach zeigt er sie sofort wieder (Fehler egal) */
export async function piQueueLedTest(on: boolean): Promise<void> {
  if (!hasServer() || !getHubInfoLite()?.enabled) return;
  try {
    await get('/api/hub/queue/ledtest', { method: 'POST', body: { on }, timeoutMs: 8000 });
  } catch {
    /* ohne Pi-Hub kein Halten nötig */
  }
}

/** Auswahl pro Filament speichern: tray = „amsId:slotId“, leer = automatisch */
export async function piQueuePick(id: string, filament: number, tray: string): Promise<{ ok: boolean; text?: string; items: PiQueueItem[] }> {
  try {
    const j = await get('/api/hub/queue/pick', { method: 'POST', body: { id, filament, tray }, timeoutMs: 20000 });
    return { ok: Boolean(j?.success), text: j?.text, items: Array.isArray(j?.items) ? j.items : [] };
  } catch (e: any) {
    return { ok: false, text: String(e?.message || e), items: [] };
  }
}

export async function piQueue(): Promise<{ items: PiQueueItem[]; auto: boolean } | null> {
  if (!hasServer() || !getHubInfoLite()?.enabled) return null;
  try {
    const j = await get('/api/hub/queue');
    return { items: Array.isArray(j?.items) ? j.items : [], auto: j?.auto !== false };
  } catch {
    return null;
  }
}

/** Neue Reihenfolge an den Pi schicken (Ziehen in der App) */
export async function piQueueReorder(ids: string[]): Promise<PiQueueItem[] | null> {
  try {
    const j = await get('/api/hub/queue/reorder', { method: 'POST', body: { ids }, timeoutMs: 20000 });
    return Array.isArray(j?.items) ? j.items : null;
  } catch {
    return null;
  }
}

const thumbCache = new Map<string, string>();
/** Titelbild eines Warteschlangen-Eintrags als Bild-Adresse (mit Schlüssel geholt, daher als Blob) */
export async function piQueueThumb(id: string): Promise<string | null> {
  const hit = thumbCache.get(id);
  if (hit) return hit;
  const b = base();
  if (b === null) return null;
  try {
    const key = getServerKey();
    const res = await fetch(`${b}/api/hub/queue/thumb/${id}`, { headers: key ? { 'x-api-key': key } : {}, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const url = URL.createObjectURL(await res.blob());
    thumbCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

export async function piQueueAuto(on: boolean): Promise<boolean> {
  try {
    const j = await get('/api/hub/queue/auto', { method: 'POST', body: { on }, timeoutMs: 20000 });
    return j?.auto !== false;
  } catch {
    return !on;
  }
}

export async function piPrinterFiles(): Promise<{ files: PrinterFile[]; error?: string }> {
  try {
    const j = await get('/api/hub/printer-files', { timeoutMs: 40000 });
    return j?.success ? { files: j.files || [] } : { files: [], error: j?.error || 'Fehler' };
  } catch (e: any) {
    return { files: [], error: String(e?.message || e) };
  }
}

/** 1.274: Datei-Archiv auf dem Pi */
export interface PiArchiveEntry {
  id: string;
  name: string;
  fileName: string;
  size: number;
  addedAt: number;
  lastUsed: number;
  printCount: number;
  fav: boolean;
  materials: string[];
  colors: string[];
  grams: number;
  sec: number;
  plates: { plate: number; grams: number; sec: number; types: string[] }[];
  bed?: string;
  nozzles?: number[];
  thumb: boolean;
}

export async function piArchiveList(): Promise<{ ok: boolean; items: PiArchiveEntry[]; bytes: number; error?: string }> {
  try {
    const j = await get('/api/hub/archive', { timeoutMs: 20000 });
    return j?.success ? { ok: true, items: j.items || [], bytes: Number(j.bytes) || 0 } : { ok: false, items: [], bytes: 0, error: j?.error || 'Fehler' };
  } catch (e: any) {
    return { ok: false, items: [], bytes: 0, error: String(e?.message || e) };
  }
}

export async function piArchiveAction(action: 'delete' | 'fav' | 'rename', body: Record<string, unknown>): Promise<PiArchiveEntry[] | null> {
  try {
    const j = await get(`/api/hub/archive/${action}`, { method: 'POST', body, timeoutMs: 20000 });
    return j?.success && Array.isArray(j.items) ? j.items : null;
  } catch {
    return null;
  }
}

/** Aus dem Archiv drucken (plate leer = alle Platten) */
export async function piArchivePrint(id: string, plate?: number): Promise<{ ok: boolean; text: string }> {
  try {
    const j = await get('/api/hub/archive/print', { method: 'POST', body: { id, plate }, timeoutMs: 90000 });
    return { ok: Boolean(j?.success), text: String(j?.text || j?.error || (j?.success ? 'Vorgemerkt.' : 'Fehler')) };
  } catch (e: any) {
    return { ok: false, text: String(e?.message || e) };
  }
}

const archiveThumbCache = new Map<string, string>();
export async function piArchiveThumb(id: string): Promise<string | null> {
  const hit = archiveThumbCache.get(id);
  if (hit) return hit;
  const b = base();
  if (b === null) return null;
  try {
    const key = getServerKey();
    const res = await fetch(`${b}/api/hub/archive/thumb/${id}`, { headers: key ? { 'x-api-key': key } : {}, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const url = URL.createObjectURL(await res.blob());
    archiveThumbCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

/** 1.273: Smart sortieren (apply=false: nur Vorschlag) */
export interface PiQueuePlan {
  order: string[];
  names: string[];
  changed: boolean;
  reasons: string[];
}
export async function piQueueOptimize(apply: boolean): Promise<{ ok: boolean; plan?: PiQueuePlan; text?: string; items: PiQueueItem[] }> {
  try {
    const j = await get('/api/hub/queue/optimize', { method: 'POST', body: { apply }, timeoutMs: 30000 });
    return { ok: Boolean(j?.success), plan: j?.plan, text: j?.error, items: Array.isArray(j?.items) ? j.items : [] };
  } catch (e: any) {
    return { ok: false, text: String(e?.message || e), items: [] };
  }
}

export async function piQueueAction(action: 'add' | 'remove' | 'move' | 'start' | 'refresh' | 'duplicate' | 'reprint', body: Record<string, unknown> = {}): Promise<{ ok: boolean; text?: string; items: PiQueueItem[] }> {
  try {
    const j = await get(`/api/hub/queue/${action}`, { method: 'POST', body, timeoutMs: 60000 });
    return { ok: Boolean(j?.success), text: j?.text || j?.error, items: Array.isArray(j?.items) ? j.items : [] };
  } catch (e: any) {
    return { ok: false, text: String(e?.message || e), items: [] };
  }
}

interface DeductSuggestion {
  filaments: { type: string; colorHex: string; grams: number }[] | null;
  parts: { spoolId: string; grams: number }[];
}

/** Manueller Abzug über den Pi: Vorschlag (Gramm aus der Datei, passende Spulen) */
export async function piDeductSuggest(p: { id: string; name: string; startMs?: number; endMs?: number }): Promise<DeductSuggestion | null> {
  try {
    const j = await get('/api/hub/deduct/suggest', { method: 'POST', body: p, timeoutMs: 90000 });
    return j?.success ? { filaments: j.filaments || null, parts: Array.isArray(j.parts) ? j.parts : [] } : null;
  } catch {
    return null;
  }
}

/** Manueller Abzug über den Pi: schreibt in die Cloud, nie doppelt */
export async function piDeductManual(p: { id: string; name: string; startMs: number; endMs: number; state: string; percent: number; parts: { spoolId: string; grams: number }[] }): Promise<{ ok: boolean; text: string }> {
  try {
    const j = await get('/api/hub/deduct/manual', { method: 'POST', body: p, timeoutMs: 30000 });
    return { ok: Boolean(j?.success), text: String(j?.text || '') };
  } catch (e: any) {
    return { ok: false, text: String(e?.message || e) };
  }
}

// 1.275: Bestell-Mails (Status ohne Passwort)
export interface OrderMailStatus {
  enabled: boolean;
  configured: boolean;
  gemini: boolean;
  account: string;
  lastCheck: number;
  lastOk: boolean;
  text: string;
  added: number;
  arrived: number;
}
export async function piOrderTest(): Promise<{ ok: boolean; text: string }> {
  try {
    const j = await get('/api/hub/orders/test', { method: 'POST', timeoutMs: 60000 });
    return j?.success ? { ok: Boolean(j.ok), text: String(j.text || '') } : { ok: false, text: 'Pi zu alt: Add-on aktualisieren' };
  } catch {
    return { ok: false, text: 'Pi nicht erreichbar' };
  }
}
export async function piOrderStatus(check = false): Promise<OrderMailStatus | null> {
  try {
    const j = await get(check ? '/api/hub/orders/check' : '/api/hub/orders', { method: check ? 'POST' : 'GET', timeoutMs: check ? 90000 : 15000 });
    return j?.success ? (j as OrderMailStatus) : null;
  } catch {
    return null;
  }
}

// 1.276/1.278: Produktseite am Pi suchen lassen (url null = nichts gefunden, error sagt warum)
export async function piProductLink(spec: { brand: string; material: string; name: string; colorName: string; refill?: boolean }): Promise<{ url: string | null; error?: string }> {
  try {
    const j = await get('/api/hub/product-link', { method: 'POST', body: spec, timeoutMs: 45000 });
    if (!j?.success) return { url: null, error: 'Pi zu alt: Add-on aktualisieren' };
    return { url: typeof j.url === 'string' ? j.url : null, error: j.error };
  } catch {
    return { url: null, error: 'Pi nicht erreichbar' };
  }
}
export interface ProductFillStatus {
  running: boolean;
  lastAt: number;
  filled: number;
  failed: number;
  open: number;
  text: string;
}
export async function piProductFill(run = false): Promise<ProductFillStatus | null> {
  try {
    const j = await get(run ? '/api/hub/product-links/run' : '/api/hub/product-links', { method: run ? 'POST' : 'GET', timeoutMs: run ? 60000 : 15000 });
    return j?.success ? (j as ProductFillStatus) : null;
  } catch {
    return null;
  }
}
