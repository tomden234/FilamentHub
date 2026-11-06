// Mitteilungs-Postfach: jede Meldung (Trocknen fertig, Druck fertig, ...) wird hier mit Details gespeichert.
// So kannst du sie in der App nochmal ansehen, auch wenn du die Benachrichtigung schon weggewischt hast.
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';

export type InboxKind = 'print-start' | 'print-check' | 'printer-error' | 'humidity' | 'print-done' | 'print-fail' | 'dry-due' | 'dry-done' | 'dry-stop' | 'low' | 'info';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  title: string;
  text: string;
  at: number;
  read: boolean;
  /** Schlüssel gegen Doppelte (Standard: die Meldungsart), z. B. bei „Spule fast leer“ je Spule */
  key?: string;
  /** Kurze Eckdaten, z. B. Dauer, Temperatur */
  facts?: { label: string; value: string }[];
  /** Betroffene Spulen o. Ä. */
  items?: { title: string; sub?: string; color?: string }[];
}

export const INBOX_KEY = 'filamenthub_inbox_v1';
const MAX_ITEMS = 100;
/** Gleiche Meldungsart innerhalb dieser Zeit nicht doppelt speichern (z. B. App und Drucker melden dasselbe Ende) */
const DEDUPE_MS = 10 * 60 * 1000;

let cache: InboxItem[] | null = null;
const listeners = new Set<() => void>();

function read(): InboxItem[] {
  try {
    const raw = safeStorage.getItem(INBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getInbox(): InboxItem[] {
  if (!cache) cache = read();
  return cache;
}

function save(next: InboxItem[]): void {
  cache = next.slice(0, MAX_ITEMS);
  safeStorage.setItem(INBOX_KEY, JSON.stringify(cache));
  listeners.forEach(l => l());
}

/** Meldung speichern. Gibt die ID zurück, oder die ID der schon vorhandenen gleichen Meldung (dann wird nichts doppelt gespeichert). */
export function addInbox(item: Omit<InboxItem, 'id' | 'at' | 'read'>): { id: string; isNew: boolean } {
  const list = getInbox();
  const now = Date.now();
  const same = list.find(i => (i.key ?? i.kind) === (item.key ?? item.kind) && now - i.at < DEDUPE_MS);
  if (same) return { id: same.id, isNew: false };
  const id = `in-${now}-${Math.random().toString(36).slice(2, 7)}`;
  save([{ ...item, id, at: now, read: false }, ...list]);
  return { id, isNew: true };
}

export function markInboxRead(id: string): void {
  const list = getInbox();
  if (!list.some(i => i.id === id && !i.read)) return;
  save(list.map(i => (i.id === id ? { ...i, read: true } : i)));
}

export function markAllInboxRead(): void {
  const list = getInbox();
  if (!list.some(i => !i.read)) return;
  save(list.map(i => ({ ...i, read: true })));
}

export function removeInbox(id: string): void {
  save(getInbox().filter(i => i.id !== id));
}

export function clearInbox(): void {
  save([]);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useInbox(): InboxItem[] {
  return useSyncExternalStore(subscribe, getInbox, getInbox);
}

export function useUnreadCount(): number {
  const list = useInbox();
  return list.reduce((n, i) => n + (i.read ? 0 : 1), 0);
}
