import React from 'react';
import type { NfcWriteFormat } from '../../utils/nfcManager';

interface NfcFormatPickerProps {
  writeFormat: NfcWriteFormat;
  setWriteFormat: (format: NfcWriteFormat) => void;
}

const OPTIONS: { id: NfcWriteFormat; title: string; hint: string; badge?: string }[] = [
  { id: 'opentag3d', title: 'OpenTag3D', hint: 'Offener Standard, kompakt, auch andere Programme lesen es', badge: 'Empfohlen' },
  { id: 'filamenthub', title: 'FilamentHub', hint: 'Eigenes Format mit Restgewicht, nur diese App' }
];

/** Auswahl des Tag-Formats beim Schreiben */
export const NfcFormatPicker: React.FC<NfcFormatPickerProps> = ({ writeFormat, setWriteFormat }) => {
  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Tag-Format</span>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(opt => {
          const active = writeFormat === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setWriteFormat(opt.id)}
              className="p-2.5 rounded-xl border-2 text-left transition cursor-pointer"
              style={{
                backgroundColor: active ? 'var(--app-accent-sub)' : 'var(--app-card-sub)',
                borderColor: active ? 'var(--app-accent)' : 'var(--app-border)'
              }}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: active ? 'var(--app-accent-text)' : 'var(--app-text)' }}>
                {opt.title}
                {opt.badge && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: 'var(--app-accent)' }}>
                    {opt.badge}
                  </span>
                )}
              </span>
              <span className="block text-[10px]" style={{ color: 'var(--app-text-muted)' }}>{opt.hint}</span>
            </button>
          );
        })}
      </div>
      {writeFormat === 'opentag3d' && (
        <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
          OpenTag3D braucht mindestens einen NTAG215-Tag. Das Restgewicht führt die App, der Tag verweist auf die Spule.
        </p>
      )}
    </div>
  );
};
