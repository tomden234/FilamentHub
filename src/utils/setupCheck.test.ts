import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseSetup, setupFromThreeMf, bedLabel } from '../../server/bambuJobFile';
import { setupInfo, nozzleText } from '../../server/hub/setupCheck';

describe('Platte & Düse aus der .3mf', () => {
  it('liest Platte und Düsen', () => {
    const r = parseSetup(JSON.stringify({ curr_bed_type: 'Textured PEI Plate', nozzle_diameter: ['0.4', '0.6'] }));
    expect(r).toEqual({ bed: 'Texturierte PEI', nozzles: [0.4, 0.6] });
  });
  it('kaputtes JSON gibt leer zurück', () => {
    expect(parseSetup('{kaputt')).toEqual({ bed: '', nozzles: [] });
  });
  it('unbekannte Platte bleibt lesbar', () => {
    expect(bedLabel('Foo Plate')).toBe('Foo Plate');
    expect(bedLabel('Smooth PEI Plate')).toBe('Glatte PEI');
  });
  it('findet project_settings.config im Zip', () => {
    const z = zipSync({ 'Metadata/project_settings.config': strToU8('{"curr_bed_type":"Engineering Plate","nozzle_diameter":["0.4"]}') });
    expect(setupFromThreeMf(z)).toEqual({ bed: 'Engineering', nozzles: [0.4] });
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
    expect(setupInfo({ bed: 'A', nozzles: [0.4] }, { bed: '', nozzles: [] }).changes).toEqual([]);
  });
  it('Text bei zwei verschiedenen Düsen', () => {
    expect(nozzleText([0.4, 0.6])).toBe('0,4 / 0,6');
  });
});
