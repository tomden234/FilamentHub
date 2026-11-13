// Home-Assistant-Dashboard „Drucker“: reiner Bauplan (ohne Netz). Der Pi veröffentlicht die Sensoren (dashboard.ts), dieser Teil baut daraus die Karten.
// Aufbau: links Drucker mit AMS in den echten Spulenfarben und Warteschlange, Mitte Drucker-Werte, rechts Spulen, Lagerbox und Trockner.
import { resolveAms } from '../../src/utils/amsEntities.js';
import { ART_VERSION } from './dashboardArt.js';
import { SPOOL_X, spoolColor } from './dashboardAms.js';
import { ID, SLOTS } from './dashboardEditLogic.js';

export const DASH_URL = 'filamenthub-drucker'; // Home Assistant verlangt einen Bindestrich
export const DASH_TITLE = 'Drucker';
export const THEME = 'FilamentHub Glas';

/** Vom Pi gesetzte Sensoren (immer vorhanden, solange der Pi läuft) */
export const S = {
  status: 'sensor.filamenthub_status',
  job: 'sensor.filamenthub_auftrag',
  progress: 'sensor.filamenthub_fortschritt',
  remain: 'sensor.filamenthub_restzeit',
  layer: 'sensor.filamenthub_schicht',
  nozzle: 'sensor.filamenthub_duese',
  nozzle2: 'sensor.filamenthub_duese_2',
  bed: 'sensor.filamenthub_bett',
  tray: 'sensor.filamenthub_fach',
  kwh: 'sensor.filamenthub_strom_woche',
  cost: 'sensor.filamenthub_kosten_woche',
  queue: 'sensor.filamenthub_warteschlange'
} as const;

export const ART_DIR = '/local/filamenthub-dashboard';
export const TRAY_PREFIX = 'sensor.filamenthub_spule_';

