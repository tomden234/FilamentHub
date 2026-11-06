import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Ablauf auf dem Pi: Druck endet → Abzug in der Cloud. Auch wenn zwei Versuche gleichzeitig laufen, wird nur EINMAL abgezogen.
describe('Pi-Server: Abzug im Ablauf', () => {
  it('zieht genau einmal ab, auch bei doppeltem Anstoß', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-'));
    process.env.FILAMENT_DATA_DIR = dir;
    process.env.FILAMENTHUB_HUB = '1';
    let doc: any = {
      updatedAt: 1,
      spools: [{ id: 'a', brand: 'Sunlu', name: 'PLA Weiß', material: 'PLA', colorHex: '#FFFFFF', pricePerKg: 20, remainingWeight: 500 }],
      printHistory: [],
      printLog: []
    };
    let posts = 0;
    vi.stubGlobal('fetch', async (url: string, init?: any) => {
      if (!String(url).startsWith('https://api.npoint.io/')) throw new Error('kein Netz');
      if (init?.method === 'POST') {
        posts++;
        await new Promise(r => setTimeout(r, 20));
        doc = JSON.parse(init.body);
        return new Response('{}', { status: 200 });
      }
      await new Promise(r => setTimeout(r, 10));
      return new Response(JSON.stringify(doc), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const hub = await import('../../server/hub/hub');
    hub.attachPrinter({ getStatus: () => ({ connected: false }), getLanAccess: () => null, stopDrying: async () => false, command: async () => undefined, resumeAfterError: async () => undefined, delayedResume: () => 0, startProject: async () => undefined });
    hub.updateHubConfig({ cloudUrl: 'https://api.npoint.io/abc123', amsSlots: { '1': 'a' }, jobGrams: { benchy: 20 } });
    const T = Date.now();
    const rec = { id: 'benchy|s1', name: 'Benchy.gcode.3mf', startMs: T - 3600_000, endMs: T, state: 'FINISH' as const, percent: 100, slots: { '1': 3000 } };
    hub._test.state().prints[rec.id] = { deduct: 'pending', tries: 0, lastTry: 0, photo: false, pushed: false, trays: [{ slot: 1, type: 'PLA', colorHex: '#FFFFFF' }], at: T };

    await Promise.all([hub._test.tryDeduct(rec), hub._test.tryDeduct(rec)]);
    expect(doc.spools[0].remainingWeight).toBe(480);
    expect(posts).toBe(1);
    expect(hub.printMeta(rec.id)?.deduct).toBe('done');

    // Später nochmal angestoßen (z. B. nach Neustart, Antwort beim Speichern verloren): nichts mehr abziehen, gilt als erledigt
    hub._test.state().prints[rec.id].deduct = 'pending';
    await hub._test.tryDeduct(rec);
    expect(doc.spools[0].remainingWeight).toBe(480);
    expect(posts).toBe(1);
    expect(hub.printMeta(rec.id)?.deduct).toBe('done');
    expect(hub.printMeta(rec.id)?.texts?.[0]).toContain('20 g von Sunlu PLA Weiß');

    // Auto-Abzug und „Jetzt abziehen“ aus der App gleichzeitig: trotzdem nur EIN Abzug
    const rec2 = { ...rec, id: 'cube|s2', name: 'Cube.gcode.3mf', startMs: T - 7200_000, endMs: T - 3000_000 };
    hub.updateHubConfig({ jobGrams: { benchy: 20, cube: 30 } });
    hub._test.state().prints[rec2.id] = { deduct: 'pending', tries: 0, lastTry: 0, photo: false, pushed: false, trays: [{ slot: 1, type: 'PLA', colorHex: '#FFFFFF' }], at: T };
    const [, manual] = await Promise.all([hub._test.tryDeduct(rec2), hub.manualDeduct(rec2, [{ spoolId: 'a', grams: 30 }])]);
    expect(doc.spools[0].remainingWeight).toBe(450);
    expect(posts).toBe(2);
    expect(manual.ok).toBe(false);
    vi.unstubAllGlobals();
  });
});
