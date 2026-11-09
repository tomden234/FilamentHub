import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { platesFromThreeMf } from '../../server/bambuJobFile';

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
});
