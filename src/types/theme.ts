export type ThemeBrightness = 'polar' | 'warm' | 'titanium' | 'slate' | 'midnight';
export type ThemeAccent = 'orange' | 'blue' | 'emerald' | 'cyan' | 'violet' | 'mono';

export interface BrightnessOption {
  id: ThemeBrightness;
  name: string;
  subtitle: string;
  level: string;
  bgHex: string;
  cardHex: string;
  textHex: string;
}

// 5 Stufen, gleichmäßig von hell nach dunkel verteilt (Helligkeit des Hintergrunds ca. 100 / 87 / 65 / 20 / 6 %)
export const BRIGHTNESS_OPTIONS: BrightnessOption[] = [
  {
    id: 'polar',
    name: '1. Weiß',
    subtitle: 'Reines Weiß',
    level: '100% Hell',
    bgHex: '#ffffff',
    cardHex: '#f1f5f9',
    textHex: '#0f172a'
  },
  {
    id: 'warm',
    name: '2. Soft',
    subtitle: 'Sanftes Hellgrau (Standard)',
    level: '87% Hell',
    bgHex: '#d6dce5',
    cardHex: '#eceff4',
    textHex: '#0f172a'
  },
  {
    id: 'titanium',
    name: '3. Grau',
    subtitle: 'Mittleres Grau',
    level: '65% Mittel',
    bgHex: '#aab4c4',
    cardHex: '#c9d1dd',
    textHex: '#0f172a'
  },
  {
    id: 'slate',
    name: '4. Graphit',
    subtitle: 'Dunkles Graphit mit Blauton',
    level: '20% Dunkel',
    bgHex: '#1c202b',
    cardHex: '#272c3a',
    textHex: '#f4f6fb'
  },
  {
    id: 'midnight',
    name: '5. Nacht',
    subtitle: 'Tiefes Nachtblau',
    level: '6% Fast schwarz',
    bgHex: '#080c15',
    cardHex: '#131a2b',
    textHex: '#f1f5f9'
  }
];

/** Standard-Theme: Soft */
export const DEFAULT_BRIGHTNESS: ThemeBrightness = 'warm';

export interface AccentOption {
  id: ThemeAccent;
  name: string;
  colorHex: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: 'orange', name: 'Industrie-Orange', colorHex: '#f97316' },
  { id: 'blue', name: 'Klassisch-Blau', colorHex: '#3b82f6' },
  { id: 'emerald', name: 'Dunkelgrün (Logo)', colorHex: '#168a47' },
  { id: 'cyan', name: 'Tech-Cyan', colorHex: '#06b6d4' },
  { id: 'violet', name: 'Neon-Violett', colorHex: '#8b5cf6' },
  { id: 'mono', name: 'Minimal-Silber', colorHex: '#94a3b8' }
];
