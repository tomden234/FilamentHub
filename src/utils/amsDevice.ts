// AMS-ESP („Filament AMS“ in ESPHome) über Home Assistant ansprechen: fürs Testmenü.
// Alle Aufrufe über haFetch (direkt, sonst über den eigenen Server mit enger Freigabe).
import { haFetch } from './haAutoOff';

export interface AmsDevice {
  /** z. B. „filament_ams“ (aus sensor.filament_ams_slot_1_tag) */
  base: string;
  /** Alle Entitäten des Geräts (Name beginnt mit „<Art>.<base>_“) */
  entities: string[];
}

/** Gerät finden: Präfix der Slot-Sensoren */
export async function findAmsDevice(): Promise<AmsDevice | null> {
  const res = await haFetch('/api/states');
  if (!res.ok) throw new Error(`Home Assistant antwortet mit ${res.status}`);
  const all: any[] = await res.json();
  for (const s of all) {
    const m = String(s?.entity_id || '').match(/^sensor\.([a-z0-9_]*ams[a-z0-9_]*)_slot_?1_tag$/);
    if (m) {
      const base = m[1];
      const entities = all.map(x => String(x?.entity_id || '')).filter(id => id.includes(`.${base}_`));
      return { base, entities };
    }
  }
  return null;
}

export interface EntityState {
  state: string;
  changed: number;
  available: boolean;
}

export async function readEntity(id: string): Promise<EntityState | null> {
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

export const ids = (base: string, entities: string[] = []) => {
  const d = defaultIds(base);
  // Namen aus Home Assistant bevorzugen (z. B. mit „_2“ am Ende oder anderer Schreibweise)
  const pick = (dom: string, re: RegExp, fallback: string) => entities.find(id => id.startsWith(`${dom}.${base}_`) && re.test(id.slice(dom.length + 1 + base.length + 1))) || fallback;
  return {
    ...d,
    firmware: pick('sensor', /^(firmware|fw_?rev\w*)(_\d+)?$/, d.firmware),
    boxHum: pick('sensor', /^box_(feuchte|luftfeuchte\w*|humidity)(_\d+)?$/, d.boxHum),
    boxTemp: pick('sensor', /^box_temp\w*?(_\d+)?$/, d.boxTemp),
    dryerHum: pick('sensor', /^trockner_(feuchte|luftfeuchte\w*|humidity)(_\d+)?$/, d.dryerHum),
    dryerTemp: pick('sensor', /^trockner_temp\w*?(_\d+)?$/, d.dryerTemp)
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

export const setQueueCount = (base: string, n: number) => service('number', 'set_value', { entity_id: ids(base).queue, value: Math.max(0, Math.min(10, Math.round(n))) });
export const setQueueTest = (base: string, on: boolean) => service('switch', on ? 'turn_on' : 'turn_off', { entity_id: ids(base).queueTest });

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
