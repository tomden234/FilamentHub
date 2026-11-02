import React from 'react';
import { Sliders } from 'lucide-react';
import { ThemeSelector } from '../ThemeSelector';
import { CustomizePanel } from './CustomizePanel';
import type { SidebarProps as ParentProps } from '../Sidebar';

export interface SettingsThemesPanelProps {
  themeBrightness: ParentProps['themeBrightness'];
  themeAccent: ParentProps['themeAccent'];
  onSetBrightness: ParentProps['onSetBrightness'];
  onSetAccent: ParentProps['onSetAccent'];
}

export const SettingsThemesPanel: React.FC<SettingsThemesPanelProps> = ({
  themeBrightness,
  themeAccent,
  onSetBrightness,
  onSetAccent
}) => {
  return (
<div className="space-y-3">
                  <div
                    className="rounded-xl border p-3 space-y-1 transition-colors"
                    style={{
                      backgroundColor: 'var(--app-card-sub)',
                      borderColor: 'var(--app-border)'
                    }}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                      <Sliders className="w-4 h-4 text-orange-400" />
                      <span>Design und Farben</span>
                    </span>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                      Wähle ein Design und stelle es unten nach deinem Geschmack ein: Helligkeit, Farben, Glas, Rundung, Schrift. „Zurücksetzen“ bringt alles auf Anfang.
                    </p>
                  </div>

                  <ThemeSelector
                    brightness={themeBrightness}
                    accent={themeAccent}
                    onSetBrightness={onSetBrightness}
                    onSetAccent={onSetAccent}
                    compact={false}
                  />

                  <CustomizePanel />
                </div>
  );
};
