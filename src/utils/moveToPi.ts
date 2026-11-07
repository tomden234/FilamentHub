// Umzug auf den Pi-Server (1.230, seit 1.234 auch automatisch): vorhandene Daten (alter Speicher, sonst dieses Gerät) werden einmal
// in die Datei auf dem Pi übernommen. Liegen dort schon Spulen, bleiben die erhalten (der normale Abgleich führt beides zusammen).
import { safeStorage } from './safeStorage';
import { cloudFetch } from './cloudFetch';
import { isPiUrl, piDocFetch } from './piDoc';
import { getLegacyNpoint, isNpointUrl, npointFetch } from './legacyNpoint';
import { serverBase } from './serverEndpoint';
import { STORAGE_KEY_HISTORY, STORAGE_KEY_SPOOLS, STORAGE_KEY_SPOOLS_AT } from './storageKeys';

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = safeStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export type MoveResult = { ok: true; piHadSpools: boolean; wrote: boolean } | { ok: false; error: string };

/**
 * @param oldUrl aktueller Cloud-Speicher des Geräts (Gist oder leer); zusätzlich wird eine zur Seite gelegte npoint-Adresse gelesen
 * @param allowEmpty false = nichts schreiben, wenn weder altes Dokument noch dieses Gerät Spulen haben (Auto-Umzug)
 */
export async function moveDataToPi(oldUrl: string, allowEmpty: boolean): Promise<MoveResult> {
  if (serverBase() === null) return { ok: false, error: 'Erst oben unter „FilamentHub Server (Pi)“ Adresse und Schlüssel eintragen.' };
  const cur = await piDocFetch();
  if (!cur.ok) {
    let e = `Pi antwortet mit HTTP ${cur.status}.`;
    try {
      e = ((await cur.json()) as { error?: string })?.error || e;
    } catch {
      /* Text bleibt */
    }
    return { ok: false, error: e };
  }
  const etag = cur.headers.get('etag') || '';
  const piDoc = ((await cur.json().catch(() => ({}))) as Record<string, unknown>) || {};
  const piHadSpools = Array.isArray(piDoc.spools) && piDoc.spools.length > 0;
  if (piHadSpools) return { ok: true, piHadSpools, wrote: false };

  let old: Record<string, unknown> = {};
  try {
    const legacy = getLegacyNpoint() || (isNpointUrl(oldUrl) ? oldUrl : '');
    const r = legacy ? await npointFetch(legacy) : oldUrl && !isPiUrl(oldUrl) ? await cloudFetch(oldUrl, { cache: 'no-store' }) : null;
    if (r && r.ok) old = ((await r.json()) as Record<string, unknown>) || {};
  } catch {
    old = {}; // alter Speicher nicht erreichbar: Daten dieses Geräts nehmen
  }
  const localSpools = readJson(STORAGE_KEY_SPOOLS, [] as unknown[]);
  const localAt = Number(safeStorage.getItem(STORAGE_KEY_SPOOLS_AT)) || 0;
  const oldAt = Number(old.updatedAt) || 0;
  const useOld = Array.isArray(old.spools) && oldAt > localAt;
  const spools = useOld ? (old.spools as unknown[]) : localSpools;
  if (!allowEmpty && spools.length === 0) return { ok: true, piHadSpools: false, wrote: false };
  const doc = {
    ...old, // enthält auch den verschlüsselten Geräte-Sync („secure“)
    updatedAt: useOld ? oldAt : localAt || Date.now(),
    spools,
    printHistory: useOld && Array.isArray(old.printHistory) ? old.printHistory : readJson(STORAGE_KEY_HISTORY, [] as unknown[])
  };
  const w = await piDocFetch({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : {}) }, body: JSON.stringify(doc) });
  if (!w.ok) return { ok: false, error: `Pi hat das Speichern abgelehnt (HTTP ${w.status}).` };
  return { ok: true, piHadSpools: false, wrote: true };
}
