// Namen der Designs und Umstellung ausgemusterter Designs (ohne Abhängigkeiten, damit customize.ts es ohne Kreis-Import nutzen kann)
export type ThemeStyle = 'classic' | 'cozy' | 'night' | 'mocha' | 'glass-green' | 'glass-purple' | 'glass-cream' | 'sand' | 'mint' | 'brass';

/** Designs, die im Auswahlmenü stehen (1.251 aufgeräumt: 4 helle, 1 dunkles) */
export const VISIBLE_STYLES: ThemeStyle[] = ['classic', 'sand', 'brass', 'mint', 'night'];

/** 1.251: Ausgemusterte Designs werden auf das nächste passende umgestellt (dunkel → Nacht, hell → Sand). Standard ist Sand. */
export function normalizeThemeStyle(v: string | null | undefined): ThemeStyle {
  if (v === 'classic' || v === 'sand' || v === 'mint' || v === 'brass' || v === 'night') return v;
  if (v === 'cozy' || v === 'mocha' || v === 'glass' || v === 'glass-green' || v === 'glass-purple') return 'night';
  return 'sand';
}

