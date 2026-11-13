import { describe, expect, it } from 'vitest';
import { DASH_URL, S, TRAY_PREFIX, buildDashboard, findCamera, trayColors, traySensorId } from '../../server/hub/dashboardConfig';
import { ID } from '../../server/hub/dashboardEditLogic';
import { BACKGROUND_SVG } from '../../server/hub/dashboardArt';
import { FRONT_WEBP_BASE64, SHADE_WEBP_BASE64 } from '../../server/hub/dashboardPhoto';
import { amsSvg, spoolColor } from '../../server/hub/dashboardAms';

const st = (entity_id: string, state = '1', attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });

describe('Dashboard „Drucker“', () => {
  it('Url hat einen Bindestrich (Pflicht in Home Assistant)', () => expect(DASH_URL).toContain('-'));

  it('Sensor-Id einer Spule', () => {
    expect(traySensorId('AMS 1 Slot 2')).toBe(`${TRAY_PREFIX}ams_1_slot_2`);
    expect(traySensorId('Extern')).toBe(`${TRAY_PREFIX}extern`);
    expect(traySensorId('AMS HT 1 Slot 1')).toBe(`${TRAY_PREFIX}ams_ht_1_slot_1`);
  });

  it('Aufbau ohne Spulen und ohne ESP: Bild links, Werte Mitte, rechts leer', () => {
    const d = buildDashboard([], 'abc');
    expect(d.title).toBe('Drucker');
    const v = d.views[0];
    expect(v.background).toContain('hintergrund.svg');
    expect(v.type).toBe('sections');
    expect(v.theme).toBe('FilamentHub Glas');
    expect(v.sections).toHaveLength(3);
    expect(v.sections[0].cards[0].type).toBe('picture-elements');
    expect(v.sections[0].cards[0].image).toContain('drucker.svg?v=abc');
    expect(v.sections[0].cards[1].content).toContain(S.queue);
    const mid = JSON.stringify(v.sections[1].cards);
    expect(mid).toContain(S.kwh);
    expect(mid).toContain(S.nozzle2);
    expect(v.sections[1].cards[0]).toMatchObject({ type: 'grid', columns: 4 }); // Temperatur-Anzeigen klein (¼)
    expect(v.sections[1].cards.filter((c: any) => c.type === 'tile')).toHaveLength(7); // Live-Werte als Kacheln mit Icon
    expect(v.sections[2].cards).toHaveLength(0);
  });

  it('Spulen: Material am Bild, Auswahl je Platz, Soll-Felder nur wenn vorhanden', () => {
    const d = buildDashboard([
      st(`${TRAY_PREFIX}ams_1_slot_1`, 'PLA', { color: '#FF0000' }),
      st(`${TRAY_PREFIX}ams_1_slot_3`, 'PETG', { color: '#00FF00' }),
      st(`${TRAY_PREFIX}extern`, 'TPU', { color: 'kaputt' }),
      st(ID.spool(1), 'Sunlu PLA Rot · 500 g (50 %)'),
      st(ID.spool(5), '— leer —'),
      st(ID.nozzleSoll, '0'),
      st(ID.nozzle2Soll, '0')
    ]);
    const pic = d.views[0].sections[0].cards[0];
    expect(pic.elements).toHaveLength(2); // Extern sitzt nicht im AMS
    expect(pic.elements[0].style.left).toBe('18.2%');
    expect(pic.elements[1].style.left).toBe('60.5%');
    expect(pic.grid_options.columns).toBe(6); // Drucker halb breit neben der Warteschlange
    const spulen = d.views[0].sections[0].cards[2];
    expect(spulen.title).toBe('Spulen');
    expect(spulen.entities.map((e: any) => e.name)).toEqual(['Slot 1:', 'Extern:']);
    const mid = JSON.stringify(d.views[0].sections[1].cards);
    expect(mid).toContain(ID.nozzle2Soll);
    expect(mid).not.toContain(ID.bedSoll); // Feld fehlt in HA → keine Kachel
    const soll = d.views[0].sections[1].cards.find((c: any) => c.entity === ID.nozzleSoll);
    expect(soll).toMatchObject({ type: 'tile', features: [{ type: 'numeric-input' }], grid_options: { columns: 4, rows: 2 } });
  });

  it('Druckerbild: Farben aus den Spulen, leer = dunkel, Foto steckt im SVG', () => {
    expect(trayColors([st(`${TRAY_PREFIX}ams_1_slot_2`, 'PLA', { color: '#12ab34' })])).toEqual([null, '#12AB34', null, null]);
    expect(spoolColor('FF0000FF')).toBe('#FF0000');
    expect(spoolColor('kaputt')).toBeNull();
    const svg = amsSvg(['#FF0000', null, '#000000', 'kaputt']);
    expect(svg.startsWith('<svg') && svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('id="t0"');
    expect(svg).not.toContain('id="t1"');
    expect(svg).toContain('id="t2"');
    expect(svg).not.toContain('id="t3"'); // ungültige Farbe = leer
    expect(svg).toContain('data:image/webp;base64,');
    expect(amsSvg(['#FF0000', null, null, null])).toBe(amsSvg(['#FF0000', null, null, null]));
  });

  it('Lagerbox nur, wenn der AMS-ESP Feuchte meldet', () => {
    const base = [st('sensor.filament_ams_slot_1_tag', ''), st('sensor.filament_ams_box_feuchte', '20', { unit_of_measurement: '%', device_class: 'humidity', friendly_name: 'Filament AMS Box Feuchte' })];
    const json = JSON.stringify(buildDashboard(base).views[0].sections[2]);
    expect(json).toContain('💧 Box Feuchte');
    expect(json).toContain('sensor.filament_ams_box_feuchte');
    expect(JSON.stringify(buildDashboard([]))).not.toContain('Lagerbox');
  });

  it('Kamera nur mit passendem Namen, gleiche Eingabe = gleicher Aufbau', () => {
    expect(findCamera([st('camera.x2d_kamera'), st('camera.haustuer')])).toBe('camera.x2d_kamera');
    expect(findCamera([st('camera.haustuer')])).toBeNull();
    const s = [st(`${TRAY_PREFIX}extern`, 'PLA', { color: '#112233' })];
    expect(JSON.stringify(buildDashboard(s))).toBe(JSON.stringify(buildDashboard(s)));
  });

  it('Grafiken: Hintergrund ist SVG, Foto und Schattierung sind WebP', () => {
    expect(BACKGROUND_SVG.startsWith('<svg') && BACKGROUND_SVG.trim().endsWith('</svg>')).toBe(true);
    for (const b64 of [FRONT_WEBP_BASE64, SHADE_WEBP_BASE64]) {
      const head = Buffer.from(b64, 'base64').subarray(0, 12).toString('latin1');
      expect(head.startsWith('RIFF') && head.endsWith('WEBP')).toBe(true);
    }
  });
});
