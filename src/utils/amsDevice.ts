// AMS-ESP („Filament AMS“ in ESPHome) über Home Assistant ansprechen: fürs Testmenü.
// Alle Aufrufe über haFetch (direkt, sonst über den eigenen Server mit enger Freigabe).
import { haFetch } from './haAutoOff';
import { resolveAms, type AmsFound, type AmsRoles } from './amsEntities';

export type { AmsEntity, AmsRoles } from './amsEntities';
export type AmsDevice = AmsFound;

/** Gerät finden: alle Werte des ESP, auch wenn ihre IDs verschieden anfangen (siehe amsEntities.ts) */
export async function findAmsDevice(): Promise<AmsDevice | null> {
  const res = await haFetch('/api/states');
  if (!res.ok) throw new Error(`Home Assistant antwortet mit ${res.status}`);
  return resolveAms(await res.json());
}

export interface EntityState {
  state: string;
  changed: number;
  available: boolean;
}

async function readEntity(id: string): Promise<EntityState | null> {
  try {
    const r = await haFetch(`/api/states/${id}`);
    if (r.status === 404) return null;
    if (!r.ok) return null;
    const j: any = await r.json();
    const st = String(j?.state ?? '');
    return { state: st, changed: Date.parse(j?.last_changed || '') || 0, available: st !== 'unavailable' };
  } catch {
    return null;
  }
}

/** IDs aller Werte: gefundene Namen aus Home Assistant, sonst der übliche Name */
export const ids = (base: string, roles?: AmsRoles) => {
  const d = defaultIds(base);
  const r = roles || { slot: {}, reader: {} };
  return {
    slot: (n: number) => r.slot[n] || d.slot(n),
    reader: (n: number) => r.reader[n] || d.reader(n),
    lastTag: r.lastTag || d.lastTag,
    firmware: r.firmware || d.firmware,
    ip: r.ip || d.ip,
    wifi: r.wifi || d.wifi,
    queue: r.queue || d.queue,
    queueTest: r.queueTest || d.queueTest,
    button: r.button || d.button,
    boxHum: r.boxHum || d.boxHum,
    boxTemp: r.boxTemp || d.boxTemp,
    dryerHum: r.dryerHum || d.dryerHum,
    dryerTemp: r.dryerTemp || d.dryerTemp
  };
};

const defaultIds = (base: string) => ({
  slot: (n: number) => `sensor.${base}_slot_${n}_tag`,
  reader: (n: number) => `sensor.${base}_leser_${n}`,
  lastTag: `sensor.${base}_letzter_tag`,
  firmware: `sensor.${base}_firmware`,
  ip: `sensor.${base}_ip`,
  wifi: `sensor.${base}_wlan_signal`,
  queue: `number.${base}_warteschlange`,
  queueTest: `switch.${base}_warteschlange_test`,
  button: `binary_sensor.${base}_platte_frei`,
  boxHum: `sensor.${base}_box_feuchte`,
  boxTemp: `sensor.${base}_box_temperatur`,
  dryerTemp: `sensor.${base}_trockner_temperatur`,
  dryerHum: `sensor.${base}_trockner_feuchte`
});

async function service(domain: string, svc: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const r = await haFetch(`/api/services/${domain}/${svc}`, { method: 'POST', body: JSON.stringify(body) });
    return r.ok;
  } catch {
    return false;
  }
}

export const setQueueCount = (entity: string, n: number) => service('number', 'set_value', { entity_id: entity, value: Math.max(0, Math.min(10, Math.round(n))) });
export const setQueueTest = (entity: string, on: boolean) => service('switch', on ? 'turn_on' : 'turn_off', { entity_id: entity });

