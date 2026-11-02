// Design-Stil: „classic“ (bisheriges Aussehen mit Helligkeit + Akzentfarbe), „cozy“ (ruhig dunkel: Waldgrün), „night“ (dunkles Lila) oder „sand“ (warm hell: Papier und Waldgrün), beide mit Serifen-Überschriften und weichen Karten. Jederzeit umschaltbar, die alte Helligkeit/Farbe bleibt gespeichert.
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';
import { STORAGE_KEY_THEME_BRIGHT } from './storageKeys';
import { applyCustomize, setActiveCustomizeStyle } from './customize';

export type ThemeStyle = 'classic' | 'cozy' | 'night' | 'glass-green' | 'glass-purple' | 'glass-cream' | 'sand';
const KEY = 'filamenthub_theme_style';
const listeners = new Set<() => void>();

/** Ab 1.162 ist Cozy der Standard. Wer „Klassisch“ wählt, behält das. */
export function getThemeStyle(): ThemeStyle {
  const v = safeStorage.getItem(KEY);
  if (v === 'glass') return 'glass-purple'; // Name aus 1.167
  return v === 'classic' || v === 'sand' || v === 'night' || v === 'glass-green' || v === 'glass-purple' || v === 'glass-cream' ? v : 'cozy';
}

/** data-theme, das wirklich gesetzt wird: Cozy nutzt die dunklen Grundregeln (Graphit) und legt seine Farben darüber */
export function effectiveTheme(brightness: string): string {
  const st = getThemeStyle();
  return st === 'cozy' || st === 'night' || st === 'glass-green' || st === 'glass-purple' ? 'slate' : st === 'sand' || st === 'glass-cream' ? 'warm' : brightness;
}

export function applyThemeStyle(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const style = getThemeStyle();
  root.setAttribute('data-style', style.startsWith('glass') ? 'glass' : style);
  if (style.startsWith('glass')) root.setAttribute('data-tone', style.slice(6));
  else root.removeAttribute('data-tone');
  root.setAttribute('data-theme', effectiveTheme(safeStorage.getItem(STORAGE_KEY_THEME_BRIGHT) || 'warm'));
  setActiveCustomizeStyle(style); // eigene Einstellungen gelten je Design (1.169)
  applyCustomize(); // setzt auch die Systemleisten
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
