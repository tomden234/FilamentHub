// 1.231: Drei-Wege-Abgleich (wie Git) für Spulen und Verbrauch zwischen mehreren Geräten und dem Pi.
// Basis = der Stand, den dieses Gerät zuletzt mit der Cloud geteilt hat. Was nur hier geändert wurde, bleibt;
// was nur woanders geändert wurde (anderes Gerät, Abzug vom Pi), kommt dazu. Vorher gewann der ganze neuere Stand,
// und Änderungen des anderen Geräts gingen verloren.
import { safeStorage } from './safeStorage';

type WithId = { id: string };

/** Vergleich unabhängig von der Reihenfolge der Felder */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter(k => o[k] !== undefined)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canon(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
const same = (a: unknown, b: unknown) => canon(a) === canon(b);

/** Ein Eintrag, auf beiden Seiten geändert: Feld für Feld. Feld nur hier geändert → hier; sonst das von dort. */
function mergeFields<T extends WithId>(base: T, local: T, remote: T): T {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const k of keys) {
    const b = (base as any)[k];
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; // fremdes Doc darf den Prototyp nicht setzen
    const l = (local as any)[k];
    const r = (remote as any)[k];
    const v = same(l, b) ? r : l; // beide geändert: dieses Gerät gewinnt
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/**
 * Listen mit `id` zusammenführen. base = null: keine gemeinsame Basis bekannt (dann entscheidet der Aufrufer anders).
 * Reihenfolge: wie hier, Neues von dort hinten dran.
 */
export function mergeById<T extends WithId>(base: T[], local: T[], remote: T[]): T[] {
  const byId = (list: T[]) => new Map(list.filter(x => x && typeof x.id === 'string').map(x => [x.id, x]));
  const B = byId(base);
  const L = byId(local);
  const R = byId(remote);
  const order = [...L.keys(), ...[...R.keys()].filter(id => !L.has(id))];
  const out: T[] = [];
  for (const id of order) {
    const b = B.get(id);
    const l = L.get(id);
    const r = R.get(id);
    if (l && r) {
      if (!b || same(l, r)) out.push(l); // gleich oder ohne Basis: dieses Gerät
      else if (same(l, b)) out.push(r);
      else if (same(r, b)) out.push(l);
      else out.push(mergeFields(b, l, r));
    } else if (l) {
      // dort gelöscht? Nur übernehmen, wenn hier seitdem nichts geändert wurde
      if (!b || !same(l, b)) out.push(l);
    } else if (r) {
      // hier gelöscht? Nur, wenn dort seitdem nichts geändert wurde
      if (!b || !same(r, b)) out.push(r);
    }
  }
  return out;
}

/** Verbrauchsliste: zusammenführen und neueste zuerst */
export function mergeHistory<T extends WithId & { timestamp?: string }>(base: T[], local: T[], remote: T[]): T[] {
  const m = mergeById(base, local, remote);
  const t = (x: T) => Date.parse(String(x.timestamp || '')) || 0;
  return m.map((x, i) => [x, i] as const).sort((a, b) => t(b[0]) - t(a[0]) || a[1] - b[1]).map(([x]) => x);
}

// --- Basis merken (je Cloud-Adresse) ---

const BASE_KEY = 'filamenthub_sync_base_v1';

interface SyncBase<S, H> {
  url: string;
  spools: S[];
  history: H[];
}

export function loadSyncBase<S, H>(url: string): SyncBase<S, H> | null {
  try {
    const v = JSON.parse(safeStorage.getItem(BASE_KEY) || 'null');
    if (v && v.url === url && Array.isArray(v.spools) && Array.isArray(v.history)) return v;
  } catch {
    /* keine Basis */
  }
  return null;
}

export function saveSyncBase<S, H>(url: string, spools: S[], history: H[]): void {
  try {
    safeStorage.setItem(BASE_KEY, JSON.stringify({ url, spools, history }));
  } catch {
    /* Speicher voll: dann ohne Basis (alter Weg) */
  }
}
