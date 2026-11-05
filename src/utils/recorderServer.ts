// FilamentHub Server (Home-Assistant-Add-on): zeichnet Drucke rund um die Uhr auf. Die App holt die Liste und trägt Fehlendes nach.
import { safeStorage } from './safeStorage';
import { IS_NATIVE, IS_STATIC } from './env';
import type { HaPrint } from './haPrintHistory';

const URL_KEY = 'filamenthub_server_url';
const KEY_KEY = 'filamenthub_server_key';

/** „192.168.68.10“ → „http://192.168.68.10:3000“ */
export function normalizeServerUrl(v: string): string {
  let u = String(v || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  const host = u.replace(/^https?:\/\//i, '').split('/')[0];
  if (/^http:\/\//i.test(u) && !host.includes(':')) u += ':3000';
  return u;
}

export const getServerUrl = (): string => safeStorage.getItem(URL_KEY) || '';
export const getServerKey = (): string => safeStorage.getItem(KEY_KEY) || '';

export function saveServer(url: string, key: string): void {
  safeStorage.setItem(URL_KEY, normalizeServerUrl(url));
  safeStorage.setItem(KEY_KEY, key.trim());
  try {
    window.dispatchEvent(new CustomEvent('filamenthub:ha-history-sync'));
  } catch {
    /* ohne Fenster egal */
  }
}

/** Ohne eingetragene Adresse: nur der eigene Server (Windows-App, lokaler Server). Auf GitHub Pages und in der Handy-App gibt es keinen. */
function base(): string | null {
  const u = getServerUrl();
  if (u) return u;
  return IS_STATIC || IS_NATIVE ? null : '';
}

async function get(path: string): Promise<any> {
  const b = base();
  if (b === null) throw new Error('keine Adresse');
  const key = getServerKey();
  const res = await fetch(`${b}${path}`, { headers: key ? { 'x-api-key': key } : {}, signal: AbortSignal.timeout(8000) });
  if (res.status === 401) throw new Error('Schlüssel (API-Key) falsch');
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(`Antwort ${res.status}`);
  return res.json();
}

export interface ServerPrints {
  /** Adresse eingetragen (oder eigener Server vorhanden) */
  configured: boolean;
  prints: HaPrint[] | null;
  error?: string;
}

/** Drucke, die der Server aufgezeichnet hat (letzte 7 Tage). Wirft nie. */
export async function fetchServerPrints(now = Date.now()): Promise<ServerPrints> {
  const explicit = Boolean(getServerUrl());
  if (base() === null) return { configured: false, prints: null };
  try {
    const j = await get(`/api/recorder/prints?since=${now - 7 * 24 * 3600_000}`);
    if (!j?.success || !Array.isArray(j.prints)) throw new Error('unerwartete Antwort');
    const prints: HaPrint[] = j.prints
      .filter((p: any) => p && typeof p.name === 'string' && Number.isFinite(Number(p.endMs)))
      .map((p: any) => ({
        name: p.name,
        startMs: Number(p.startMs) || Number(p.endMs),
        endMs: Number(p.endMs),
        state: p.state === 'FAILED' ? 'FAILED' : 'FINISH',
        percent: Number(p.percent) || (p.state === 'FAILED' ? 0 : 100),
        slots: p.slots && typeof p.slots === 'object' ? p.slots : {},
        trayRaw: ''
      }));
    return { configured: true, prints };
  } catch (e: any) {
    // Eigener Server ohne Adresse (z. B. Seite ohne Rekorder): still ignorieren
    return { configured: explicit, prints: null, error: `FilamentHub Server: ${String(e?.message || e)}` };
  }
}

export interface ServerCheck {
  ok: boolean;
  text: string;
}

/** Für „Prüfen“ in den Verbindungen */
export async function checkServer(): Promise<ServerCheck> {
  if (!getServerUrl()) return { ok: false, text: 'Keine Adresse eingetragen.' };
  try {
    const j = await get('/api/recorder/status');
    if (!j?.success || j.server !== 'filamenthub') throw new Error('kein FilamentHub Server');
    const printer = j.printerConnected ? (j.receivingData ? 'Drucker verbunden' : 'Drucker verbunden, aber aus') : 'Drucker nicht verbunden';
    const open = j.open ? ` · läuft: ${j.open.name} (${j.open.percent} %)` : '';
    return { ok: true, text: `Server erreichbar · ${printer} · ${j.count} Drucke gespeichert${open}` };
  } catch (e: any) {
    const m = String(e?.message || e);
    return {
      ok: false,
      text: /Failed to fetch|NetworkError|Load failed|aborted|timeout/i.test(m)
        ? 'Server nicht erreichbar. Adresse prüfen, Gerät im Heimnetz oder Tailscale an? (Auf GitHub Pages geht nur https, dort bitte die Handy- oder Windows-App nutzen.)'
        : m
    };
  }
}
