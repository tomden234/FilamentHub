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

  it('304: schickt If-None-Match und liefert die gemerkte Fassung; Speichern vergisst sie', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"spools":[1]}', { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"7"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"8"' } }))
      .mockResolvedValueOnce(new Response('{"spools":[2]}', { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"8"' } }));
    vi.stubGlobal('fetch', f);
    await piDocFetch();
    const r2 = await piDocFetch();
    expect((f.mock.calls[1] as any)[1].headers['If-None-Match']).toBe('"7"');
    expect(r2.status).toBe(200);
    expect(await r2.text()).toBe('{"spools":[1]}');
    await piDocFetch({ method: 'POST', body: '{}' });
    await piDocFetch();
    expect((f.mock.calls[3] as any)[1].headers['If-None-Match']).toBeUndefined();
  });
});
