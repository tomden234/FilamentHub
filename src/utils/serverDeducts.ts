// Abzug durch den Pi-Server (Hub) und Schutz gegen doppeltes Abziehen.
// Der Server schreibt jeden Abzug in die Cloud (Spulen, Verlauf „srv:<Druck>:<Spule>“, Druckliste, serverDeducts).
// Die App übernimmt das beim Abgleich. Schreibt ein Gerät mit altem Stand die Cloud zurück, wendet reconcileServerDeducts
// den Abzug genau einmal neu an (gemerkt in „angewendet“, damit es auch nach Löschen des Verlaufs nie doppelt passiert).
import type { HistoryEntry, Spool } from '../types/filament';
import { safeStorage } from './safeStorage';
import { getPrintLog, samePrint } from './printLog';
import { alreadyDeducted } from './printUsage';

export interface ServerDeduct {
  id: string;
  name: string;
  endMs: number;
  parts: { spoolId: string; grams: number }[];
  at: number;
}

const CACHE_KEY = 'filamenthub_server_deducts';
const APPLIED_KEY = 'filamenthub_server_deducts_applied';
const HUB_KEY = 'filamenthub_hub_status';

export const historyIdOf = (printId: string, spoolId: string) => `srv:${printId}:${spoolId}`;

function readJson<T>(key: string, fb: T): T {
  try {
    const v = JSON.parse(safeStorage.getItem(key) || 'null');
    return v ?? fb;
  } catch {
    return fb;
  }
}

export const getAppliedServerDeducts = (): string[] => readJson<string[]>(APPLIED_KEY, []);
const getCachedServerDeducts = (): ServerDeduct[] => readJson<ServerDeduct[]>(CACHE_KEY, []);

export function cleanServerDeducts(v: unknown): ServerDeduct[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((d: any) => d && typeof d.id === 'string' && Array.isArray(d.parts))
    .map((d: any) => ({
      id: d.id,
      name: String(d.name || ''),
      endMs: Number(d.endMs) || 0,
      at: Number(d.at) || 0,
      parts: d.parts.filter((p: any) => p && typeof p.spoolId === 'string' && Number(p.grams) > 0).map((p: any) => ({ spoolId: p.spoolId, grams: Number(p.grams) }))
    }));
}

/** Reine Logik: fehlende Server-Abzüge anwenden. applied = alle Abzüge, die jetzt erledigt sind (neu angewendet oder schon im Verlauf). */
export function reconcileServerDeducts(
  spools: Spool[],
  history: HistoryEntry[],
  sds: ServerDeduct[],
  appliedBefore: string[],
  now: number = Date.now()
): { spools: Spool[]; history: HistoryEntry[]; applied: string[]; changed: boolean; texts: string[] } {
  const done = new Set(appliedBefore);
  const ids = new Set(history.map(h => h.id));
  let nextSpools = spools;
  const added: HistoryEntry[] = [];
  const texts: string[] = [];
  for (const sd of sds) {
    if (done.has(sd.id)) continue;
    // Älter als 3 Tage und hier nie gesehen: nur merken, nicht mehr anwenden (z. B. Verlauf woanders gelöscht)
    if (now - (sd.at || sd.endMs) > 3 * 86400_000) {
      done.add(sd.id);
      continue;
    }
    const inHistory = sd.parts.some(p => ids.has(historyIdOf(sd.id, p.spoolId)));
    if (!inHistory) {
      for (const p of sd.parts) {
        const sp = nextSpools.find(s => s.id === p.spoolId);
        if (!sp) continue;
        const rest = Math.max(0, Math.round((Number(sp.remainingWeight) || 0) - p.grams));
        nextSpools = nextSpools.map(s => (s.id === sp.id ? { ...s, remainingWeight: rest, sealed: false } : s));
        added.push({ id: historyIdOf(sd.id, sp.id), spoolId: sp.id, spoolLabel: `${sp.brand} ${sp.name}`, grams: Math.round(p.grams), timestamp: new Date(sd.endMs || sd.at || Date.now()).toISOString() });
        texts.push(`${Math.round(p.grams)} g von ${sp.brand} ${sp.name}`);
      }
    }
    done.add(sd.id);
  }
  return { spools: nextSpools, history: added.length ? [...added, ...history] : history, applied: Array.from(done).slice(-300), changed: added.length > 0, texts };
}

