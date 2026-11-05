// Alle Werte des AMS-ESP („Filament AMS“) in Home Assistant finden. Rein (ohne Netz), für App und Pi-Server.
// 1.206: Nicht nur über den festen Namen (sensor.filament_ams_…). Home Assistant behält alte Entitäts-IDs, wenn das Gerät
// früher anders hieß; neue Werte bekommen dann einen anderen Anfang. Darum über den Anzeigenamen suchen
// („Filament AMS Leser 1“): der folgt immer dem aktuellen Gerätenamen.

export interface AmsEntity {
  id: string;
  state: string;
  /** Anzeigename in Home Assistant */
  name: string;
  deviceClass: string;
  unit: string;
  /** Zeitpunkt der letzten Änderung (ms) */
  changed: number;
}

export interface AmsRoles {
  slot: Record<number, string>;
  reader: Record<number, string>;
  lastTag?: string;
  firmware?: string;
  ip?: string;
  wifi?: string;
  queue?: string;
  queueMode?: string;
  queueTest?: string;
  button?: string;
  boxHum?: string;
  boxTemp?: string;
  dryerHum?: string;
  dryerTemp?: string;
}

export interface AmsFound {
  /** Anfang der Slot-IDs, z. B. „filament_ams“ */
  base: string;
  /** Gerätename laut Anzeigename, z. B. „Filament AMS“ */
  devName: string;
  entities: AmsEntity[];
  roles: AmsRoles;
}

const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const toEntity = (x: any): AmsEntity => ({
  id: String(x?.entity_id || ''),
  state: String(x?.state ?? ''),
  name: String(x?.attributes?.friendly_name || ''),
  deviceClass: String(x?.attributes?.device_class || ''),
  unit: String(x?.attributes?.unit_of_measurement || ''),
  changed: Date.parse(String(x?.last_changed || '')) || 0
});

/** Den ESP in der Liste aller Zustände (/api/states) finden und jeden Wert einer Rolle zuordnen */
export function resolveAms(states: any[]): AmsFound | null {
  const all = (Array.isArray(states) ? states : []).map(toEntity).filter(x => x.id);
  // Slot-1-Sensor: zuerst mit „ams“ im Namen, sonst jeder „…slot_1_tag“
  const slot1 =
    all.find(x => /^sensor\.[a-z0-9_]*ams[a-z0-9_]*_slot_?1_tag$/.test(x.id)) ||
    all.find(x => /^sensor\.[a-z0-9_]+_slot_?1_tag$/.test(x.id)) ||
    all.find(x => /(^|\s)slot 1 tag$/i.test(x.name));
  if (!slot1) return null;
  const base = slot1.id.replace(/^sensor\./, '').replace(/_slot_?1_tag$/, '');
  const devName = slot1.name.replace(/\s*slot\s*1\s*tag\s*$/i, '').trim();
  const devKey = devName ? `${norm(devName)}_` : '';

  // Zum Gerät gehört: gleicher ID-Anfang oder gleicher Anzeigename-Anfang
  const entities = all.filter(x => x.id.includes(`.${base}_`) || (devKey && norm(x.name).startsWith(devKey)));

  // Rolle eines Werts: Teil nach dem Gerätenamen („leser_1“, „trockner_feuchte“ …), aus Anzeigename oder ID
  const keysOf = (x: AmsEntity): string[] => {
    const out: string[] = [];
    const n = norm(x.name);
    if (devKey && n.startsWith(devKey)) out.push(n.slice(devKey.length));
    const idRest = x.id.split('.')[1] || '';
    if (idRest.startsWith(`${base}_`)) out.push(idRest.slice(base.length + 1).replace(/_\d+$/, ''));
    return out;
  };
  const find = (domain: string, re: RegExp) => entities.find(x => x.id.startsWith(`${domain}.`) && keysOf(x).some(k => re.test(k)))?.id;

  const roles: AmsRoles = { slot: {}, reader: {} };
  for (const x of entities) {
    for (const k of keysOf(x)) {
      let m = k.match(/^slot_?(\d)_tag$/);
      if (m && x.id.startsWith('sensor.') && !roles.slot[Number(m[1])]) roles.slot[Number(m[1])] = x.id;
      m = k.match(/^leser_?(\d)$/);
      if (m && x.id.startsWith('sensor.') && !roles.reader[Number(m[1])]) roles.reader[Number(m[1])] = x.id;
    }
  }
  roles.lastTag = find('sensor', /^letzter_tag$/);
  roles.ip = find('sensor', /^ip(_adresse)?$/);
  roles.wifi = find('sensor', /^(wlan|wifi)_signal$/);
  roles.queue = find('number', /^warteschlange$/);
  roles.queueMode = find('number', /^warteschlange_modus$/);
  roles.queueTest = find('switch', /^warteschlange_test$/);
  roles.button = find('binary_sensor', /^platte_frei$/);
  roles.boxHum = find('sensor', /^box_(feuchte|luftfeuchte\w*|humidity)$/);
  roles.boxTemp = find('sensor', /^box_temp\w*$/);
  roles.dryerHum = find('sensor', /^trockner_(feuchte|luftfeuchte\w*|humidity)$/);
  roles.dryerTemp = find('sensor', /^trockner_temp\w*$/);
  // Feuchte/Temperatur ohne passenden Namen: nach Typ (ohne ESP-Innentemperatur), zwei Sensoren = Box und Trockner
  const text = (x: AmsEntity) => `${x.id} ${x.name}`.toLowerCase();
  const byClass = (cls: string, unit: string) => entities.filter(x => x.id.startsWith('sensor.') && (x.deviceClass === cls || x.unit === unit) && !/esp32|internal|intern|wlan|wifi/.test(text(x)));
  const room = (list: AmsEntity[], word: RegExp, other: RegExp) => list.find(x => word.test(text(x))) || (list.length === 2 ? list.find(x => !other.test(text(x))) : undefined);
  const box = /box/;
  const dry = /trockner|dryer|drying/;
  const hums = byClass('humidity', '%');
  const temps = byClass('temperature', '°C');
  roles.boxHum ||= room(hums, box, dry)?.id;
  roles.dryerHum ||= room(hums, dry, box)?.id;
  roles.boxTemp ||= room(temps, box, dry)?.id;
  roles.dryerTemp ||= room(temps, dry, box)?.id;
  // Firmware: nach Name, sonst Wert, der wie eine Revision aussieht („1.202“)
  roles.firmware =
    find('sensor', /^(firmware|fw_?rev\w*)$/) ||
    entities.find(x => x.id.startsWith('sensor.') && !x.deviceClass && !x.unit && /^\d\.\d{2,3}$/.test(x.state.trim()))?.id;
  return { base, devName, entities, roles };
}
