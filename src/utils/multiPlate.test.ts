import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { bedsFromThreeMf, platesFromThreeMf } from '../../server/bambuJobFile';

const plate = (i: number, g: number, t = 'PLA') =>
  `<plate><metadata key="index" value="${i}"/><metadata key="prediction" value="${i * 1000}"/>${g > 0 ? `<filament id="1" type="${t}" color="#FF0000" used_g="${g}"/>` : ''}</plate>`;
const zip = (xml: string) => zipSync({ 'Metadata/slice_info.config': strToU8(`<config>${xml}</config>`) });

describe('Mehrere Platten einer Datei', () => {
  it('liest alle Platten mit Filament, sortiert', () => {
    const r = platesFromThreeMf(zip(plate(3, 5) + plate(1, 10) + plate(2, 20, 'PETG')));
    expect(r.map(p => p.plate)).toEqual([1, 2, 3]);
    expect(r[1].filaments[0]).toMatchObject({ type: 'PETG', grams: 20 });
    expect(r[2].predSec).toBe(3000);
  });
  it('überspringt Platten ohne Filament', () => {
    expect(platesFromThreeMf(zip(plate(1, 10) + plate(2, 0) + plate(3, 7))).map(p => p.plate)).toEqual([1, 3]);
  });
  it('eine Platte und fehlende Datei', () => {
    expect(platesFromThreeMf(zip(plate(1, 4)))).toHaveLength(1);
    expect(platesFromThreeMf(zipSync({ 'a.txt': strToU8('x') }))).toEqual([]);
  });
  it('1.299: Plattennummer = G-Code in der Datei (Neu-Nummerierung, fehlender G-Code)', () => {
    const withG = (xml: string, nums: number[]) =>
      zipSync({ 'Metadata/slice_info.config': strToU8(`<config>${xml}</config>`), ...Object.fromEntries(nums.map(n => [`Metadata/plate_${n}.gcode`, strToU8('G1')])) });
    // slice_info sagt 2, im Zip liegt nur plate_1.gcode: Start muss Platte 1 nehmen
    expect(platesFromThreeMf(withG(plate(2, 9), [1])).map(p => p.plate)).toEqual([1]);
    // 2 und 3 mit Filament, aber nur G-Code für 2 und 3: bleibt
    expect(platesFromThreeMf(withG(plate(2, 9) + plate(3, 4), [2, 3])).map(p => p.plate)).toEqual([2, 3]);
    // drei Platten in slice_info, G-Code nur für 1 und 3: Platte 2 fällt weg
    expect(platesFromThreeMf(withG(plate(1, 1) + plate(2, 2) + plate(3, 3), [1, 3])).map(p => p.plate)).toEqual([1, 3]);
  });
  it('1.302: Druckplatte je Platte aus model_settings.config', () => {
    const pl = (id: number, bed: string) => `<plate><metadata key="plater_id" value="${id}"/><metadata key="bed_type" value="${bed}"/></plate>`;
    const z = zipSync({ 'Metadata/model_settings.config': strToU8(`<config>${pl(1, 'Textured PEI Plate')}${pl(2, 'Cool Plate')}${pl(3, '')}${pl(4, 'Engineering Plate')}</config>`) });
    expect(bedsFromThreeMf(z)).toEqual({ 1: 'Texturierte PEI', 2: 'Cool Plate', 4: 'Engineering' });
    expect(bedsFromThreeMf(zipSync({ 'a.txt': strToU8('x') }))).toEqual({});
  });
});