/** Nach dem Laden der Cloud: Server-Abzüge merken und gemerkte Liste speichern */
export function rememberServerDeducts(sds: ServerDeduct[], applied: string[]): void {
  safeStorage.setItem(CACHE_KEY, JSON.stringify(sds.slice(0, 150)));
  safeStorage.setItem(APPLIED_KEY, JSON.stringify(applied.slice(-300)));
}

/** Wurde dieser Druck schon abgezogen – vom Server, auf diesem oder einem anderen Gerät? */
export function printAlreadyDeducted(id: string | undefined, name: string, endMs: number): boolean {
  const p = { name, endMs };
  if (getCachedServerDeducts().some(d => d.id === id || samePrint(d, p, 10 * 60_000))) return true;
  if (getPrintLog().some(r => (r.id === id || samePrint(r, p, 10 * 60_000)) && r.grams > 0)) return true;
  return alreadyDeducted(name, endMs);
}

// --- Status des Hubs (vom Pi-Server), damit die App weiß, was der Server übernimmt ---

interface HubInfo {
  enabled: boolean;
  ha: boolean;
  cloud: boolean;
  deduct: boolean;
  power: boolean;
  lastPush?: { at: number; ok: boolean; text: string } | null;
  backups?: number;
  lastBackup?: string;
  energyWeek?: { week: string; totalWh: number; printWh: number; cost: number } | null;
  esp?: { ok: boolean; text: string; revision: string } | null;
  at: number;
}

export function saveHubInfo(h: any): void {
  if (!h || typeof h !== 'object') return;
  const info: HubInfo = {
    enabled: Boolean(h.enabled),
    ha: Boolean(h.ha),
    cloud: Boolean(h.cloud),
    deduct: Boolean(h.deduct),
    power: Boolean(h.power),
    lastPush: h.lastPush || null,
    backups: Number(h.backups) || 0,
    lastBackup: String(h.lastBackup || ''),
    energyWeek: h.energyWeek || null,
    esp: h.esp || null,
    at: Date.now()
  };
  safeStorage.setItem(HUB_KEY, JSON.stringify(info));
}

export function getHubInfo(): HubInfo | null {
  const h = readJson<HubInfo | null>(HUB_KEY, null);
  return h && typeof h.at === 'number' ? h : null;
}

const FRESH_MS = 3 * 3600_000;

/** Server zieht ab (zuletzt vor < 3 h bestätigt): die App zieht dann nicht selbst ab, sondern wartet auf den Server */
export function hubDeductActive(): boolean {
  const h = getHubInfo();
  return Boolean(h && h.deduct && Date.now() - h.at < FRESH_MS);
}

/** Pi schickt die Meldungen aufs Handy (über die Home-Assistant-App): der Hintergrund-Dienst der Android-App ist dann unnötig */
export function hubPushActive(): boolean {
  const h = getHubInfo();
  return Boolean(h && h.enabled && h.ha && Date.now() - h.at < FRESH_MS);
}

/** Server schaltet die Steckdose (Aus nach Druck / Trocknen): die App schaltet dann nicht zusätzlich */
function hubPowerActive(): boolean {
  const h = getHubInfo();
  return Boolean(h && h.power && Date.now() - h.at < FRESH_MS);
}

// --- Steckdose: Die App überlässt das Ausschalten dem Pi nur, wenn er den aktuellen Schalter-Stand sicher bekommen hat ---
const POWER_SENT_KEY = 'filamenthub_hub_power_sent';

export const powerSig = (kind: 'auto' | 'dry', armed: boolean, armedAt: number) => `${kind}:${armed ? 1 : 0}:${armedAt}`;

export function markHubPowerSent(sig: string): void {
  const kind = sig.split(':')[0];
  const cur = readJson<Record<string, string>>(POWER_SENT_KEY, {});
  cur[kind] = sig;
  safeStorage.setItem(POWER_SENT_KEY, JSON.stringify(cur));
}

/** Schaltet der Pi für diesen Schalter-Stand? (Server aktiv + Stand angekommen) */
export function hubHandlesPower(sig: string): boolean {
  if (!hubPowerActive()) return false;
  return readJson<Record<string, string>>(POWER_SENT_KEY, {})[sig.split(':')[0]] === sig;
}
