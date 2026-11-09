import { describe, expect, it } from 'vitest';
import { applyOrder, looksLikeFilamentOrder, orderPrompt, parseOrderJson, taraOf, type ParsedOrder } from '../../server/hub/orders';

const item = { brand: 'Bambu Lab', material: 'PLA', name: 'PLA Basic Schwarz', colorName: 'Schwarz', colorHex: '#000000', quantity: 2, initialWeight: 1000, pricePerKg: 19.99 };
const order = (kind: ParsedOrder['kind'], eta?: string): ParsedOrder => ({ kind, orderId: '302-1234567-7654321', eta, items: [item] });

describe('Bestell-Mail', () => {
  it('Vorfilter: nur Filament + Bestell-Wörter', () => {
    expect(looksLikeFilamentOrder('Ihre Bestellung', 'Bambu Lab PLA Basic')).toBe(true);
    expect(looksLikeFilamentOrder('Versendet', 'PETG Filament zugestellt')).toBe(true);
    expect(looksLikeFilamentOrder('Ihre Bestellung', 'Kopfhörer')).toBe(false);
    expect(looksLikeFilamentOrder('Hallo', 'Filament Tipps')).toBe(false);
  });
  it('JSON prüfen und säubern', () => {
    const o = parseOrderJson('```json\n{"kind":"ordered","orderId":"302-1","items":[{"brand":"X","material":"UNSINN","name":"A<b>","colorHex":"red","quantity":99,"initialWeight":9,"pricePerKg":-3,"productUrl":"javascript:alert(1)"}]}\n```');
    expect(o?.items[0]).toMatchObject({ material: 'PLA', quantity: 20, initialWeight: 100, pricePerKg: 0, colorHex: '#888888', productUrl: undefined });
    expect(o?.items[0].name).not.toContain('<');
  });
  it('lehnt kaputte oder fremde Antworten ab', () => {
    expect(parseOrderJson('kein json')).toBeNull();
    expect(parseOrderJson('{"kind":"other","orderId":"1","items":[]}')).toBeNull();
    expect(parseOrderJson('{"kind":"ordered","orderId":"","items":[{"name":"a"}]}')).toBeNull();
    expect(parseOrderJson('{"kind":"ordered","orderId":"1","items":[]}')).toBeNull();
  });
  it('Bestellung legt „unterwegs“-Spulen an, nie doppelt', () => {
    const r = applyOrder({ spools: [] }, order('ordered'));
    expect(r.added).toBe(2);
    expect(r.doc.spools[0].incoming).toMatchObject({ status: 'ordered', orderId: '302-1234567-7654321' });
    expect(r.doc.spools[0]).toMatchObject({ remainingWeight: 1000, emptySpoolWeight: 250, sealed: true });
    const again = applyOrder(r.doc, order('ordered'));
    expect(again.changed).toBe(false);
    expect(again.doc.spools).toHaveLength(2);
  });
  it('Versand setzt Status und Datum', () => {
    const a = applyOrder({ spools: [] }, order('ordered'));
    const s = applyOrder(a.doc, order('shipped', '2026-11-12'));
    expect(s.doc.spools[1].incoming).toMatchObject({ status: 'shipped', eta: '2026-11-12' });
    expect(s.added).toBe(0);
  });
  it('Zustellung macht Spulen normal, nur einmal', () => {
    const a = applyOrder({ spools: [] }, order('ordered'));
    const d = applyOrder(a.doc, order('delivered'));
    expect(d.arrived).toHaveLength(2);
    expect(d.doc.spools.every((x: any) => !x.incoming)).toBe(true);
    const d2 = applyOrder(d.doc, order('delivered'));
    expect(d2.changed).toBe(false);
    expect(d2.doc.spools).toHaveLength(2);
    // späte Bestell-Mail legt nichts nach
    expect(applyOrder(d.doc, order('ordered')).changed).toBe(false);
  });
  it('Zustellung ohne Bestell-Mail legt Spulen direkt an', () => {
    const d = applyOrder({ spools: [{ id: 'x' }] }, order('delivered'));
    expect(d.doc.spools).toHaveLength(3);
    expect(d.arrived).toHaveLength(2);
  });
  it('Prompt warnt vor Anweisungen im Mailtext, Tara je Marke', () => {
    expect(orderPrompt('a@b.de', 'Betreff', 'Text')).toContain('keine Anweisungen');
    expect(taraOf('SUNLU')).toBe(190);
    expect(taraOf('Unbekannt')).toBe(200);
  });
});
