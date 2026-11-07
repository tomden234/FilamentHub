import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, GripVertical, ListOrdered, Loader2, Play, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { setQueueDock, toggleQueueDock, useDruckerOpen, useQueueDock } from '../utils/queueDock';
import { useBackLayer } from '../utils/backNav';
import { piPrinterFiles, piQueueAction, piQueuePick, piQueueReorder, piQueueThumb, type PiQueueItem, type PrinterFile } from '../utils/recorderServer';

// Warteschlange vom Pi als Fach rechts: Bild, Name, Anzahl Filamente und Material. Zeilen ziehen = Reihenfolge ändern.

const Thumb: React.FC<{ item: PiQueueItem }> = ({ item }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let tries = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    // 1.239: Bild bei Fehlschlag bis zu 5× neu holen (vorher blieb nur das Symbol stehen)
    const load = () => {
      void piQueueThumb(item.id).then(u => {
        if (!alive) return;
        if (u) setSrc(u);
        else if (++tries < 5) t = setTimeout(load, 3000);
      });
    };
    if (item.thumb) load();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
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

/** Streifen am rechten Rand wie „DRUCKER“: öffnet/schließt die Warteschlange. Offen sitzt er an der Kante des Fachs. */
export const QUEUE_PANEL_W = 'min(72vw, 18rem)';

/** Suche ohne Groß/klein, Leerzeichen, _ und - (findet „air up“ in „Air_Up_Fake_Pod“) */
const normName = (t: string) => t.toLowerCase().replace(/\.gcode\.3mf$|\.3mf$/i, '').replace(/[\s_\-.()]+/g, '');
const matchName = (name: string, q: string) => !q.trim() || normName(name).includes(normName(q));

const QueueEdgeTab: React.FC<{ count: number; open: boolean }> = ({ count, open }) => {
  const druckerOpen = useDruckerOpen();
  return (
  <div
    className="fixed z-[56] select-none transition-all duration-300"
    style={{ right: druckerOpen ? 'min(100vw, 420px)' : open ? QUEUE_PANEL_W : 0, top: 'calc(50% - 82px)', transform: 'translateY(-100%)' }}
  >
    <button
      onClick={toggleQueueDock}
      title={open ? 'Warteschlange schließen' : 'Warteschlange öffnen'}
      aria-label={open ? 'Warteschlange schließen' : `Warteschlange öffnen (${count})`}
      className="group relative flex flex-col items-center justify-between w-7 sm:w-8 min-h-[64px] sm:min-h-[168px] py-2 sm:py-3 px-0.5 sm:px-1.5 rounded-l-2xl border-l-2 border-t border-b shadow-2xl backdrop-blur-xl cursor-pointer transition-all opacity-80 hover:opacity-100 sm:opacity-100 hover:scale-105 active:scale-95"
      style={{
        backgroundColor: 'var(--app-card)',
        borderColor: count > 0 ? 'var(--app-accent)' : 'var(--app-border)',
        color: 'var(--app-text)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
      }}
    >
      <div className="relative flex items-center justify-center">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: count > 0 ? 'var(--app-accent)' : 'var(--app-text-muted)' }} />
      </div>
      <div className="flex flex-col items-center justify-center gap-1 my-1">
        <span className="hidden sm:block text-[10px] font-black tracking-widest uppercase [writing-mode:vertical-lr] rotate-180" style={{ color: 'var(--app-text)' }}>
          WARTESCHLANGE
        </span>
        <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded border" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-accent-text)' }}>
          {count}
        </span>
      </div>
      <div style={{ color: 'var(--app-text-muted)' }}>
        <ListOrdered className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </div>
    </button>
  </div>
  );
};

