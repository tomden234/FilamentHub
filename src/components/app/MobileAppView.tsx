import React from 'react';
import { Search, X } from 'lucide-react';
import { BambuPrinterWidget } from '../BambuPrinterWidget';
import { LocationFilter } from '../workshop/LocationFilter';
import { SpoolTile } from '../SpoolTile';
import type { Spool } from '../../types/filament';

interface MobileAppViewProps {
  spools: any;
  totalGrams: any;
  now: number;
  appSettings: any;
  setSpoolToEdit: any;
  setSpoolPrefill: any;
  setIsSpoolModalOpen: any;
  viewMode: any;
  handleDeductWeight: (...args: any[]) => any;
  handleApplyDryingCredit: any;
  handleMarkDried: (...args: any[]) => any;
  searchQuery: any;
  setSearchQuery: any;
  setActiveMaterialFilter: any;
  activeMaterialFilter: any;
  filteredSpools: any;
  handleAddWeight: (...args: any[]) => any;
  handleOpenSpoolNfc: any;
  handleDeleteSpool: (...args: any[]) => any;
  locations: any;
  activeLocationFilter: any;
  setActiveLocationFilter: any;
}

/** Handy-Ansicht: Drucker oben, darunter Suche und die Spulen als schlichte Kacheln. Funktionen stecken im Menü und unter „Neu“. */
export const MobileAppView: React.FC<MobileAppViewProps> = ({
  spools,
  totalGrams,
  now,
  appSettings,
  setSpoolToEdit,
  setSpoolPrefill,
  setIsSpoolModalOpen,
  viewMode,
  handleDeductWeight,
  handleApplyDryingCredit,
  handleMarkDried,
  searchQuery,
  setSearchQuery,
  setActiveMaterialFilter,
  activeMaterialFilter,
  filteredSpools,
  handleAddWeight,
  handleOpenSpoolNfc,
  handleDeleteSpool,
  locations,
  activeLocationFilter,
  setActiveLocationFilter
}) => {
  const kg = (totalGrams / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 });
  const materials = ['ALL', ...Array.from(new Set<string>(spools.map((s: any) => String(s.material || '')).filter(Boolean))).sort()];

  return (
    <div className="max-w-md mx-auto w-full space-y-3">
      <BambuPrinterWidget
        compact
        spools={spools}
        viewMode={viewMode}
        onDeductWeight={handleDeductWeight}
        onApplyDryingCredit={handleApplyDryingCredit}
        onOpenNewSpool={(prefill?: Partial<Spool>) => {
          setSpoolToEdit(null);
          setSpoolPrefill(prefill || null);
          setIsSpoolModalOpen(true);
        }}
      />

      <div className="flex items-baseline justify-between pl-1 pr-7">
        <h2 className="text-sm font-extrabold tracking-tight">Spulen</h2>
        <span className="text-[11px] font-mono-num" style={{ color: 'var(--app-text-muted)' }}>
          {spools.length} Stück · {kg} kg
        </span>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--app-text-muted)' }} />
          <input
            type="text"
            placeholder="Suchen"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border text-xs outline-none"
            style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer" style={{ color: 'var(--app-text-muted)' }} aria-label="Suche leeren">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {materials.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {materials.map(mat => {
              const on = activeMaterialFilter === mat;
              return (
                <button
                  key={mat}
                  onClick={() => setActiveMaterialFilter(mat)}
                  className="px-3 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap cursor-pointer transition"
                  style={{
                    backgroundColor: on ? 'var(--app-accent)' : 'transparent',
                    borderColor: on ? 'var(--app-accent)' : 'var(--app-border)',
                    color: on ? '#ffffff' : 'var(--app-text-muted)'
                  }}
                >
                  {mat === 'ALL' ? 'Alle' : mat}
                </button>
              );
            })}
          </div>
        )}

        <LocationFilter locations={locations} active={activeLocationFilter} onChange={setActiveLocationFilter} />
      </div>

      <div className="space-y-2">
        {filteredSpools.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center text-xs" style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
            {spools.length === 0 ? 'Noch keine Spulen. Oben auf „Neu“ tippen.' : 'Keine Spule gefunden.'}
          </div>
        ) : (
          filteredSpools.map((spool: any) => (
            <SpoolTile
              key={spool.id}
              spool={spool}
              now={now}
              appSettings={appSettings}
              onDeduct={handleDeductWeight}
              onAdd={handleAddWeight}
              onMarkDried={handleMarkDried}
              onWriteNfc={handleOpenSpoolNfc}
              onDelete={handleDeleteSpool}
              onEdit={id => {
                const s = spools.find((x: any) => x.id === id);
                if (s) {
                  setSpoolToEdit(s);
                  setSpoolPrefill(null);
                  setIsSpoolModalOpen(true);
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};
