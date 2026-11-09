import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { describeThreeMf, displayNameOf, isOurRename, pickEvictions, type ArchiveEntry } from '../../server/hub/archive';

const plate = (i: number, g: number, t: string, sec: number) =>
  `<plate><metadata key="index" value="${i}"/><metadata key="prediction" value="${sec}"/><filament id="1" type="${t}" color="#00FF00" used_g="${g}"/></plate>`;
const zip = (xml: string) => zipSync({ 'Metadata/slice_info.config': strToU8(`<config>${xml}</config>`) });

const e = (id: string, size: number, lastUsed: number, fav = false) => ({ id, size, lastUsed, fav }) as ArchiveEntry;

describe('Datei-Archiv', () => {
  it('fasst Material, Gramm und Zeit über alle Platten zusammen', () => {
    const d = describeThreeMf(zip(plate(1, 10, 'PLA', 600) + plate(2, 5.5, 'PETG', 300)));
    expect(d.materials).toEqual(['PLA', 'PETG']);
    expect(d.grams).toBe(15.5);
    expect(d.sec).toBe(900);
    expect(d.plates).toHaveLength(2);
    expect(d.plates[1]).toMatchObject({ plate: 2, grams: 5.5, types: ['PETG'] });
  });
  it('kaputte Datei gibt leere Werte', () => {
    const d = describeThreeMf(zipSync({ 'a.txt': strToU8('x') }));
    expect(d.materials).toEqual([]);
    expect(d.grams).toBe(0);
  });
  it('Anzeigename ohne Endung', () => {
    expect(displayNameOf('/x/Vase.gcode.3mf')).toBe('Vase');
    expect(displayNameOf('Box.3mf')).toBe('Box');
    expect(isOurRename('fh_0123456789ab.gcode.3mf')).toBe(true);
    expect(isOurRename('Vase.3mf')).toBe(false);
  });
  it('Aufräumen: älteste zuerst, markierte nie', () => {
    const list = [e('a', 100, 1, true), e('b', 100, 2), e('c', 100, 3), e('d', 100, 4)];
    expect(pickEvictions(list, 250, 99)).toEqual(['b', 'c']);
    expect(pickEvictions(list, 1000, 2)).toEqual(['b', 'c']);
    expect(pickEvictions(list, 1000, 99)).toEqual([]);
    expect(pickEvictions([e('a', 100, 1, true)], 10, 0)).toEqual([]);
  });
});
