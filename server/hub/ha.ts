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

export async function haPush(configured: string, title: string, message: string, tag?: string): Promise<{ ok: boolean; sent: string[] }> {
  const targets = await notifyTargets(configured);
  const sent: string[] = [];
  for (const t of targets) {
    const ok = await haService('notify', t, { title, message, data: { group: 'filamenthub', ...(tag ? { tag } : {}) } });
    if (ok) sent.push(t);
  }
  return { ok: sent.length > 0, sent };
}
