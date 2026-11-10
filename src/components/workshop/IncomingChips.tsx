import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CircleCheck, Circle, Truck, X } from 'lucide-react';
import type { Spool } from '../../types/filament';
import { incomingInfo, incomingSteps, requestConfirmArrival, requestRejectIncoming } from '../../utils/incoming';

// 1.277/1.290: Abzeichen „Kommt in 2 Tagen / Zugestellt“. Antippen öffnet ein kleines Menü mit Verlauf,
// „Schon zugestellt“ und „Falsch erkannt“. Bei zugestellter Bestellung bleibt der Knopf „Habe ich“.

const TONE: Record<string, string> = {
  wait: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  soon: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  late: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  here: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
};

export const IncomingChips: React.FC<{ spool: Spool }> = ({ spool }) => {
  const inc = spool.incoming;
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  if (!inc) return null;
  const info = incomingInfo(inc);
  const here = inc.status === 'delivered';
  const steps = incomingSteps(inc);
  const close = () => setPos(null);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos) return close();
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const w = 232;
    setPos({ top: Math.min(r.bottom + 6, window.innerHeight - 250), left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) });
  };
  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={!!pos}
        className={`text-[10px] px-1.5 py-0.5 rounded font-bold border inline-flex items-center gap-1 cursor-pointer ${TONE[info.tone]}`}
        title={`Bestellung ${inc.orderId}: Verlauf anzeigen`}
      >
        <Truck className="w-2.5 h-2.5" />
        <span>{info.text}</span>
      </button>
      {here && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            requestConfirmArrival(spool.id);
          }}
          className="text-[10px] px-1.5 py-0.5 rounded font-bold border inline-flex items-center gap-1 cursor-pointer bg-emerald-500 text-white border-emerald-500"
          title="Spule ist da: als normale Spule übernehmen"
        >
          <Check className="w-2.5 h-2.5" />
          <span>Habe ich</span>
        </button>
      )}
      {pos &&
        createPortal(
          <div className="fixed inset-0 z-[300]" onClick={e => { e.stopPropagation(); close(); }}>
            <div
              role="dialog"
              aria-label="Bestellstatus"
              onClick={e => e.stopPropagation()}
              className="absolute w-[232px] rounded-xl border p-3 shadow-xl text-xs"
              style={{ top: pos.top, left: pos.left, backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            >
              <div className="font-bold mb-0.5 truncate">{spool.brand} {spool.name}</div>
              <div className="text-[10px] mb-2" style={{ color: 'var(--app-text-muted)' }}>Bestellung {inc.orderId}</div>
              <ol className="space-y-1.5 mb-3">
                {steps.map(st => (
                  <li key={st.label} className="flex items-center gap-2" style={{ opacity: st.done ? 1 : 0.6 }}>
                    {st.done ? <CircleCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                    <span className="font-semibold">{st.label}</span>
                    <span className="ml-auto text-[10px]" style={{ color: 'var(--app-text-muted)' }}>{st.when}</span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => { close(); requestConfirmArrival(spool.id); }}
                  className="w-full px-2 py-1.5 rounded-lg font-bold border inline-flex items-center justify-center gap-1 cursor-pointer bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                >
                  <Check className="w-3 h-3" />
                  Schon zugestellt
                </button>
                <button
                  type="button"
                  onClick={() => { close(); requestRejectIncoming(spool.id); }}
                  className="w-full px-2 py-1.5 rounded-lg font-bold border inline-flex items-center justify-center gap-1 cursor-pointer bg-rose-500/15 text-rose-300 border-rose-500/40"
                >
                  <X className="w-3 h-3" />
                  Falsch erkannt
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
