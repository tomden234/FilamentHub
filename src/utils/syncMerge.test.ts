import { describe, expect, it, vi } from 'vitest';
import { mergeById, mergeHistory } from './syncMerge';

const sp = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `Spule ${id}`, remainingWeight: 1000, ...extra });

describe('1.231: Drei-Wege-Abgleich der Spulen', () => {
  it('Änderungen auf zwei Geräten an verschiedenen Spulen bleiben beide erhalten', () => {
    const base = [sp('a'), sp('b')];
    const local = [sp('a', { name: 'Neu A' }), sp('b')];
    const remote = [sp('a'), sp('b', { name: 'Neu B' })];
    expect(mergeById(base, local, remote)).toEqual([sp('a', { name: 'Neu A' }), sp('b', { name: 'Neu B' })]);
  });

  it('Abzug vom Pi und Umbenennen hier an derselben Spule: beides bleibt (Feld für Feld)', () => {
    const base = [sp('a')];
    const local = [sp('a', { name: 'Galaxy' })];
    const remote = [sp('a', { remainingWeight: 950 })];
    expect(mergeById(base, local, remote)).toEqual([sp('a', { name: 'Galaxy', remainingWeight: 950 })]);
  });

  it('gleiches Feld auf beiden Seiten geändert: dieses Gerät gewinnt', () => {
    expect(mergeById([sp('a')], [sp('a', { remainingWeight: 700 })], [sp('a', { remainingWeight: 950 })])[0].remainingWeight).toBe(700);
  });

  it('Löschen hier und dort, neue Spulen hier und dort', () => {
    const base = [sp('a'), sp('b'), sp('c')];
    const local = [sp('a'), sp('c'), sp('neuL')]; // b hier gelöscht
    const remote = [sp('a'), sp('b'), sp('neuR')]; // c dort gelöscht
    expect(mergeById(base, local, remote).map(x => x.id)).toEqual(['a', 'neuL', 'neuR']);
  });

  it('dort gelöscht, hier aber geändert: Änderung gewinnt (nichts geht unbemerkt verloren)', () => {
    expect(mergeById([sp('a')], [sp('a', { name: 'X' })], []).map(x => x.id)).toEqual(['a']);
    expect(mergeById([sp('a')], [], [sp('a', { remainingWeight: 1 })]).map(x => x.id)).toEqual(['a']);
  });

  it('Feld-Reihenfolge ist egal', () => {
    const a = { id: 'a', x: 1, y: 2 };
    const b = { y: 2, id: 'a', x: 1 };
    expect(mergeById([a], [b], [a])).toEqual([b]);
  });

  it('Verbrauch: Einträge vereinigt, neueste zuerst', () => {
    const h = (id: string, t: string) => ({ id, timestamp: t, grams: 1 });
    const base = [h('1', '2026-01-01T00:00:00Z')];
    const local = [h('2', '2026-01-03T00:00:00Z'), ...base];
    const remote = [h('srv:x:a', '2026-01-04T00:00:00Z'), ...base];
    expect(mergeHistory(base, local, remote).map(x => x.id)).toEqual(['srv:x:a', '2', '1']);
  });
});

describe('1.231: Speichern mit Abgleich (cloudSync.saveMerged)', () => {
  it('bei gleichzeitiger Änderung (409) gewinnt nicht mehr der alte Stand', async () => {
    let doc: any = { spools: [sp('a'), sp('b', { name: 'Anderes Gerät' })], printHistory: [], updatedAt: 2 };
    let rev = 1;
    vi.doMock('../utils/cloudFetch', () => ({
      cloudFetch: async () => new Response(JSON.stringify(doc)),
      cloudUpdateDoc: async (_u: string, build: (e: any) => any) => {
        const next = build(JSON.parse(JSON.stringify(doc)));
        doc = next;
        rev++;
        return next;
      }
    }));
    const { cloudSync } = await import('../api/storageApi');
    const base = { spools: [sp('a'), sp('b')], history: [] };
    const out = await cloudSync.saveMerged('pi:', { spools: [sp('a', { name: 'Hier' }), sp('b')], printHistory: [] }, base);
    expect((out?.spools as any[]).map(x => x.name)).toEqual(['Hier', 'Anderes Gerät']);
    expect(rev).toBe(2);
  });

  it('Druckliste: neueste bleiben beim Kürzen', async () => {
    let doc: any = { spools: [], printLog: Array.from({ length: 400 }, (_, i) => ({ id: `p${i}`, endMs: 1000 + i })) };
    vi.doMock('../utils/cloudFetch', () => ({
      cloudFetch: async () => new Response(JSON.stringify(doc)),
      cloudUpdateDoc: async (_u: string, build: (e: any) => any) => (doc = build(JSON.parse(JSON.stringify(doc))))
    }));
    vi.resetModules();
    const { cloudSync } = await import('../api/storageApi');
    await cloudSync.save('pi:', { printLog: [{ id: 'neu', endMs: 99999 }] as any[] });
    expect(doc.printLog).toHaveLength(400);
    expect(doc.printLog[0].id).toBe('neu');
    expect(doc.printLog.some((r: any) => r.id === 'p0')).toBe(false);
  });
});
