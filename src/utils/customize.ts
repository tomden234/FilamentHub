// Eigenes Aussehen (1.166): Helligkeit, Farbton, Akzent, Glas, Leuchten, Rundung, Schrift. Liegt über dem gewählten Design
// (Klassisch/Cozy/Nacht/Sand) und lässt sich mit „Zurücksetzen“ komplett entfernen. Alles bleibt lokal gespeichert.
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';
import { applySystemBars } from './systemBars';
import type { ThemeStyle } from './themeStyle';

export interface Customize {
  color: number; // Farbanteil 0..100: wie viel Farbe (z. B. Lila) in Flächen und Hintergrundlicht steckt
  light: number; // Helligkeit -25..25 (Prozentpunkte Lightness der Flächen)
  tintOn: boolean; // Hintergrund einfärben
  tintHue: number; // 0..360
  tintAmount: number; // 0..100
  accentOn: boolean; // eigene Akzentfarbe
  accentHue: number; // 0..360
  accentSat: number; // 20..100
  glass: number; // 0..100 Glas-Effekt (Karten halb durchsichtig + Unschärfe)
  glow: number; // 0..100 Leuchten im Hintergrund
  radius: number; // 40..160 Rundung in Prozent
  font: number; // 85..125 Schriftgröße in Prozent
  serif: boolean; // Überschriften mit Serifen
  calm: boolean; // Bewegung aus
  textWarm: number; // -50..50 Textfarbe kühler/wärmer
}

export const CUSTOM_DEFAULT: Customize = {
  color: 100, light: 0, tintOn: false, tintHue: 270, tintAmount: 40, accentOn: false, accentHue: 262, accentSat: 60,
  glass: 0, glow: 50, radius: 100, font: 100, serif: true, calm: false, textWarm: 0
};

/** Fertige Looks (setzen auch das Design) */
export const CUSTOM_PRESETS: { id: string; name: string; sub: string; style: ThemeStyle; c: Partial<Customize> }[] = [
  { id: 'glass-green', name: 'Glas Dunkelgrün', sub: 'Tiefes Grün, Creme, leichte Akzente', style: 'glass-green', c: {} },
  { id: 'glass-purple', name: 'Glas Dunkellila', sub: 'Tiefes Lila, Creme, leichte Akzente', style: 'glass-purple', c: {} },
  { id: 'glass-cream', name: 'Glas Creme', sub: 'Hell, cremig, Salbeigrün', style: 'glass-cream', c: {} },
  { id: 'glass-calm', name: 'Glas ruhig', sub: 'Dunkellila, fast ohne Farbe', style: 'glass-purple', c: { color: 25, glow: 30 } },
  { id: 'paper', name: 'Papier', sub: 'Hell, ohne Effekte', style: 'sand', c: { glass: 0, glow: 20, calm: true } }
];

// 1.169: Eigene Einstellungen gelten je Design. Jedes Design hat seinen eigenen Satz (Schlüssel v2).
// Der alte globale Satz (v1) wird nicht mehr gelesen, damit nichts Verstelltes mitwandert.
const KEY = 'filamenthub_custom_v2';
const STYLE_KEY = 'filamenthub_theme_style';
const listeners = new Set<() => void>();
let cache: Customize | null = null;
let activeStyle: string | null = null;

function currentStyle(): string {
  if (activeStyle) return activeStyle;
  let v = safeStorage.getItem(STYLE_KEY) || 'cozy';
  if (v === 'glass') v = 'glass-purple';
  activeStyle = v;
  return v;
}

