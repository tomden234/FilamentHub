import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { addEnergy, allTrays, inQuietHours, mapFilaments, mergeEspYaml, missingMaterials, readSubstitutions, stalled, weekKey, weeklyReport, yamlRevision } from '../../server/hub/hubLogic';
import { findPowerSensor, pushData } from '../../server/hub/ha';

const T = new Date(2026, 10, 5, 14, 0).getTime(); // Do 05.11.2026

describe('Ruhezeit', () => {
  it('über Mitternacht 22-7', () => {
    expect(inQuietHours(23, 22, 7)).toBe(true);
    expect(inQuietHours(3, 22, 7)).toBe(true);
    expect(inQuietHours(7, 22, 7)).toBe(false);
    expect(inQuietHours(12, 22, 7)).toBe(false);
    expect(inQuietHours(13, 12, 14)).toBe(true);
    expect(inQuietHours(5, 5, 5)).toBe(false);
  });
  it('lautlos-Daten für die Home-Assistant-App', () => {
    expect(pushData({ silent: true })).toMatchObject({ channel: 'FilamentHub leise', importance: 'low' });
    expect(pushData({ actions: [{ action: 'A', title: 'B' }] }).actions).toHaveLength(1);
  });
});

describe('Strom', () => {
  it('summiert je Woche, Lücken zählen nicht', () => {
    let w = addEnergy({}, T, 120, 30_000, true); // 1 Wh
    w = addEnergy(w, T + 30_000, 120, 30_000, false);
    w = addEnergy(w, T + 60_000, 500, 10 * 60_000, true); // Lücke: ignoriert
    expect(w[weekKey(T)].totalWh).toBeCloseTo(2, 5);
    expect(w[weekKey(T)].printWh).toBeCloseTo(1, 5);
    expect(weekKey(T)).toBe('2026-11-02');
  });
  it('findet den Leistungs-Sensor der Steckdose', () => {
    const states = [
      { entity_id: 'sensor.3d_drucker_steckdose_power', attributes: { unit_of_measurement: 'W' } },
      { entity_id: 'sensor.anderes_power', attributes: { unit_of_measurement: 'W' } },
      { entity_id: 'sensor.3d_drucker_steckdose_energy', attributes: { unit_of_measurement: 'kWh' } }
    ];
    expect(findPowerSensor(states, 'switch.3d_drucker_steckdose')).toBe('sensor.3d_drucker_steckdose_power');
    expect(findPowerSensor([], 'switch.x')).toBeNull();
  });
});

describe('Wochenbericht', () => {
  it('Drucke, Gramm, Strom, fast leere Spulen', () => {
    const r = weeklyReport({
      now: T,
      prints: [
        { name: 'A', endMs: T - 3600_000, state: 'FINISH' },
        { name: 'B', endMs: T - 7200_000, state: 'FAILED' },
        { name: 'alt', endMs: T - 10 * 86400_000, state: 'FINISH' }
      ],
      history: [{ grams: 100, timestamp: new Date(T - 3600_000).toISOString(), spoolId: 'a' }],
      spools: [
        { id: 'a', brand: 'Sunlu', name: 'PLA', pricePerKg: 20, remainingWeight: 80 },
        { id: 'b', brand: 'X', name: 'Y', pricePerKg: 20, remainingWeight: 500 }
      ],
      energy: { totalWh: 2000, printWh: 1500 },
      kwhPrice: 0.35,
      lowWeightG: 100
    });
    expect(r.text).toContain('2 Drucke (1 fertig, 1 abgebrochen)');
    expect(r.text).toContain('100 g Filament');
    expect(r.text).toContain('2 kWh');
    expect(r.text).toContain('Sunlu PLA (80 g)');
    expect(r.text).not.toContain('X Y');
  });
});

describe('Warteschlange: Filament → AMS-Platz', () => {
  const ams = {
    ams: [
      { id: '0', tray: [{ id: '0', tray_type: 'PLA', tray_color: 'FFFFFFFF' }, { id: '1', tray_type: 'PETG', tray_color: '000000FF' }, { id: '2' }, { id: '3' }] },
      { id: '128', tray: [{ id: '0', tray_type: 'PLA', tray_color: 'FF0000FF' }] }
    ]
  };
  const trays = allTrays(ams, { tray_type: 'TPU', tray_color: '00FF00FF' });
  it('liest alle Einheiten und extern', () => {
    expect(trays.map(t => `${t.amsId}/${t.slotId}/${t.type}`)).toEqual(['0/0/PLA', '0/1/PETG', '128/0/PLA', '255/0/TPU']);
  });
  it('ordnet nach Material und Farbe zu', () => {
    const m = mapFilaments(
      [
        { id: 1, type: 'PLA', colorHex: '#EE1111', grams: 10 },
        { id: 3, type: 'PETG', colorHex: '#111111', grams: 5 }
      ],
      trays
    );
    expect(m.amsMapping).toEqual([512, -1, 1]);
    expect(m.amsMapping2[0]).toEqual({ ams_id: 128, slot_id: 0 });
    expect(m.amsMapping2[2]).toEqual({ ams_id: 0, slot_id: 1 });
    expect(m.missing).toEqual([]);
    expect(m.lines[0]).toContain('AMS HT 1 Slot 1');
  });
  it('fehlendes Material', () => {
    expect(mapFilaments([{ id: 1, type: 'ABS', colorHex: '#000000', grams: 1 }], trays).missing).toHaveLength(1);
    expect(missingMaterials([{ type: 'ABS' }, { type: 'PLA Matte' }], trays)).toEqual(['ABS']);
  });
});

