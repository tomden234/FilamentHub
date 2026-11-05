import { describe, expect, it } from 'vitest';
import { applyDeduction, deductedIn, expectedMinutes, planParts, shortages, tooLong, historyIdOf } from '../../server/hub/deductPlan';
import { reconcileServerDeducts } from './serverDeducts';

const spools = [
  { id: 'a', brand: 'Sunlu', name: 'PLA Weiß', material: 'PLA', colorHex: '#FFFFFF', pricePerKg: 20, remainingWeight: 500 },
  { id: 'b', brand: 'Sunlu', name: 'PETG Schwarz', material: 'PETG', colorHex: '#000000', pricePerKg: 25, remainingWeight: 300 }
];
const trays = [
  { slot: 1, type: 'PLA', colorHex: '#FFFFFF' },
  { slot: 2, type: 'PETG', colorHex: '#000000' }
];
const T = Date.parse('2026-11-05T10:00:00Z');
const print = { id: 'benchy|s1', name: 'Benchy.gcode.3mf', startMs: T - 3600_000, endMs: T, state: 'FINISH' as const, percent: 100 };

describe('Server: welche Spule verliert wie viel', () => {
  it('aus der Druckdatei, zugewiesener Slot gewinnt', () => {
    const parts = planParts({ filaments: [{ type: 'PLA', colorHex: '#FEFEFE', grams: 12.34 }], trays, usedSlots: [1], mainSlot: 1, amsSlots: { '1': 'a', '2': 'b' }, spools, knownGrams: 0 });
    expect(parts).toEqual([{ spoolId: 'a', grams: 12.3 }]);
  });
  it('zwei Filamente auf zwei Spulen', () => {
    const parts = planParts({
      filaments: [
        { type: 'PLA', colorHex: '#FFFFFF', grams: 10 },
        { type: 'PETG', colorHex: '#000000', grams: 5 }
      ],
      trays,
      usedSlots: [1, 2],
      mainSlot: 1,
      amsSlots: { '1': 'a', '2': 'b' },
      spools,
      knownGrams: 0
    });
    expect(parts).toEqual([
      { spoolId: 'a', grams: 10 },
      { spoolId: 'b', grams: 5 }
    ]);
  });
  it('ohne Druckdatei: gemerktes Gewicht auf den Hauptslot', () => {
    expect(planParts({ filaments: null, trays, usedSlots: [2], mainSlot: 2, amsSlots: { '2': 'b' }, spools, knownGrams: 40 })).toEqual([{ spoolId: 'b', grams: 40 }]);
  });
  it('nichts bekannt: leer (App fragt)', () => {
    expect(planParts({ filaments: null, trays, usedSlots: [], mainSlot: null, amsSlots: {}, spools, knownGrams: 0 })).toEqual([]);
  });
});

describe('Server: Abzug genau einmal', () => {
  const doc = { updatedAt: 1, spools, printHistory: [], printLog: [], secure: { d: 'x' } };
  it('zieht ab, schreibt Verlauf, Druckliste und serverDeducts, lässt den Rest', () => {
    const r = applyDeduction(doc, print, [{ spoolId: 'a', grams: 12.4 }], T + 60_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.spools.find((s: any) => s.id === 'a').remainingWeight).toBe(488);
    expect(r.doc.spools.find((s: any) => s.id === 'b').remainingWeight).toBe(300);
    expect(r.doc.printHistory[0]).toMatchObject({ id: historyIdOf(print.id, 'a'), spoolId: 'a', grams: 12 });
    expect(r.doc.printLog[0]).toMatchObject({ id: print.id, grams: 12.4 });
    expect(r.doc.serverDeducts).toHaveLength(1);
    expect(r.doc.secure).toEqual({ d: 'x' });
    expect(r.doc.updatedAt).toBe(T + 60_000);
    // zweiter Versuch: nichts mehr
    const again = applyDeduction(r.doc, print, [{ spoolId: 'a', grams: 12.4 }], T + 120_000);
    expect(again.ok).toBe(false);
  });
  it('App hat schon abgezogen (Druckliste mit Gramm): Server lässt es', () => {
    const d2 = { ...doc, printLog: [{ id: 'anders', name: 'benchy', endMs: T + 5 * 60_000, grams: 12 }] };
    expect(deductedIn(d2, print)).toBe('app');
    expect(applyDeduction(d2, print, [{ spoolId: 'a', grams: 12 }], T).ok).toBe(false);
  });
  it('Eintrag in der Druckliste ohne Gramm wird ergänzt statt verdoppelt', () => {
    const d3 = { ...doc, printLog: [{ id: 'benchy|s1', name: 'Benchy.gcode.3mf', endMs: T, grams: 0, spools: [] }] };
    const r = applyDeduction(d3, print, [{ spoolId: 'a', grams: 10 }], T);
    expect(r.ok && r.doc.printLog).toHaveLength(1);
    expect(r.ok && r.doc.printLog[0].grams).toBe(10);
  });
  it('nie unter 0 g', () => {
    const r = applyDeduction(doc, print, [{ spoolId: 'b', grams: 999 }], T);
    expect(r.ok && r.doc.spools.find((s: any) => s.id === 'b').remainingWeight).toBe(0);
  });
});

