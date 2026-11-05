import { useCallback, useEffect, useState } from 'react';
import { piQueue, type PiQueueItem } from '../utils/recorderServer';

/** Warteschlange vom Pi: jede Sekunde neu laden (nur wenn die App sichtbar ist). null = kein Pi mit Hub. */
export function usePiQueue(active = true): { items: PiQueueItem[] | null; setItems: (i: PiQueueItem[] | null) => void; reload: () => Promise<void> } {
  const [items, setItems] = useState<PiQueueItem[] | null>(null);
  const reload = useCallback(async () => {
    const q = await piQueue();
    setItems(q ? q.items : null);
  }, []);
  useEffect(() => {
    if (!active) return;
    void reload();
    const iv = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) void reload();
    }, 1000);
    const onVis = () => !document.hidden && void reload();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, reload]);
  return { items, setItems, reload };
}
