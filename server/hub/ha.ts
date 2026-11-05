// Home Assistant aus dem Server heraus ansprechen: im Add-on über den Supervisor (kein Token nötig),
// sonst über die gespeicherte HA-Verbindung (server/haConfig). Für Push-Meldungen, Steckdose und Kamera.
import { loadHaConfig } from '../haConfig.js';

interface Base {
  url: string;
  token: string;
}

function base(): Base | null {
  const sup = process.env.SUPERVISOR_TOKEN;
  if (sup) return { url: 'http://supervisor/core/api', token: sup };
  const c = loadHaConfig();
  if (c.isConfigured && c.haUrl && c.haToken) return { url: `${c.haUrl.replace(/\/+$/, '')}/api`, token: c.haToken };
  return null;
}

export const haAvailable = (): boolean => base() !== null;

async function call(path: string, init: { method?: string; body?: unknown; raw?: boolean } = {}): Promise<Response> {
  const b = base();
  if (!b) throw new Error('Home Assistant nicht erreichbar (kein Zugang)');
  return fetch(`${b.url}${path}`, {
    method: init.method || 'GET',
    headers: { Authorization: `Bearer ${b.token}`, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000)
  });
}

export async function haState(entity: string): Promise<string | null> {
  try {
    const r = await call(`/states/${encodeURIComponent(entity)}`);
    if (!r.ok) return null;
    const j: any = await r.json();
    return String(j?.state ?? '');
  } catch {
    return null;
  }
}

