import { apiGet, apiPost, type ApiBase } from './client';
import { cloudFetch, cloudUpdateDoc } from '../utils/cloudFetch';
import { mergeById, mergeHistory } from '../utils/syncMerge';

// Server-Speicher (/api/storage/*) und optionaler Cloud-Sync (externer JSON-Speicher).

interface StorageStatsResponse extends ApiBase {
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
  // 1.231: neueste zuerst, dann kürzen (vorher wurden ab 400 Einträgen die NEUESTEN abgeschnitten, der Pi schreibt neueste vorne)
  return Array.from(out.values())
    .sort((x: any, y: any) => (Number(y?.endMs) || 0) - (Number(x?.endMs) || 0))
    .slice(0, 400);
}

/** Basis für den Drei-Wege-Abgleich (letzter gemeinsamer Stand mit der Cloud) */
interface MergeBase {
  spools: any[];
  history: any[];
}

function buildDoc(existing: Record<string, unknown>, payload: CloudPayload, base: MergeBase | null | undefined): Record<string, unknown> | null {
  // Teil-Speicherung (nur Druckliste) auf ein Dokument ohne Spulen: lieber nichts schreiben als ein halbes Dokument anlegen
  if (!payload.spools && !Array.isArray(existing.spools)) return null;
  const out: Record<string, unknown> = { ...existing, ...payload };
  // 1.231: Spulen und Verbrauch je Eintrag zusammenführen statt die ganze Liste zu ersetzen (sonst gewinnt bei 409 trotzdem der alte Stand)
  if (base && payload.spools && Array.isArray(existing.spools)) out.spools = mergeById(base.spools, payload.spools as any[], existing.spools as any[]);
  if (base && payload.printHistory && Array.isArray(existing.printHistory))
    out.printHistory = mergeHistory(base.history, payload.printHistory as any[], existing.printHistory as any[]);
  if (payload.printLog || existing.printLog) out.printLog = unionById(existing.printLog, payload.printLog);
  if (payload.printLogRemoved || existing.printLogRemoved)
    out.printLogRemoved = Array.from(new Set([...((existing.printLogRemoved as string[]) || []), ...(payload.printLogRemoved || [])])).slice(-300);
  return out;
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
  /** Speichern; Rückgabe: geklappt ja/nein (für Teil-Speicherungen wie die Druckliste) */
  async save(url: string, payload: CloudPayload): Promise<boolean> {
    return (await this.saveMerged(url, payload, null)) !== null;
  },
  /**
   * Speichern mit Drei-Wege-Abgleich. Gibt das geschriebene Dokument zurück (null = nicht gespeichert).
   * 1.229: Ohne aktuellen Stand nie schreiben. 1.230: beim Pi-Server mit Versionszähler.
   */
  async saveMerged(url: string, payload: CloudPayload, base: MergeBase | null): Promise<CloudPayload | null> {
    if (!url) return null; // keine Cloud eingerichtet: rein lokal
    return (await cloudUpdateDoc(url, existing => buildDoc(existing, payload, base))) as CloudPayload | null;
  }
};