/** Tag-Nummer vom Handy („04:a1:…“) bewerten: liest der AMS-Leser ihn? */
export function judgeTag(serial: string): { bytes: number; ok: boolean; text: string } {
  const hex = String(serial || '').replace(/[^0-9a-fA-F]/g, '');
  const bytes = Math.floor(hex.length / 2);
  if (!bytes) return { bytes: 0, ok: false, text: 'Keine Nummer gelesen. Nochmal ans Handy halten.' };
  if (bytes === 7) return { bytes, ok: true, text: '7-Byte-Tag (NTAG): Den lesen die AMS-Leser.' };
  if (bytes === 4) return { bytes, ok: false, text: '4-Byte-Tag (z. B. MIFARE Classic): Die Leser ignorieren ihn absichtlich (wie Bambu-Chips). Bitte NTAG213/215/216 nehmen.' };
  return { bytes, ok: false, text: `${bytes}-Byte-Tag: unüblich, wird ignoriert. Bitte NTAG213/215/216 nehmen.` };
}

/** Text des Leser-Zustands verstehen */
export function judgeReader(st: string | undefined): 'ok' | 'bad' | 'unknown' {
  if (!st || st === 'unknown' || st === 'unavailable') return 'unknown';
  return st.startsWith('OK') ? 'ok' : 'bad';
}

// ---------- Nachtmodus der LED-Streifen (Werte liegen am ESP, damit er auch ohne App/Pi dimmt) ----------

export interface NightLed {
  on: boolean;
  from: number;
  to: number;
  pct: number;
  /** Gerade Nacht (Streifen gedimmt)? null = unbekannt */
  active: boolean | null;
  ids: { on: string; from: string; to: string; pct: string };
}

export const NIGHT_DEFAULT = { on: true, from: 21, to: 7, pct: 25 };

/** Nachtmodus-Werte vom ESP lesen. null = ESP hat noch keine Firmware mit Nachtmodus (oder nicht gefunden). */
export async function readNightLed(): Promise<NightLed | null> {
  const dev = await findAmsDevice();
  if (!dev) return null;
  const r = dev.roles;
  const base = dev.base;
  const idsOf = {
    on: r.nightOn || `switch.${base}_led_nachtmodus`,
    from: r.nightFrom || `number.${base}_led_nacht_ab`,
    to: r.nightTo || `number.${base}_led_nacht_bis`,
    pct: r.nightPct || `number.${base}_led_nacht_helligkeit`
  };
  const [on, from, to, pct, active] = await Promise.all([
    readEntity(idsOf.on),
    readEntity(idsOf.from),
    readEntity(idsOf.to),
    readEntity(idsOf.pct),
    readEntity(`binary_sensor.${base}_led_nacht_aktiv`)
  ]);
  if (!from || !to || !pct || !from.available) return null;
  const num = (e: EntityState | null, d: number) => (e && Number.isFinite(Number(e.state)) ? Math.round(Number(e.state)) : d);
  return {
    on: on ? on.state === 'on' : NIGHT_DEFAULT.on,
    from: num(from, NIGHT_DEFAULT.from),
    to: num(to, NIGHT_DEFAULT.to),
    pct: num(pct, NIGHT_DEFAULT.pct),
    active: active && active.available ? active.state === 'on' : null,
    ids: idsOf
  };
}

/** Einen Nachtmodus-Wert am ESP setzen */
export async function setNightLed(n: Pick<NightLed, 'ids'>, change: Partial<Pick<NightLed, 'on' | 'from' | 'to' | 'pct'>>): Promise<boolean> {
  const calls: Promise<boolean>[] = [];
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
  if (change.on !== undefined) calls.push(service('switch', change.on ? 'turn_on' : 'turn_off', { entity_id: n.ids.on }));
  if (change.from !== undefined) calls.push(service('number', 'set_value', { entity_id: n.ids.from, value: clamp(change.from, 0, 23) }));
  if (change.to !== undefined) calls.push(service('number', 'set_value', { entity_id: n.ids.to, value: clamp(change.to, 0, 23) }));
  if (change.pct !== undefined) calls.push(service('number', 'set_value', { entity_id: n.ids.pct, value: clamp(change.pct / 5, 1, 20) * 5 }));
  const r = await Promise.all(calls);
  return r.every(Boolean);
}

/** Ist zur Stunde h Nacht? (von 21 bis 7 = über Mitternacht; gleich = nie) – gleiche Regel wie am ESP */
export function isNightHour(h: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? h >= from && h < to : h >= from || h < to;
}
