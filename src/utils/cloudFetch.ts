// Zugriff auf den Cloud-Speicher: Pi-Server („pi:“) oder privater GitHub-Gist („gist:<ID>“).
// npoint.io ist seit 1.234 abgeschaltet (kein Umweg über Server oder Windows-Programm mehr, keine Zertifikat-Ausnahme).
import { gistFetch, isGistUrl } from './gistStore';
import { isPiUrl, piDocFetch } from './piDoc';

export async function cloudFetch(url: string, init: { method?: string; body?: string; cache?: RequestCache; headers?: Record<string, string> } = {}): Promise<Response> {
  // Pi-Server („pi:“): Datei auf dem Pi, nur mit Schlüssel erreichbar
  if (isPiUrl(url)) return piDocFetch(init);
  // Privater GitHub-Gist („gist:<ID>“): api.github.com erlaubt Zugriffe aus dem Browser, auch in der Windows-App
  if (isGistUrl(url)) return gistFetch(url, init);
  return new Response(JSON.stringify({ error: 'Kein Cloud-Speicher eingerichtet (npoint ist abgeschaltet). Menü → Verbindungen → Auf Pi-Server umstellen.' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Dokument lesen, ändern und zurückschreiben. Beim Pi-Server mit Versionszähler (If-Match): hat ein anderes Gerät
 * dazwischen gespeichert (409), wird neu gelesen und die Änderung erneut daraufgesetzt. `build` liefert null = nichts schreiben.
 * Gibt das geschriebene Dokument zurück (null = nicht gespeichert).
 */
export async function cloudUpdateDoc(url: string, build: (existing: Record<string, unknown>) => Record<string, unknown> | null): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < 3; i++) {
    let existing: Record<string, unknown>;
    let etag = '';
    try {
      const cur = await cloudFetch(url, { cache: 'no-store' });
      if (!cur.ok) return null;
      etag = cur.headers.get('etag') || '';
      const j = await cur.json();
      existing = j && typeof j === 'object' && !Array.isArray(j) ? j : {};
    } catch {
      return null;
    }
    const next = build(existing);
    if (!next) return null;
    let res: Response;
    try {
      res = await cloudFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : {}) }, body: JSON.stringify(next) });
    } catch {
      return null;
    }
    if (res.status !== 409) return res.ok ? next : null;
  }
  return null;
}

export async function cloudUpdate(url: string, build: (existing: Record<string, unknown>) => Record<string, unknown> | null): Promise<boolean> {
  return (await cloudUpdateDoc(url, build)) !== null;
}
