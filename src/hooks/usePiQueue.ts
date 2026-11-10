import { useCallback, useEffect, useRef, useState } from 'react';
import { piQueue, type PiQueueItem } from '../utils/recorderServer';

/** Warteschlange vom Pi: alle 2 Sekunden neu laden (nur wenn die App sichtbar ist). null = kein Pi mit Hub (erst nach 10 Fehlversuchen in Folge). */
export function usePiQueue(active = true): { items: PiQueueItem[] | null; setItems: (i: PiQueueItem[] | null) => void; reload: () => Promise<void> } {
  const [items, setItems] = useState<PiQueueItem[] | null>(null);
  const fails = useRef(0);
  const reload = useCallback(async () => {
    const q = await piQueue();
    if (q) {
      fails.current = 0;
      setItems(q.items);
      return;
    }
    // 1.288: ein einzelner Aussetzer (Pi beschäftigt, Neustart, Netz) lässt die Warteschlange nicht mehr verschwinden:
    // letzte Liste bleibt stehen, erst nach 10 Fehlversuchen in Folge (ca. 20 s) gilt „kein Pi“
    fails.current += 1;
    if (fails.current >= 10) setItems(null);
  }, []);
  useEffect(() => {
    if (!active) return;
    void reload();
    const iv = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) void reload();
    }, 2000);
    const onVis = () => !document.hidden && void reload();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, reload]);
  return { items, setItems, reload };
}
