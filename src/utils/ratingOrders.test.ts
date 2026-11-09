import { describe, expect, it } from 'vitest';
import { summarize, withPrint, withRating, ratingActions } from '../../server/hub/rating';
import { confirmOrder, dueTomorrow, orderActions } from '../../server/hub/orders';

describe('👍/👎 nach dem Druck', () => {
  it('merkt Druck, trägt Urteil ein und fasst pro Modell zusammen', () => {
    let l = withPrint([], { id: 'vase|s1', name: 'Vase', fils: ['ELEGOO PLA Weiß'] }).list;
    const h = withPrint(l, { id: 'vase|s1', name: 'Vase', fils: [] }).h;
    expect(withPrint(l, { id: 'vase|s1', name: 'Vase', fils: [] }).list).toHaveLength(1);
    l = withRating(l, h, true).list;
    l = withPrint(l, { id: 'vase|s2', name: 'Vase', fils: ['JAYO PLA Schwarz'] }).list;
    const h2 = withPrint(l, { id: 'vase|s2', name: 'Vase', fils: [] }).h;
    l = withRating(l, h2, false).list;
    const s = summarize(l, 'Vase', 'x');
    expect(s).toContain('👍 Gut mit: ELEGOO PLA Weiß');
    expect(s).toContain('👎 Schlecht mit: JAYO PLA Schwarz');
    expect(summarize(l, 'Anderes Teil')).toBe('');
    expect(ratingActions(h)[0].action).toMatch(/^FH_R_UP_[0-9a-f]{12}$/);
  });
});

describe('Lieferstatus-Push', () => {
  const inc = (status: string, eta: string, extra: any = {}) => ({ id: 's', brand: 'ELEGOO', name: 'PLA', incoming: { key: 'k', orderId: 'O1', status, eta, ...extra } });
  it('meldet nur Spulen, die morgen kommen, nur einmal', () => {
    const now = new Date(2026, 10, 9, 10);
    expect(dueTomorrow([inc('shipped', '2026-11-10'), inc('shipped', '2026-11-11'), inc('delivered', '2026-11-10'), inc('ordered', '2026-11-10', { etaPushed: '2026-11-10' })], now)).toEqual([0]);
  });
  it('„Habe ich“ macht zugestellte Spulen der Bestellung normal', () => {
    const h = orderActions('O1')[0].action.replace('FH_O_HAVE_', '');
    const r = confirmOrder({ spools: [inc('delivered', ''), inc('shipped', ''), { id: 'x' }] }, h);
    expect(r.names).toHaveLength(1);
    expect(r.doc.spools[0].incoming).toBeUndefined();
    expect(r.doc.spools[0].deliveredKey).toBe('deliv:k');
    expect(r.doc.spools[1].incoming).toBeTruthy();
  });
});

import { byFilament, byModel, unrated } from './printRatings';
describe('Bewertungs-Ansicht', () => {
  const e = (h: string, name: string, fils: string[], rating: 0 | 1 | -1, at: number) => ({ h, id: h, model: name.toLowerCase(), name, fils, rating, at });
  const l = [e('a', 'Vase', ['ELEGOO PLA Weiß'], 1, 1), e('b', 'Vase', ['ELEGOO PLA Weiß'], 1, 2), e('c', 'Vase', ['JAYO PLA'], -1, 3), e('d', 'Box', ['JAYO PLA'], 0, 4)];
  it('gruppiert nach Modell und Filament', () => {
    const m = byModel(l);
    expect(m).toHaveLength(1);
    expect(m[0].combos.find(c => c.fils === 'ELEGOO PLA Weiß')).toMatchObject({ up: 2, down: 0 });
    expect(byFilament(l)[0].fil).toBe('ELEGOO PLA Weiß');
    expect(unrated(l).map(x => x.h)).toEqual(['d']);
  });
});
