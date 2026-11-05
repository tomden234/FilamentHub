import { apiGet, apiPost, type ApiBase } from './client';
import { cloudFetch } from '../utils/cloudFetch';

// Server-Speicher (/api/storage/*) und optionaler Cloud-Sync (externer JSON-Speicher).

export interface StorageStatsResponse extends ApiBase {
  stats?: { manualUsedGrams?: number; [key: string]: any };
}

export const storageApi = {
  getStats: () => apiGet<StorageStatsResponse>('/api/storage/stats'),
  saveManualUsedGrams: (manualUsedGrams: number) =>
    apiPost<ApiBase>('/api/storage/stats', { manualUsedGrams })
};

export interface CloudPayload {
  updatedAt?: number;
  spools?: unknown[];
  printHistory?: unknown[];
  /** Druckliste mit Foto-Infos (ohne Fotos), wird zwischen Geräten vereinigt */
  printLog?: unknown[];
  printLogRemoved?: string[];
}

/** Zwei Drucklisten vereinigen (nach id), damit kein Gerät die Drucke eines anderen überschreibt */
function unionById(a: unknown, b: unknown): unknown[] {
  const out = new Map<string, unknown>();
  for (const list of [a, b])
    if (Array.isArray(list))
      for (const r of list as any[]) {
        if (!r || !r.id) continue;
        const prev: any = out.get(String(r.id));
        // Gleicher Druck: Eintrag mit Verbrauch (z. B. vom Pi-Server) nicht durch einen ohne überschreiben
        if (prev && Number(prev.grams) > 0 && !(Number(r.grams) > 0)) continue;
        out.set(String(r.id), r);
      }
  return Array.from(out.values()).slice(-400);
}

/**
 * Cloud-Sync gegen eine externe URL. Bewusst mit normalem fetch (nicht apiFetch),
 * damit der interne API-Key nie an Fremdserver gesendet wird.
 */
export const cloudSync = {
  async load(url: string): Promise<{ ok: boolean; data: CloudPayload | null }> {
    if (!url) return { ok: false, data: null }; // keine Cloud eingerichtet: rein lokal
    const res = await cloudFetch(url, { cache: 'no-store' });
    if (!res.ok) return { ok: false, data: null };
    return { ok: true, data: (await res.json()) as CloudPayload };
  },
  async save(url: string, payload: CloudPayload): Promise<boolean> {
    if (!url) return false; // keine Cloud eingerichtet: rein lokal
    // Bestehende Felder (z. B. verschlüsselter Geräte-Sync „secure“) erhalten, nur Spulen/Verlauf ersetzen
    let existing: Record<string, unknown> = {};
    try {
      const cur = await cloudFetch(url, { cache: 'no-store' });
      if (cur.ok) existing = (await cur.json()) || {};
    } catch {
      existing = {};
    }
    const res = await cloudFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...existing,
        ...payload,
        ...(payload.printLog || existing.printLog ? { printLog: unionById(existing.printLog, payload.printLog) } : {}),
        ...(payload.printLogRemoved || existing.printLogRemoved
          ? { printLogRemoved: Array.from(new Set([...((existing.printLogRemoved as string[]) || []), ...(payload.printLogRemoved || [])])).slice(-300) }
          : {})
      })
    });
    return res.ok;
  }
};
