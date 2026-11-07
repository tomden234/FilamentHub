// Cloud-Speicher auf einem privaten GitHub-Gist (Alternative zum Pi-Server; npoint.io ist seit 1.234 abgeschaltet).
// Die Adresse im Gerät sieht so aus: „gist:<ID>“. Alle Aufrufe laufen über cloudFetch und liefern dasselbe Format wie der Pi-Server:
// GET gibt das JSON-Dokument zurück, POST ersetzt es. Der Zugang ist ein GitHub-Token mit dem Recht „gist“ (bleibt nur im Gerät).
import { getServerKey, getServerUrl } from './serverEndpoint';
import { safeStorage } from './safeStorage';

const TOKEN_KEY = 'filamenthub_gist_token';
const API = 'https://api.github.com';
export const GIST_FILE = 'filamenthub.json';
const GIST_PREFIX = 'gist:';

export const isGistUrl = (u: string): boolean => typeof u === 'string' && u.startsWith(GIST_PREFIX);
export const gistIdOf = (u: string): string => u.slice(GIST_PREFIX.length).trim();
export const gistUrlOf = (id: string): string => GIST_PREFIX + id.trim();
export const validGistId = (id: string): boolean => /^[0-9a-zA-Z]{6,64}$/.test(id);

export const getGistToken = (): string => (safeStorage.getItem(TOKEN_KEY) || '').trim();
export const setGistToken = (t: string): void => safeStorage.setItem(TOKEN_KEY, t.trim());

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function authHeaders(token: string, withBody = false): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`
  };
  if (withBody) h['Content-Type'] = 'application/json';
  return h;
}

/** Verständliche Fehlermeldung aus einer GitHub-Antwort */
async function failure(r: Response): Promise<Response> {
  let msg = '';
  try {
    msg = String(((await r.json()) as { message?: string })?.message || '');
  } catch {
    msg = '';
  }
  if (r.status === 401) msg = 'GitHub-Token ungültig oder abgelaufen.';
  else if (r.status === 403 && /rate limit/i.test(msg)) msg = 'GitHub-Limit erreicht, später nochmal.';
  else if (r.status === 403) msg = 'Token darf keine Gists ändern. Er braucht das Recht „gist“.';
  else if (r.status === 404) msg = 'Gist nicht gefunden (ID falsch oder Token gehört zu einem anderen Konto).';
  return json(r.status, { error: msg || `GitHub antwortet mit HTTP ${r.status}` });
}

/** Wie fetch auf den Pi-Speicher: GET lädt das Dokument, POST ersetzt es */
export async function gistFetch(url: string, init: { method?: string; body?: string } = {}): Promise<Response> {
  const token = getGistToken();
  if (!token) return json(401, { error: 'GitHub-Token fehlt. Bitte unter Einstellungen → Verbindungen eintragen.' });
  const id = gistIdOf(url);
  if (!validGistId(id)) return json(400, { error: 'Ungültige Gist-ID.' });
  try {
    if (init.method !== 'POST') {
      const r = await fetch(`${API}/gists/${id}`, { headers: authHeaders(token), cache: 'no-store' });
      if (!r.ok) return failure(r);
      const gist = (await r.json()) as { files?: Record<string, { content?: string; truncated?: boolean; raw_url?: string }> };
      const file = gist?.files?.[GIST_FILE];
      if (!file) return json(200, {}); // leerer Gist = leerer Speicher
      let content = file.content ?? '';
      if (file.truncated && file.raw_url) {
        const raw = await fetch(file.raw_url, { cache: 'no-store' });
        if (!raw.ok) return json(502, { error: 'Gist-Datei konnte nicht vollständig geladen werden.' });
        content = await raw.text();
      }
      return new Response(content || '{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const r = await fetch(`${API}/gists/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token, true),
      body: JSON.stringify({ files: { [GIST_FILE]: { content: String(init.body ?? '{}') } } })
    });
    if (!r.ok) return failure(r);
    return json(200, { ok: true });
  } catch (e: any) {
    return json(502, { error: `GitHub nicht erreichbar: ${e?.message || e}` });
  }
}

type GistResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Token prüfen: gültig? Bei klassischen Tokens zusätzlich: hat er das Recht „gist“? */
export async function checkGistToken(token: string): Promise<GistResult<{ login: string }>> {
  try {
    const r = await fetch(`${API}/user`, { headers: authHeaders(token.trim()), cache: 'no-store' });
    if (!r.ok) return { ok: false, error: ((await failure(r).then(x => x.json())) as { error: string }).error };
    const scopes = r.headers.get('x-oauth-scopes'); // nur bei klassischen Tokens vorhanden
    if (scopes !== null && !scopes.split(',').map(s => s.trim()).includes('gist')) {
      return { ok: false, error: 'Token ist gültig, hat aber nicht das Recht „gist“. Neues Token mit Haken bei „gist“ erstellen.' };
    }
    const u = (await r.json()) as { login?: string };
    return { ok: true, login: u.login || '' };
  } catch (e: any) {
    return { ok: false, error: `GitHub nicht erreichbar: ${e?.message || e}` };
  }
}

/** Neuen privaten Gist mit dem Startinhalt anlegen */
export async function createGist(token: string, content: string): Promise<GistResult<{ id: string; login?: string }>> {
  try {
    const r = await fetch(`${API}/gists`, {
      method: 'POST',
      headers: authHeaders(token.trim(), true),
      body: JSON.stringify({
        description: 'FilamentHub Sync (privat, Zugang verschlüsselt)',
        public: false,
        files: { [GIST_FILE]: { content } }
      })
    });
    if (!r.ok) return { ok: false, error: ((await failure(r).then(x => x.json())) as { error: string }).error };
    const g = (await r.json()) as { id?: string };
    if (!g.id) return { ok: false, error: 'GitHub hat keine Gist-ID geliefert.' };
    return { ok: true, id: g.id };
  } catch (e: any) {
    return { ok: false, error: `GitHub nicht erreichbar: ${e?.message || e}` };
  }
}

/** Vorhandenen Gist lesen (Test der Verbindung) */
export async function testGist(url: string): Promise<GistResult> {
  const r = await gistFetch(url);
  if (r.ok) return { ok: true };
  let error = `HTTP ${r.status}`;
  try {
    error = ((await r.json()) as { error?: string })?.error || error;
  } catch {
    /* Text bleibt */
  }
  return { ok: false, error };
}

/** Kopplungs-Text für ein zweites Gerät (im Link-Teil nach „#“, geht nie an einen Server) */
function gistPairFragment(url: string): string {
  const token = getGistToken();
  return isGistUrl(url) && token ? `pairGist=${gistIdOf(url)}.${token}` : '';
}

/** Kopplung aus dem URL-Teil nach „#“ lesen: ID und Token */
export function parseGistPair(hash: string): { id: string; token: string } | null {
  const m = /[#&]pairGist=([0-9a-zA-Z]{6,64})\.([0-9a-zA-Z_]{20,255})/.exec(hash || '');
  return m ? { id: m[1], token: m[2] } : null;
}

/** 1.247: Kopplung mit dem Pi aus dem URL-Teil nach „#“: Adresse und Schlüssel (geht nie an einen Server) */
export function parsePiPair(hash: string): { url: string; key: string } | null {
  const m = /[#&]pairPi=([^&]{3,200})&k=([^&]{8,200})/.exec(hash || '');
  if (!m) return null;
  try {
    const url = decodeURIComponent(m[1]);
    const key = decodeURIComponent(m[2]);
    return /^https?:\/\/[^\s/]+(:\d+)?\/?$/i.test(url) && key.trim() ? { url, key } : null;
  } catch {
    return null;
  }
}
export const piPairFragment = (url: string, key: string): string => (url && key ? `pairPi=${encodeURIComponent(url)}&k=${encodeURIComponent(key)}` : '');

/** Koppel-Link für QR-Code und Kopieren: bei Gist mit Zugang im Teil nach „#“, sonst nur die Seitenadresse (Pi: Adresse + Schlüssel am zweiten Gerät eintragen) */
export function pairUrlFor(cloudUrl: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  // Pi-Server: Adresse und Schlüssel stehen im Teil nach „#“ (1.247), das zweite Gerät übernimmt sie nach Nachfrage
  if (cloudUrl === 'pi:') {
    const frag = piPairFragment(getServerUrl(), getServerKey());
    return frag ? `${base}#${frag}` : base;
  }
  if (isGistUrl(cloudUrl)) {
    const frag = gistPairFragment(cloudUrl);
    return frag ? `${base}#${frag}` : base;
  }
  return base;
}
