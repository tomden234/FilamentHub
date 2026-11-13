// Dashboard „Drucker“ in Home Assistant: Der Pi veröffentlicht die Druckerwerte als Sensoren (sensor.filamenthub_*) und legt das Dashboard
// samt Grafiken selbst an. Läuft nur im Add-on (Supervisor-Zugang). Das Dashboard wird nur neu gespeichert, wenn sich sein Aufbau ändert.
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../paths.js';
import { writeFileAtomic } from '../jsonConfig.js';
import { activeSlotFromPrinter } from '../../src/utils/amsMatch.js';
import { haAvailable, haDeleteState, haSetState, haStates, haWsCommand } from './ha.js';
import { publishAsset } from './esphome.js';
import { allTrays, trayLabel } from './hubLogic.js';
import { energyWeeks } from './watch.js';
import { port } from './core.js';
import { BACKGROUND_SVG } from './dashboardArt.js';
import { X2D_WEBP_BASE64 } from './dashboardPhoto.js';
import { ART_DIR, DASH_TITLE, DASH_URL, S, TRAY_PREFIX, buildDashboard, traySensorId } from './dashboardConfig.js';

const STATUS_TEXT: Record<string, string> = { RUNNING: 'Druckt', PAUSE: 'Pause', FINISH: 'Fertig', FAILED: 'Fehler', IDLE: 'Bereit', PREPARE: 'Vorbereitung', SLICING: 'Vorbereitung' };

// ---------- Sensoren ----------

const sent = new Map<string, { sig: string; at: number }>();
const REFRESH_MS = 5 * 60_000; // nach einem HA-Neustart sind die Sensoren weg: alle 5 min neu setzen

async function setSensor(entity: string, value: string | number, attrs: Record<string, unknown> = {}): Promise<void> {
  const sig = JSON.stringify([value, attrs]);
  const old = sent.get(entity);
  const now = Date.now();
  if (old && old.sig === sig && now - old.at < REFRESH_MS) return;
  if (await haSetState(entity, value, attrs)) sent.set(entity, { sig, at: now });
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v !== undefined && v !== null && v !== '' && Number.isFinite(n) ? n : null;
};

/** Druckerwerte als Sensoren setzen (Takt alle 30 s, doppelte Werte werden nicht gesendet) */
export async function publishSensors(): Promise<void> {
  if (!haAvailable() || !port) return;
  const st: any = port.getStatus();
  const live = Boolean(st?.connected && st?.receivingData !== false);
  const d = (live && st?.data) || {};
  const gs = String(d.gcode_state || '');
  const na = 'unavailable';
  const val = (v: unknown) => num(v) ?? na;
  await setSensor(S.status, live ? STATUS_TEXT[gs] || gs || 'Bereit' : 'Offline', { friendly_name: 'Drucker Status', icon: 'mdi:printer-3d' });
  await setSensor(S.job, live && d.subtask_name ? String(d.subtask_name).slice(0, 120) : '–', { friendly_name: 'Drucker Auftrag', icon: 'mdi:file-cad' });
  const running = ['RUNNING', 'PAUSE', 'PREPARE'].includes(gs);
  await setSensor(S.progress, live ? val(running ? d.mc_percent : gs === 'FINISH' ? 100 : 0) : na, { friendly_name: 'Drucker Fortschritt', unit_of_measurement: '%', icon: 'mdi:progress-clock' });
  await setSensor(S.remain, live && running ? val(d.mc_remaining_time) : live ? 0 : na, { friendly_name: 'Drucker Restzeit', unit_of_measurement: 'min', device_class: 'duration', icon: 'mdi:timer-sand' });
  await setSensor(S.layer, live ? (running ? `${num(d.layer_num) ?? 0}${num(d.total_layer_num) ? ` / ${num(d.total_layer_num)}` : ''}` : '–') : na, { friendly_name: 'Drucker Schicht', icon: 'mdi:layers' });
  await setSensor(S.nozzle, live ? val(d.nozzle_temper !== undefined ? Math.round(Number(d.nozzle_temper)) : undefined) : na, { friendly_name: 'Drucker Düse', unit_of_measurement: '°C', device_class: 'temperature', state_class: 'measurement' });
  await setSensor(S.bed, live ? val(d.bed_temper !== undefined ? Math.round(Number(d.bed_temper)) : undefined) : na, { friendly_name: 'Drucker Bett', unit_of_measurement: '°C', device_class: 'temperature', state_class: 'measurement' });

  // Spulen im AMS und extern
  const trays = live ? allTrays(d.ams, d.vt_tray) : [];
  const active = live ? activeSlotFromPrinter(d.ams) : null;
  const now = new Set<string>();
  let activeText = '–';
  for (const t of trays) {
    const label = trayLabel(t);
    const id = traySensorId(label);
    now.add(id);
    const isActive = t.amsId === 255 ? active === 5 : t.amsId === 0 && active === t.slotId + 1;
    if (isActive) activeText = `${label} (${t.type})`;
    await setSensor(id, t.type, { friendly_name: label, color: t.colorHex, icon: 'mdi:circle', active: isActive });
  }
  await setSensor(S.tray, live ? activeText : na, { friendly_name: 'Drucker Aktives Fach', icon: 'mdi:printer-3d-nozzle' });
  // Leere/entfernte Fächer verschwinden aus Home Assistant (nur wenn der Drucker erreichbar ist)
  if (live) {
    for (const id of [...sent.keys()]) {
      if (id.startsWith(TRAY_PREFIX) && !now.has(id)) {
        sent.delete(id);
        void haDeleteState(id);
      }
    }
  }

  // Strom der laufenden Woche
  const w = energyWeeks().slice(-1)[0];
  await setSensor(S.kwh, w ? Math.round(w.totalWh / 10) / 100 : 0, { friendly_name: 'Strom diese Woche', unit_of_measurement: 'kWh', device_class: 'energy', state_class: 'total', icon: 'mdi:flash' });
  await setSensor(S.cost, w ? w.cost : 0, { friendly_name: 'Kosten diese Woche', unit_of_measurement: '€', icon: 'mdi:currency-eur' });
}

