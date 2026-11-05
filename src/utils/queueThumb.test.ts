import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { thumbFromThreeMf, weightsFromThreeMf } from '../../server/bambuJobFile';

describe('Warteschlange: Titelbild aus .3mf', () => {
  const png = new Uint8Array(200).fill(7);
  const slice = '<config><plate><metadata key="index" value="2"/><filament id="1" type="PLA" color="#FF0000" used_g="12.5"/></plate></config>';
  const zip = zipSync({ 'Metadata/plate_1.png': new Uint8Array(150).fill(1), 'Metadata/plate_2.png': png, 'Metadata/slice_info.config': strToU8(slice) });
  it('nimmt das Bild der richtigen Platte', () => {
    const t = thumbFromThreeMf(zip, 2);
    expect(t?.length).toBe(200);
  });
  it('fällt auf Platte 1 zurück', () => {
    expect(thumbFromThreeMf(zip, 5)?.length).toBe(150);
  });
  it('ohne Bild: null, Gewicht bleibt lesbar', () => {
    const z2 = zipSync({ 'Metadata/slice_info.config': strToU8(slice) });
    expect(thumbFromThreeMf(z2, 1)).toBeNull();
    expect(weightsFromThreeMf(z2, 2)?.filaments[0]?.grams).toBe(12.5);
  });
});
