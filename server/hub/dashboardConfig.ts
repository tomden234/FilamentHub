// Home-Assistant-Dashboard „Drucker“: reiner Bauplan (ohne Netz). Der Pi veröffentlicht die Sensoren (dashboard.ts), dieser Teil baut daraus die Karten.
// Aufbau: links Drucker (AMS in echten Farben) neben der Warteschlange und die Spulen, Mitte Drucker-Werte, rechts Lagerbox und Trockner.
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
// Lagerbox/Trockner: Feuchte in Blau (hell = trocken, dunkel = feucht), Temperatur warm von Gelb nach Rot
const HUM: Seg[] = [{ from: 0, color: '#9fd8f5' }, { from: 25, color: '#5fb2e6' }, { from: 30, color: '#2f78c2' }];
const AIR: Seg[] = [{ from: 0, color: '#ffe08a' }, { from: 15, color: '#ffc069' }, { from: 40, color: '#ff8f5a' }, { from: 60, color: '#e5534b' }];

/** Kleine Anzeigen nebeneinander (je ¼ Breite bei 4 Spalten) */
const small = (cards: any[], columns = 4) => ({ type: 'grid', columns, square: false, cards });
/** Breite/Höhe einer Karte im Abschnitt (12 Spalten, Zeile ≈ 56 px) */
const size = (card: any, columns: number, rows?: number) => ({ ...card, grid_options: { columns, ...(rows ? { rows } : {}) } });
/** Kachel mit Icon (Wert als zweite Zeile) */
const tile = (entity: string, name: string, icon: string) => ({ type: 'tile', entity, name, icon, vertical: false });

const PILL = { color: '#fff', 'font-size': '11px', 'font-weight': '700', 'text-shadow': '0 1px 3px #000', background: 'rgba(8,12,18,.62)', padding: '1px 8px', 'border-radius': '999px', 'white-space': 'nowrap' };

/** Temperatur-Etikett im Bild: Name + Ist oben, Soll darunter, −/+ ändern das Soll in 5-°C-Schritten (Eingabe geht über den Pi an den Drucker) */
function tempTag(ist: string, soll: string, name: string, x: number, y: number, accent: string, withSoll: boolean): any[] {
  const glass = { background: 'rgba(12,18,22,.72)', 'backdrop-filter': 'blur(6px)', border: '1px solid rgba(255,255,255,.22)', 'box-shadow': '0 4px 14px rgba(0,0,0,.35)' };
  const pos = (dx: number, dy: number) => ({ left: `${x + dx}%`, top: `${y + dy}%` });
  const el: any[] = [
    {
      type: 'state-label',
      entity: ist,
      prefix: `${name}  `,
      style: { ...pos(0, 0), ...glass, 'border-left': `3px solid ${accent}`, 'border-radius': '14px', padding: withSoll ? '5px 30px 19px' : '5px 12px', 'min-width': '64px', 'text-align': 'center', color: '#fff', 'font-size': '12px', 'font-weight': '700', 'white-space': 'nowrap' }
    }
  ];
  if (!withSoll) return el;
  const btn = (icon: string, dx: number, action: string) => ({
    type: 'icon',
    icon,
    title: `${name} Soll ${action === 'increment' ? '+5' : '−5'} °C`,
    tap_action: { action: 'perform-action', perform_action: `input_number.${action}`, target: { entity_id: soll } },
    style: { ...pos(dx, 0.9), color: '#fff', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.35)', 'border-radius': '50%', padding: '2px', '--mdc-icon-size': '16px' }
  });
  el.push({ type: 'state-label', entity: soll, prefix: 'Soll ', style: { ...pos(0, 2.2), color: accent, 'font-size': '11px', 'font-weight': '700', 'white-space': 'nowrap' } });
  el.push(btn('mdi:minus', -12.5, 'decrement'), btn('mdi:plus', 12.5, 'increment'));
  return el;
}

