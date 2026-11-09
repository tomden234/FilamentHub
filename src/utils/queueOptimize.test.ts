import { describe, expect, it } from 'vitest';
import { filamentKey, optimize, statsOf, type OptItem } from '../../server/hub/queueOptimize';

const mk = (id: string, bed: string, keys: string[], sec = 3600, extra: Partial<OptItem> = {}): OptItem => ({ id, bed, nozzle: '0,4', keys, sec, ...extra });
// Mittag in Berlin (CET, UTC+1): 11:00 UTC = 12:00 Ortszeit
const NOON = Date.UTC(2026, 10, 9, 11, 0);

describe('Warteschlange smart sortieren', () => {
  it('gleiche Platte zusammen: A B A → A A B', () => {
    const a1 = mk('a1', 'Glatte PEI', ['PLA|#FF0000']);
    const b = mk('b', 'Texturierte PEI', ['PLA|#FF0000']);
    const a2 = mk('a2', 'Glatte PEI', ['PLA|#FF0000']);
    const p = optimize([a1, b, a2], NOON);
    expect(p.changed).toBe(true);
    expect(p.before.bedChanges).toBe(2);
    expect(p.after.bedChanges).toBe(1);
    expect(p.reasons.join()).toContain('Plattenwechsel 2 → 1');
    expect(p.order.indexOf('b')).not.toBe(1);
  });
  it('wenige Spulenwechsel', () => {
    const x = (id: string, k: string) => mk(id, 'P', [k]);
    const p = optimize([x('1', 'PLA|#111111'), x('2', 'PETG|#222222'), x('3', 'PLA|#111111')], NOON);
    expect(p.after.spoolSwaps).toBeLessThan(p.before.spoolSwaps);
  });
  it('langer Druck wandert in die Nacht', () => {
    const long = mk('long', 'P', ['PLA|#111111'], 8 * 3600);
    const short = mk('short', 'P', ['PLA|#111111'], 1800);
    // Mittags starten: langer zuerst läuft 12-20 Uhr am Tag, kurzer zuerst verschiebt ihn kaum. Nach Mitternacht starten ist besser als mittags.
    const p = optimize([long, short], Date.UTC(2026, 10, 9, 17, 0)); // 18 Uhr Ortszeit: lang ab 18 Uhr = 4 h Tag; erst kurz → 18:30
    expect(p.after.dayHours).toBeLessThanOrEqual(p.before.dayHours);
  });
  it('Platten eines Projekts bleiben zusammen und in Reihenfolge', () => {
    const p1 = mk('p1', 'P', ['PLA|#111111'], 3600, { project: 'X', part: 1 });
    const p2 = mk('p2', 'P', ['PLA|#111111'], 3600, { project: 'X', part: 2 });
    const o = mk('o', 'Q', ['PLA|#111111']);
    const r = optimize([p2, o, p1], NOON);
    const i1 = r.order.indexOf('p1');
    expect(r.order.indexOf('p2')).toBe(i1 + 1);
  });
  it('schon gut: nichts ändern', () => {
    const a = mk('a', 'P', ['PLA|#111111']);
    const b = mk('b', 'P', ['PLA|#111111']);
    const p = optimize([a, b], NOON);
    expect(p.changed).toBe(false);
    expect(p.order).toEqual(['a', 'b']);
  });
  it('viele Einträge (>8) laufen durch und sortieren Platten zusammen', () => {
    const items = Array.from({ length: 10 }, (_, i) => mk(`i${i}`, i % 2 ? 'A' : 'B', ['PLA|#111111']));
    const p = optimize(items, NOON);
    expect(p.after.bedChanges).toBeLessThan(p.before.bedChanges);
    expect(new Set(p.order).size).toBe(10);
  });
  it('Statistik und Schlüssel', () => {
    expect(statsOf([mk('a', 'P', ['PLA|#1']), mk('b', 'Q', ['PETG|#1'])], NOON).bedChanges).toBe(1);
    expect(filamentKey('PLA Basic', '#ff0000')).toBe(filamentKey('PLA', '#FF0000'));
  });
});
