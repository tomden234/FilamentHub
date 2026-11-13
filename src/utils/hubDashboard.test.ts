import { describe, expect, it } from 'vitest';
import { DASH_URL, S, TRAY_PREFIX, buildDashboard, findCamera, traySensorId } from '../../server/hub/dashboardConfig';
import { ID } from '../../server/hub/dashboardEditLogic';
import { BACKGROUND_SVG } from '../../server/hub/dashboardArt';
import { X2D_WEBP_BASE64 } from '../../server/hub/dashboardPhoto';

const st = (entity_id: string, state = '1', attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });

describe('Dashboard „Drucker“', () => {
  it('Url hat einen Bindestrich (Pflicht in Home Assistant)', () => expect(DASH_URL).toContain('-'));

  it('Sensor-Id einer Spule', () => {
    expect(traySensorId('AMS 1 Slot 2')).toBe(`${TRAY_PREFIX}ams_1_slot_2`);
    expect(traySensorId('Extern')).toBe(`${TRAY_PREFIX}extern`);
    expect(traySensorId('AMS HT 1 Slot 1')).toBe(`${TRAY_PREFIX}ams_ht_1_slot_1`);
  });

  it('Aufbau ohne Spulen und ohne ESP: Foto links, Werte Mitte, rechts leer', () => {
    const d = buildDashboard([]);
    expect(d.title).toBe('Drucker');
    const v = d.views[0];
    expect(v.background).toContain('hintergrund.svg');
    expect(v.type).toBe('sections');
    expect(v.theme).toBe('FilamentHub Glas');
    expect(v.sections).toHaveLength(3);
    expect(v.sections[0].cards[0].type).toBe('picture-elements');
    expect(v.sections[0].cards[0].image).toContain('x2d.webp');
    expect(JSON.stringify(v.sections[1].cards)).toContain(S.kwh);
    expect(v.sections[2].cards).toHaveLength(0);
  });

  it('Spulen: Farbpunkte am Foto, Karte je Platz mit Eingabefeldern', () => {
    const d = buildDashboard([
      st(`${TRAY_PREFIX}ams_1_slot_1`, 'PLA', { color: '#FF0000', friendly_name: 'AMS 1 Slot 1' }),
      st(`${TRAY_PREFIX}ams_1_slot_3`, 'PETG', { color: '#00FF00' }),
      st(`${TRAY_PREFIX}extern`, 'TPU', { color: 'kaputt' }),
      st(ID.material(1), 'PLA'),
      st(ID.color(1), 'Rot'),
      st(ID.grams(1), '820'),
      st(ID.nozzleSoll, '0')
    ]);
    const pic = d.views[0].sections[0].cards[0];
    const icons = pic.elements.filter((e: any) => e.type === 'state-icon');
    expect(icons).toHaveLength(2); // Extern sitzt nicht am AMS-Kopf
    expect(icons[0].style.color).toBe('#FF0000');
    expect(icons[0].style.left).toBe('25%');
    expect(icons[1].style.left).toBe('54.7%');
    const right = d.views[0].sections[2].cards;
    expect(right.length).toBeGreaterThanOrEqual(3); // Slot 1, Slot 3, Extern
    const slot1 = right[0].cards;
    expect(slot1[0].type).toBe('tile');
    expect(slot1[0].color).toBe('#FF0000');
    expect(slot1[1].entities.map((e: any) => e.entity)).toEqual([ID.material(1), ID.color(1), ID.grams(1)]);
    const extern = right.find((c: any) => c.cards?.[0]?.entity === `${TRAY_PREFIX}extern`);
    expect(extern.cards[0].color).toBe('grey'); // ungültige Farbe
    expect(JSON.stringify(d.views[0].sections[1].cards)).toContain(ID.nozzleSoll);
    expect(JSON.stringify(d.views[0].sections[1].cards)).not.toContain(ID.bedSoll); // Feld fehlt in HA → keine Zeile
  });

  it('Lagerbox nur, wenn der AMS-ESP Feuchte meldet', () => {
    const base = [st('sensor.filament_ams_slot_1_tag', ''), st('sensor.filament_ams_box_feuchte', '20', { unit_of_measurement: '%', device_class: 'humidity', friendly_name: 'Filament AMS Box Feuchte' })];
    const json = JSON.stringify(buildDashboard(base).views[0].sections[2]);
    expect(json).toContain('sensor.filament_ams_box_feuchte');
    expect(JSON.stringify(buildDashboard([]))).not.toContain('Lagerbox');
  });

  it('Kamera nur mit passendem Namen, gleiche Eingabe = gleicher Aufbau', () => {
    expect(findCamera([st('camera.x2d_kamera'), st('camera.haustuer')])).toBe('camera.x2d_kamera');
    expect(findCamera([st('camera.haustuer')])).toBeNull();
    const s = [st(`${TRAY_PREFIX}extern`, 'PLA', { color: '#112233' })];
    expect(JSON.stringify(buildDashboard(s))).toBe(JSON.stringify(buildDashboard(s)));
  });

  it('Grafiken: Hintergrund ist SVG, Foto ist ein WebP', () => {
    expect(BACKGROUND_SVG.startsWith('<svg') && BACKGROUND_SVG.trim().endsWith('</svg>')).toBe(true);
    const head = Buffer.from(X2D_WEBP_BASE64, 'base64').subarray(0, 12).toString('latin1');
    expect(head.startsWith('RIFF') && head.endsWith('WEBP')).toBe(true);
  });
});
