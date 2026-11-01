import { describe, expect, it } from 'vitest';
import { buildStatusLedConfig, findLedEntities } from './statusLed';

const states = [
  { entity_id: 'light.wled', attributes: { friendly_name: 'WLED', effect_list: ['Solid', 'Blink', 'Breathe', 'Percent'] } },
  { entity_id: 'light.wohnzimmer', attributes: { friendly_name: 'Wohnzimmer' } },
  { entity_id: 'number.wled_intensity', attributes: { friendly_name: 'WLED Intensity' } },
  { entity_id: 'sensor.x2d_druckstatus', attributes: { friendly_name: 'X2D Druckstatus' } },
  { entity_id: 'sensor.x2d_druckfortschritt', attributes: { friendly_name: 'X2D Druckfortschritt' } },
  { entity_id: 'sensor.x2d_ams_2_pro_rest_trockenzeit', attributes: { friendly_name: 'AMS 2 Pro Rest-Trockenzeit' } },
  { entity_id: 'sensor.x2d_ams_2_pro_luftfeuchte', attributes: { friendly_name: 'AMS Luftfeuchte' } },
  { entity_id: 'automation.led', attributes: { id: 'filamenthub_status_led' } }
];

describe('findLedEntities', () => {
  it('findet WLED, Regler, Status, Fortschritt und Trockenzeit', () => {
    const f = findLedEntities(states);
    expect(f.entities).toMatchObject({
      light: 'light.wled',
      intensity: 'number.wled_intensity',
      status: 'sensor.x2d_druckstatus',
      progress: 'sensor.x2d_druckfortschritt',
      dry: ['sensor.x2d_ams_2_pro_rest_trockenzeit']
    });
    expect(f.automation).toBe('automation.led');
  });
  it('meldet fehlende LED', () => {
    const f = findLedEntities(states.filter(s => !s.entity_id.startsWith('light.')));
    expect(f.entities).toBeUndefined();
    expect(f.found.status).toBe('sensor.x2d_druckstatus');
  });
});

describe('buildStatusLedConfig', () => {
  const e = findLedEntities(states).entities!;
  const cfg = buildStatusLedConfig(e, 30);
  const json = JSON.stringify(cfg);
  it('hat Neustart-Modus und Trigger', () => {
    expect(cfg.mode).toBe('restart');
    expect(cfg.trigger.length).toBe(1 + 1 + 1 + 2);
  });
  it('Druck: blau mit Percent und Fortschritt', () => {
    const c = cfg.action[0].choose[0].sequence;
    expect(c[0].data).toMatchObject({ brightness_pct: 30, rgb_color: [0, 110, 255], effect: 'Percent' });
    expect(c[1].data.value).toContain("states('sensor.x2d_druckfortschritt')");
  });
  it('fertig und Fehler gehen nach 30 Minuten aus', () => {
    expect(cfg.action[0].choose[2].sequence[1]).toEqual({ delay: { minutes: 30 } });
    expect(cfg.action[0].choose[3].sequence[0].data.effect).toBe('Blink');
  });
  it('sonst aus', () => {
    expect(cfg.action[0].default[0].service).toBe('light.turn_off');
  });
  it('ohne Effekte: kein effect-Feld, ohne Regler kein Balken', () => {
    const c2 = buildStatusLedConfig({ ...e, effects: [], intensity: undefined }, 50);
    expect(JSON.stringify(c2)).not.toContain('"effect"');
    expect(JSON.stringify(c2)).not.toContain('number.set_value');
  });
  it('Effekt fehlt in WLED: Solid', () => {
    const c3 = buildStatusLedConfig({ ...e, effects: ['Solid'] }, 30);
    expect(c3.action[0].choose[4].sequence[0].data.effect).toBe('Solid');
  });
  it('ist gültiges JSON', () => {
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
