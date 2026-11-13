import React, { useState } from 'react';
import { X, Nfc, Check, Loader2, Search, AlertTriangle } from 'lucide-react';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import type { Spool } from '../../types/filament';
import type { HwTray } from '../../utils/amsMatch';
import { useNfcTags } from '../../utils/nfcRead';
import { sendToSlot, type SlotSendResult } from '../../utils/slotAssign';
import { paramsFromSpool } from '../../utils/spoolProfile';
import { SpoolPicker } from '../SpoolPicker';

// Kleines Fenster pro AMS-Slot: Tag ans Handy halten (oder Spule suchen) → Slot ist belegt. Mehr nicht.

interface Props {
  /** 1-4 */
  slot: number;
  spools: Spool[];
  tray?: HwTray;
  connected: boolean;
  onAssign: (slot: number, spoolId: string) => void;
  onClose: () => void;
}

export const SlotTagSheet: React.FC<Props> = ({ slot, spools, tray, connected, onAssign, onClose }) => {
  useEscapeClose(onClose);
  const [busy, setBusy] = useState(false);
  const [spool, setSpool] = useState<Spool | null>(null);
  const [result, setResult] = useState<SlotSendResult | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const apply = async (s: Spool) => {
    setSpool(s);
    setBusy(true);
    setResult(null);
    onAssign(slot, s.id); // die App merkt sich die Zuweisung immer
    if (connected) {
      const r = await sendToSlot(slot, paramsFromSpool(s));
      setResult(r);
      if (r.confirmed) setTimeout(onClose, 1800);
    } else {
      setResult({ confirmed: false, blocked: false, text: 'Drucker nicht verbunden. Die Zuweisung ist in der App gespeichert.' });
    }
    setBusy(false);
  };

  const { supported, error } = useNfcTags(
    spools,
    parsed => {
      if (busy) return;
      if (parsed.matchedSpool) {
        setInfo(null);
        void apply(parsed.matchedSpool);
      } else {
        setInfo('Tag leer oder unbekannt. Such die Spule unten.');
      }
    },
    !spool
  );

  const done = Boolean(spool && result);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl border p-4 space-y-3"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-extrabold">Slot {slot}</span>
            {tray && !tray.empty && (
              <span className="flex items-center gap-1 text-[11px] min-w-0" style={{ color: 'var(--app-text-muted)' }}>
                <span className="w-3 h-3 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: tray.colorHex || '#888' }} />
                <span className="truncate">{tray.type}</span>
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label="Schließen" className="p-1.5 rounded-lg border cursor-pointer" style={{ borderColor: 'var(--app-border)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {!spool && (
          <>
            <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
              <div className="relative w-11 h-11 shrink-0">
                <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: 'var(--app-accent)' }} />
                <span className="relative w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: 'var(--app-accent)' }}>
                  <Nfc className="w-5 h-5" />
                </span>
              </div>
              <div className="text-xs">
                <div className="font-extrabold">{supported ? 'Tag ans Handy halten' : 'NFC nicht verfügbar'}</div>
                <div style={{ color: 'var(--app-text-muted)' }}>Die Spule landet sofort in Slot {slot}.</div>
              </div>
            </div>
            {(error || info) && <div className="text-[11px] font-bold text-rose-400">{error || info}</div>}
            <button
              onClick={() => setShowSearch(true)}
              className="w-full py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
            >
              <Search className="w-4 h-4" />
              Spule suchen
            </button>
          </>
        )}

        {spool && (
          <div
            className="flex items-center gap-3 rounded-2xl border-2 p-3"
            style={{ borderColor: spool.colorHex, background: `linear-gradient(135deg, ${spool.colorHex}30, transparent 70%)` }}
          >
            <span className="w-10 h-10 rounded-full border-4 border-white/70 shadow-md shrink-0" style={{ backgroundColor: spool.colorHex }} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold truncate">
                {spool.brand} {spool.name}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                {spool.material} · {spool.colorName}
              </div>
            </div>
            {busy ? (
              <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: 'var(--app-accent-text)' }} />
            ) : result?.confirmed ? (
              <Check className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            )}
          </div>
        )}

        {done && result && (
          <div
            className={`rounded-2xl border p-3 text-xs font-bold ${
              result.confirmed ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/40 bg-amber-500/10 text-amber-500'
            }`}
          >
            {result.confirmed ? `✓ Slot ${slot} gesetzt.` : `In der App gemerkt: Slot ${slot}. `}
            {!result.confirmed && result.text}
          </div>
        )}
        {done && !result?.confirmed && (
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl text-xs font-extrabold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--app-accent)' }}
          >
            OK
          </button>
        )}
      </div>

      {showSearch && (
        <SpoolPicker
          spools={spools}
          title={`Spule für Slot ${slot}`}
          hint={tray && !tray.empty ? { material: tray.type, colorHex: tray.colorHex || undefined } : undefined}
          onClose={() => setShowSearch(false)}
          onPick={s => {
            setShowSearch(false);
            if (s) void apply(s);
          }}
        />
      )}
    </div>
  );
};
