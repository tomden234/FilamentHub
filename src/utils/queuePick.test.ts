import { describe, expect, it } from 'vitest';
import { mapFilaments } from '../../server/hub/hubLogic';
import { scanDelayMs } from '../../server/hub/queue';

const tray = (amsId: number, slotId: number, type: string, colorHex: string): Parameters<typeof mapFilaments>[1][number] => ({ amsId, slotId, type, colorHex, remain: 100 }) as never;
const trays = [tray(0, 0, 'PLA', '#ff0000'), tray(0, 1, 'PETG', '#00ff00'), tray(0, 2, 'PLA', '#0000ff')];
const fil = [{ id: 1, type: 'PLA', colorHex: '#ff0000', grams: 100 }];

describe('1.239 Wahl pro Filament', () => {
  it('automatisch nimmt passendste Farbe', () => {
    const m = mapFilaments(fil, trays);
    expect(m.chosen[1].key).toBe('0:0');
    expect(m.chosen[1].auto).toBe(true);
  });
  it('eigene Wahl hat Vorrang, auch anderes Material', () => {
    const m = mapFilaments(fil, trays, { '1': '0:1' });
    expect(m.chosen[1].key).toBe('0:1');
    expect(m.chosen[1].auto).toBe(false);
    expect(m.missing).toEqual([]);
  });
  it('gewählter Platz weg → zurück auf automatisch', () => {
    const m = mapFilaments(fil, trays, { '1': '3:3' });
    expect(m.chosen[1].auto).toBe(true);
  });
  it('Suche ist schneller solange die App zuschaut', () => {
    expect(scanDelayMs(false, 5, true)).toBe(8000);
    expect(scanDelayMs(false, 5, false)).toBeGreaterThanOrEqual(20000);
  });
});
