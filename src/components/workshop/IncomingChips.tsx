import React from 'react';
import { Check, Truck } from 'lucide-react';
import type { Spool } from '../../types/filament';
import { incomingInfo, requestConfirmArrival } from '../../utils/incoming';

// 1.277: Abzeichen „Kommt in 2 Tagen / Zugestellt“ mit Knopf „Angekommen“ für bestellte Spulen

const TONE: Record<string, string> = {
  wait: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  soon: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  late: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  here: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
};

export const IncomingChips: React.FC<{ spool: Spool }> = ({ spool }) => {
  const inc = spool.incoming;
  if (!inc) return null;
  const info = incomingInfo(inc);
  const here = inc.status === 'delivered';
  return (
    <>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border inline-flex items-center gap-1 ${TONE[info.tone]}`} title={`Bestellung ${inc.orderId}`}>
        <Truck className="w-2.5 h-2.5" />
        <span>{info.text}</span>
      </span>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          requestConfirmArrival(spool.id);
        }}
        className={`text-[10px] px-1.5 py-0.5 rounded font-bold border inline-flex items-center gap-1 cursor-pointer ${here ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-transparent border-slate-500/40 text-slate-300'}`}
        title="Spule ist da: als normale Spule übernehmen"
      >
        <Check className="w-2.5 h-2.5" />
        <span>{here ? 'Habe ich' : 'Schon da'}</span>
      </button>
    </>
  );
};
