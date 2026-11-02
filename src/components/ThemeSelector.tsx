import React from 'react';
import {
  ThemeBrightness,
  ThemeAccent,
  BRIGHTNESS_OPTIONS,
  ACCENT_OPTIONS
} from '../types/theme';
import { Coffee, Palette, Sun, Sparkles } from 'lucide-react';
import { useThemeStyle, type ThemeStyle } from '../utils/themeStyle';

interface ThemeSelectorProps {
  brightness: ThemeBrightness;
  accent: ThemeAccent;
  onSetBrightness: (b: ThemeBrightness) => void;
  onSetAccent: (a: ThemeAccent) => void;
  compact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  brightness,
  accent,
  onSetBrightness,
  onSetAccent,
  compact = false
}) => {
  const [style, setStyle] = useThemeStyle();
  const cozy = style !== 'classic';
  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 p-1 rounded-xl border transition-colors"
        style={{
          backgroundColor: 'var(--app-card-sub)',
          borderColor: 'var(--app-border)'
        }}
      >
        <span className="text-[10px] font-bold px-1 hidden md:inline" style={{ color: 'var(--app-text-muted)' }}>
          Theme:
        </span>
        <div className="flex items-center gap-1">
          {BRIGHTNESS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onSetBrightness(opt.id)}
              title={`${opt.name}: ${opt.subtitle}`}
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer ${
                brightness === opt.id
                  ? 'ring-2 ring-[var(--app-accent)]/50 scale-110'
                  : 'hover:scale-105'
              }`}
              style={{
                backgroundColor: opt.bgHex,
                borderColor: brightness === opt.id ? 'var(--app-accent)' : 'var(--app-border)'
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: opt.cardHex }}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-3.5 p-3.5 rounded-xl border text-xs transition-colors"
      style={{
        backgroundColor: 'var(--app-card-sub)',
        borderColor: 'var(--app-border)',
        color: 'var(--app-text)'
      }}
    >
      {/* Design-Stil: Klassisch oder Cozy */}
      <div className="space-y-1.5">
        <span className="font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wider" style={{ color: 'var(--app-text-muted)' }}>
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Design</span>
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              { id: 'classic', name: 'Klassisch', sub: 'Hell oder dunkel, eigene Farbe', bg: '#d6dce5', card: '#eceff4', ink: '#0f172a', acc: '#168a47', serif: false },
              { id: 'cozy', name: 'Cozy', sub: 'Ruhig dunkelgrün', bg: '#14241c', card: '#1c3126', ink: '#e3eadf', acc: '#5fb582', serif: true },
              { id: 'night', name: 'Nacht', sub: 'Dunkles Lila', bg: '#16132a', card: '#201c38', ink: '#e6e2f4', acc: '#9484e6', serif: true },
              { id: 'sand', name: 'Sand', sub: 'Warm hell', bg: '#e9e2d3', card: '#f5f0e4', ink: '#2f2b23', acc: '#3f8a5c', serif: true }
            ] as const
          ).map(o => {
            const active = style === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setStyle(o.id as ThemeStyle)}
                className={`rounded-xl border p-2 text-left cursor-pointer transition ${active ? 'ring-2 ring-[var(--app-accent)]/40' : 'hover:opacity-90'}`}
                style={{ backgroundColor: active ? 'var(--app-accent-sub)' : 'var(--app-card)', borderColor: active ? 'var(--app-accent)' : 'var(--app-border)' }}
                aria-pressed={active}
              >
                {/* kleine Vorschau */}
                <div className="rounded-lg p-2 mb-1.5 border" style={{ backgroundColor: o.bg, borderColor: 'rgba(127,127,127,.25)' }}>
                  <div className="rounded-md p-1.5 space-y-1" style={{ backgroundColor: o.card }}>
                    <div
                      className="text-[11px] leading-none"
                      style={{ color: o.ink, fontFamily: o.serif ? "'Fraunces', Georgia, serif" : "'Plus Jakarta Sans', sans-serif", fontWeight: o.serif ? 600 : 800 }}
                    >
                      Filament
                    </div>
                    <div className="h-1 rounded-full w-3/4" style={{ backgroundColor: o.acc }} />
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: active ? 'var(--app-accent-text)' : 'var(--app-text)' }}>
                  {o.id !== 'classic' && <Coffee className="w-3 h-3" />}
                  {o.name}
                </div>
                <div className="text-[10px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
                  {o.sub}
                </div>
              </button>
            );
          })}
        </div>
        {cozy && (
          <p className="text-[10.5px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
            Cozy, Nacht und Sand haben feste Farben. Feinabstimmung (Helligkeit, Farbton, Glas) machst du unten bei „Helligkeit und Farbe“. Die 5 Helligkeiten und die Akzentfarbe hier gelten nur bei „Klassisch“.
          </p>
        )}
      </div>

      {/* 5 Helligkeitsstufen */}
      <div className={`space-y-1.5 pt-2 border-t ${cozy ? 'opacity-50' : ''}`} style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center justify-between" style={{ color: 'var(--app-text-muted)' }}>
          <span className="font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>5 Helligkeits-Themes</span>
          </span>
          <span className="text-[10px] font-semibold font-mono-num" style={{ color: 'var(--app-accent-text)' }}>
            {BRIGHTNESS_OPTIONS.find((b) => b.id === brightness)?.name}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1">
          {BRIGHTNESS_OPTIONS.map((opt) => {
            const isActive = brightness === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onSetBrightness(opt.id)}
                className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 text-center transition cursor-pointer ${
                  isActive
                    ? 'ring-2 ring-[var(--app-accent)]/40'
                    : 'hover:opacity-90'
                }`}
                style={{
                  backgroundColor: isActive ? 'var(--app-accent-sub)' : 'var(--app-card)',
                  borderColor: isActive ? 'var(--app-accent)' : 'var(--app-border)'
                }}
                title={opt.subtitle}
              >
                <div
                  className="w-6 h-6 rounded-lg border flex items-center justify-center shadow-inner"
                  style={{
                    backgroundColor: opt.bgHex,
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-md"
                    style={{ backgroundColor: opt.cardHex }}
                  />
                </div>
                <span
                  className="text-[9.5px] font-bold tracking-tight truncate w-full"
                  style={{ color: isActive ? 'var(--app-accent-text)' : 'var(--app-text)' }}
                >
                  {opt.name.split('. ')[1]?.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Akzentfarben */}
      <div className={`space-y-1.5 pt-2 border-t ${cozy ? 'opacity-50' : ''}`} style={{ borderColor: 'var(--app-border)' }}>
        <span className="font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wider" style={{ color: 'var(--app-text-muted)' }}>
          <Palette className="w-3.5 h-3.5 text-sky-400" />
          <span>Akzent-Farbschema</span>
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {ACCENT_OPTIONS.map((acc) => {
            const isActive = accent === acc.id;
            return (
              <button
                key={acc.id}
                onClick={() => onSetAccent(acc.id)}
                className="py-1.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 text-center transition cursor-pointer"
                style={{
                  backgroundColor: isActive ? 'var(--app-accent-sub)' : 'var(--app-card)',
                  borderColor: isActive ? 'var(--app-accent)' : 'var(--app-border)',
                  color: isActive ? 'var(--app-accent-text)' : 'var(--app-text)'
                }}
                title={acc.name}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow"
                  style={{ backgroundColor: acc.colorHex }}
                />
                <span className="text-[11px] font-semibold truncate">
                  {acc.name.split('-')[1] || acc.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
