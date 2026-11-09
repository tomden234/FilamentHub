import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';

// 1.264: Breite der Seitenteile (Menü links, Warteschlange und Drucker/Logs rechts) frei ziehbar. Bleibt nach dem Neustart gespeichert.
export type PanelKey = 'menu' | 'queue' | 'log';
type Widths = Partial<Record<PanelKey, number>>;

const KEY = 'filamenthub_panel_widths';
export const PANEL_MIN = 240;

function load(): Widths {
  try {
    const j = JSON.parse(safeStorage.getItem(KEY) || '{}');
    const out: Widths = {};
    for (const k of ['menu', 'queue', 'log'] as const) {
      const v = Number(j?.[k]);
      if (Number.isFinite(v) && v >= PANEL_MIN && v <= 4000) out[k] = Math.round(v);
    }
    return out;
  } catch {
    return {};
  }
}

let widths: Widths = load();
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

/** Größte erlaubte Breite: Fenster minus ein schmaler Rest zum Greifen */
export const panelMax = (): number => Math.max(PANEL_MIN, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 60);
export const clampPanel = (n: number): number => Math.round(Math.min(panelMax(), Math.max(PANEL_MIN, n)));

export function setPanelW(k: PanelKey, px: number): void {
  widths = { ...widths, [k]: clampPanel(px) };
  emit();
}

/** Beim Loslassen speichern (nicht bei jedem Pixel) */
export function savePanelW(): void {
  safeStorage.setItem(KEY, JSON.stringify(widths));
}

export function resetPanelW(k: PanelKey): void {
  const { [k]: _drop, ...rest } = widths;
  widths = rest;
  savePanelW();
  emit();
}

const sub = (cb: () => void) => {
  subs.add(cb);
  return () => subs.delete(cb);
};
const snap = () => widths;

export function usePanelWidths(): Widths {
  return useSyncExternalStore(sub, snap, () => ({}));
}

/** Breite des Menüs in px (Standard: fest 310, sonst 340) */
export const menuWidth = (w: Widths, docked: boolean): number => w.menu ?? (docked ? 310 : 340);
/** Warteschlange als CSS-Wert */
export const queueWidthCss = (w: Widths): string => (w.queue ? `min(94vw, ${w.queue}px)` : 'min(72vw, 18rem)');
/** Drucker/Logs als CSS-Wert */
export const logWidthCss = (w: Widths): string => `min(100vw, ${w.log ?? 420}px)`;
