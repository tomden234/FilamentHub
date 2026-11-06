import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Spulen-Dokument auf dem Pi: Versionszähler, Konflikt und Schutz vor halben Dokumenten
let mod: typeof import('../../server/hub/localDoc');
let cloud: typeof import('../../server/hub/cloud');

beforeAll(async () => {
  process.env.FILAMENT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-doc-'));
  mod = await import('../../server/hub/localDoc');
  cloud = await import('../../server/hub/cloud');
});

describe('localDoc', () => {
  it('leer: rev 0 und leeres Dokument', () => {
    expect(mod.readLocalDoc()).toEqual({ rev: 0, doc: {} });
  });

  it('schreibt, zählt rev hoch und liest zurück', () => {
    const w = mod.writeLocalDoc({ spools: [{ id: 'a' }], updatedAt: 1 });
    expect(w).toEqual({ ok: true, rev: 1 });
    expect(mod.readLocalDoc().doc.spools).toEqual([{ id: 'a' }]);
  });

  it('If-Match: falsche Version gibt 409, richtige schreibt', () => {
    const stale = mod.writeLocalDoc({ spools: [{ id: 'b' }] }, 0);
    expect(stale).toMatchObject({ ok: false, status: 409 });
    const fresh = mod.writeLocalDoc({ spools: [{ id: 'b' }] }, 1);
    expect(fresh).toEqual({ ok: true, rev: 2 });
  });

  it('lehnt Dokument ohne Spulen ab, wenn schon Spulen da sind', () => {
    expect(mod.writeLocalDoc({ printLog: [] })).toMatchObject({ ok: false, status: 400 });
    expect(mod.readLocalDoc().rev).toBe(2);
  });

  it('lehnt Arrays und Nicht-Objekte ab', () => {
    expect(mod.writeLocalDoc([])).toMatchObject({ ok: false, status: 400 });
    expect(mod.writeLocalDoc(null)).toMatchObject({ ok: false, status: 400 });
  });

  it('behält die Vorversion als .prev', () => {
    expect(fs.existsSync(path.join(process.env.FILAMENT_DATA_DIR!, 'filamenthub-doc.prev.json'))).toBe(true);
  });

  it('Hub-Zugriff über „pi:“ nutzt dieselbe Datei', async () => {
    expect(cloud.cloudReady({ cloudUrl: 'pi:' })).toBe(true);
    const doc: any = await cloud.loadDoc({ cloudUrl: 'pi:', gistToken: '' });
    expect(doc.spools).toEqual([{ id: 'b' }]);
    await cloud.saveDoc({ cloudUrl: 'pi:', gistToken: '' }, { ...doc, spools: [{ id: 'c' }] });
    expect(mod.readLocalDoc().rev).toBe(3);
  });
});