describe('App: Server-Abzüge übernehmen (auch wenn ein Gerät alte Daten zurückschrieb)', () => {
  const sd = { id: 'p1', name: 'X', endMs: T, parts: [{ spoolId: 'a', grams: 20 }], at: T };
  it('fehlt im Verlauf: einmal anwenden', () => {
    const r = reconcileServerDeducts(spools as any, [], [sd], [], T);
    expect(r.changed).toBe(true);
    expect(r.spools.find(s => s.id === 'a')!.remainingWeight).toBe(480);
    expect(r.history[0].id).toBe(historyIdOf('p1', 'a'));
    expect(r.applied).toEqual(['p1']);
    // nochmal: nichts
    const r2 = reconcileServerDeducts(r.spools, r.history, [sd], r.applied, T);
    expect(r2.changed).toBe(false);
  });
  it('schon im Verlauf (Cloud übernommen): nur merken, nicht abziehen', () => {
    const hist = [{ id: historyIdOf('p1', 'a'), spoolId: 'a', spoolLabel: 'x', grams: 20, timestamp: '' }];
    const r = reconcileServerDeducts(spools as any, hist, [sd], [], T);
    expect(r.changed).toBe(false);
    expect(r.applied).toEqual(['p1']);
  });
  it('alt (über 3 Tage) und nie gesehen: nur merken', () => {
    const r = reconcileServerDeducts(spools as any, [], [sd], [], T + 4 * 86400_000);
    expect(r.changed).toBe(false);
    expect(r.applied).toEqual(['p1']);
  });
  it('schon gemerkt (z. B. Verlauf gelöscht): nie nochmal', () => {
    const r = reconcileServerDeducts(spools as any, [], [sd], ['p1'], T);
    expect(r.changed).toBe(false);
  });
});

describe('Server: Warnungen', () => {
  it('Spule reicht nicht', () => {
    const t = shortages({ filaments: [{ type: 'PETG', colorHex: '#000000', grams: 400 }], trays, amsSlots: { '2': 'b' }, spools, mainSlot: 2, knownGrams: 0, left: 1 });
    expect(t[0]).toContain('reicht evtl. nicht');
    expect(shortages({ filaments: [{ type: 'PETG', colorHex: '#000000', grams: 100 }], trays, amsSlots: { '2': 'b' }, spools, mainSlot: 2, knownGrams: 0, left: 1 })).toEqual([]);
    expect(shortages({ filaments: [{ type: 'ABS', colorHex: '#000000', grams: 10 }], trays, amsSlots: {}, spools, mainSlot: 2, knownGrams: 0, left: 1 })[0]).toContain('Kein ABS');
  });
  it('dauert zu lange', () => {
    const hist = [
      { name: 'Teil.3mf', startMs: 0, endMs: 60 * 60_000, state: 'FINISH' },
      { name: 'teil', startMs: 0, endMs: 80 * 60_000, state: 'FINISH' }
    ];
    expect(expectedMinutes(hist, 'Teil', 999)).toBe(70);
    expect(expectedMinutes([], 'Teil', 50)).toBe(50);
    expect(tooLong(100, 70)).toBe(true);
    expect(tooLong(85, 70)).toBe(false);
    expect(tooLong(25, 10)).toBe(false); // nur 15 min länger
    expect(tooLong(500, 0)).toBe(false);
  });
});
