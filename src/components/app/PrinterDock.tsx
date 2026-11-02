// Fester Drucker-Streifen rechts (PC): das Drucker-Widget mit allem, darunter Warteschlange und Drucke.
// Scrollt für sich, das Menü links und die Spulen in der Mitte bleiben davon unberührt.
import React, { useState } from 'react';
import { Camera, ListOrdered } from 'lucide-react';
import { BambuPrinterWidget } from '../BambuPrinterWidget';
import { QueueTab } from '../workshop/QueueTab';
import { PrintsTab } from '../workshop/PrintsTab';
import type { Spool } from '../../types/filament';

export interface PrinterDockProps {
  spools: Spool[];
  viewMode: any;
  onDeductWeight: (...args: any[]) => any;
  onApplyDryingCredit: any;
  onOpenNewSpool: (prefill?: Partial<Spool>) => void;
}

export const PrinterDock: React.FC<PrinterDockProps> = ({ spools, viewMode, onDeductWeight, onApplyDryingCredit, onOpenNewSpool }) => {
  const [tab, setTab] = useState<'queue' | 'prints'>('queue');
  return (
    <aside
      className="sticky top-0 h-screen w-[460px] shrink-0 border-l overflow-y-auto z-10"
      style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
      aria-label="Drucker"
    >
      <div className="p-3 space-y-3">
        <BambuPrinterWidget spools={spools} viewMode={viewMode} onDeductWeight={onDeductWeight} onApplyDryingCredit={onApplyDryingCredit} onOpenNewSpool={onOpenNewSpool} />

        <div className="flex gap-1.5 px-1">
          {(
            [
              { id: 'queue', label: 'Warteschlange', icon: ListOrdered },
              { id: 'prints', label: 'Drucke', icon: Camera }
            ] as const
          ).map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--app-accent)' : 'var(--app-card)',
                  borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
                  color: active ? '#ffffff' : 'var(--app-text)'
                }}
              >
                <t.icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        {tab === 'queue' ? <QueueTab spools={spools} /> : <PrintsTab />}
      </div>
    </aside>
  );
};
