// Schutz vor fremden Daten (1.233): Cloud-Dokument, Backup-Datei und Koppel-Links sind nicht vertrauenswürdig.
import type { Spool } from '../types/filament';
import { isGistUrl } from './gistStore';

/** Nur echte http(s)-Adressen. Alles andere (javascript:, data:, file: …) wird zu null. */
export function safeHttpUrl(u: unknown): string | null {
  if (typeof u !== 'string') return null;
  const t = u.trim();
  if (!t || t.length > 2000) return null;
  try {
    const p = new URL(t);
    return p.protocol === 'https:' || p.protocol === 'http:' ? p.toString() : null;
  } catch {
    return null;
  }
}

/** Erlaubte Cloud-Speicher: Pi-Server oder privater Gist (npoint seit 1.234 nicht mehr). Alles andere wird abgelehnt. */
export function isTrustedCloudUrl(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  return u === 'pi:' || isGistUrl(u);
}

export const MAX_SPOOLS = 2000;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const STR_FIELDS = ['brand', 'name', 'material', 'colorName', 'storageNote', 'lastDried', 'location', 'nfcTagId', 'bambuRfid'] as const;
const NUM_FIELDS = ['pricePerKg', 'initialWeight', 'remainingWeight', 'emptySpoolWeight', 'dryIntervalDays', 'dryTemp', 'dryHours'] as const;
const OPT_NUM_FIELDS = ['nozzleTemp', 'bedTemp'] as const;
const BOOL_FIELDS = ['nfcWritten', 'onSpool', 'sealed', 'silicaBag', 'inEibos', 'needsDrying'] as const;

/**
 * Eine Spule aus fremder Quelle säubern: Typen erzwingen, Texte kürzen, Zahlen begrenzen, Link und Farbe prüfen.
 * Gibt dasselbe Objekt zurück, wenn nichts zu ändern war (kein unnötiges Neuzeichnen). Ohne Text-ID: null.
 */
export function sanitizeSpool(s: unknown): Spool | null {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const src = s as Record<string, unknown>;
  if (typeof src.id !== 'string' || !src.id || src.id.length > 100) return null;
  const out: Record<string, unknown> = {};
  let changed = false;
  for (const k of Object.keys(src)) {
    if (BAD_KEYS.has(k)) { changed = true; continue; }
    out[k] = src[k];
  }
  const set = (k: string, v: unknown): void => {
    if (v === undefined) delete out[k]; else out[k] = v;
    changed = true;
  };
  for (const k of STR_FIELDS) {
    const v = out[k];
    if (v === undefined && k !== 'brand' && k !== 'name' && k !== 'material' && k !== 'colorName' && k !== 'lastDried') continue;
    if (typeof v !== 'string') set(k, k === 'material' ? 'PLA' : '');
    else if (v.length > 300) set(k, v.slice(0, 300));
  }
  for (const k of NUM_FIELDS) {
    const v = out[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) set(k, 0);
    else if (Math.abs(v) > 1e7) set(k, 1e7 * Math.sign(v));
  }
  for (const k of OPT_NUM_FIELDS) {
    const v = out[k];
    if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v))) set(k, undefined);
  }
  for (const k of BOOL_FIELDS) {
    if (out[k] !== undefined && typeof out[k] !== 'boolean') set(k, undefined);
  }
  if (typeof out.colorHex !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(out.colorHex)) set('colorHex', '#888888');
  if (out.productUrl !== undefined) {
    const safe = safeHttpUrl(out.productUrl);
    if (safe !== (out.productUrl as string).trim?.() && safe !== out.productUrl) set('productUrl', safe || undefined);
  }
  return (changed ? out : s) as unknown as Spool;
}

/** Liste aus fremder Quelle säubern: ungültige Einträge fliegen raus, höchstens MAX_SPOOLS. */
export function sanitizeSpoolList(list: unknown): Spool[] {
  if (!Array.isArray(list)) return [];
  const out: Spool[] = [];
  for (const x of list) {
    if (out.length >= MAX_SPOOLS) break;
    const s = sanitizeSpool(x);
    if (s) out.push(s);
  }
  return out;
}
