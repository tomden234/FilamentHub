// npoint.io ist seit 1.234 abgeschaltet: nichts synchronisiert mehr darüber. Dieses Modul bleibt nur für den Umzug (einmal lesen)
// und zum Leeren des alten öffentlichen Speichers. Die Adresse wird dafür getrennt vom aktiven Cloud-Speicher aufbewahrt.
import { safeStorage } from './safeStorage';
import { STORAGE_KEY_CLOUD_URL, STORAGE_KEY_LEGACY_NPOINT } from './storageKeys';

const NPOINT_RE = /^https:\/\/api\.npoint\.io\/[A-Za-z0-9_-]{1,64}$/;

export const isNpointUrl = (u: unknown): u is string => typeof u === 'string' && NPOINT_RE.test(u);

/** Alte npoint-Adresse dieses Geräts (leer = keine) */
export const getLegacyNpoint = (): string => {
  const u = safeStorage.getItem(STORAGE_KEY_LEGACY_NPOINT) || '';
  return isNpointUrl(u) ? u : '';
};

export const clearLegacyNpoint = (): void => safeStorage.removeItem(STORAGE_KEY_LEGACY_NPOINT);

/**
 * Beim Start: steht noch npoint als Cloud-Speicher im Gerät, wird die Adresse zur Seite gelegt und der aktive Speicher leer
 * (Daten bleiben auf dem Gerät, nichts geht mehr an npoint). Gibt den aktiven Cloud-Speicher zurück.
 */
export function stashLegacyNpoint(): string {
  const cur = safeStorage.getItem(STORAGE_KEY_CLOUD_URL) || '';
  if (!cur) return '';
  if (!isNpointUrl(cur)) return cur;
  safeStorage.setItem(STORAGE_KEY_LEGACY_NPOINT, cur);
  safeStorage.removeItem(STORAGE_KEY_CLOUD_URL);
  return '';
}

/** Direkter Zugriff, nur für Umzug (GET) und Leeren (POST). Kein Umweg über den Server, keine Zertifikat-Ausnahme. */
export async function npointFetch(url: string, init: { method?: 'GET' | 'POST'; body?: string } = {}): Promise<Response> {
  if (!isNpointUrl(url)) return new Response(JSON.stringify({ error: 'Keine npoint-Adresse.' }), { status: 400 });
  return fetch(url, {
    method: init.method || 'GET',
    headers: init.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body,
    cache: 'no-store',
    signal: AbortSignal.timeout(20000)
  });
}
