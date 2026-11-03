import { describe, expect, it } from 'vitest';
import { LED_ORDER_GUIDE, buildLedTestCalls, buildStatusLedConfig, describeLedState, findLedEntities, findLedTestKit, ledIntensityValue } from './statusLed';

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

describe('findLedEntities ESPHome (ein ESP32 mit NFC-Lesern)', () => {
  it('findet Status LED und Status LED Intensity', () => {
    const esp = [
      { entity_id: 'light.filament_ams_status_led', attributes: { friendly_name: 'Filament AMS Status LED', effect_list: ['Solid', 'Percent', 'Blink', 'Breathe'] } },
      { entity_id: 'number.filament_ams_status_led_intensity', attributes: { friendly_name: 'Filament AMS Status LED Intensity' } },
      ...states.filter(s => s.entity_id.startsWith('sensor.') || s.entity_id.startsWith('automation.'))
    ];
    const f = findLedEntities(esp);
    expect(f.entities).toMatchObject({ light: 'light.filament_ams_status_led', intensity: 'number.filament_ams_status_led_intensity' });
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

describe('LED-Test der Modi', () => {
  const esp = [
    { entity_id: 'light.filament_ams_status_led', attributes: { friendly_name: 'Filament AMS Status LED', effect_list: ['Solid', 'Percent', 'Blink', 'Breathe'] } },
    { entity_id: 'number.filament_ams_status_led_intensity', attributes: { friendly_name: 'Filament AMS Status LED Intensity' } }
  ];
  it('findet LED und Regler auch ohne Druckstatus', () => {
    expect(findLedTestKit(esp)).toEqual({
      light: 'light.filament_ams_status_led',
      effects: ['Solid', 'Percent', 'Blink', 'Breathe'],
      intensity: 'number.filament_ams_status_led_intensity'
    });
    expect(findLedTestKit([{ entity_id: 'light.wohnzimmer', attributes: {} }])).toBeNull();
  });
  it('rechnet Prozent in Reglerwert um', () => {
    expect(ledIntensityValue(0)).toBe(0);
    expect(ledIntensityValue(50)).toBe(128);
    expect(ledIntensityValue(100)).toBe(255);
    expect(ledIntensityValue(250)).toBe(255);
    expect(ledIntensityValue(-5)).toBe(0);
  });
  it('Druck: erst Balken setzen, dann blau mit Percent', () => {
    const kit = findLedTestKit(esp)!;
    const calls = buildLedTestCalls(kit, 'print', 30, 40);
    expect(calls).toEqual([
      { domain: 'number', service: 'set_value', data: { entity_id: 'number.filament_ams_status_led_intensity', value: 102 } },
      { domain: 'light', service: 'turn_on', data: { entity_id: 'light.filament_ams_status_led', brightness_pct: 30, rgb_color: [0, 110, 255], effect: 'Percent' } }
    ]);
  });
  it('Pause, Fertig, Fehler, Trocknen: Farbe und Effekt wie in der Automation', () => {
    const kit = findLedTestKit(esp)!;
    const one = (m: any) => buildLedTestCalls(kit, m, 50)[0].data;
    expect(one('pause')).toMatchObject({ rgb_color: [255, 190, 0], effect: 'Solid' });
    expect(one('finish')).toMatchObject({ rgb_color: [0, 220, 70], effect: 'Solid' });
    expect(one('failed')).toMatchObject({ rgb_color: [255, 0, 0], effect: 'Blink' });
    expect(one('dry')).toMatchObject({ rgb_color: [255, 110, 0], effect: 'Breathe' });
  });
  it('Aus schaltet nur die LED aus', () => {
    const kit = findLedTestKit(esp)!;
    expect(buildLedTestCalls(kit, 'off', 30)).toEqual([{ domain: 'light', service: 'turn_off', data: { entity_id: 'light.filament_ams_status_led' } }]);
  });
  it('ohne Effekte kein Effekt und ohne Regler kein Balken', () => {
    const calls = buildLedTestCalls({ light: 'light.x', effects: [] }, 'print', 30, 60);
    expect(calls).toHaveLength(1);
    expect(calls[0].data).not.toHaveProperty('effect');
  });
});

describe('Farbtest und Diagnose', () => {
  it('Farbtest nutzt den Effekt Farbtest, sonst Solid', () => {
    const withEffect = buildLedTestCalls({ light: 'light.x', effects: ['Solid', 'Farbtest'] }, 'colortest', 30);
    expect(withEffect[0].data).toMatchObject({ effect: 'Farbtest' });
    const without = buildLedTestCalls({ light: 'light.x', effects: ['Solid'] }, 'colortest', 30);
    expect(without[0].data).toMatchObject({ effect: 'Solid' });
  });
  it('Hilfe für led_order: sechs verschiedene Reihenfolgen, GRB = alles richtig', () => {
    expect(LED_ORDER_GUIDE).toHaveLength(6);
    expect(new Set(LED_ORDER_GUIDE.map(g => g.order)).size).toBe(6);
    expect(new Set(LED_ORDER_GUIDE.map(g => g.seen)).size).toBe(6);
    expect(LED_ORDER_GUIDE.find(g => g.seen === 'Rot, Grün, Blau')?.order).toBe('GRB');
    expect(LED_ORDER_GUIDE.find(g => g.seen === 'Grün, Rot, Blau')?.order).toBe('RGB');
  });
  it('beschreibt den Zustand der LED', () => {
    expect(describeLedState({ state: 'on', attributes: { effect: 'Solid', rgb_color: [255, 0, 0], brightness: 77 } })).toBe('Gerät meldet: an, Effekt Solid, Farbe 255/0/0, Helligkeit 30 %.');
    expect(describeLedState({ state: 'off', attributes: {} })).toBe('Gerät meldet: off.');
    expect(describeLedState(null)).toBe('Zustand nicht lesbar.');
  });
});
