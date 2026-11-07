// Gemeinsame API-Schicht: ein Ort für API-Key, JSON-Handling und Timeouts.
// Alle Aufrufe an das eigene Backend (/api/...) laufen hier durch.

import { IS_STATIC, IS_NATIVE } from '../utils/env';

const API_KEY_STORAGE = 'app_api_key';

interface ApiOptions {
  method?: string;
  /** Objekte werden automatisch als JSON gesendet */
  body?: unknown;
  /** Abbruch nach X Millisekunden (Standard: kein Timeout) */
  timeoutMs?: number;
  signal?: AbortSignal;
  cache?: RequestCache;
}

export interface ApiResult<T = any> {
  /** HTTP-Status 200-299 */
  ok: boolean;
  status: number;
  /** Geparste JSON-Antwort, bei leerer oder ungültiger Antwort ein leeres Objekt */
  data: T;
  /** true, wenn die Antwort wirklich JSON war */
  isJson: boolean;
}

/** Standard-Antwortformat des Servers */
export interface ApiBase {
  success?: boolean;
  error?: string;
  message?: string;
}

/** Schlüssel für den eigenen Server: eigener Eintrag oder der Schlüssel des Pi (Menü → Pi-Server), falls die App vom Pi kommt */
function readApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || localStorage.getItem('filamenthub_server_key') || null;
  } catch {
    return null;
  }
}

// 1.231: Kurzlebiger Medien-Token (12 h) statt des echten Schlüssels in Bild-/Stream-Adressen (die landen im Browser-Verlauf).
let media: { key: string; token: string; exp: number } | null = null;
let mediaLoading: Promise<void> | null = null;

/** Medien-Token beim Server holen (läuft im Hintergrund, Fehler egal: dann gilt der alte Weg) */
export function refreshMediaToken(): Promise<void> {
  const key = readApiKey();
  if (!key || IS_STATIC || IS_NATIVE) return Promise.resolve();
  if (mediaLoading) return mediaLoading;
  mediaLoading = fetch('/api/media-token', { headers: { 'x-api-key': key }, cache: 'no-store', signal: AbortSignal.timeout(8000) })
    .then(r => (r.ok ? r.json() : null))
    .then((j: any) => {
      if (j && typeof j.token === 'string' && j.token && Number(j.exp) > Date.now()) media = { key, token: j.token, exp: Number(j.exp) };
    })
    .catch(() => undefined)
    .finally(() => {
      mediaLoading = null;
    });
  return mediaLoading;
}

/**
 * Für Adressen, die der Browser selbst lädt (<img>, EventSource): die können keinen Header mitschicken.
 * 1.231: hängt den Medien-Token als ?mt= an. Nur bis der Token da ist (erste Sekunden) oder bei einem alten Server noch ?k=.
 */
export function withApiKey(path: string): string {
  const key = readApiKey();
  if (!key || !path.startsWith('/api')) return path;
  const sep = path.includes('?') ? '&' : '?';
  const fresh = media && media.key === key && media.exp - Date.now() > 30 * 60_000;
  if (!fresh) void refreshMediaToken();
  if (media && media.key === key && media.exp > Date.now()) return `${path}${sep}mt=${encodeURIComponent(media.token)}`;
  return `${path}${sep}k=${encodeURIComponent(key)}`;
}

/**
 * Wie fetch, hängt aber bei /api-Pfaden den optionalen API-Key an
 * (Server-Variable APP_API_KEY, im Browser unter localStorage 'app_api_key').
 * Externe URLs (z. B. Cloud-Sync) bekommen den Key nie.
 */
function noServerResponse(): Response {
  return new Response(
    JSON.stringify({ success: false, error: 'Nicht verfügbar auf GitHub Pages (kein Server). Diese Funktion braucht den lokalen Server (npm run dev).' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}

export function apiFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  // Android-App: Drucker-Aufrufe laufen direkt in der App (natives MQTT), ohne Server
  if (IS_NATIVE && (path.startsWith('/api/printer/') || path.startsWith('/api/bambu/status'))) {
    return import('../utils/bambu/NativeBambuService')
      .then(m => m.localPrinterFetch(path, init))
      .then(res => res ?? noServerResponse());
  }
  // GitHub Pages hat keinen Server: /api-Aufrufe gar nicht erst senden
  if (IS_STATIC && path.startsWith('/api')) {
    return Promise.resolve(
      new Response(
        JSON.stringify({ success: false, error: 'Nicht verfügbar auf GitHub Pages (kein Server). Diese Funktion braucht den lokalen Server (npm run dev).' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
  const { timeoutMs, ...rest } = init;
  const headers = new Headers(rest.headers);
  const key = path.startsWith('/api') ? readApiKey() : null;
  if (key) headers.set('x-api-key', key);

  // 1.229: Zeitgrenze gilt auch, wenn zusätzlich ein eigenes Abbruch-Signal mitkommt
  let timer: ReturnType<typeof setTimeout> | undefined;
  let signal = rest.signal ?? undefined;
  if (timeoutMs) {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    signal = controller.signal;
  }

  return fetch(path, { ...rest, headers, signal }).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Sendet eine Anfrage und liefert Status plus JSON. Wirft nur bei Netzwerkfehlern oder Timeout,
 * nicht bei HTTP-Fehlern (dafür ok/status prüfen).
 */
async function apiRequest<T = any>(path: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, timeoutMs, signal, cache } = options;
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await apiFetch(path, { method, headers, body: payload, timeoutMs, signal, cache });
  const isJson = Boolean(res.headers.get('content-type')?.includes('application/json'));

  let data: any = {};
  try {
    const text = await res.text();
    if (text) data = JSON.parse(text);
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, data: data as T, isJson };
}

export const apiGet = <T = any>(path: string, options: Omit<ApiOptions, 'method' | 'body'> = {}) =>
  apiRequest<T>(path, { ...options, method: 'GET' });

export const apiPost = <T = any>(path: string, body?: unknown, options: Omit<ApiOptions, 'method' | 'body'> = {}) =>
  apiRequest<T>(path, { ...options, method: 'POST', body });
