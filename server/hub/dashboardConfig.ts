// Home-Assistant-Dashboard „Drucker“: reiner Bauplan (ohne Netz). Der Pi veröffentlicht die Sensoren (dashboard.ts), dieser Teil baut daraus die Karten.
import { resolveAms } from '../../src/utils/amsEntities.js';
import { ART_VERSION } from './dashboardArt.js';

export const DASH_URL = 'filamenthub-drucker'; // Home Assistant verlangt einen Bindestrich
export const DASH_TITLE = 'Drucker';

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
  cost: 'sensor.filamenthub_kosten_woche'
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

const PILL = { color: '#fff', 'font-size': '14px', 'font-weight': '600', 'text-shadow': '0 1px 3px #000', background: 'rgba(8,12,18,.62)', padding: '3px 11px', 'border-radius': '999px', 'white-space': 'nowrap' };
const label = (entity: string, left: number, top: number, extra: Record<string, unknown> = {}, prefix = '') => ({
  type: 'state-label',
  entity,
  ...(prefix ? { prefix } : {}),
  style: { left: `${left}%`, top: `${top}%`, ...PILL, ...extra }
});

/** Das X2D-Foto mit den Werten: Düse, Fortschritt und Bett rechts (die Hilfslinien sind im Foto), Spulenfarben auf den AMS-Köpfen */
function printerPicture(trays: any[]) {
  const R = 80.2; // gemeinsame Spalte der Werte rechts im Foto (in %)
  const el: any[] = [
    label(S.status, R, 29.5, { 'font-size': '13px', color: '#8ff0d0' }),
    label(S.nozzle, R, 38.4, {}, 'Düse '),
    label(S.progress, R, 55.3, { 'font-size': '24px', padding: '5px 16px' }),
    label(S.remain, R, 60.8, {}, 'Rest '),
    label(S.layer, R, 66, {}, 'Schicht '),
    label(S.bed, R, 73.6, {}, 'Bett '),
    label(S.job, 50, 96.5, { 'font-size': '15px' })
  ];
  const byId = new Map<string, any>(trays.map(t => [String(t.entity_id), t]));
  const colorOf = (t: any) => (/^#[0-9a-fA-F]{6}$/.test(String(t?.attributes?.color || '')) ? String(t.attributes.color) : '#888888');
  PHOTO_SLOTS.forEach((x, i) => {
    const t = byId.get(`${TRAY_PREFIX}ams_1_slot_${i + 1}`);
    if (!t) return;
    el.push({ type: 'state-icon', entity: t.entity_id, icon: 'mdi:circle', title: String(t.attributes?.friendly_name || ''), style: { left: `${x}%`, top: '21.7%', color: colorOf(t), '--mdi-icon-size': '30px' } });
    el.push(label(t.entity_id, x, 26.2, { 'font-size': '11px', padding: '1px 8px' }));
  });
  const ext = byId.get(`${TRAY_PREFIX}extern`);
  if (ext) {
    el.push({ type: 'state-icon', entity: ext.entity_id, icon: 'mdi:circle', title: 'Externe Spule', style: { left: '91%', top: '21.7%', color: colorOf(ext), '--mdi-icon-size': '30px' } });
    el.push(label(ext.entity_id, 91, 26.2, { 'font-size': '11px', padding: '1px 8px' }, 'Extern '));
  }
  return { type: 'picture-elements', image: `${ART_DIR}/x2d.webp?v=${ART_VERSION}`, grid_options: { columns: 'full' }, elements: el };
}

/** Dashboard-Aufbau aus der aktuellen Zustandsliste von Home Assistant */
export function buildDashboard(states: any[]): { title: string; views: any[] } {
  const all = Array.isArray(states) ? states : [];
  const cards: any[] = [];

  // 1. Drucker live: Bild mit Werten, darunter Anzeigen
  const trays = all.filter(x => String(x?.entity_id || '').startsWith(TRAY_PREFIX)).sort((x, y) => String(x.entity_id).localeCompare(String(y.entity_id)));
  const cam = findCamera(all);
  const photo = printerPicture(trays);
  if (cam) cards.push({ type: 'picture-entity', entity: cam, camera_view: 'auto', show_name: false, show_state: false });
  cards.push({ type: 'horizontal-stack', cards: [gauge(S.progress, 'Fortschritt', 100, GREEN), gauge(S.nozzle, 'Düse', 350, HEAT(60, 230)), gauge(S.bed, 'Bett', 120, HEAT(40, 80))] });
  cards.push({
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

  // 2. Spulen / AMS (eine Kachel je Fach, Farbe = Filamentfarbe)
  if (trays.length) {
    cards.push({
      type: 'grid',
      columns: 2,
      square: false,
      cards: trays.map(t => ({
        type: 'tile',
        entity: t.entity_id,
        icon: 'mdi:circle',
        color: /^#[0-9a-fA-F]{6}$/.test(String(t.attributes?.color || '')) ? String(t.attributes.color) : 'grey',
        vertical: false
      }))
    });
  }

  // 3. Lagerbox (SHT31 am AMS-ESP)
  const r = resolveAms(all)?.roles;
  if (r && (r.boxHum || r.dryerHum || r.boxTemp || r.dryerTemp)) {
    const g: any[] = [];
    if (r.boxHum) g.push(gauge(r.boxHum, 'Box Feuchte', 100, HUM));
    if (r.dryerHum) g.push(gauge(r.dryerHum, 'Trockner Feuchte', 100, HUM));
    if (g.length) cards.push({ type: 'horizontal-stack', cards: g });
    const rows = [
      r.boxTemp && { entity: r.boxTemp, name: 'Box Temperatur', icon: 'mdi:thermometer' },
      r.dryerTemp && { entity: r.dryerTemp, name: 'Trockner Temperatur', icon: 'mdi:thermometer' }
    ].filter(Boolean);
    if (rows.length) cards.push({ type: 'entities', title: 'Lagerbox', show_header_toggle: false, entities: rows });
    const hist = [r.boxHum, r.dryerHum].filter(Boolean);
    if (hist.length) cards.push({ type: 'history-graph', title: 'Feuchte (24 h)', hours_to_show: 24, entities: hist.map(e => ({ entity: e as string })) });
  }

  // 4. Strom & Woche + Verlauf
  cards.push({
    type: 'entities',
    title: 'Strom & Woche',
    show_header_toggle: false,
    entities: [
      { entity: S.kwh, name: 'Strom diese Woche', icon: 'mdi:flash' },
      { entity: S.cost, name: 'Kosten diese Woche', icon: 'mdi:currency-eur' }
    ]
  });
  cards.push({
    type: 'horizontal-stack',
    cards: [
      { type: 'sensor', entity: S.nozzle, name: 'Düse', graph: 'line', detail: 2, hours_to_show: 6 },
      { type: 'sensor', entity: S.bed, name: 'Bett', graph: 'line', detail: 2, hours_to_show: 6 }
    ]
  });

  return { title: DASH_TITLE, views: [{ title: DASH_TITLE, path: 'drucker', icon: 'mdi:printer-3d', type: 'sections', max_columns: 2, background: `center / cover no-repeat fixed url('${ART_DIR}/hintergrund.svg?v=${ART_VERSION}')`, sections: [{ type: 'grid', cards: [photo] }, { type: 'grid', cards }] }] };
}
