// Home-Assistant-Dashboard „Drucker“: reiner Bauplan (ohne Netz). Der Pi veröffentlicht die Sensoren (dashboard.ts), dieser Teil baut daraus die Karten.
import { resolveAms } from '../../src/utils/amsEntities.js';
import { ART_VERSION } from './dashboardArt.js';
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
  bed: 'sensor.filamenthub_bett',
  tray: 'sensor.filamenthub_fach',
  kwh: 'sensor.filamenthub_strom_woche',
  cost: 'sensor.filamenthub_kosten_woche',
  queue: 'sensor.filamenthub_warteschlange'
} as const;

export const ART_DIR = '/local/filamenthub-dashboard';
/** Mitte der vier AMS-Köpfe im Foto (in % der Bildbreite) */
const PHOTO_SLOTS = [25, 40.1, 54.7, 68.5];
export const TRAY_PREFIX = 'sensor.filamenthub_spule_';

/** Sensor-Id einer Spule am Drucker: „AMS 1 Slot 2“ → sensor.filamenthub_spule_ams_1_slot_2 */
export const traySensorId = (label: string): string => `${TRAY_PREFIX}${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;

const ids = (states: any[]) => (Array.isArray(states) ? states : []).map(x => String(x?.entity_id || '')).filter(Boolean);

/** Kamera des Druckers in Home Assistant (z. B. von der Bambu-Integration), falls vorhanden */
export function findCamera(states: any[]): string | null {
  const cams = ids(states).filter(i => i.startsWith('camera.'));
  return cams.find(i => /x2d|bambu|drucker|printer/.test(i) && !/cover|pic|bild|snapshot/.test(i)) || null;
}

type Seg = { from: number; color: string };
const gauge = (entity: string, name: string, max: number, segments?: Seg[]) => ({
  type: 'gauge',
  entity,
  name,
  min: 0,
  max,
  needle: Boolean(segments),
  ...(segments ? { segments } : {})
});

// Farben der Anzeigen: Düse/Bett von kalt (blau) über warm (gelb) nach heiß (rot), Fortschritt grün, Feuchte grün/gelb/rot
const HEAT = (warm: number, hot: number): Seg[] => [{ from: 0, color: '#4cc9f0' }, { from: warm, color: '#ffd166' }, { from: hot, color: '#ef476f' }];
const GREEN: Seg[] = [{ from: 0, color: '#38d6b4' }];
const HUM: Seg[] = [{ from: 0, color: '#38d6b4' }, { from: 25, color: '#ffd166' }, { from: 30, color: '#ef476f' }];

const PILL = { color: '#fff', 'font-size': '11px', 'font-weight': '700', 'text-shadow': '0 1px 3px #000', background: 'rgba(8,12,18,.7)', padding: '1px 8px', 'border-radius': '999px', 'white-space': 'nowrap' };

/** Das X2D-Foto (Hintergrund durchsichtig) mit den Spulenfarben auf den AMS-Köpfen */
function printerPicture(trays: any[]) {
  const el: any[] = [];
  const byId = new Map<string, any>(trays.map(t => [String(t.entity_id), t]));
  const colorOf = (t: any) => (/^#[0-9a-fA-F]{6}$/.test(String(t?.attributes?.color || '')) ? String(t.attributes.color) : '#888888');
  PHOTO_SLOTS.forEach((x, i) => {
    const t = byId.get(`${TRAY_PREFIX}ams_1_slot_${i + 1}`);
    if (!t) return;
    el.push({ type: 'state-icon', entity: t.entity_id, icon: 'mdi:circle', title: String(t.attributes?.friendly_name || ''), style: { left: `${x}%`, top: '21.7%', color: colorOf(t), '--mdi-icon-size': '22px' } });
    el.push({ type: 'state-label', entity: t.entity_id, style: { left: `${x}%`, top: '27%', ...PILL } });
  });
  return { type: 'picture-elements', image: `${ART_DIR}/x2d.webp?v=${ART_VERSION}`, grid_options: { columns: 'full' }, elements: el };
}

const rows = (has: (id: string) => boolean, list: { entity: string; name: string; icon?: string }[]) => list.filter(r => has(r.entity));

/** Karte je Platz: Farb-Kachel und Eingabefelder (Material, Farbe, Gramm) */
function slotCard(slot: number, tray: any | undefined, has: (id: string) => boolean) {
  const label = slot === 5 ? 'Extern' : `Slot ${slot}`;
  const fields = rows(has, [
    { entity: ID.material(slot), name: 'Material', icon: 'mdi:layers-triple' },
    { entity: ID.color(slot), name: 'Farbe', icon: 'mdi:palette' },
    { entity: ID.grams(slot), name: 'Gramm', icon: 'mdi:weight-gram' }
  ]);
  const cards: any[] = [];
  if (tray) {
    const hex = /^#[0-9a-fA-F]{6}$/.test(String(tray.attributes?.color || '')) ? String(tray.attributes.color) : 'grey';
    cards.push({ type: 'tile', entity: tray.entity_id, name: label, icon: 'mdi:circle', color: hex, vertical: false });
  }
  if (fields.length) cards.push({ type: 'entities', show_header_toggle: false, ...(tray ? {} : { title: label }), entities: fields });
  return cards.length ? { type: 'vertical-stack', cards } : null;
}

/** Dashboard-Aufbau aus der aktuellen Zustandsliste von Home Assistant */
export function buildDashboard(states: any[]): { title: string; views: any[] } {
  const all = Array.isArray(states) ? states : [];
  const have = new Set(ids(all));
  const has = (id: string) => have.has(id);
  const trays = all.filter(x => String(x?.entity_id || '').startsWith(TRAY_PREFIX)).sort((x, y) => String(x.entity_id).localeCompare(String(y.entity_id)));
  const trayOf = (slot: number) => trays.find(t => t.entity_id === (slot === 5 ? `${TRAY_PREFIX}extern` : `${TRAY_PREFIX}ams_1_slot_${slot}`));

  // Links: Drucker (ohne Kasten, klein), Status, Warteschlange
  const left: any[] = [
    printerPicture(trays),
    {
      type: 'entities',
      title: 'Status',
      show_header_toggle: false,
      entities: [
        { entity: S.status, name: 'Status', icon: 'mdi:printer-3d' },
        { entity: S.job, name: 'Auftrag', icon: 'mdi:file-cad' },
        { entity: S.progress, name: 'Fortschritt', icon: 'mdi:progress-clock' },
        { entity: S.remain, name: 'Restzeit', icon: 'mdi:timer-sand' }
      ]
    },
    {
      type: 'markdown',
      title: 'Warteschlange',
      content: `{% set q = state_attr('${S.queue}', 'items') or [] %}{% for i in q %}**{{ loop.index }}. {{ i.name }}** · Platte {{ i.plate }}{% if i.time %} · {{ i.time }}{% endif %}\n\n{% else %}Leer\n{% endfor %}`
    }
  ];

  // Mitte: alle Drucker-Werte
  const mid: any[] = [{ type: 'horizontal-stack', cards: [gauge(S.progress, 'Fortschritt', 100, GREEN), gauge(S.nozzle, 'Düse', 350, HEAT(60, 230)), gauge(S.bed, 'Bett', 120, HEAT(40, 80))] }];
  const soll = rows(has, [
    { entity: ID.nozzleSoll, name: 'Düse Soll (bis 300 °C)', icon: 'mdi:printer-3d-nozzle-heat' },
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
      { entity: S.tray, name: 'Aktives Fach', icon: 'mdi:printer-3d-nozzle' }
    ]
  });
  const cam = findCamera(all);
  if (cam) mid.push({ type: 'picture-entity', entity: cam, camera_view: 'auto', show_name: false, show_state: false });
  mid.push({
    type: 'horizontal-stack',
    cards: [
      { type: 'sensor', entity: S.nozzle, name: 'Düse', graph: 'line', detail: 2, hours_to_show: 6 },
      { type: 'sensor', entity: S.bed, name: 'Bett', graph: 'line', detail: 2, hours_to_show: 6 }
    ]
  });
  mid.push({
    type: 'entities',
    title: 'Strom & Woche',
    show_header_toggle: false,
    entities: [
      { entity: S.kwh, name: 'Strom diese Woche', icon: 'mdi:flash' },
      { entity: S.cost, name: 'Kosten diese Woche', icon: 'mdi:currency-eur' }
    ]
  });

  // Rechts: AMS-Spulen (zum Einstellen) und Trockner/Lagerbox
  const right: any[] = [];
  for (const slot of SLOTS) {
    const c = slotCard(slot, trayOf(slot), has);
    if (c) right.push(c);
  }
  const r = resolveAms(all)?.roles;
  if (r && (r.boxHum || r.dryerHum || r.boxTemp || r.dryerTemp)) {
    const g: any[] = [];
    if (r.boxHum) g.push(gauge(r.boxHum, 'Box Feuchte', 100, HUM));
    if (r.dryerHum) g.push(gauge(r.dryerHum, 'Trockner Feuchte', 100, HUM));
    if (g.length) right.push({ type: 'horizontal-stack', cards: g });
    const temps = [r.boxTemp && { entity: r.boxTemp, name: 'Box Temperatur', icon: 'mdi:thermometer' }, r.dryerTemp && { entity: r.dryerTemp, name: 'Trockner Temperatur', icon: 'mdi:thermometer' }].filter(Boolean);
    if (temps.length) right.push({ type: 'entities', title: 'Trockner & Lagerbox', show_header_toggle: false, entities: temps });
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
        theme: THEME,
        background: `center / cover no-repeat fixed url('${ART_DIR}/hintergrund.svg?v=${ART_VERSION}')`,
        sections: [section(left), section(mid), section(right)]
      }
    ]
  };
}
