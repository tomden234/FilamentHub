import { describe, expect, it } from 'vitest';
import { isRawAllowed } from '../../server/haRawAllow';
import { isNightHour } from './amsDevice';
import { resolveAms } from './amsEntities';

const s = (entity_id: string, friendly_name: string, state = '') => ({ entity_id, state, attributes: { friendly_name } });

describe('Nachtmodus LED-Streifen', () => {
  it('erkennt Nacht über Mitternacht und am Tag', () => {
    expect(isNightHour(22, 21, 7)).toBe(true);
    expect(isNightHour(3, 21, 7)).toBe(true);
    expect(isNightHour(7, 21, 7)).toBe(false);
    expect(isNightHour(20, 21, 7)).toBe(false);
    expect(isNightHour(14, 13, 15)).toBe(true);
    expect(isNightHour(10, 8, 8)).toBe(false); // gleich = nie
  });

  it('findet die Nacht-Werte des ESP', () => {
    const d = resolveAms([
      s('sensor.filament_ams_slot_1_tag', 'Filament AMS Slot 1 Tag'),
      s('switch.filament_ams_led_nachtmodus', 'Filament AMS LED Nachtmodus', 'on'),
      s('number.filament_ams_led_nacht_ab', 'Filament AMS LED Nacht ab', '21'),
      s('number.filament_ams_led_nacht_bis', 'Filament AMS LED Nacht bis', '7'),
      s('number.filament_ams_led_nacht_helligkeit', 'Filament AMS LED Nacht Helligkeit', '25'),
      s('binary_sensor.filament_ams_taster_doppelt', 'Filament AMS Taster doppelt')
    ])!;
    expect(d.roles.nightOn).toBe('switch.filament_ams_led_nachtmodus');
    expect(d.roles.nightFrom).toBe('number.filament_ams_led_nacht_ab');
    expect(d.roles.nightTo).toBe('number.filament_ams_led_nacht_bis');
    expect(d.roles.nightPct).toBe('number.filament_ams_led_nacht_helligkeit');
    expect(d.roles.buttonDouble).toBe('binary_sensor.filament_ams_taster_doppelt');
  });

  it('Weiterleitung lässt nur die Nacht-Werte im erlaubten Bereich durch', () => {
    const post = (svc: string, body: unknown) => isRawAllowed('POST', `/api/services/${svc}`, body);
    expect(post('number/set_value', { entity_id: 'number.filament_ams_led_nacht_ab', value: 21 })).toBe(true);
    expect(post('number/set_value', { entity_id: 'number.filament_ams_led_nacht_bis', value: 24 })).toBe(false);
    expect(post('number/set_value', { entity_id: 'number.filament_ams_led_nacht_helligkeit', value: 25 })).toBe(true);
    expect(post('number/set_value', { entity_id: 'number.filament_ams_led_nacht_helligkeit', value: 2 })).toBe(false);
    expect(post('switch/turn_off', { entity_id: 'switch.filament_ams_led_nachtmodus' })).toBe(true);
    expect(post('switch/turn_off', { entity_id: 'switch.drucker_steckdose' })).toBe(false);
  });
});