function readAll(): Record<string, Partial<Customize>> {
  try {
    const raw = safeStorage.getItem(KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/** Vom Design-Wechsel aufgerufen: anderes Design = anderer Satz */
export function setActiveCustomizeStyle(style: string): void {
  if (activeStyle === style) return;
  activeStyle = style;
  cache = null;
  listeners.forEach(l => l());
}

export function getCustomize(): Customize {
  if (cache) return cache;
  cache = { ...CUSTOM_DEFAULT, ...(readAll()[currentStyle()] || {}) };
  return cache;
}

export function setCustomize(patch: Partial<Customize>): void {
  cache = { ...getCustomize(), ...patch };
  const all = readAll();
  all[currentStyle()] = cache;
  safeStorage.setItem(KEY, JSON.stringify(all));
  applyCustomize();
  listeners.forEach(l => l());
}

/** Setzt nur das aktuelle Design zurück, andere bleiben */
export function resetCustomize(): void {
  cache = { ...CUSTOM_DEFAULT };
  const all = readAll();
  delete all[currentStyle()];
  safeStorage.setItem(KEY, JSON.stringify(all));
  applyCustomize();
  listeners.forEach(l => l());
}

export function isCustomized(c: Customize = getCustomize()): boolean {
  return (Object.keys(CUSTOM_DEFAULT) as (keyof Customize)[]).some(k => c[k] !== CUSTOM_DEFAULT[k]);
}

// ───────────── Farb-Hilfen ─────────────
type RGBA = [number, number, number, number];
function parseColor(v: string): RGBA | null {
  v = v.trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (m) {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);
    if (p.length >= 3 && p.every(n => !isNaN(n))) return [p[0], p[1], p[2], p[3] ?? 1];
  }
  return null;
}
function rgb2hsl([r, g, b]: RGBA): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
function hsla(h: number, s: number, l: number, a = 1): string {
  return `hsla(${Math.round(((h % 360) + 360) % 360)}, ${clamp(s, 0, 100).toFixed(1)}%, ${clamp(l, 0, 100).toFixed(1)}%, ${a})`;
}

const SURFACE_VARS = ['--app-bg', '--app-card', '--app-card-sub', '--app-border', '--app-input-bg'];
const TEXT_VARS = ['--app-text', '--app-text-muted'];
const ACCENT_VARS = ['--app-accent', '--app-accent-hover', '--app-accent-bar', '--app-accent-text', '--a-100', '--a-300', '--a-400', '--a-500', '--a-600', '--a-700'];
const ALL_VARS = [...SURFACE_VARS, ...TEXT_VARS, ...ACCENT_VARS, '--app-accent-sub', '--app-accent-gradient', '--radius-md', '--radius-lg', '--radius-xl', '--radius-2xl', '--fh-glow', '--fh-glass-blur', '--fh-glow-hue'];

function numberOr(v: string, d: number): number {
  const n = parseFloat(v);
  return isNaN(n) ? d : n;
}

export function applyCustomize(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const c = getCustomize();
  // alte Überschreibungen weg, damit wir die echten Design-Werte lesen
  ALL_VARS.forEach(v => root.style.removeProperty(v));
  root.style.removeProperty('font-size');
  root.removeAttribute('data-glass');
  root.removeAttribute('data-custom');
  root.removeAttribute('data-calm');
  root.removeAttribute('data-noserif');

  if (!isCustomized(c)) {
    applySystemBars();
    return;
  }
  root.setAttribute('data-custom', '1');
  const cs = getComputedStyle(root);
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  const read = (k: string) => parseColor(cs.getPropertyValue(k) || '');
  const dark = /dark/.test(cs.colorScheme || '') || root.getAttribute('data-theme') === 'slate' || root.getAttribute('data-theme') === 'midnight';
  const alphaCard = c.glass > 0 ? 1 - (c.glass / 100) * 0.62 : 1;

  // Flächen: Helligkeit verschieben, optional einfärben
  SURFACE_VARS.forEach(k => {
    const col = read(k);
    if (!col) return;
    let [h, s, l] = rgb2hsl(col);
    l += c.light * (k === '--app-border' ? 0.7 : 1);
    s *= c.color / 100;
    if (c.tintOn) {
      h = c.tintHue;
      s = clamp(s * 0.4 + c.tintAmount * (dark ? 0.55 : 0.4), 0, 90);
    }
    let a = col[3];
    if (k === '--app-card' || k === '--app-card-sub') a = a * alphaCard;
    set(k, hsla(h, s, l, a));
  });
  // Text: kühler/wärmer
  TEXT_VARS.forEach(k => {
    const col = read(k);
    if (!col) return;
    const [h, s, l] = rgb2hsl(col);
    if (c.textWarm !== 0) set(k, hsla(c.textWarm > 0 ? 38 : 215, clamp(Math.max(s, 12), 0, 60) * (Math.abs(c.textWarm) / 25), l, col[3]));
    else if (c.light !== 0 && Math.abs(c.light) > 12) set(k, hsla(h, s, clamp(l + (dark ? 4 : -4) * Math.sign(c.light), 0, 100), col[3]));
  });
  // Akzent
  if (c.accentOn) {
    ACCENT_VARS.forEach(k => {
      const col = read(k);
      if (!col) return;
      const [, s, l] = rgb2hsl(col);
      set(k, hsla(c.accentHue, clamp(s * (c.accentSat / 60), 8, 100), l, col[3]));
    });
    const mid = read('--app-accent') || [120, 100, 200, 1];
    const [, , lm] = rgb2hsl(mid);
    set('--app-accent-sub', hsla(c.accentHue, c.accentSat, clamp(lm + 12, 0, 90), 0.16));
    set('--app-accent-gradient', `linear-gradient(90deg, ${hsla(c.accentHue, c.accentSat, clamp(lm - 10, 5, 90))} 0%, ${hsla(c.accentHue, c.accentSat, lm)} 60%, ${hsla(c.accentHue, c.accentSat - 5, clamp(lm + 22, 5, 92))} 100%)`);
  }
  // Leuchten
  const glowHue = c.accentOn ? c.accentHue : c.tintOn ? c.tintHue : numberOr(cs.getPropertyValue('--fh-glow-hue'), 150);
  set('--fh-glow', String((c.glow / 100) * (c.color / 100)));
  set('--fh-glow-hue', String(glowHue));
  if (c.glass > 0) {
    set('--fh-glass-blur', `${Math.round(6 + c.glass * 0.22)}px`);
    root.setAttribute('data-glass', '1');
  }
  // Rundung
  const sc = c.radius / 100;
  if (sc !== 1) {
    const base = root.getAttribute('data-style') === 'classic' ? [0.375, 0.5, 0.75, 1] : [0.6, 0.8, 1.05, 1.45];
    ['--radius-md', '--radius-lg', '--radius-xl', '--radius-2xl'].forEach((k, i) => set(k, `${(base[i] * sc).toFixed(3)}rem`));
  }
  if (c.font !== 100) root.style.fontSize = `${c.font}%`;
  if (!c.serif) root.setAttribute('data-noserif', '1');
  if (c.calm) root.setAttribute('data-calm', '1');
  applySystemBars();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function useCustomize(): [Customize, typeof setCustomize] {
  return [useSyncExternalStore(subscribe, getCustomize, getCustomize), setCustomize];
}
