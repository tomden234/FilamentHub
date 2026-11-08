import { describe, expect, it } from 'vitest';
import { checkEnough, enoughLines, slotNumber } from '../../server/hub/enough';

const sp = (id: string, material: string, colorHex: string, rest: number, extra: Record<string, unknown> = {}) => ({ id, brand: 'B', name: id, material, colorHex, remainingWeight: rest, ...extra });

describe('slotNumber', () => {
  it('AMS 1 = 1-4, extern = 5, andere Einheiten = keine Zuordnung', () => {
    expect(slotNumber('0:0')).toBe(1);
    expect(slotNumber('0:3')).toBe(4);
    expect(slotNumber('255:0')).toBe(5);
    expect(slotNumber('1:0')).toBeNull();
    expect(slotNumber('')).toBeNull();
  });
});

describe('checkEnough', () => {
  const fil = [{ id: 1, type: 'PLA', colorHex: '#FFFFFF', grams: 100 }];
  const chosen = { 1: { key: '0:1' } };
  it('reicht: Rest ≥ Gramm + 10 %', () => {
    const r = checkEnough({ filaments: fil, chosen, amsSlots: { '2': 'a' }, spools: [sp('a', 'PLA', '#FFFFFF', 110)] });
    expect(r[0].ok).toBe(true);
    expect(r[0].need).toBe(110);
  });
  it('reicht nicht: Fehlbetrag, Ersatz klein zuerst, Kauf-Angaben', () => {
    const spools = [sp('a', 'PLA', '#FFFFFF', 80, { productUrl: 'https://x.de/a' }), sp('big', 'PLA', '#FEFEFE', 900), sp('small', 'PLA', '#FAFAFA', 150), sp('petg', 'PETG', '#FFFFFF', 500), sp('red', 'PLA', '#FF0000', 500)];
    const r = checkEnough({ filaments: fil, chosen, amsSlots: { '2': 'a' }, spools });
    expect(r[0].ok).toBe(false);
    expect(r[0].missing).toBe(30);
    expect(r[0].alternatives.map(a => a.id)).toEqual(['small', 'big']);
    expect(r[0].buy?.url).toBe('https://x.de/a');
    expect(enoughLines(r)[0]).toContain('Besser:');
  });
  it('zwei Filamente auf derselben Spule: Summe zählt', () => {
    const two = [{ id: 1, type: 'PLA', colorHex: '#FFFFFF', grams: 60 }, { id: 2, type: 'PLA', colorHex: '#FFFFFF', grams: 60 }];
    const r = checkEnough({ filaments: two, chosen: { 1: { key: '0:1' }, 2: { key: '0:1' } }, amsSlots: { '2': 'a' }, spools: [sp('a', 'PLA', '#FFFFFF', 100)] });
    expect(r.every(x => !x.ok)).toBe(true);
    expect(r[0].need).toBe(132);
  });
  it('Spule nicht zugeordnet oder andere AMS-Einheit: kein Alarm', () => {
    expect(checkEnough({ filaments: fil, chosen, amsSlots: {}, spools: [sp('a', 'PLA', '#FFFFFF', 1)] })[0]).toMatchObject({ ok: true, have: null });
    expect(checkEnough({ filaments: fil, chosen: { 1: { key: '1:0' } }, amsSlots: { '1': 'a' }, spools: [sp('a', 'PLA', '#FFFFFF', 1)] })[0].ok).toBe(true);
  });
});