export const QueueDrawer: React.FC<{ items: PiQueueItem[] | null; setItems: (i: PiQueueItem[] | null) => void }> = ({ items, setItems }) => {
  const open = useQueueDock();
  const onClose = () => setQueueDock(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<PrinterFile[] | null>(null);
  const [filesBusy, setFilesBusy] = useState(false);
  const [fileQuery, setFileQuery] = useState('');

  const count = items ? items.length : 0;
  // Esc und Zurück schließen das Fach (wie die anderen Fenster: immer nur eine Ebene)
  useBackLayer(open && items !== null, () => setQueueDock(false), 'queue-dock');
  if (items === null) return null;

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

  const act = async (action: 'remove' | 'start' | 'refresh' | 'duplicate', id?: string) => {
    setBusy(true);
    setMsg(null);
    const r = await piQueueAction(action, id ? { id } : {});
    if (r.items) setItems(r.items);
    if (r.text || !r.ok) setMsg({ ok: r.ok, text: r.text || 'Fehler' });
    setBusy(false);
  };

  const loadFiles = async () => {
    setFilesBusy(true);
    const r = await piPrinterFiles();
    setFiles(r.files);
    if (r.error) setMsg({ ok: false, text: r.error });
    setFilesBusy(false);
  };
  const addFile = async (f: PrinterFile) => {
    setBusy(true);
    setMsg(null);
    const r = await piQueueAction('add', { path: f.path });
    if (r.items.length) setItems(r.items);
    setMsg({ ok: r.ok, text: r.ok ? `„${f.name.replace(/\.gcode\.3mf$|\.3mf$/i, '')}“ vorgemerkt.` : r.text || 'Fehler' });
    setBusy(false);
  };

  const pick = async (id: string, filament: number, tray: string) => {
    setBusy(true);
    const r = await piQueuePick(id, filament, tray);
    if (r.items.length) setItems(r.items);
    if (!r.ok) setMsg({ ok: false, text: r.text || 'Fehler' });
    setBusy(false);
  };

  const mats = (it: PiQueueItem) => Array.from(new Set(it.filaments.map(f => f.type).filter(Boolean))).join(', ') || '–';

  return (
    <>
      {/* Fach rechts: liegt immer über dem Inhalt (am PC und am Handy), der Inhalt verschiebt sich nicht und wird nicht abgedunkelt. Gleitet auf und zu, Escape oder X oder der Streifen schließen es. */}
      <div
        className="overflow-hidden transition-[width,box-shadow] duration-300 ease-out fixed inset-y-0 right-0 z-[55]"
        style={{ width: open ? QUEUE_PANEL_W : 0, boxShadow: open ? '-8px 0 24px -8px rgba(0,0,0,0.45)' : 'none' }}
        aria-hidden={!open}
      >
      <aside
        className="h-full flex flex-col border-l"
        style={{ width: QUEUE_PANEL_W, backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        aria-label="Warteschlange"
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
          <ListOrdered className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-extrabold flex-1">Warteschlange ({items.length})</span>
          <button disabled={busy} onClick={() => void act('refresh')} className="p-1.5 rounded-lg cursor-pointer disabled:opacity-40" title="Auf dem Drucker nach neuen Dateien suchen" aria-label="Aktualisieren">
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
          </button>
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
                className="p-2.5 rounded-2xl border"
                style={{
                  borderColor: overId === it.id && dragId && dragId !== it.id ? 'var(--app-accent)' : 'var(--app-border)',
                  backgroundColor: 'var(--app-card-sub)',
                  opacity: dragId === it.id ? 0.4 : 1
                }}
              >
                {/* Kopf: Griff, Nummer, Bild, Name und die zwei Knöpfe oben rechts */}
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 shrink-0 cursor-grab" style={{ color: 'var(--app-text-muted)' }} aria-label="Ziehen zum Verschieben" />
                  <span className="w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--app-card)' }}>
                    {i + 1}
                  </span>
                  <Thumb item={it} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate" title={it.name}>
                      {it.name}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                      {it.filaments.length} {it.filaments.length === 1 ? 'Filament' : 'Filamente'} · {Math.round(it.filaments.reduce((t, f) => t + f.grams, 0))} g
                    </div>
                  </div>
                  <button className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30 hover:bg-white/10 shrink-0" disabled={busy} onClick={() => void act('duplicate', it.id)} title="Kopieren (noch einmal drucken)" aria-label="Kopieren">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30 hover:bg-white/10 text-rose-400 shrink-0" disabled={busy} onClick={() => void act('remove', it.id)} title="Löschen" aria-label="Löschen">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {it.missing.length > 0 && <div className="text-[10px] text-amber-400 mt-1.5">Im AMS fehlt: {it.missing.join(', ')}</div>}
                {it.slots && it.slots.length > 0 && (
                  <div className="mt-2.5">
                    {/* Runder Balken über die volle Breite: Anteil der Gramm je Filament */}
                    <div className="flex h-2 rounded-full overflow-hidden gap-0.5" title={`${Math.round(it.slots.reduce((t, x) => t + x.grams, 0))} g gesamt`}>
                      {it.slots.map(sl => (
                        <div key={sl.id} style={{ width: `${Math.max(3, (sl.grams / Math.max(1, it.slots!.reduce((t, x) => t + x.grams, 0))) * 100)}%`, backgroundColor: sl.colorHex, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.25)' }} />
                      ))}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {it.slots.map(sl => (
                        <div key={sl.id} className="flex items-center gap-2 text-[11px]">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sl.colorHex, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.3)' }} />
                          <span className="font-bold shrink-0">{sl.type}</span>
                          <span className="shrink-0" style={{ color: 'var(--app-text-muted)' }}>
                            {Math.round(sl.grams)} g
                          </span>
                          {/* Chip mit Auswahl: das echte Auswahlfeld liegt unsichtbar darüber */}
                          <span
                            className="relative ml-auto inline-flex items-center gap-1 rounded-full border pl-1.5 pr-1.5 py-1 text-[11px] min-w-0 max-w-[62%]"
                            style={{ borderColor: sl.tray ? 'var(--app-border)' : '#fbbf24', backgroundColor: 'var(--app-card)', color: 'var(--app-text)' }}
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sl.trayColor || 'transparent', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.3)' }} />
                            <span className="truncate">{sl.tray ? sl.trayLabel : 'fehlt im AMS'}</span>
                            {sl.auto && sl.tray && (
                              <span className="text-[10px] shrink-0" style={{ color: 'var(--app-text-muted)' }}>
                                auto
                              </span>
                            )}
                            <ChevronDown className="w-3 h-3 shrink-0" />
                            <select
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              value={sl.auto ? '' : sl.tray}
                              disabled={busy}
                              aria-label={`Material für ${sl.type} ${Math.round(sl.grams)} g wählen`}
                              onChange={e => void pick(it.id, sl.id, e.target.value)}
                            >
                              <option value="">Automatisch{sl.auto && sl.trayLabel ? ` (${sl.trayLabel})` : ''}</option>
                              {sl.options.map(o => (
                                <option key={o.key} value={o.key}>
                                  {o.label} · {o.type}
                                </option>
                              ))}
                            </select>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-3 pb-24 border-t space-y-2" style={{ borderColor: 'var(--app-border)' }}>
          <button
            type="button"
            disabled={filesBusy}
            onClick={() => void loadFiles()}
            className="w-full py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center justify-center gap-1.5"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
          >
            {filesBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Datei vom Drucker vormerken
          </button>
          {files && files.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border" style={{ borderColor: 'var(--app-border)' }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-muted)' }} />
              <input
                value={fileQuery}
                onChange={e => setFileQuery(e.target.value)}
                placeholder="Name suchen …"
                className="flex-1 min-w-0 bg-transparent text-[11px] outline-none"
                style={{ color: 'var(--app-text)' }}
                aria-label="Dateiname suchen"
              />
              {fileQuery && (
                <button type="button" onClick={() => setFileQuery('')} className="p-0.5 cursor-pointer" aria-label="Suche leeren">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          {files && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {files.length === 0 && (
                <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Keine .3mf-Dateien gefunden.
                </p>
              )}
              {files.length > 0 && fileQuery && !files.some(f => matchName(f.name, fileQuery)) && (
                <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Nichts gefunden für „{fileQuery}“.
                </p>
              )}
              {files.filter(f => matchName(f.name, fileQuery)).map(f => (
                <button
                  key={f.path}
                  type="button"
                  disabled={busy}
                  onClick={() => void addFile(f)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] text-left cursor-pointer disabled:opacity-40"
                  style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                >
                  <Plus className="w-3 h-3 shrink-0" />
                  <span className="truncate flex-1">{f.name.replace(/\.gcode\.3mf$|\.3mf$/i, '')}</span>
                  <span className="shrink-0" style={{ color: 'var(--app-text-muted)' }}>
                    {f.time ? new Date(f.time).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
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
      </div>
      <QueueEdgeTab count={count} open={open} />
    </>
  );
};
