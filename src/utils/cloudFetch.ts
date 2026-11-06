// Zugriff auf die Cloud-Datenbank (privater GitHub-Gist oder alt: npoint). Bei npoint läuft der Aufruf in der Windows-App über den eingebauten Server,
// weil das Fenster sonst vom Browser-Schutz (CORS) blockiert werden kann („Failed to fetch“).
import { IS_DESKTOP } from './env';
import { gistFetch, isGistUrl } from './gistStore';
import { isPiUrl, piDocFetch } from './piDoc';

export async function cloudFetch(url: string, init: { method?: string; body?: string; cache?: RequestCache; headers?: Record<string, string> } = {}): Promise<Response> {
  // Pi-Server („pi:“): Datei auf dem Pi, nur mit Schlüssel erreichbar
  if (isPiUrl(url)) return piDocFetch(init);
  // Privater GitHub-Gist („gist:<ID>“): api.github.com erlaubt Zugriffe aus dem Browser, auch in der Windows-App
  if (isGistUrl(url)) return gistFetch(url, init);
  if (!IS_DESKTOP) return fetch(url, init);
  // Windows-App ab 1.95: über das Hauptprogramm (Windows-Zertifikate, kein CORS)
  const bridge = (window as any).desktop;
  if (bridge?.cloudFetch) {
    const r: { status: number; text: string } = await bridge.cloudFetch({ url, method: init.method || 'GET', body: init.body });
    return new Response(r.text, { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }
  return fetch('/api/cloud-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method: init.method || 'GET', body: init.body })
  });
}

/**
 * Dokument lesen, ändern und zurückschreiben. Beim Pi-Server mit Versionszähler (If-Match): hat ein anderes Gerät
 * dazwischen gespeichert (409), wird neu gelesen und die Änderung erneut daraufgesetzt. `build` liefert null = nichts schreiben.
 */
export async function cloudUpdate(url: string, build: (existing: Record<string, unknown>) => Record<string, unknown> | null): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    let existing: Record<string, unknown>;
    let etag = '';
    try {
      const cur = await cloudFetch(url, { cache: 'no-store' });
      if (!cur.ok) return false;
      etag = cur.headers.get('etag') || '';
      const j = await cur.json();
      existing = j && typeof j === 'object' && !Array.isArray(j) ? j : {};
    } catch {
      return false;
    }
    const next = build(existing);
    if (!next) return false;
    const res = await cloudFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : {}) }, body: JSON.stringify(next) });
    if (res.status !== 409) return res.ok;
  }
  return false;
}
