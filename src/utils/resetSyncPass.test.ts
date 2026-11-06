import { describe, it, expect, beforeEach, vi } from 'vitest';

// Sync-Passwort neu festlegen: Cloud-Paket wird mit dem neuen Passwort ersetzt, andere Dokument-Teile bleiben
let cloudDoc: Record<string, unknown>;
const store = new Map<string, string>();

vi.mock('./safeStorage', () => ({
  safeStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
}));
vi.mock('./cloudFetch', () => ({
  cloudFetch: vi.fn(),
  cloudUpdate: async (_url: string, build: (e: Record<string, unknown>) => Record<string, unknown> | null) => {
    const next = build(cloudDoc);
    if (!next) return false;
    cloudDoc = next;
    return true;
  }
}));

import { resetSyncPass, getSyncPass } from './deviceSync';

beforeEach(() => {
  store.clear();
  cloudDoc = { spools: [{ id: 'a' }], secure: { d: 'alt' } };
});

describe('resetSyncPass', () => {
  it('lehnt zu kurze Passwörter ab', async () => {
    expect(await resetSyncPass('pi:', '123')).toBe('nopass');
  });

  it('ohne Einstellungen auf dem Gerät: Fehler, Cloud bleibt unverändert', async () => {
    expect(await resetSyncPass('pi:', 'neues-passwort')).toBe('error');
    expect(cloudDoc.secure).toEqual({ d: 'alt' });
  });

  it('ersetzt das verschlüsselte Paket, behält Spulen und merkt sich das Passwort', async () => {
    store.set('ha_url', 'https://example.ui.nabu.casa');
    expect(await resetSyncPass('pi:', 'neues-passwort')).toBe('pushed');
    expect(cloudDoc.spools).toEqual([{ id: 'a' }]);
    expect((cloudDoc.secure as any).d).not.toBe('alt');
    expect(getSyncPass()).toBe('neues-passwort');
  });
});
