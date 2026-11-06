// Cloud-Dokument der App (Spulen, Verlauf, Druckliste) vom Server aus lesen und schreiben.
// Gleiches Format wie in der App: „pi:“ (Datei auf dem Pi, ab 1.230), npoint-Adresse (GET/POST) oder privater GitHub-Gist („gist:<ID>“, Datei filamenthub.json).
import { readLocalDoc, writeLocalDoc } from './localDoc.js';
const GIST_FILE = 'filamenthub.json';

export interface CloudAccess {
  cloudUrl: string;
  gistToken: string;
}

const isGist = (u: string) => u.startsWith('gist:');
const isLocal = (u: string) => u === 'pi:';

function gistHeaders(token: string, body = false): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'FilamentHub-Server',
    ...(body ? { 'Content-Type': 'application/json' } : {})
  };
}

export function cloudReady(a: Partial<CloudAccess>): boolean {
  const u = String(a.cloudUrl || '');
  if (isLocal(u)) return true;
  if (isGist(u)) return /^[0-9a-zA-Z]{6,64}$/.test(u.slice(5)) && Boolean(a.gistToken);
  return /^https:\/\/api\.npoint\.io\/[A-Za-z0-9_-]+$/.test(u);
}

export async function loadDoc(a: CloudAccess): Promise<any> {
  if (!cloudReady(a)) throw new Error('Cloud nicht eingerichtet');
  if (isLocal(a.cloudUrl)) return readLocalDoc().doc;
  if (isGist(a.cloudUrl)) {
    const r = await fetch(`https://api.github.com/gists/${a.cloudUrl.slice(5)}`, { headers: gistHeaders(a.gistToken), signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`GitHub antwortet mit ${r.status}`);
    const g: any = await r.json();
    const f = g?.files?.[GIST_FILE];
    if (!f) return {};
    let text = String(f.content ?? '');
    if (f.truncated && f.raw_url) {
      const raw = await fetch(f.raw_url, { signal: AbortSignal.timeout(20000) });
      if (!raw.ok) throw new Error('Gist-Datei unvollständig');
      text = await raw.text();
    }
    return text ? JSON.parse(text) : {};
  }
  const r = await fetch(a.cloudUrl, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Cloud antwortet mit ${r.status}`);
  return r.json();
}

export async function saveDoc(a: CloudAccess, doc: unknown): Promise<void> {
  if (!cloudReady(a)) throw new Error('Cloud nicht eingerichtet');
  if (isLocal(a.cloudUrl)) {
    const w = writeLocalDoc(doc);
    if (!w.ok) throw new Error(w.error);
    return;
  }
  const content = JSON.stringify(doc);
  if (isGist(a.cloudUrl)) {
    const r = await fetch(`https://api.github.com/gists/${a.cloudUrl.slice(5)}`, {
      method: 'PATCH',
      headers: gistHeaders(a.gistToken, true),
      body: JSON.stringify({ files: { [GIST_FILE]: { content } } }),
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) throw new Error(`GitHub speichert nicht (${r.status})`);
    return;
  }
  const r = await fetch(a.cloudUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: content, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Cloud speichert nicht (${r.status})`);
}
