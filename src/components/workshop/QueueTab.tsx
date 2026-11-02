import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, ListOrdered, Plus, Trash2, XCircle } from 'lucide-react';
import type { Spool } from '../../types/filament';
import { addToQueue, checkQueueItem, loadedSpools, moveInQueue, removeFromQueue, useQueue } from '../../utils/printQueue';
import { NumInput } from '../ui/NumInput';
import { Card } from './ui';

// Druck-Warteschlange: Aufträge vormerken, Filament-Check, nach jedem Druckende kommt eine Mitteilung mit dem Nächsten.

export const QueueTab: React.FC<{ spools: Spool[] }> = ({ spools }) => {
  const queue = useQueue();
  const loaded = useMemo(() => loadedSpools(spools), [spools]);
  const materials = useMemo(() => Array.from(new Set(spools.map(s => s.material).filter(Boolean))).sort(), [spools]);
  const [name, setName] = useState('');
  const [material, setMaterial] = useState('');
  const [grams, setGrams] = useState(50);

  const inputStyle: React.CSSProperties = { backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' };
  const add = () => {
    const n = name.trim();
    if (!n) return;
    addToQueue({ name: n, material: material.trim(), grams: Math.max(0, Number(grams) || 0) });
    setName('');
  };

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <ListOrdered className="w-4 h-4 text-emerald-400" />
          <span>Nächsten Druck vormerken</span>
        </div>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Name wie die Datei im Slicer. Ist ein Druck fertig, nimmt die App ihn aus der Liste und meldet, was als Nächstes dran ist und ob das Filament reicht.
          Gestartet wird nichts von selbst: erst Platte frei machen.
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Name des Drucks"
            className="col-span-2 min-w-0 px-2.5 py-1.5 rounded-lg border text-xs outline-none"
            style={inputStyle}
            aria-label="Name des Drucks"
          />
          <input
            type="text"
            list="queue-materials"
            value={material}
            onChange={e => setMaterial(e.target.value)}
            placeholder="Material (z. B. PETG)"
            className="min-w-0 px-2.5 py-1.5 rounded-lg border text-xs outline-none"
            style={inputStyle}
            aria-label="Material"
          />
          <datalist id="queue-materials">
            {materials.map(m => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <span className="flex items-center gap-1">
            <NumInput
              type="number"
              min={0}
              max={5000}
              value={grams}
              onChange={e => setGrams(parseInt(e.target.value, 10) || 0)}
              className="w-16 px-2 py-1.5 rounded-lg border text-xs font-mono-num outline-none text-right"
              style={inputStyle}
              aria-label="Gramm"
            />
            <span className="text-xs">g</span>
          </span>
          <button
            onClick={add}
            disabled={!name.trim()}
            className="col-span-2 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: 'var(--app-accent)', color: '#fff' }}
          >
            <Plus className="w-3.5 h-3.5" /> Vormerken
          </button>
        </div>
      </Card>

      {queue.length === 0 ? (
        <div className="text-center text-xs py-8" style={{ color: 'var(--app-text-muted)' }}>
          Die Warteschlange ist leer.
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((q, i) => {
            const c = checkQueueItem(q, loaded);
            return (
              <div key={q.id} className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: i === 0 ? 'var(--app-accent)' : 'var(--app-border)' }}>
                <span className="w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0" style={{ backgroundColor: i === 0 ? 'var(--app-accent)' : 'var(--app-card)', color: i === 0 ? '#fff' : 'var(--app-text)' }}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold truncate">{q.name}</div>
                  <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>
                    <span>
                      {q.material || 'Material egal'} · {Math.round(q.grams)} g
                    </span>
                  </div>
                  <div className={`text-[11px] font-bold flex items-center gap-1 ${c.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {c.ok ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{c.text}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => moveInQueue(q.id, -1)} disabled={i === 0} className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" aria-label="Nach oben">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveInQueue(q.id, 1)} disabled={i === queue.length - 1} className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" aria-label="Nach unten">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeFromQueue(q.id)} className="p-1.5 rounded-lg cursor-pointer text-rose-400" aria-label="Entfernen">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
