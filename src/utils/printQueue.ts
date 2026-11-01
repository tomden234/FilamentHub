// Druck-Warteschlange: Aufträge vormerken (Name, Material, Gramm). Die App prüft, ob das Filament im AMS reicht,
// nimmt fertige Drucke aus der Liste und meldet nach dem Druckende, was als Nächstes dran ist.
// Sie startet nichts von selbst: erst die Platte frei machen, dann den Druck am Drucker oder im Slicer starten.
import { useSyncExternalStore } from 'react';
import type { Spool } from '../types/filament';
import { safeStorage } from './safeStorage';
import { baseMaterial } from './amsMatch';
import { raiseAlert } from './alerts';

export interface QueueItem {
  id: string;
  name: string;
  material: string;
  grams: number;
  colorHex?: string;
}

export interface QueueCheck {
  ok: boolean;
  /** Spule, die gedruckt würde (wenn eine passt) */
  spool?: Spool;
  text: string;
}

const KEY = 'filamenthub_print_queue_v1';
let cache: QueueItem[] | null = null;
const listeners = new Set<() => void>();

const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/\.gcode\.3mf$|\.3mf$|\.gcode$/g, '')
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim();

/** Passt der Druckname zum Eintrag? (Dateiname und Auftragsname sind oft leicht verschieden) */
export function sameJob(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}

/** Reicht das Filament der Spulen, die gerade im AMS stecken (laut Slot-Zuordnung)? */
export function checkQueueItem(item: QueueItem, loaded: Spool[]): QueueCheck {
  const mat = baseMaterial(item.material);
  const sameMat = loaded.filter(s => !mat || baseMaterial(s.material) === mat);
  if (!loaded.length) return { ok: false, text: 'Keine Spulen im AMS zugeordnet' };
  if (!sameMat.length) return { ok: false, text: `${item.material || 'Material'} steckt nicht im AMS` };
  const enough = sameMat.filter(s => s.remainingWeight >= item.grams).sort((a, b) => a.remainingWeight - b.remainingWeight)[0];
  if (enough) return { ok: true, spool: enough, text: `Reicht: ${enough.brand} ${enough.name} (${Math.round(enough.remainingWeight)} g)` };
  const most = [...sameMat].sort((a, b) => b.remainingWeight - a.remainingWeight)[0];
  return { ok: false, spool: most, text: `Zu wenig: nur ${Math.round(most.remainingWeight)} g von ${Math.round(item.grams)} g` };
}

function read(): QueueItem[] {
  try {
    const v = JSON.parse(safeStorage.getItem(KEY) || '[]');
    if (Array.isArray(v)) return v.filter(x => x && typeof x.name === 'string').slice(0, 50);
  } catch {
    /* kaputt */
  }
  return [];
}

/** Spulen, die laut Slot-Zuordnung der App gerade im AMS (und extern) stecken */
export function loadedSpools(spools: Spool[]): Spool[] {
  try {
    const map: Record<string, string> = JSON.parse(safeStorage.getItem('filamenthub_ams_slots_x2d') || '{}');
    const ids = new Set(Object.values(map));
    return spools.filter(s => ids.has(s.id));
  } catch {
    return [];
  }
}

export function getQueue(): QueueItem[] {
  if (!cache) cache = read();
  return cache;
}

function save(list: QueueItem[]): void {
  cache = list;
  safeStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach(l => l());
}

export function addToQueue(i: Omit<QueueItem, 'id'>): void {
  save([...getQueue(), { ...i, id: `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}` }]);
}
export function removeFromQueue(id: string): void {
  save(getQueue().filter(x => x.id !== id));
}
export function moveInQueue(id: string, dir: -1 | 1): void {
  const l = [...getQueue()];
  const i = l.findIndex(x => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]];
  save(l);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function useQueue(): QueueItem[] {
  return useSyncExternalStore(subscribe, getQueue, getQueue);
}

/** Druck ist fertig: passenden Eintrag aus der Liste nehmen und sagen, was als Nächstes dran ist */
export function onQueuePrintFinished(jobName: string, loaded: Spool[], showToast?: (t: string) => void): void {
  const list = getQueue();
  if (!list.length) return;
  const hit = list.find(x => sameJob(x.name, jobName));
  const rest = hit ? list.filter(x => x.id !== hit.id) : list;
  if (hit) save(rest);
  const next = rest[0];
  if (!next) {
    if (hit) void raiseAlert({ kind: 'info', key: `queue-empty-${Date.now()}`, title: 'Warteschlange leer', text: 'Alle vorgemerkten Drucke sind fertig.', toast: '📋 Warteschlange leer' }, showToast);
    return;
  }
  const c = checkQueueItem(next, loaded);
  const text = `Nächster in der Warteschlange: ${next.name}. Platte frei machen. ${c.ok ? '✅' : '⚠️'} ${c.text}.`;
  void raiseAlert({ kind: 'info', key: `queue-next-${next.id}-${Date.now()}`, title: 'Nächster Druck', text, toast: `📋 ${text}` }, showToast);
}