/** Alle Zustände (für die Suche nach den ESP-Werten) */
export async function haStates(): Promise<any[] | null> {
  try {
    const r = await call('/states');
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

export async function haService(domain: string, service: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    const r = await call(`/services/${domain}/${service}`, { method: 'POST', body: data });
    return r.ok;
  } catch {
    return false;
  }
}

/** Steckdose schalten (switch., light. oder input_boolean.) */
export async function haSwitch(entity: string, on: boolean): Promise<boolean> {
  const domain = entity.split('.')[0] || 'switch';
  return haService(domain === 'light' || domain === 'input_boolean' ? domain : 'switch', on ? 'turn_on' : 'turn_off', { entity_id: entity });
}

/** Kamerabild über Home Assistant */
export async function haCameraJpeg(entity: string): Promise<Buffer | null> {
  try {
    const r = await call(`/camera_proxy/${encodeURIComponent(entity)}`);
    if (!r.ok || !String(r.headers.get('content-type') || '').includes('image')) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

let targetsCache: { at: number; list: string[] } | null = null;

/** Ziele für Push: eingestellter Dienst, sonst alle Handys mit der Home-Assistant-App (notify.mobile_app_*) */
export async function notifyTargets(configured: string): Promise<string[]> {
  const c = configured.trim().replace(/^notify\./, '');
  if (c) return c.split(',').map(s => s.trim().replace(/^notify\./, '')).filter(Boolean);
  if (targetsCache && Date.now() - targetsCache.at < 3600_000) return targetsCache.list;
  try {
    const r = await call('/services');
    const j: any[] = r.ok ? await r.json() : [];
    const notify = j.find(d => d?.domain === 'notify');
    const names = Object.keys(notify?.services || {});
    const phones = names.filter(n => n.startsWith('mobile_app_'));
    const list = phones.length ? phones : names.includes('notify') ? ['notify'] : [];
    targetsCache = { at: Date.now(), list };
    return list;
  } catch {
    return [];
  }
}

export interface PushOptions {
  tag?: string;
  /** Lautlos (Ruhezeit) */
  silent?: boolean;
  /** Bild über Home Assistant (z. B. /local/filamenthub/x.jpg) */
  image?: string;
  /** Knöpfe in der Meldung (Home-Assistant-App) */
  actions?: { action: string; title: string }[];
}

/** Zusatzdaten für die Home-Assistant-App (Android und iPhone) */
export function pushData(o: PushOptions): Record<string, unknown> {
  return {
    group: 'filamenthub',
    ...(o.tag ? { tag: o.tag } : {}),
    ...(o.image ? { image: o.image } : {}),
    ...(o.actions?.length ? { actions: o.actions } : {}),
    // Android: eigener Kanal je Lautstärke; iPhone: passive Meldung = ohne Ton
    ...(o.silent ? { channel: 'FilamentHub leise', importance: 'low', push: { 'interruption-level': 'passive' } } : { channel: 'FilamentHub', importance: 'high', ttl: 0, priority: 'high' })
  };
}

export async function haPush(configured: string, title: string, message: string, opts: PushOptions | string = {}): Promise<{ ok: boolean; sent: string[] }> {
  const o: PushOptions = typeof opts === 'string' ? { tag: opts } : opts;
  const targets = await notifyTargets(configured);
  const sent: string[] = [];
  for (const t of targets) {
    const ok = await haService('notify', t, { title, message, data: pushData(o) });
    if (ok) sent.push(t);
  }
  return { ok: sent.length > 0, sent };
}

/** Zahl an einem ESPHome-/HA-Regler setzen (number.set_value) */
export async function haSetNumber(entity: string, value: number): Promise<boolean> {
  return haService('number', 'set_value', { entity_id: entity, value });
}

/** Leistung (W) der Steckdose: Attribut der Steckdose oder Sensor mit gleichem Namen (…_power / …_leistung) */
let powerEntity: { at: number; id: string | null } | null = null;
export async function haPowerW(switchEntity: string): Promise<number | null> {
  try {
    if (!powerEntity || Date.now() - powerEntity.at > 3600_000) {
      const r = await call('/states');
      const all: any[] = r.ok ? await r.json() : [];
      const sw = all.find(x => x?.entity_id === switchEntity);
      const attr = sw?.attributes?.current_power_w ?? sw?.attributes?.power;
      if (attr !== undefined && attr !== null && Number.isFinite(Number(attr))) powerEntity = { at: Date.now(), id: switchEntity };
      else powerEntity = { at: Date.now(), id: findPowerSensor(all, switchEntity) };
    }
    if (!powerEntity.id) return null;
    const r = await call(`/states/${encodeURIComponent(powerEntity.id)}`);
    if (!r.ok) return null;
    const j: any = await r.json();
    const v = powerEntity.id === switchEntity ? (j?.attributes?.current_power_w ?? j?.attributes?.power) : j?.state;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

/** Sensor für die Leistung zur Steckdose finden (gleicher Name, Einheit W) */
export function findPowerSensor(states: any[], switchEntity: string): string | null {
  const base = switchEntity.split('.')[1] || '';
  const watts = states.filter(x => String(x?.entity_id || '').startsWith('sensor.') && /^(W|kW)$/.test(String(x?.attributes?.unit_of_measurement || '')));
  const strip = (id: string) => id.replace(/^sensor\./, '').replace(/_(power|leistung|current_consumption|aktueller_verbrauch|energy_power|wirkleistung)$/, '');
  const same = watts.find(x => strip(x.entity_id) === base);
  if (same) return same.entity_id;
  const prefix = watts.find(x => base && String(x.entity_id).includes(base));
  return prefix ? prefix.entity_id : null;
}

// ---------- Ereignisse von Home Assistant (Knöpfe in Push-Meldungen, Taster am ESP) ----------

type EventHandler = (ev: { event_type: string; data: any }) => void;
let ws: any = null;
let wsHandlers: EventHandler[] = [];
let wsRetry: ReturnType<typeof setTimeout> | null = null;

/** Auf Home-Assistant-Ereignisse hören (Websocket, nur im Add-on). Verbindet sich bei Abbruch neu. */
export function haListen(handler: EventHandler): void {
  wsHandlers.push(handler);
  if (!ws) connectWs();
}

function connectWs(): void {
  const token = process.env.SUPERVISOR_TOKEN;
  const WS = (globalThis as any).WebSocket;
  if (!token || !WS) return;
  try {
    ws = new WS('ws://supervisor/core/websocket');
  } catch {
    ws = null;
    return;
  }
  let id = 1;
  ws.onmessage = (m: any) => {
    let j: any;
    try {
      j = JSON.parse(String(m.data));
    } catch {
      return;
    }
    if (j.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: token }));
    else if (j.type === 'auth_ok') {
      for (const ev of ['mobile_app_notification_action', 'state_changed']) ws.send(JSON.stringify({ id: id++, type: 'subscribe_events', event_type: ev }));
      console.log('[Hub] Home-Assistant-Ereignisse verbunden');
    } else if (j.type === 'event' && j.event) {
      for (const h of wsHandlers) {
        try {
          h(j.event);
        } catch {
          /* weiter */
        }
      }
    }
  };
  const retry = () => {
    ws = null;
    if (wsRetry) return;
    wsRetry = setTimeout(() => {
      wsRetry = null;
      connectWs();
    }, 30_000);
  };
  ws.onclose = retry;
  ws.onerror = () => {
    try {
      ws?.close();
    } catch {
      /* egal */
    }
  };
}
