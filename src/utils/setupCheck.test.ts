import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseSetup, setupFromThreeMf, bedLabel } from '../../server/bambuJobFile';
import { setupInfo, nozzleText } from '../../server/hub/setupCheck';

describe('Platte & Düse aus der .3mf', () => {
  it('liest Platte und Düsen', () => {
    const r = parseSetup(JSON.stringify({ curr_bed_type: 'Textured PEI Plate', nozzle_diameter: ['0.4', '0.6'] }));
    expect(r).toEqual({ bed: 'Texturierte PEI', nozzles: [0.4, 0.6], temps: [] });
  });
  it('kaputtes JSON gibt leer zurück', () => {
    expect(parseSetup('{kaputt')).toEqual({ bed: '', nozzles: [], temps: [] });
  });
  it('unbekannte Platte bleibt lesbar', () => {
    expect(bedLabel('Foo Plate')).toBe('Foo Plate');
    expect(bedLabel('Smooth PEI Plate')).toBe('Glatte PEI');
  });
  it('findet project_settings.config im Zip', () => {
    const z = zipSync({ 'Metadata/project_settings.config': strToU8('{"curr_bed_type":"Engineering Plate","nozzle_diameter":["0.4"]}') });
    expect(setupFromThreeMf(z)).toEqual({ bed: 'Engineering', nozzles: [0.4], temps: [] });
    expect(setupFromThreeMf(zipSync({ 'a.txt': strToU8('x') }))).toBeNull();
  });
});

describe('Wechsel-Hinweis', () => {
  it('meldet Plattenwechsel und Düsenwechsel', () => {
    const i = setupInfo({ bed: 'Texturierte PEI', nozzles: [0.6] }, { bed: 'Glatte PEI', nozzles: [0.4] });
    expect(i.changes).toEqual(['Platte: Glatte PEI → Texturierte PEI', 'Düse: 0,4 → 0,6 mm']);
  });
  it('kein Hinweis bei gleichem Setup oder ohne Vergleich', () => {
    expect(setupInfo({ bed: 'A', nozzles: [0.4, 0.4] }, { bed: 'A', nozzles: [0.4] }).changes).toEqual([]);
    expect(setupInfo({ bed: 'A', nozzles: [0.4] }, null).changes).toEqual([]);
    expect(setupInfo({ bed: 'A', nozzles: [0.4] }, { bed: '', nozzles: [], temps: [] }).changes).toEqual([]);
  });
  it('Text bei zwei verschiedenen Düsen', () => {
    expect(nozzleText([0.4, 0.6])).toBe('0,4 / 0,6');
  });
});

import { checkEnough } from '../../server/hub/enough';

describe('Profil-Wächter: Temperatur', () => {
  it('liest die Düsentemperatur je Filament', () => {
    expect(parseSetup(JSON.stringify({ curr_bed_type: 'x', nozzle_temperature: ['220', '245'] })).temps).toEqual([220, 245]);
    expect(parseSetup(JSON.stringify({ nozzle_temperature: ['abc'] })).temps).toEqual([]);
  });
  const base = {
    filaments: [{ id: 1, type: 'PETG', colorHex: '#000000', grams: 10 }],
    chosen: { 1: { key: '0:0' } },
    amsSlots: { '1': 's1' }
  };
  const sp = (t?: number) => [{ id: 's1', material: 'PETG', remainingWeight: 500, nozzleTemp: t }];
  it('warnt bei 25 °C Unterschied', () => {
    const r = checkEnough({ ...base, spools: sp(245), temps: [220] });
    expect(r[0].tempNote).toContain('220');
    expect(r[0].tempNote).toContain('245');
  });
  it('keine Warnung bei kleinem Unterschied oder fehlenden Werten', () => {
    expect(checkEnough({ ...base, spools: sp(235), temps: [225] })[0].tempNote).toBeUndefined();
    expect(checkEnough({ ...base, spools: sp(undefined), temps: [220] })[0].tempNote).toBeUndefined();
    expect(checkEnough({ ...base, spools: sp(245) })[0].tempNote).toBeUndefined();
  });
});
