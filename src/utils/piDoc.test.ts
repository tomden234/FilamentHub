import { describe, it, expect, vi, afterEach } from 'vitest';

// Alter Pi liefert für unbekannte Adressen die Startseite (HTML): muss als klarer Fehler ankommen
const store = new Map<string, string>([
  ['filamenthub_server_url', 'http://192.168.68.57:3000'],
  ['filamenthub_server_key', 'k']
]);
vi.mock('./safeStorage', () => ({ safeStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: () => undefined, removeItem: () => undefined } }));

import { piDocFetch } from './piDoc';

afterEach(() => vi.unstubAllGlobals());

describe('piDocFetch', () => {
  it('HTML statt JSON → 404 mit Hinweis auf das Add-on-Update', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
    const r = await piDocFetch();
    expect(r.status).toBe(404);
    expect(((await r.json()) as any).error).toContain('1.3.9');
  });

  it('JSON bleibt unverändert, Schlüssel geht als Header mit', async () => {
    const f = vi.fn(async () => new Response('{"spools":[]}', { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"3"' } }));
    vi.stubGlobal('fetch', f);
    const r = await piDocFetch();
    expect(r.ok).toBe(true);
    expect(r.headers.get('etag')).toBe('"3"');
    expect((f.mock.calls[0] as any)[1].headers['x-api-key']).toBe('k');
  });
});
