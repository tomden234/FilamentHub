import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Spool } from '../../types/filament';
import { PENDING_DEDUCT_KEY, recordDeduct, rememberJobGrams, type PendingDeduct } from '../../utils/printUsage';
import { safeStorage } from '../../utils/safeStorage';
import { printAlreadyDeducted } from '../../utils/serverDeducts';
import { resolveOnServer } from '../../utils/recorderServer';

// Nach einem Druck: „Spule abziehen?“ Ja/Nein. Spule und Gramm sind vorgewählt, wenn bekannt (Druckdatei, gemerkt, aktiver Slot).
// Kommt auch, wenn der Druck nicht über die App gestartet wurde oder die App beim Druckende zu war.
interface Props {
  pending: PendingDeduct;
  spools: Spool[];
  onDeduct: (spoolId: string, grams: number) => void;
  onClose: () => void;
}

interface Row {
  spoolId: string;
  grams: string;
}

const fmt = (g: number) => String(Math.round(g * 10) / 10).replace('.', ',');

export const LanDeductPrompt: React.FC<Props> = ({ pending, spools, onDeduct, onClose }) => {
  const [rows, setRows] = useState<Row[]>(() =>
    pending.parts && pending.parts.length
      ? pending.parts.map(p => ({ spoolId: p.spoolId, grams: p.grams > 0 ? fmt(p.grams) : '' }))
      : [{ spoolId: pending.spoolId || spools[0]?.id || '', grams: '' }]
  );
  const parsed = rows.map(r => ({ spoolId: r.spoolId, g: Number(r.grams.replace(',', '.')) }));
  const ok = parsed.length > 0 && parsed.every(r => r.spoolId && r.g > 0);
  const known = Boolean(pending.parts?.length);

  const done = () => {
    safeStorage.removeItem(PENDING_DEDUCT_KEY);
    // Beantwortet: andere Geräte fragen diesen Druck nicht mehr (Pi-Server merkt es sich)
    if (pending.printId) void resolveOnServer(pending.printId);
    onClose();
  };

  // 1.192: Hat die Cloud diesen Druck inzwischen schon abgezogen, nicht noch einmal fragen
  useEffect(() => {
    if (printAlreadyDeducted(pending.printId, pending.jobName, Date.parse(pending.at))) done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (i: number, patch: Partial<Row>) => setRows(prev => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const title =
    pending.reason === 'failed'
      ? `Druck abgebrochen${pending.percent ? ` bei ${pending.percent} %` : ''}`
      : pending.reason === 'missed'
      ? 'Druck fertig, Spule abziehen?'
      : 'Druck fertig: Verbrauch abziehen';

  const hint =
    pending.reason === 'failed'
      ? known
        ? 'Gramm anteilig nach Fortschritt geschätzt. Bei Bedarf anpassen.'
        : 'Wie viel wurde verbraucht? Gramm schätzen oder „Nein“ drücken.'
      : pending.reason === 'missed'
      ? known
        ? 'Der Druck lief ohne die App. Spule und Gewicht sind vorgeschlagen.'
        : 'Der Druck lief ohne die App. Trag die Gramm aus Bambu Studio ein. Beim nächsten Druck mit gleichem Namen zieht die App dann selbst ab.'
      : 'Im LAN-Modus meldet der Drucker das Gewicht nicht. Trag die Gramm aus Bambu Studio ein. Beim nächsten Druck mit gleichem Namen zieht die App dann selbst ab.';

  const inputStyle = { backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-end sm:items-center justify-center p-3" onClick={done}>
      <div
        className="w-full max-w-sm rounded-2xl border p-4 space-y-3"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        onClick={e => e.stopPropagation()}
      >
        <div>
          <div className="text-sm font-extrabold">{title}</div>
          <div className="text-[11px] font-bold truncate" style={{ color: 'var(--app-text)' }}>
            „{pending.jobName}“
          </div>
        </div>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          {hint}
        </p>

        <div className="space-y-2">
          {rows.map((r, i) => {
            const sp = spools.find(s => s.id === r.spoolId);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-3 h-8 rounded-full shrink-0 border" style={{ backgroundColor: sp?.colorHex || '#888', borderColor: 'var(--app-border)' }} />
                <select value={r.spoolId} onChange={e => set(i, { spoolId: e.target.value })} className="flex-1 min-w-0 px-2 py-2 rounded-lg border text-xs outline-none" style={inputStyle}>
                  {spools.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.brand} {s.name} ({Math.round(s.remainingWeight)} g)
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="g"
                  value={r.grams}
                  onChange={e => set(i, { grams: e.target.value })}
                  className="w-16 px-2 py-2 rounded-lg border text-sm text-right outline-none"
                  style={inputStyle}
                />
                {rows.length > 1 && (
                  <button onClick={() => setRows(prev => prev.filter((_, k) => k !== i))} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--app-text-muted)' }} title="Zeile entfernen">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={() => setRows(prev => [...prev, { spoolId: spools[0]?.id || '', grams: '' }])}
            className="text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            style={{ color: 'var(--app-text-muted)' }}
          >
            <Plus className="w-3 h-3" /> Weitere Spule (mehrfarbig)
          </button>
        </div>

        <div className="flex gap-2">
          <button
            disabled={!ok}
            onClick={() => {
              // Inzwischen auf einem anderen Gerät oder vom Pi abgezogen: nicht doppelt
              if (printAlreadyDeducted(pending.printId, pending.jobName, Date.parse(pending.at))) return done();
              recordDeduct(pending.jobName, Date.parse(pending.at), 'lan');
              parsed.forEach((r, i) => setTimeout(() => onDeduct(r.spoolId, r.g), i * 300));
              if (pending.reason !== 'failed') rememberJobGrams(pending.jobName, parsed.reduce((a, r) => a + r.g, 0));
              done();
            }}
            className="flex-1 py-2 rounded-xl text-white text-xs font-extrabold cursor-pointer disabled:opacity-40"
            style={{ backgroundImage: 'var(--app-accent-gradient)' }}
          >
            Ja, abziehen
          </button>
          <button onClick={done} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
            Nein
          </button>
        </div>
      </div>
    </div>
  );
};