describe('ESP-YAML übers WLAN', () => {
  const repoYaml = fs.readFileSync('hardware/ams-nfc/filament-ams.yaml', 'utf-8');
  it('behält eigene Werte (led_count …), übernimmt den Rest', () => {
    const mine = repoYaml.replace('led_count: "144"', 'led_count: "40"').replace('led_cap: "0.15"', 'led_cap: "0.6"');
    const fresh = repoYaml.replace('# Erstellt:', '# Neu\n# Erstellt:');
    const out = mergeEspYaml(fresh, mine);
    expect(readSubstitutions(out).led_count).toBe('"40"');
    expect(readSubstitutions(out).led_cap).toBe('"0.6"');
    expect(out.startsWith('# Neu')).toBe(true);
    // Revision nie aus der alten Datei
    const old2 = repoYaml.replace(/fw_revision: "[\d.]+"/, 'fw_revision: "1.100"');
    expect(readSubstitutions(mergeEspYaml(repoYaml, old2)).fw_revision).toBe(readSubstitutions(repoYaml).fw_revision);
  });
  it('Revision aus Zeile 1, Taster und Warteschlange drin', () => {
    expect(yamlRevision(repoYaml)).toMatch(/^1\.\d+$/);
    expect(repoYaml).toContain('GPIO26');
    expect(repoYaml).toContain('name: "Warteschlange"');
  });
});

describe('Stillstand', () => {
  it('30 Minuten ohne Fortschritt', () => {
    expect(stalled(T, T + 31 * 60_000)).toBe(true);
    expect(stalled(T, T + 10 * 60_000)).toBe(false);
    expect(stalled(0, T)).toBe(false);
  });
});

describe('NFC-Leser über die Weiterleitung', () => {
  it('lässt Sensoren lesen, aber keine Schlösser', async () => {
    const { isRawAllowed } = await import('../../server/haRawAllow');
    expect(isRawAllowed('GET', '/api/states/sensor.filament_ams_slot_1_tag', undefined)).toBe(true);
    expect(isRawAllowed('GET', '/api/states/sensor.filament_ams_leser_3', undefined)).toBe(true);
    expect(isRawAllowed('GET', '/api/states/sensor.filament_ams_letzter_tag', undefined)).toBe(true);
    expect(isRawAllowed('GET', '/api/states/sensor.wohnzimmer_temperatur', undefined)).toBe(true); // 1.206: Sensoren nur lesen, egal welche ID
    expect(isRawAllowed('GET', '/api/states/lock.haustuer', undefined)).toBe(false);
  });
});

describe('Testmenü über die Weiterleitung', () => {
  it('Warteschlange setzen und Test-Schalter, sonst nichts', async () => {
    const { isRawAllowed } = await import('../../server/haRawAllow');
    expect(isRawAllowed('POST', '/api/services/number/set_value', { entity_id: 'number.filament_ams_warteschlange', value: 7 })).toBe(true);
    expect(isRawAllowed('POST', '/api/services/number/set_value', { entity_id: 'number.filament_ams_warteschlange', value: 11 })).toBe(false);
    expect(isRawAllowed('POST', '/api/services/number/set_value', { entity_id: 'number.heizung_soll', value: 5 })).toBe(false);
    expect(isRawAllowed('POST', '/api/services/switch/turn_on', { entity_id: 'switch.filament_ams_warteschlange_test' })).toBe(true);
    expect(isRawAllowed('POST', '/api/services/switch/turn_on', { entity_id: 'switch.3d_drucker_steckdose' })).toBe(false);
    expect(isRawAllowed('GET', '/api/states/binary_sensor.filament_ams_platte_frei', undefined)).toBe(true);
    expect(isRawAllowed('GET', '/api/states/switch.filament_ams_warteschlange_test', undefined)).toBe(true);
  });
});

describe('Freigabe 1.206: ESP-Werte ohne „ams“ in der ID', () => {
  it('lesen und Warteschlange auch mit anderem ID-Anfang', async () => {
    const { isRawAllowed } = await import('../../server/haRawAllow');
    expect(isRawAllowed('GET', '/api/states/sensor.esp32dev_leser_1', undefined)).toBe(true);
    expect(isRawAllowed('POST', '/api/services/number/set_value', { entity_id: 'number.esp32dev_warteschlange', value: 3 })).toBe(true);
    expect(isRawAllowed('POST', '/api/services/switch/turn_on', { entity_id: 'switch.esp32dev_warteschlange_test' })).toBe(true);
    expect(isRawAllowed('POST', '/api/services/switch/turn_on', { entity_id: 'switch.steckdose' })).toBe(false);
    expect(isRawAllowed('GET', '/api/states/lock.haustuer', undefined)).toBe(false);
  });
});
