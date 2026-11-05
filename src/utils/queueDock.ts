import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';

// Warteschlangen-Fach: angedockt (bleibt offen, nichts wird abgedunkelt). Zustand bleibt gespeichert.
const KEY = 'filamenthub_queue_dock';
let open = safeStorage.getItem(KEY) === '1';
const subs = new Set<() => void>();

export function setQueueDock(v: boolean): void {
  open = v;
  safeStorage.setItem(KEY, v ? '1' : '0');
  subs.forEach(f => f());
}
export const toggleQueueDock = (): void => setQueueDock(!open);

export function useQueueDock(): boolean {
  return useSyncExternalStore(
    cb => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => open,
    () => false
  );
}
