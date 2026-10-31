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
      body: JSON.stringify({ ...existing, ...payload })
    });
    return res.ok;
  }
};
