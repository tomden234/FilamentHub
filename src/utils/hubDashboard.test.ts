import { describe, expect, it } from 'vitest';
import { DASH_URL, S, TRAY_PREFIX, buildDashboard, findCamera, traySensorId } from '../../server/hub/dashboardConfig';
import { BACKGROUND_SVG, PRINTER_SVG } from '../../server/hub/dashboardArt';

const st = (entity_id: string, state = '1', attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });

describe('Dashboard „Drucker“', () => {
  it('Url hat einen Bindestrich (Pflicht in Home Assistant)', () => expect(DASH_URL).toContain('-'));

  it('Sensor-Id einer Spule', () => {
    expect(traySensorId('AMS 1 Slot 2')).toBe(`${TRAY_PREFIX}ams_1_slot_2`);
    expect(traySensorId('Extern')).toBe(`${TRAY_PREFIX}extern`);
    expect(traySensorId('AMS HT 1 Slot 1')).toBe(`${TRAY_PREFIX}ams_ht_1_slot_1`);
  });

  it('Aufbau ohne Spulen und ohne ESP: Bild, Anzeigen, Strom', () => {
    const d = buildDashboard([]);
    expect(d.title).toBe('Drucker');
    const v = d.views[0];
    expect(v.background).toContain('hintergrund.svg');
    const types = v.cards.map((c: any) => c.type);
    expect(types[0]).toBe('picture-elements');
    expect(types).not.toContain('grid');
    expect(JSON.stringify(v.cards)).toContain(S.kwh);
  });

  it('Spulen: Farbe am Bild und Kachel, Extern rechts', () => {
    const d = buildDashboard([
      st(`${TRAY_PREFIX}ams_1_slot_1`, 'PLA', { color: '#FF0000', friendly_name: 'AMS 1 Slot 1' }),
      st(`${TRAY_PREFIX}ams_1_slot_3`, 'PETG', { color: '#00FF00' }),
      st(`${TRAY_PREFIX}extern`, 'TPU', { color: 'kaputt' })
    ]);
    const pic = d.views[0].cards[0];
    const icons = pic.elements.filter((e: any) => e.type === 'state-icon');
    expect(icons).toHaveLength(3);
    expect(icons[0].style.color).toBe('#FF0000');
    expect(icons[0].style.left).toBe('29.4%');
    expect(icons[1].style.left).toBe('56.9%');
    expect(icons[2].style.color).toBe('#888888'); // ungültige Farbe → grau
    const grid = d.views[0].cards.find((c: any) => c.type === 'grid');
    expect(grid.cards).toHaveLength(3);
  });

  it('Lagerbox nur, wenn der AMS-ESP Feuchte meldet', () => {
    const base = [st('sensor.filament_ams_slot_1_tag', ''), st('sensor.filament_ams_box_feuchte', '20', { unit_of_measurement: '%', device_class: 'humidity', friendly_name: 'Filament AMS Box Feuchte' })];
    const json = JSON.stringify(buildDashboard(base));
    expect(json).toContain('sensor.filament_ams_box_feuchte');
    expect(JSON.stringify(buildDashboard([]))).not.toContain('Lagerbox');
  });

  it('Kamera nur mit passendem Namen, gleiche Eingabe = gleicher Aufbau', () => {
    expect(findCamera([st('camera.x2d_kamera'), st('camera.haustuer')])).toBe('camera.x2d_kamera');
    expect(findCamera([st('camera.haustuer')])).toBeNull();
    const s = [st(`${TRAY_PREFIX}extern`, 'PLA', { color: '#112233' })];
    expect(JSON.stringify(buildDashboard(s))).toBe(JSON.stringify(buildDashboard(s)));
  });

  it('Grafiken sind gültiges SVG', () => {
    for (const svg of [PRINTER_SVG, BACKGROUND_SVG]) {
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.trim().endsWith('</svg>')).toBe(true);
    }
    expect(PRINTER_SVG).toContain('viewBox="0 0 800 600"');
  });
});
