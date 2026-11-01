import React from 'react';

// Kleine, gemeinsame Bausteine für die Werkstatt-Fenster

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div
    className={`rounded-xl border p-3 space-y-2 ${className}`}
    style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
  >
    {children}
  </div>
);

export const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({
  on,
  onChange,
  label,
  hint
}) => (
  <button
    type="button"
    onClick={() => onChange(!on)}
    className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
    aria-pressed={on}
  >
    <span className="min-w-0">
      <span className="text-xs font-bold block" style={{ color: 'var(--app-text)' }}>
        {label}
      </span>
      {hint && (
        <span className="text-[11px] block leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          {hint}
        </span>
      )}
    </span>
    <span
      className="w-10 h-6 rounded-full relative shrink-0 transition-colors"
      style={{ backgroundColor: on ? 'var(--app-accent)' : 'var(--app-border)' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
        style={{ left: on ? '1.15rem' : '0.125rem' }}
      />
    </span>
  </button>
);

export const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--app-input-bg)',
  borderColor: 'var(--app-border)',
  color: 'var(--app-text)'
};

export const buttonStyle: React.CSSProperties = {
  backgroundColor: 'var(--app-card)',
  borderColor: 'var(--app-border)',
  color: 'var(--app-text)'
};

/** Bereich mit kleiner Überschrift (in „Cozy“ als Serifen-Schrift) */
export const Section: React.FC<{
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  children: React.ReactNode;
}> = ({ id, icon: Icon, title, sub, children }) => (
  <section id={`notices-${id}`} className="space-y-2 scroll-mt-2">
    <div className="flex items-end gap-2 px-1">
      <span
        className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--app-accent-sub)', borderColor: 'var(--app-border)', color: 'var(--app-accent-text)' }}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-extrabold leading-tight" style={{ color: 'var(--app-text)' }}>
          {title}
        </h4>
        {sub && (
          <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
    {children}
  </section>
);

/** Schalter untereinander mit feinen Trennlinien */
export const ToggleList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="divide-y divide-[var(--app-border)] [&>*]:py-2.5 [&>*:first-child]:pt-0.5 [&>*:last-child]:pb-0.5" style={{ borderColor: 'var(--app-border)' }}>
    {children}
  </div>
);
