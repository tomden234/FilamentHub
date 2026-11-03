import { describe, expect, it } from 'vitest';
import { isRawAllowed, okLedIntensityBody, okLedLightBody } from '../../server/haRawAllow';

describe('Weiterleitung zu Home Assistant: was erlaubt ist', () => {
  it('lässt die Status-LED mit Farbe, Helligkeit und Effekt zu', () => {
    const body = { entity_id: 'light.zimmer_filament_ams_status_led', brightness_pct: 30, rgb_color: [0, 110, 255], effect: 'Percent' };
    expect(isRawAllowed('POST', '/api/services/light/turn_on', body)).toBe(true);
    expect(isRawAllowed('POST', '/api/services/light/turn_off', { entity_id: 'light.zimmer_filament_ams_status_led' })).toBe(true);
  });
  it('lässt den Intensity-Regler mit Wert 0-255 zu', () => {
    expect(isRawAllowed('POST', '/api/services/number/set_value', { entity_id: 'number.zimmer_filament_ams_status_led_intensity', value: 128 })).toBe(true);
    expect(okLedIntensityBody({ entity_id: 'number.x_intensity', value: 256 })).toBe(false);
    expect(okLedIntensityBody({ entity_id: 'number.x_intensity', value: -1 })).toBe(false);
    expect(okLedIntensityBody({ entity_id: 'number.x_intensity', value: '5' })).toBe(false);
  });
  it('lässt Zustand lesen von Licht und Regler zu', () => {
    expect(isRawAllowed('GET', '/api/states/light.zimmer_filament_ams_status_led', undefined)).toBe(true);
    expect(isRawAllowed('GET', '/api/states/number.zimmer_filament_ams_status_led_intensity', undefined)).toBe(true);
    expect(isRawAllowed('GET', '/api/states/lock.haustuer', undefined)).toBe(false);
  });
  it('lehnt fremde Geräte, Listen und zusätzliche Felder ab', () => {
    expect(okLedLightBody({ entity_id: 'light.a, light.b' })).toBe(false);
    expect(okLedLightBody({ entity_id: ['light.a', 'light.b'] })).toBe(false);
    expect(okLedLightBody({ entity_id: 'all' })).toBe(false);
    expect(okLedLightBody({ entity_id: 'switch.drucker' })).toBe(false);
    expect(okLedLightBody({ entity_id: 'light.a', transition: 5 })).toBe(false);
    expect(okLedLightBody({ entity_id: 'light.a', brightness_pct: 101 })).toBe(false);
    expect(okLedLightBody({ entity_id: 'light.a', rgb_color: [300, 0, 0] })).toBe(false);
    expect(okLedLightBody({ entity_id: 'light.a', rgb_color: [1, 2] })).toBe(false);
    expect(okLedLightBody(null)).toBe(false);
    expect(isRawAllowed('POST', '/api/services/lock/unlock', { entity_id: 'lock.haustuer' })).toBe(false);
    expect(isRawAllowed('POST', '/api/services/number/set_value', { entity_id: 'number.heizung', value: 20 })).toBe(false);
    expect(isRawAllowed('POST', '/api/services/light/turn_on', undefined)).toBe(false);
  });
  it('alte Regeln bleiben', () => {
    expect(isRawAllowed('GET', '/api/states', undefined)).toBe(true);
    expect(isRawAllowed('POST', '/api/services/automation/turn_off', { entity_id: 'automation.filamenthub_status_led' })).toBe(true);
    expect(isRawAllowed('POST', '/api/config/automation/config/filamenthub_status_led', {})).toBe(true);
    expect(isRawAllowed('POST', '/api/services/homeassistant/restart', {})).toBe(false);
  });
});
