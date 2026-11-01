// Design-Stil: „classic“ (bisheriges Aussehen mit Helligkeit + Akzentfarbe) oder „cozy“ (dunkles Petrol, Creme, Messing,
// Serifen-Überschriften, weiche Karten). Jederzeit umschaltbar, die alte Helligkeit/Farbe bleibt gespeichert.
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';
import { STORAGE_KEY_THEME_BRIGHT } from './storageKeys';
import { applySystemBars } from './systemBars';

export type ThemeStyle = 'classic' | 'cozy';
const KEY = 'filamenthub_theme_style';
const listeners = new Set<() => void>();

/** Ab 1.162 ist Cozy der Standard. Wer „Klassisch“ wählt, behält das. */
export function getThemeStyle(): ThemeStyle {
  return safeStorage.getItem(KEY) === 'classic' ? 'classic' : 'cozy';
}

/** data-theme, das wirklich gesetzt wird: Cozy nutzt die dunklen Grundregeln (Graphit) und legt seine Farben darüber */
export function effectiveTheme(brightness: string): string {
  return getThemeStyle() === 'cozy' ? 'slate' : brightness;
}

export function applyThemeStyle(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const style = getThemeStyle();
  root.setAttribute('data-style', style);
  root.setAttribute('data-theme', effectiveTheme(safeStorage.getItem(STORAGE_KEY_THEME_BRIGHT) || 'warm'));
  applySystemBars();
}

export function setThemeStyle(s: ThemeStyle): void {
  safeStorage.setItem(KEY, s);
  applyThemeStyle();
  listeners.forEach(l => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useThemeStyle(): [ThemeStyle, typeof setThemeStyle] {
  return [useSyncExternalStore(subscribe, getThemeStyle, getThemeStyle), setThemeStyle];
}
