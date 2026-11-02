import React from 'react';
import { Wand2, RotateCcw } from 'lucide-react';
import { useCustomize, resetCustomize, isCustomized, CUSTOM_PRESETS, CUSTOM_DEFAULT, type Customize } from '../../utils/customize';
import { setThemeStyle } from '../../utils/themeStyle';

const Slider: React.FC<{
  label: string; hint?: string; value: number; min: number; max: number; unit?: string; step?: number;
  onChange: (n: number) => void; hue?: boolean; disabled?: boolean;
}> = ({ label, hint, value, min, max, unit = '', step = 1, onChange, hue, disabled }) => (
  <label className={`block ${disabled ? 'opacity-45' : ''}`}>
    <span className="flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-bold" style={{ color: 'var(--app-text)' }}>{label}</span>
      <span className="text-[11px] font-mono-num" style={{ color: 'var(--app-accent-text)' }}>{value}{unit}</span>
    </span>
    {hint && <span className="block text-[10.5px] leading-snug mb-0.5" style={{ color: 'var(--app-text-muted)' }}>{hint}</span>}
    <input
      type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full h-2 rounded-full cursor-pointer appearance-none"
      style={{
        accentColor: 'var(--app-accent)',
        background: hue
          ? 'linear-gradient(90deg, hsl(0 70% 55%), hsl(60 70% 55%), hsl(120 70% 50%), hsl(180 70% 50%), hsl(240 70% 60%), hsl(300 70% 58%), hsl(360 70% 55%))'
          : 'var(--app-border)'
      }}
    />
  </label>
);

const Sw: React.FC<{ label: string; hint?: string; on: boolean; set: (v: boolean) => void }> = ({ label, hint, on, set }) => (
  <button type="button" onClick={() => set(!on)} className="w-full flex items-center justify-between gap-3 text-left cursor-pointer" aria-pressed={on}>
    <span className="min-w-0">
      <span className="block text-[12px] font-bold" style={{ color: 'var(--app-text)' }}>{label}</span>
      {hint && <span className="block text-[10.5px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>{hint}</span>}
    </span>
    <span className="w-9 h-5 rounded-full shrink-0 p-0.5 transition" style={{ backgroundColor: on ? 'var(--app-accent)' : 'var(--app-border)' }}>
      <span className="block w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: on ? 'translateX(16px)' : 'none' }} />
    </span>
  </button>
);

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border p-3 space-y-3" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
    <div className="fh-eyebrow">{title}</div>
    {children}
  </div>
);

export const CustomizePanel: React.FC = () => {
  const [c, set] = useCustomize();
  const up = (p: Partial<Customize>) => set(p);
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug px-1" style={{ color: 'var(--app-text-muted)' }}>Alle Regler gelten nur für das gewählte Design. Jedes Design merkt sich seine eigenen Werte.</p>
      <div className="rounded-xl border p-3" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
            <Wand2 className="w-4 h-4 text-violet-400" /> Fertige Looks
          </span>
          {isCustomized(c) && (
            <button onClick={resetCustomize} className="text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
              <RotateCcw className="w-3 h-3" /> Zurücksetzen
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CUSTOM_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => { setThemeStyle(p.style); set({ ...CUSTOM_DEFAULT, ...p.c }); }}
              className="rounded-lg border px-2.5 py-2 text-left cursor-pointer hover:opacity-90 transition min-w-0"
              style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)' }}
            >
              <span className="block text-[12px] font-bold truncate" style={{ color: 'var(--app-text)' }}>{p.name}</span>
              <span className="block text-[10.5px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>{p.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <Group title="Farbe und Helligkeit">
        <Slider label="Farbanteil" hint="Weniger = kaum Lila, nur Akzente. Gilt für Flächen und Hintergrundlicht" value={c.color} min={0} max={100} unit=" %" onChange={n => up({ color: n })} />
        <Slider label="Hell / Dunkel" hint="Flächen heller oder dunkler, die Farbe bleibt gleich" value={c.light} min={-25} max={25} unit=" %" onChange={n => up({ light: n })} />
        <Sw label="Hintergrund einfärben" hint="Tönt Flächen in einer Farbe, z. B. Lila" on={c.tintOn} set={v => up({ tintOn: v })} />
        <Slider label="Farbton Hintergrund" value={c.tintHue} min={0} max={360} unit="°" hue disabled={!c.tintOn} onChange={n => up({ tintHue: n })} />
        <Slider label="Stärke der Tönung" value={c.tintAmount} min={0} max={100} unit=" %" disabled={!c.tintOn} onChange={n => up({ tintAmount: n })} />
        <Slider label="Textfarbe" hint="Links kühl, rechts warm" value={c.textWarm} min={-50} max={50} onChange={n => up({ textWarm: n })} />
      </Group>

      <Group title="Akzentfarbe">
        <Sw label="Eigene Akzentfarbe" hint="Knöpfe, Balken, Hervorhebungen" on={c.accentOn} set={v => up({ accentOn: v })} />
        <Slider label="Farbton" value={c.accentHue} min={0} max={360} unit="°" hue disabled={!c.accentOn} onChange={n => up({ accentHue: n })} />
        <Slider label="Kräftigkeit" value={c.accentSat} min={20} max={100} unit=" %" disabled={!c.accentOn} onChange={n => up({ accentSat: n })} />
      </Group>

      <Group title="Glas und Licht">
        <Slider label="Glas-Effekt" hint="Karten werden durchscheinend und leicht unscharf" value={c.glass} min={0} max={100} unit=" %" onChange={n => up({ glass: n })} />
        <Slider label="Leuchten im Hintergrund" hint="Weiches Farblicht, passt zur Akzentfarbe" value={c.glow} min={0} max={100} unit=" %" onChange={n => up({ glow: n })} />
      </Group>

      <Group title="Form und Schrift">
        <Slider label="Rundung der Ecken" value={c.radius} min={40} max={160} unit=" %" step={5} onChange={n => up({ radius: n })} />
        <Slider label="Schriftgröße" value={c.font} min={85} max={125} unit=" %" step={5} onChange={n => up({ font: n })} />
        <Sw label="Überschriften mit Serifen" hint="Aus = überall die gleiche Schrift" on={c.serif} set={v => up({ serif: v })} />
        <Sw label="Ruhige Bewegung" hint="Schaltet Animationen und Übergänge aus" on={c.calm} set={v => up({ calm: v })} />
      </Group>
    </div>
  );
};