/** Sensor-Id einer Spule am Drucker: „AMS 1 Slot 2“ → sensor.filamenthub_spule_ams_1_slot_2 */
export const traySensorId = (label: string): string => `${TRAY_PREFIX}${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;

const ids = (states: any[]) => (Array.isArray(states) ? states : []).map(x => String(x?.entity_id || '')).filter(Boolean);
const amsTray = (slot: number) => `${TRAY_PREFIX}ams_1_slot_${slot}`;

/** Farben der vier AMS-Plätze aus den Spulen-Sensoren (null = leer) */
export function trayColors(states: any[]): (string | null)[] {
  const by = new Map((Array.isArray(states) ? states : []).map(s => [String(s?.entity_id || ''), s]));
  return [1, 2, 3, 4].map(n => {
    const t = by.get(amsTray(n));
    return t ? spoolColor(t.attributes?.color) : null;
  });
}

/** Kamera des Druckers in Home Assistant (z. B. von der Bambu-Integration), falls vorhanden */
export function findCamera(states: any[]): string | null {
  const cams = ids(states).filter(i => i.startsWith('camera.'));
  return cams.find(i => /x2d|bambu|drucker|printer/.test(i) && !/cover|pic|bild|snapshot/.test(i)) || null;
}

type Seg = { from: number; color: string };
const gauge = (entity: string, name: string, min: number, max: number, segments: Seg[]) => ({ type: 'gauge', entity, name, min, max, needle: true, segments });

// Farben der Anzeigen (wie die Feuchte-Anzeige): kalt blau, normal grün, warm orange, heiß rot
const C = { blue: '#5aa9ff', green: '#3dd9b4', yellow: '#ffd166', orange: '#ffb347', red: '#f2557a' };
const NOZZLE: Seg[] = [{ from: 0, color: C.blue }, { from: 50, color: C.green }, { from: 180, color: C.orange }, { from: 260, color: C.red }];
const BED: Seg[] = [{ from: 0, color: C.blue }, { from: 35, color: C.green }, { from: 70, color: C.orange }, { from: 100, color: C.red }];
const PROGRESS: Seg[] = [{ from: 0, color: C.green }];
const HUM: Seg[] = [{ from: 0, color: C.green }, { from: 25, color: C.yellow }, { from: 30, color: C.red }];
const AIR: Seg[] = [{ from: 0, color: C.blue }, { from: 15, color: C.green }, { from: 40, color: C.orange }, { from: 60, color: C.red }];

/** Kleine Anzeigen nebeneinander (je ¼ Breite bei 4 Spalten) */
const small = (cards: any[], columns = 4) => ({ type: 'grid', columns, square: false, cards });

const PILL = { color: '#fff', 'font-size': '11px', 'font-weight': '700', 'text-shadow': '0 1px 3px #000', background: 'rgba(8,12,18,.62)', padding: '1px 8px', 'border-radius': '999px', 'white-space': 'nowrap' };

/** Druckerbild (AMS in den echten Farben, vom Pi gebaut) mit dem Material je Platz */
function printerPicture(states: any[], photoV: string) {
  const have = new Set(ids(states));
  const elements = SPOOL_X.flatMap((x, i) => (have.has(amsTray(i + 1)) ? [{ type: 'state-label', entity: amsTray(i + 1), style: { left: `${x}%`, top: '20.5%', ...PILL } }] : []));
  return { type: 'picture-elements', image: `${ART_DIR}/drucker.svg?v=${photoV}`, grid_options: { columns: 'full' }, elements };
}

/** Warteschlange wie in der App: Bild, Nummer, Name, Spulen je Filament, Zeit, Warnungen in Rot */
const QUEUE_MD = `{% set q = state_attr('${S.queue}', 'items') or [] %}{% if q | count == 0 %}Leer{% endif %}{% for i in q %}<table width="100%"><tr>{% if i.thumb %}<td width="64"><img src="{{ i.thumb }}" width="60"></td>{% endif %}<td><b>{{ loop.index }}. {{ i.name }}</b>{% for l in i.lines %}<br><font color="#cfe3e6">{{ l }}</font>{% endfor %}{% if i.time %}<br><font color="#bfe9ff">{{ i.time }}</font>{% endif %}{% for w in i.warn %}<br><font color="#ff8fa8"><b>{{ w }}</b></font>{% endfor %}</td></tr></table>
{% endfor %}`;

/** Dashboard-Aufbau aus der aktuellen Zustandsliste von Home Assistant. photoV = Kennung des Druckerbilds */
export function buildDashboard(states: any[], photoV = String(ART_VERSION)): { title: string; views: any[] } {
  const all = Array.isArray(states) ? states : [];
  const have = new Set(ids(all));
  const has = (id: string) => have.has(id);
  const rows = (list: { entity: string; name: string; icon?: string }[]) => list.filter(r => has(r.entity));

  // Links: Drucker (ohne Kasten) und Warteschlange
  const left: any[] = [printerPicture(all, photoV), { type: 'markdown', title: 'Warteschlange', content: QUEUE_MD }];

  // Mitte: Drucker-Werte (Temperatur-Anzeigen klein), Soll-Werte, live, Verlauf
  const mid: any[] = [
    small([gauge(S.progress, 'Fortschritt', 0, 100, PROGRESS), gauge(S.nozzle, 'Düse 1', 0, 320, NOZZLE), gauge(S.nozzle2, 'Düse 2', 0, 320, NOZZLE), gauge(S.bed, 'Bett', 0, 120, BED)])
  ];
  const soll = rows([
    { entity: ID.nozzleSoll, name: 'Düse 1 Soll (bis 300 °C)', icon: 'mdi:printer-3d-nozzle-heat' },
    { entity: ID.nozzle2Soll, name: 'Düse 2 Soll (bis 300 °C)', icon: 'mdi:printer-3d-nozzle-heat' },
    { entity: ID.bedSoll, name: 'Bett Soll (bis 120 °C)', icon: 'mdi:radiator' }
  ]);
  if (soll.length) mid.push({ type: 'entities', title: 'Soll-Temperatur', show_header_toggle: false, entities: soll });
  mid.push({
    type: 'entities',
    title: 'Drucker live',
    show_header_toggle: false,
    entities: [
      { entity: S.status, name: 'Status', icon: 'mdi:printer-3d' },
      { entity: S.job, name: 'Auftrag', icon: 'mdi:file-cad' },
      { entity: S.remain, name: 'Restzeit', icon: 'mdi:timer-sand' },
      { entity: S.layer, name: 'Schicht', icon: 'mdi:layers' },
      { entity: S.tray, name: 'Aktives Fach', icon: 'mdi:printer-3d-nozzle' },
      { entity: S.kwh, name: 'Strom diese Woche', icon: 'mdi:flash' },
      { entity: S.cost, name: 'Kosten diese Woche', icon: 'mdi:currency-eur' }
    ]
  });
  const cam = findCamera(all);
  if (cam) mid.push({ type: 'picture-entity', entity: cam, camera_view: 'auto', show_name: false, show_state: false });
  mid.push({ type: 'history-graph', title: 'Düsen & Bett (6 h)', hours_to_show: 6, entities: [{ entity: S.nozzle, name: 'Düse 1' }, { entity: S.nozzle2, name: 'Düse 2' }, { entity: S.bed, name: 'Bett' }] });

  // Rechts: Spule je Platz aus dem Lager wählen, Lagerbox und Trockner
  const right: any[] = [];
  const spoolRows = rows(SLOTS.map(s => ({ entity: ID.spool(s), name: s === 5 ? 'Extern:' : `Slot ${s}:`, icon: 'mdi:printer-3d-nozzle' })));
  if (spoolRows.length) right.push({ type: 'entities', title: 'Spulen', show_header_toggle: false, entities: spoolRows });
  const r = resolveAms(all)?.roles;
  if (r && (r.boxHum || r.dryerHum || r.boxTemp || r.dryerTemp)) {
    const hum = [r.boxHum && gauge(r.boxHum, 'Box Feuchte', 0, 100, HUM), r.dryerHum && gauge(r.dryerHum, 'Trockner Feuchte', 0, 100, HUM)].filter(Boolean);
    if (hum.length) right.push({ type: 'horizontal-stack', cards: hum });
    const temps = [r.boxTemp && gauge(r.boxTemp, 'Box Temp.', 0, 80, AIR), r.dryerTemp && gauge(r.dryerTemp, 'Trockner Temp.', 0, 80, AIR)].filter(Boolean) as any[];
    if (temps.length) {
      // Zwei kleine Anzeigen (je ¼) und daneben ein kleiner Verlauf
      const tGraph = { type: 'history-graph', title: 'Temperatur (24 h)', hours_to_show: 24, entities: [r.boxTemp, r.dryerTemp].filter(Boolean).map(e => ({ entity: e as string })) };
      right.push({ type: 'horizontal-stack', cards: [small(temps, 2), tGraph] });
    }
    const hist = [r.boxHum, r.dryerHum].filter(Boolean);
    if (hist.length) right.push({ type: 'history-graph', title: 'Feuchte (24 h)', hours_to_show: 24, entities: hist.map(e => ({ entity: e as string })) });
  }

  const section = (cards: any[]) => ({ type: 'grid', cards });
  return {
    title: DASH_TITLE,
    views: [
      {
        title: DASH_TITLE,
        path: 'drucker',
        icon: 'mdi:printer-3d',
        type: 'sections',
        max_columns: 3,
        dense_section_placement: true,
        theme: THEME,
        background: `center / cover no-repeat fixed url('${ART_DIR}/hintergrund.svg?v=${ART_VERSION}')`,
        sections: [section(left), section(mid), section(right)]
      }
    ]
  };
}
