// AMS-ESP („Filament AMS“ in ESPHome) über Home Assistant ansprechen: fürs Testmenü.
// Alle Aufrufe über haFetch (direkt, sonst über den eigenen Server mit enger Freigabe).
import { haFetch } from './haAutoOff';

export interface AmsEntity {
  id: string;
  state: string;
  /** Anzeigename in Home Assistant */
  name: string;
  deviceClass: string;
  unit: string;
}

export interface AmsDevice {
  /** z. B. „filament_ams“ (aus sensor.filament_ams_slot_1_tag) */
  base: string;
  /** Alle Entitäten des Geräts (Name beginnt mit „<Art>.<base>_“) */
  entities: AmsEntity[];
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
      const entities: AmsEntity[] = all
        .filter(x => String(x?.entity_id || '').includes(`.${base}_`))
        .map(x => ({
          id: String(x.entity_id),
          state: String(x.state ?? ''),
          name: String(x.attributes?.friendly_name || ''),
          deviceClass: String(x.attributes?.device_class || ''),
          unit: String(x.attributes?.unit_of_measurement || '')
        }));
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

export const ids = (base: string, entities: AmsEntity[] = []) => {
  const d = defaultIds(base);
  const sensors = entities.filter(x => x.id.startsWith('sensor.'));
  const text = (x: AmsEntity) => `${x.id} ${x.name}`.toLowerCase();
  // Firmware: Sensor, dessen Wert wie eine Revision aussieht („1.202“), sonst nach Name
  const fw = sensors.find(x => !x.deviceClass && !x.unit && /^\d\.\d{2,3}$/.test(x.state.trim())) || sensors.find(x => /firmware|fw_?rev/.test(text(x)));
  const byClass = (cls: string, unit: string) => sensors.filter(x => (x.deviceClass === cls || x.unit === unit) && !/esp32|internal|intern/.test(text(x)));
  const pickRoom = (list: AmsEntity[], word: RegExp, other: RegExp) => list.find(x => word.test(text(x))) || (list.length === 2 ? list.find(x => !other.test(text(x))) : undefined);
  const hums = byClass('humidity', '%');
  const temps = byClass('temperature', '°C');
  const box = /box/;
  const dry = /trockner|dryer|drying/;
  return {
    ...d,
    firmware: fw?.id || d.firmware,
    queueTest: entities.find(x => x.id.startsWith('switch.') && /warteschlange_test/.test(x.id))?.id || d.queueTest,
    queue: entities.find(x => x.id.startsWith('number.') && /warteschlange$/.test(x.id))?.id || d.queue,
    boxHum: pickRoom(hums, box, dry)?.id || d.boxHum,
    boxTemp: pickRoom(temps, box, dry)?.id || d.boxTemp,
    dryerHum: pickRoom(hums, dry, box)?.id || d.dryerHum,
    dryerTemp: pickRoom(temps, dry, box)?.id || d.dryerTemp
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
