// FilamentHub Server (Home-Assistant-Add-on): zeichnet Drucke rund um die Uhr auf. Die App holt die Liste und trägt Fehlendes nach.
import { safeStorage } from './safeStorage';
import { IS_NATIVE, IS_STATIC } from './env';
import type { HaPrint } from './haPrintHistory';
import { getHubInfo as getHubInfoLite, saveHubInfo } from './serverDeducts';
import { STORAGE_KEY_CLOUD_URL } from './storageKeys';
import { getGistToken } from './gistStore';
import { isAutoDeductOn, readJobGrams } from './printUsage';
import { getHaCredentials } from './haClient';
import { getWorkshopSettings } from './workshopSettings';

const URL_KEY = 'filamenthub_server_url';
const KEY_KEY = 'filamenthub_server_key';

/** „192.168.68.10“ → „http://192.168.68.10:3000“ */
export function normalizeServerUrl(v: string): string {
  let u = String(v || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  const host = u.replace(/^https?:\/\//i, '').split('/')[0];
  if (/^http:\/\//i.test(u) && !host.includes(':')) u += ':3000';
  return u;
}

export const getServerUrl = (): string => safeStorage.getItem(URL_KEY) || '';

/** Gibt es einen Server zum Fragen? (eingetragener Pi oder die App kommt selbst vom Pi / aus der Windows-App) */
export const hasServer = (): boolean => base() !== null;
export const getServerKey = (): string => safeStorage.getItem(KEY_KEY) || '';

export function saveServer(url: string, key: string): void {
  safeStorage.setItem(URL_KEY, normalizeServerUrl(url));
  safeStorage.setItem(KEY_KEY, key.trim());
  try {
    window.dispatchEvent(new CustomEvent('filamenthub:ha-history-sync'));
  } catch {
    /* ohne Fenster egal */
  }
}

/** Ohne eingetragene Adresse: nur der eigene Server (Windows-App, lokaler Server). Auf GitHub Pages und in der Handy-App gibt es keinen. */
function base(): string | null {
  const u = getServerUrl();
  if (u) return u;
  return IS_STATIC || IS_NATIVE ? null : '';
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
  if (res.status === 401) throw new Error('Schlüssel (API-Key) falsch');
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(`Antwort ${res.status}`);
  return res.json();
}

/** Stand des Abzugs auf dem Server: done = erledigt, ask = App soll fragen, pending/working = Server arbeitet noch, off/skip = App wie bisher */
export type ServerDeductState = 'pending' | 'working' | 'done' | 'ask' | 'skip' | 'off';

export interface ServerPrint extends HaPrint {
  deduct: ServerDeductState;
  resolved: boolean;
  photo: boolean;
}

export interface ServerPrints {
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

export interface ServerCheck {
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
export function hubConfigPayload() {
  const ha = getHaCredentials();
  const ws = getWorkshopSettings();
  return {
    cloudUrl: safeStorage.getItem(STORAGE_KEY_CLOUD_URL) || '',
    gistToken: getGistToken(),
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
export interface HubSettings {
  kwhPrice: number;
  quietFrom: number;
  quietTo: number;
  materialGuard: boolean;
}
/** Strompreis: Durchschnitt Nürnberg Nov. 2026 (Grundversorgung 38,6 ct, günstige Tarife ca. 33 ct) */
export const DEFAULT_HUB_SETTINGS: HubSettings = { kwhPrice: 0.35, quietFrom: 22, quietTo: 7, materialGuard: true };
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

export async function testServerPush(): Promise<ServerCheck> {
  try {
    const j = await get('/api/hub/test-push', { method: 'POST', body: {}, timeoutMs: 20000 });
    if (j) saveHubInfo(j);
    if (!j?.enabled) return { ok: false, text: 'Der Server ist zu alt. In Home Assistant die App „FilamentHub Server“ aktualisieren.' };
    if (!j.ha) return { ok: false, text: 'Der Server erreicht Home Assistant nicht. App „FilamentHub Server“ aktualisieren und neu starten.' };
    return j.success ? { ok: true, text: `Push gesendet ${j.lastPush?.text || ''}`.trim() } : { ok: false, text: `Kein Push: ${j.lastPush?.text || 'unbekannt'}. Ist die Home-Assistant-App auf dem Handy angemeldet?` };
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

export async function weeklyReportNow(): Promise<ServerCheck> {
  try {
    const j = await get('/api/hub/report-now', { method: 'POST', body: {}, timeoutMs: 30000 });
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
}

export interface PrinterFile {
  path: string;
  name: string;
  size: number;
  time: number;
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

export async function piQueueAction(action: 'add' | 'remove' | 'move' | 'start' | 'refresh', body: Record<string, unknown> = {}): Promise<{ ok: boolean; text?: string; items: PiQueueItem[] }> {
  try {
    const j = await get(`/api/hub/queue/${action}`, { method: 'POST', body, timeoutMs: 60000 });
    return { ok: Boolean(j?.success), text: j?.text || j?.error, items: Array.isArray(j?.items) ? j.items : [] };
  } catch (e: any) {
    return { ok: false, text: String(e?.message || e), items: [] };
  }
}
