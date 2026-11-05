// Druckverlauf aus Home Assistant holen und fehlende Drucke nachtragen (Druckliste + Abzug), auch wenn keine App offen war.
// Home Assistant läuft rund um die Uhr und kennt den Druckstatus über die Bambu-Lab-Integration (ha-bambulab).
import { getHaCredentials } from './haClient';
import { haFetch } from './haAutoOff';
import { safeStorage } from './safeStorage';
import { addSystemLog } from './logService';
import { addPrintRecord, findPrint, getPrintLog } from './printLog';
import { PENDING_DEDUCT_KEY } from './printUsage';
import { isPrintDone, makePrintId, markPrintDone, type PrintSession } from './printSession';
import { extractPrints, findHistorySensors, parseHistory, type HaPrint, type HistorySensors } from './haPrintHistory';

const SENSORS_KEY = 'filamenthub_ha_hist_sensors';
const FIRST_KEY = 'filamenthub_ha_hist_first';
const INFO_KEY = 'filamenthub_ha_hist_info';
/** Wie weit zurück der Verlauf gelesen wird */
const WINDOW_MS = 7 * 24 * 3600_000;
/** Frisch beendete Drucke überlässt die offene App dem Live-Weg (sonst doppelte Meldungen) */
const MIN_AGE_MS = 3 * 60_000;
/** Abzug nachträglich nur für Drucke, die nach (erster Start dieser Funktion − 2 Tage) endeten */
const BACKFILL_MS = 2 * 24 * 3600_000;

export interface HaSyncInfo {
  at: number;
  ok: boolean;
  text: string;
  added: number;
}

export function getHaSyncInfo(): HaSyncInfo | null {
  try {
    return JSON.parse(safeStorage.getItem(INFO_KEY) || 'null');
  } catch {
    return null;
  }
}

const setInfo = (i: HaSyncInfo): HaSyncInfo => {
  safeStorage.setItem(INFO_KEY, JSON.stringify(i));
  return i;
};

function firstRun(): number {
  let v = Number(safeStorage.getItem(FIRST_KEY));
  if (!Number.isFinite(v) || v <= 0) {
    v = Date.now();
    safeStorage.setItem(FIRST_KEY, String(v));
  }
  return v;
}

async function loadSensors(): Promise<HistorySensors | null> {
  try {
    const c = JSON.parse(safeStorage.getItem(SENSORS_KEY) || 'null');
    if (c && c.sensors?.status && Date.now() - c.at < 6 * 3600_000) return c.sensors;
  } catch {
    /* neu suchen */
  }
  const res = await haFetch('/api/states');
  if (!res.ok) throw new Error(`Home Assistant antwortet mit ${res.status}`);
  const sensors = findHistorySensors(await res.json());
  if (sensors.status) safeStorage.setItem(SENSORS_KEY, JSON.stringify({ at: Date.now(), sensors }));
  return sensors.status ? sensors : null;
}

/** Aus dem HA-Verlauf gebaute Drucke der letzten 7 Tage (ohne Seiteneffekte) */
export async function fetchHaPrints(now = Date.now()): Promise<{ prints: HaPrint[]; sensors: HistorySensors | null }> {
  const sensors = await loadSensors();
  if (!sensors) return { prints: [], sensors: null };
  const ids = [sensors.status, sensors.name, sensors.tray, sensors.progress, sensors.start].filter(Boolean) as string[];
  const from = encodeURIComponent(new Date(now - WINDOW_MS).toISOString());
  const to = encodeURIComponent(new Date(now).toISOString());
  const res = await haFetch(`/api/history/period/${from}?filter_entity_id=${ids.join(',')}&end_time=${to}&minimal_response&no_attributes`);
  if (!res.ok) throw new Error(`Verlauf: Home Assistant antwortet mit ${res.status}`);
  const hist = parseHistory(await res.json());
  const get = (id?: string) => (id ? hist[id] || [] : []);
  return {
    sensors,
    prints: extractPrints({ status: get(sensors.status), names: get(sensors.name), trays: get(sensors.tray), progress: get(sensors.progress), starts: get(sensors.start) })
  };
}

