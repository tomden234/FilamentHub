import { describe, expect, it } from 'vitest';
import { resolveAms } from './amsEntities';

const s = (id: string, name: string, state = '', attrs: Record<string, unknown> = {}) => ({ entity_id: id, state, attributes: { friendly_name: name, ...attrs } });

describe('resolveAms', () => {
  it('findet Werte mit anderem ID-Anfang über den Anzeigenamen', () => {
    const d = resolveAms([
      s('sensor.filament_ams_slot_1_tag', 'Filament AMS Slot 1 Tag'),
      s('sensor.filament_ams_box_feuchte', 'Filament AMS Box Feuchte', '39', { device_class: 'humidity', unit_of_measurement: '%' }),
      s('sensor.esp32dev_leser_1', 'Filament AMS Leser 1', 'OK (Chip 0x92)'),
      s('sensor.esp32dev_firmware', 'Filament AMS Firmware', '1.202'),
      s('sensor.esp32dev_trockner_feuchte', 'Filament AMS Trockner Feuchte', '22', { device_class: 'humidity', unit_of_measurement: '%' }),
      s('switch.esp32dev_warteschlange_test', 'Filament AMS Warteschlange Test', 'off'),
      s('number.esp32dev_warteschlange', 'Filament AMS Warteschlange', '0'),
      s('sensor.anderes_geraet_firmware', 'Drucker Firmware', '01.02.03')
    ])!;
    expect(d.base).toBe('filament_ams');
    expect(d.roles.reader[1]).toBe('sensor.esp32dev_leser_1');
    expect(d.roles.firmware).toBe('sensor.esp32dev_firmware');
    expect(d.roles.dryerHum).toBe('sensor.esp32dev_trockner_feuchte');
    expect(d.roles.boxHum).toBe('sensor.filament_ams_box_feuchte');
    expect(d.roles.queueTest).toBe('switch.esp32dev_warteschlange_test');
    expect(d.roles.queue).toBe('number.esp32dev_warteschlange');
    expect(d.entities.some(x => x.id === 'sensor.anderes_geraet_firmware')).toBe(false);
  });

  it('übliche Namen und Zusatz _2', () => {
    const d = resolveAms([
      s('sensor.filament_ams_slot_1_tag', 'Filament AMS Slot 1 Tag'),
      s('sensor.filament_ams_trockner_temperatur_2', 'Filament AMS Trockner Temperatur', '30', { device_class: 'temperature', unit_of_measurement: '°C' }),
      s('binary_sensor.filament_ams_platte_frei', 'Filament AMS Platte frei', 'off')
    ])!;
    expect(d.roles.dryerTemp).toBe('sensor.filament_ams_trockner_temperatur_2');
    expect(d.roles.button).toBe('binary_sensor.filament_ams_platte_frei');
  });

  it('ohne ESP: null', () => {
    expect(resolveAms([s('sensor.x', 'X')])).toBeNull();
  });
});
