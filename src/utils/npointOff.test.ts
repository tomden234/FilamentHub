import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// 1.234: npoint ist abgeschaltet. Alte Adresse wird zur Seite gelegt, Umzug auf den Pi, Pi ist am Server der Standard.
const store = new Map<string, string>();
vi.mock('./safeStorage', () => ({
  safeStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k)
  }
}));

import { isNpointUrl, stashLegacyNpoint, getLegacyNpoint } from './legacyNpoint';
import { cloudFetch } from './cloudFetch';
import { moveDataToPi } from './moveToPi';

const NP = 'https://api.npoint.io/2a75ad089c77e7c35f98';

beforeEach(() => {
  store.clear();
  store.set('filamenthub_server_url', 'http://192.168.68.57:3000');
  store.set('filamenthub_server_key', 'k');
});
afterEach(() => vi.unstubAllGlobals());

describe('npoint abgeschaltet (1.234)', () => {
  it('erkennt npoint-Adressen genau', () => {
    expect(isNpointUrl(NP)).toBe(true);
    expect(isNpointUrl('https://api.npoint.io/abc/../x')).toBe(false);
    expect(isNpointUrl('pi:')).toBe(false);
  });

  it('legt eine alte npoint-Adresse zur Seite, Pi und Gist bleiben', () => {
    store.set('filamenthub_cloud_db_url', NP);
    expect(stashLegacyNpoint()).toBe('');
    expect(store.get('filamenthub_cloud_db_url')).toBeUndefined();
    expect(getLegacyNpoint()).toBe(NP);
    store.set('filamenthub_cloud_db_url', 'pi:');
    expect(stashLegacyNpoint()).toBe('pi:');
    store.set('filamenthub_cloud_db_url', 'gist:abc123XYZ');
    expect(stashLegacyNpoint()).toBe('gist:abc123XYZ');
  });

  it('cloudFetch ruft npoint nie mehr an', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const r = await cloudFetch(NP);
    expect(r.status).toBe(410);
    expect(f).not.toHaveBeenCalled();
  });

  it('Umzug: Daten von npoint landen einmal auf dem Pi', async () => {
    store.set('filamenthub_legacy_npoint_url', NP);
    const old = { updatedAt: 50, spools: [{ id: 'a' }], printHistory: [{ id: 'h' }], secure: { d: 'x' } };
    let written: any = null;
    const f = vi.fn(async (url: string, init?: any) => {
      if (String(url).startsWith(NP)) return new Response(JSON.stringify(old), { status: 200 });
      if (init?.method === 'POST') {
        written = JSON.parse(init.body);
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"0"' } });
    });
    vi.stubGlobal('fetch', f);
    const r = await moveDataToPi('', false);
    expect(r).toEqual({ ok: true, piHadSpools: false, wrote: true });
    expect(written.spools).toEqual([{ id: 'a' }]);
    expect(written.secure).toEqual({ d: 'x' });
  });

  it('Umzug: liegen schon Spulen auf dem Pi, wird nichts überschrieben', async () => {
    store.set('filamenthub_legacy_npoint_url', NP);
    const f = vi.fn(async () => new Response(JSON.stringify({ spools: [{ id: 'pi' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', f);
    const r = await moveDataToPi('', false);
    expect(r).toEqual({ ok: true, piHadSpools: true, wrote: false });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('Auto-Umzug schreibt nichts, wenn es nichts zu übernehmen gibt', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', f);
    const r = await moveDataToPi('', false);
    expect(r).toEqual({ ok: true, piHadSpools: false, wrote: false });
    expect(f).toHaveBeenCalledTimes(1); // nur Lesen am Pi
  });
});

describe('Pi-Server: Standard-Speicher ist die Datei auf dem Pi', () => {
  it('npoint wird nicht angenommen, im Add-on gilt „pi:“', async () => {
    process.env.FILAMENT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-np-'));
    process.env.FILAMENTHUB_HUB = '1';
    vi.resetModules();
    const core = await import('../../server/hub/core');
    const cloud = await import('../../server/hub/cloud');
    expect(core.access().cloudUrl).toBe('pi:');
    core.updateHubConfig({ cloudUrl: NP });
    expect(core.getHubConfig().cloudUrl).toBe('');
    expect(core.access().cloudUrl).toBe('pi:');
    expect(cloud.cloudReady({ cloudUrl: NP })).toBe(false);
    core.updateHubConfig({ cloudUrl: 'gist:abc123XYZ' });
    expect(core.access().cloudUrl).toBe('gist:abc123XYZ');
    delete process.env.FILAMENTHUB_HUB;
  });
});