// ---------- Dashboard anlegen / aktualisieren ----------

const keyFile = () => path.join(dataDir, 'hub-dashboard.json');
let lastKey = '';
let running = false;

function readKey(): string {
  try {
    return String(JSON.parse(fs.readFileSync(keyFile(), 'utf-8'))?.key || '');
  } catch {
    return '';
  }
}

export interface DashboardResult {
  ok: boolean;
  text: string;
  changed: boolean;
}

/** Dashboard „Drucker“ anlegen (falls es fehlt) und den Aufbau speichern, wenn er sich geändert hat. force = auch ohne Änderung neu speichern */
export async function ensureDashboard(force = false): Promise<DashboardResult> {
  if (!haAvailable()) return { ok: false, text: 'Home Assistant nicht erreichbar', changed: false };
  if (running) return { ok: true, text: 'läuft schon', changed: false };
  running = true;
  try {
    const states = await haStates();
    if (!states) return { ok: false, text: 'Zustände von Home Assistant nicht lesbar', changed: false };
    // Grafiken ablegen (nur bei neuem Inhalt geschrieben)
    const a = publishAsset('x2d.webp', Buffer.from(X2D_WEBP_BASE64, 'base64'));
    const b = publishAsset('hintergrund.svg', BACKGROUND_SVG);
    if (!a || !b) return { ok: false, text: 'www-Ordner von Home Assistant nicht beschreibbar (Add-on braucht homeassistant_config:rw)', changed: false };
    const config = buildDashboard(states);
    const key = createHash('sha1').update(JSON.stringify(config)).digest('hex').slice(0, 16);
    if (!lastKey) lastKey = readKey();
    if (!force && key === lastKey) return { ok: true, text: 'Dashboard aktuell', changed: false };

    const list = await haWsCommand({ type: 'lovelace/dashboards/list' });
    if (!list.ok) return { ok: false, text: `Dashboards nicht lesbar: ${list.error}`, changed: false };
    const exists = Array.isArray(list.result) && list.result.some((x: any) => x?.url_path === DASH_URL);
    if (!exists) {
      const c = await haWsCommand({ type: 'lovelace/dashboards/create', url_path: DASH_URL, title: DASH_TITLE, icon: 'mdi:printer-3d', show_in_sidebar: true, require_admin: false, mode: 'storage' });
      if (!c.ok) return { ok: false, text: `Dashboard anlegen: ${c.error}`, changed: false };
    }
    const s = await haWsCommand({ type: 'lovelace/config/save', url_path: DASH_URL, config });
    if (!s.ok) return { ok: false, text: `Dashboard speichern: ${s.error}`, changed: false };
    lastKey = key;
    writeFileAtomic(keyFile(), JSON.stringify({ key, at: Date.now(), url: `/${DASH_URL}`, art: ART_DIR }), { mode: 0o644 });
    console.log(`[Hub] Dashboard „${DASH_TITLE}“ ${exists ? 'aktualisiert' : 'angelegt'} (/${DASH_URL})`);
    return { ok: true, text: exists ? 'Dashboard aktualisiert' : 'Dashboard angelegt', changed: true };
  } catch (e) {
    return { ok: false, text: (e as Error)?.message || String(e), changed: false };
  } finally {
    running = false;
  }
}