/** Druckerbild (AMS in den echten Farben, vom Pi gebaut) mit dem Material je Platz und den Temperaturen an Düsen und Bett */
function printerPicture(states: any[], photoV: string) {
  const have = new Set(ids(states));
  const elements = SPOOL_X.flatMap((x, i) => (have.has(amsTray(i + 1)) ? [{ type: 'state-label', entity: amsTray(i + 1), style: { left: `${x}%`, top: '20.5%', ...PILL } }] : []));
  elements.push(
    ...tempTag(S.nozzle, ID.nozzleSoll, 'Düse 1', 27, 51, '#ffb347', have.has(ID.nozzleSoll)),
    ...tempTag(S.nozzle2, ID.nozzle2Soll, 'Düse 2', 73, 51, '#ffb347', have.has(ID.nozzle2Soll)),
    ...tempTag(S.bed, ID.bedSoll, 'Bett', 50, 79, '#ff7b7b', have.has(ID.bedSoll))
  );
  return { type: 'picture-elements', image: `${ART_DIR}/drucker.svg?v=${photoV}`, grid_options: { columns: 6 }, elements };
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

  // Links: Drucker (halbe Breite) neben der Warteschlange, darunter die Spulen
  const left: any[] = [printerPicture(all, photoV), size({ type: 'markdown', title: 'Warteschlange', content: QUEUE_MD }, 6)];
  const spoolRows = rows(SLOTS.map(s => ({ entity: ID.spool(s), name: s === 5 ? 'Extern:' : `Slot ${s}:`, icon: 'mdi:printer-3d-nozzle' })));
  if (spoolRows.length) left.push(size({ type: 'entities', title: 'Spulen', show_header_toggle: false, entities: spoolRows }, 12));

  // Mitte: kleine Anzeigen, Live-Werte als Kacheln, Verlauf (Soll-Temperaturen stehen im Druckerbild)
  const mid: any[] = [
    size(small([gauge(S.progress, '⏳ Fortschritt', 0, 100, PROGRESS), gauge(S.nozzle, '🔥 Düse 1', 0, 320, NOZZLE), gauge(S.nozzle2, '🔥 Düse 2', 0, 320, NOZZLE), gauge(S.bed, '♨️ Bett', 0, 120, BED)]), 12)
  ];
  for (const [entity, name, icon] of [
    [S.status, 'Status', 'mdi:printer-3d'],
    [S.job, 'Auftrag', 'mdi:file-cad'],
    [S.remain, 'Restzeit', 'mdi:timer-sand'],
    [S.layer, 'Schicht', 'mdi:layers'],
    [S.tray, 'Aktives Fach', 'mdi:printer-3d-nozzle'],
    [S.kwh, 'Strom Woche', 'mdi:flash'],
    [S.cost, 'Kosten Woche', 'mdi:currency-eur']
  ] as const)
    mid.push(size(tile(entity, name, icon), 6, 1));
  const cam = findCamera(all);
  if (cam) mid.push(size({ type: 'picture-entity', entity: cam, camera_view: 'auto', show_name: false, show_state: false }, 12));
  mid.push(size({ type: 'history-graph', title: 'Düsen & Bett (6 h)', hours_to_show: 6, entities: [{ entity: S.nozzle, name: 'Düse 1' }, { entity: S.nozzle2, name: 'Düse 2' }, { entity: S.bed, name: 'Bett' }] }, 12));

  // Rechts: Lagerbox und Trockner (Feuchte groß, Temperatur klein mit Verlauf daneben)
  const right: any[] = [];
  const r = resolveAms(all)?.roles;
  if (r && (r.boxHum || r.dryerHum || r.boxTemp || r.dryerTemp)) {
    // Vier einzelne, gleich große Anzeigen: oben Feuchte (💧), unten Temperatur (🔥)
    if (r.boxHum) right.push(size(gauge(r.boxHum, '💧 Box Feuchte', 0, 100, HUM), 6));
    if (r.dryerHum) right.push(size(gauge(r.dryerHum, '💧 Trockner Feuchte', 0, 100, HUM), 6));
    if (r.boxTemp) right.push(size(gauge(r.boxTemp, '🔥 Box Temp.', 0, 80, AIR), 6));
    if (r.dryerTemp) right.push(size(gauge(r.dryerTemp, '🔥 Trockner Temp.', 0, 80, AIR), 6));
    const temps = [r.boxTemp, r.dryerTemp].filter(Boolean);
    if (temps.length) right.push(size({ type: 'history-graph', title: 'Temperatur (24 h)', hours_to_show: 24, entities: temps.map(e => ({ entity: e as string })) }, 12, 3));
    const hist = [r.boxHum, r.dryerHum].filter(Boolean);
    if (hist.length) right.push(size({ type: 'history-graph', title: 'Feuchte (24 h)', hours_to_show: 24, entities: hist.map(e => ({ entity: e as string })) }, 12));
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
