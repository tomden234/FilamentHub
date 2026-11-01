import { describe, expect, it } from 'vitest';
import type { Spool } from '../types/filament';
import { checkQueueItem, sameJob } from './printQueue';

const sp = (material: string, remainingWeight: number, name = 'Test'): Spool => ({ id: name + material + remainingWeight, brand: 'Bambu', name, material, remainingWeight } as unknown as Spool);

describe('printQueue', () => {
  it('erkennt denselben Auftrag trotz Dateiendung und Schreibweise', () => {
    expect(sameJob('Case_v2.gcode.3mf', 'case v2')).toBe(true);
    expect(sameJob('Halter', 'Case')).toBe(false);
    expect(sameJob('', 'Case')).toBe(false);
  });
  it('Filament reicht', () => {
    const r = checkQueueItem({ id: '1', name: 'A', material: 'PETG', grams: 50 }, [sp('PETG Basic', 300), sp('PLA', 900)]);
    expect(r.ok).toBe(true);
  });
  it('Material fehlt im AMS', () => {
    const r = checkQueueItem({ id: '1', name: 'A', material: 'ABS', grams: 50 }, [sp('PLA', 900)]);
    expect(r.ok).toBe(false);
    expect(r.text).toContain('steckt nicht im AMS');
  });
  it('Zu wenig auf der Spule', () => {
    const r = checkQueueItem({ id: '1', name: 'A', material: 'PLA', grams: 200 }, [sp('PLA', 80)]);
    expect(r.ok).toBe(false);
    expect(r.text).toContain('Zu wenig');
  });
  it('nimmt die knappste Spule, die noch reicht', () => {
    const r = checkQueueItem({ id: '1', name: 'A', material: 'PLA', grams: 100 }, [sp('PLA', 900, 'voll'), sp('PLA', 150, 'knapp')]);
    expect(r.spool?.name).toBe('knapp');
  });
});