export type HaEndHandler = (session: PrintSession, info: { state: 'FINISH' | 'FAILED'; missed: boolean; endMs: number }) => void;

/**
 * Fehlende Drucke nachtragen und den Abzug anstoßen. `onEnd` ist der gleiche Weg wie am Live-Druckende (useLanDeduct.handleEnd):
 * Gewicht bekannt und Druck fertig = automatisch, sonst kurze Frage „Spule abziehen?“.
 */
export async function syncHaPrints(onEnd: HaEndHandler, now = Date.now()): Promise<HaSyncInfo> {
  if (!getHaCredentials().token) return setInfo({ at: now, ok: false, text: 'Kein Home-Assistant-Token in der App.', added: 0 });
  const first = firstRun();
  let prints: HaPrint[];
  try {
    const r = await fetchHaPrints(now);
    if (!r.sensors) return setInfo({ at: now, ok: false, text: 'Kein Druckstatus-Sensor in Home Assistant gefunden (Bambu-Lab-Integration nötig).', added: 0 });
    prints = r.prints;
  } catch (e: any) {
    return setInfo({ at: now, ok: false, text: `Verlauf nicht lesbar: ${String(e?.message || e)}`, added: 0 });
  }

  let added = 0;
  let askedFailed = false;
  // Neueste zuerst durchsehen: bei Abbrüchen wird nur der neueste erfragt
  const todo = prints.filter(p => now - p.endMs >= MIN_AGE_MS).sort((a, b) => b.endMs - a.endMs);
  const fresh: { p: HaPrint; id: string }[] = [];
  for (const p of todo) {
    const id = makePrintId(p.name, p.startMs, 0);
    if (isPrintDone(id) || getPrintLog().some(r => r.id === id) || findPrint(p.name, p.endMs)) continue;
    fresh.push({ p, id });
  }
  for (const { p, id } of fresh.reverse()) {
    // Es wartet schon eine Frage „Spule abziehen?“: nichts überschreiben, nächster Lauf macht weiter
    if (safeStorage.getItem(PENDING_DEDUCT_KEY)) break;
    addPrintRecord({
      id,
      name: p.name,
      startMs: p.startMs,
      endMs: p.endMs,
      state: p.state,
      missed: true,
      percent: p.percent,
      durationMin: Math.round((p.endMs - p.startMs) / 60000)
    });
    markPrintDone(id);
    added++;
    addSystemLog('spule', 'Druck aus Home Assistant nachgetragen', `${p.name}: ${p.state === 'FINISH' ? 'fertig' : 'abgebrochen'}${p.trayRaw ? `, Fach laut HA „${p.trayRaw}“` : ''}`, 'info');
    if (p.endMs < first - BACKFILL_MS) continue; // zu alt für einen Abzug, nur in die Liste
    if (p.state === 'FAILED') {
      if (askedFailed) continue;
      askedFailed = true;
    }
    const session: PrintSession = {
      id,
      name: p.name,
      startMs: p.startMs,
      seenAt: p.endMs,
      midway: true,
      slots: p.slots,
      lastPercent: p.state === 'FINISH' ? 100 : p.percent,
      ended: true
    };
    // Fertig: Ende ist sicher bekannt (missed false = automatisch, wenn das Gewicht bekannt ist). Abbruch: immer fragen.
    onEnd(session, { state: p.state, missed: p.state === 'FAILED', endMs: p.endMs });
    await new Promise(r => setTimeout(r, 1500)); // Abzüge nacheinander, jeder braucht den neuen Spulenstand
  }
  return setInfo({ at: now, ok: true, text: added ? `${added} Druck${added === 1 ? '' : 'e'} nachgetragen.` : 'Alles auf dem neuesten Stand.', added });
}
