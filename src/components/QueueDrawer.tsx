import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, ListOrdered, Play, Trash2, X } from 'lucide-react';
import { piQueueAction, piQueueReorder, piQueueThumb, type PiQueueItem } from '../utils/recorderServer';

// Warteschlange vom Pi als Fach rechts: Bild, Name, Anzahl Filamente und Material. Zeilen ziehen = Reihenfolge ändern.

const Thumb: React.FC<{ item: PiQueueItem }> = ({ item }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (item.thumb) void piQueueThumb(item.id).then(u => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [item.id, item.thumb]);
  return src ? (
    <img src={src} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" style={{ backgroundColor: 'var(--app-card-sub)' }} draggable={false} />
  ) : (
    <div className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--app-card-sub)', color: 'var(--app-text-muted)' }}>
      <ListOrdered className="w-5 h-5" />
    </div>
  );
};

export const QueueDrawer: React.FC<{ open: boolean; onClose: () => void; items: PiQueueItem[] | null; setItems: (i: PiQueueItem[] | null) => void }> = ({ open, onClose, items, setItems }) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  if (!open || items === null) return null;

  const drop = async (targetId: string) => {
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (!from || from === targetId) return;
    const order = items.map(x => x.id);
    const a = order.indexOf(from);
    const b = order.indexOf(targetId);
    if (a < 0 || b < 0) return;
    order.splice(b, 0, order.splice(a, 1)[0]);
    // Sofort zeigen, dann beim Pi speichern
    const byId = new Map(items.map(x => [x.id, x]));
    setItems(order.map(id => byId.get(id)!));
    const r = await piQueueReorder(order);
    if (r) setItems(r);
  };

  const act = async (action: 'remove' | 'start', id?: string) => {
    setBusy(true);
    setMsg(null);
    const r = await piQueueAction(action, id ? { id } : {});
    if (r.items) setItems(r.items);
    if (r.text || !r.ok) setMsg({ ok: r.ok, text: r.text || 'Fehler' });
    setBusy(false);
  };

  const mats = (it: PiQueueItem) => Array.from(new Set(it.filaments.map(f => f.type).filter(Boolean))).join(', ') || '–';

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/30 sm:bg-transparent" onClick={onClose} aria-hidden />
      <aside
        className="fixed z-[61] top-0 right-0 h-full w-[min(92vw,22rem)] flex flex-col border-l shadow-2xl"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        aria-label="Warteschlange"
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
          <ListOrdered className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-extrabold flex-1">Warteschlange ({items.length})</span>
          <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer" aria-label="Schließen">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 ? (
            <p className="text-xs leading-snug" style={{ color: 'var(--app-text-muted)' }}>
              Leer. In Bambu Studio „Senden“ drücken: die Datei kommt nach wenigen Sekunden hierher.
            </p>
          ) : (
            items.map((it, i) => (
              <div
                key={it.id}
                draggable
                onDragStart={() => setDragId(it.id)}
                onDragOver={e => {
                  e.preventDefault();
                  if (overId !== it.id) setOverId(it.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDrop={e => {
                  e.preventDefault();
                  void drop(it.id);
                }}
                className="flex items-center gap-2 p-2 rounded-xl border"
                style={{
                  borderColor: overId === it.id && dragId && dragId !== it.id ? 'var(--app-accent)' : 'var(--app-border)',
                  backgroundColor: 'var(--app-card-sub)',
                  opacity: dragId === it.id ? 0.4 : 1
                }}
              >
                <GripVertical className="w-4 h-4 shrink-0 cursor-grab" style={{ color: 'var(--app-text-muted)' }} aria-label="Ziehen zum Verschieben" />
                <span className="text-[11px] font-extrabold w-4 text-center shrink-0">{i + 1}</span>
                <Thumb item={it} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate" title={it.name}>
                    {it.name}
                  </div>
                  <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>
                    <span>
                      {it.filaments.length} {it.filaments.length === 1 ? 'Filament' : 'Filamente'} · {mats(it)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {it.filaments.slice(0, 8).map(f => (
                      <span key={f.id} className="w-3 h-3 rounded-full border" style={{ backgroundColor: f.colorHex, borderColor: 'var(--app-border)' }} title={`${f.type} · ${Math.round(f.grams)} g`} />
                    ))}
                    <span className="text-[10px] ml-1" style={{ color: 'var(--app-text-muted)' }}>
                      {Math.round(it.filaments.reduce((s, f) => s + f.grams, 0))} g
                    </span>
                  </div>
                  {it.missing.length > 0 && <div className="text-[10px] text-amber-400">Im AMS fehlt: {it.missing.join(', ')}</div>}
                </div>
                <button className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" disabled={busy} onClick={() => void act('remove', it.id)} title="Entfernen" aria-label="Entfernen">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t space-y-2" style={{ borderColor: 'var(--app-border)' }}>
          {msg && <p className={`text-[11px] ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</p>}
          <button
            disabled={busy || items.length === 0}
            onClick={() => void act('start')}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-orange-400 disabled:opacity-40 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> Nächsten starten (wie Taster)
          </button>
          <p className="text-[10px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
            Ziehen am Griff ändert die Reihenfolge. Platte erst leer machen.
          </p>
        </div>
      </aside>
    </>
  );
};
