import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ExternalLink, Sparkles, Copy, GripVertical, ListOrdered, Loader2, Play, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { PanelResizer } from './PanelResizer';
import { logWidthCss, queueWidthCss, usePanelWidths } from '../utils/panelWidth';
import { setQueueDock, toggleQueueDock, useDruckerOpen, useQueueDock } from '../utils/queueDock';
import { useBackLayer } from '../utils/backNav';
import { generateAutoShopUrl } from '../utils/shopLinks';
import { safeHttpUrl } from '../utils/safeData';
import { fmtDur } from '../utils/printTimeFmt';
import { piPrinterFiles, piQueueAction, piQueueOptimize, type PiQueuePlan, piQueuePick, piQueueReorder, piQueueThumb, type PiQueueItem, type PrinterFile } from '../utils/recorderServer';

// Warteschlange vom Pi als Fach rechts: Bild, Name, Anzahl Filamente und Material. Zeilen ziehen = Reihenfolge ändern.

type SlotOpt = { key: string; label: string; type: string; colorHex: string };
/** 1.259: eigene Auswahl statt Browser-Liste: Farbpunkt je Spule, passt zum Design. Liste liegt über allem (Portal), wird nie abgeschnitten. */
const SlotPicker: React.FC<{
  value: string; // '' = automatisch
  auto: boolean;
  tray: string;
  trayLabel: string;
  trayColor: string;
  options: SlotOpt[];
  disabled: boolean;
  label: string;
  onPick: (key: string) => void;
}> = ({ value, auto, tray, trayLabel, trayColor, options, disabled, label, onPick }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useBackLayer(open, () => setOpen(false), 'queue-slot');
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const width = Math.min(Math.max(230, r.width), window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    if (below >= 200 || below >= above) setPos({ left, top: r.bottom + 6, width, maxH: Math.max(140, below) });
    else setPos({ left, bottom: window.innerHeight - r.top + 6, width, maxH: Math.max(140, above) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || btn.current?.contains(t)) return;
      setOpen(false);
    };
    const close = (e: Event) => {
      if (menu.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);
  const choose = (k: string) => {
    setOpen(false);
    if (k !== value) onPick(k);
  };
  const row = (k: string, active: boolean, children: React.ReactNode) => (
    <button
      key={k || 'auto'}
      type="button"
      role="option"
      aria-selected={active}
      onClick={() => choose(k)}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] rounded-xl transition-colors hover:bg-[var(--app-card-sub)]"
      style={{ backgroundColor: active ? 'var(--app-accent-sub)' : undefined, color: 'var(--app-text)' }}
    >
      {children}
      <Check className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: 'var(--app-accent-bar)', opacity: active ? 1 : 0 }} />
    </button>
  );
  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border pl-2 pr-2 py-1 text-[11px] min-w-0 max-w-[62%] transition-colors hover:bg-[var(--app-card-sub)] disabled:opacity-60"
        style={{ borderColor: tray ? 'var(--app-border)' : '#fbbf24', backgroundColor: 'var(--app-card)', color: 'var(--app-text)' }}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: trayColor || 'transparent', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.3)' }} />
        <span className="truncate">{tray ? trayLabel : 'fehlt im AMS'}</span>
        {auto && tray && (
          <span className="text-[10px] shrink-0" style={{ color: 'var(--app-text-muted)' }}>
            auto
          </span>
        )}
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menu}
            role="listbox"
            className="fixed z-[80] overflow-y-auto rounded-2xl border p-1.5"
            style={{
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: pos.width,
              maxHeight: pos.maxH,
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)',
              boxShadow: '0 18px 40px -12px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.12)'
            }}
          >
            {row(
              '',
              auto,
              <>
                <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--app-card-sub)', color: 'var(--app-text-muted)' }}>
                  <Sparkles className="w-3 h-3" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">Automatisch</span>
                  {auto && trayLabel && (
                    <span className="block text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                      {trayLabel}
                    </span>
                  )}
                </span>
              </>
            )}
            <div className="my-1 h-px" style={{ backgroundColor: 'var(--app-border)' }} />
            {options.map(o =>
              row(
                o.key,
                !auto && o.key === value,
                <>
                  <span className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: o.colorHex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.25), inset 0 0 0 3px rgba(255,255,255,.18)' }} />
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{o.label}</span>
                    <span className="block text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                      {o.type}
                    </span>
                  </span>
                </>
              )
            )}
          </div>,
          document.body
        )}
    </>
  );
};

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

/** Suche ohne Groß/klein, Leerzeichen, _ und - (findet „air up“ in „Air_Up_Fake_Pod“) */
const normName = (t: string) => t.toLowerCase().replace(/\.gcode\.3mf$|\.3mf$/i, '').replace(/[\s_\-.()]+/g, '');
const matchName = (name: string, q: string) => !q.trim() || normName(name).includes(normName(q));

const QueueEdgeTab: React.FC<{ count: number; open: boolean }> = ({ count, open }) => {
  const druckerOpen = useDruckerOpen();
  const pw = usePanelWidths();
  return (
  <div
    className="fixed z-[56] select-none transition-all duration-300"
    style={{ right: druckerOpen ? logWidthCss(pw) : open ? queueWidthCss(pw) : 0, top: 'calc(50% - 82px)', transform: 'translateY(-100%)' }}
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
        <span className="text-[10px] font-mono font-bold px-1 py-0.5 rounded border" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-accent-text)' }}>
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

/** 1.272: Kopf über den Platten einer Mehrplatten-Datei: Fortschritt, Restzeit, Gramm */
const ProjectHeader: React.FC<{ items: PiQueueItem[]; pid: string; busy: boolean; onRemove: () => void }> = ({ items, pid, busy, onRemove }) => {
  const mine = items.filter(x => x.project?.id === pid);
  const total = mine[0]?.project?.total || mine.length;
  const left = mine.length;
  const sec = mine.reduce((a, x) => a + (x.time ? (x.time.learned ? x.time.calcSec : x.time.slicerSec) : 0), 0);
  const grams = mine.reduce((a, x) => a + x.filaments.reduce((b, f) => b + (f.grams || 0), 0), 0);
  const title = (mine[0]?.name || '').replace(/ \(Platte \d+\/\d+\)$/, '');
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] border" style={{ borderColor: 'var(--app-accent)', backgroundColor: 'var(--app-card)' }}>
      <span aria-hidden>📦</span>
      <div className="min-w-0 flex-1">
        <div className="font-bold truncate" title={title}>
          {title}
        </div>
        <div style={{ color: 'var(--app-text-muted)' }}>
          {total - left} von {total} Platten fertig · noch {left}
          {sec > 0 ? ` · ${fmtDur(sec)}` : ''}
          {grams > 0 ? ` · ${Math.round(grams)} g` : ''}
        </div>
      </div>
      <button type="button" disabled={busy} onClick={onRemove} className="p-1 rounded-lg" aria-label="Ganzes Projekt löschen" title="Ganzes Projekt löschen">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const QueueDrawer: React.FC<{ items: PiQueueItem[] | null; setItems: (i: PiQueueItem[] | null) => void }> = ({ items, setItems }) => {
  const open = useQueueDock();
  const pw = usePanelWidths();
  const QUEUE_PANEL_W = queueWidthCss(pw);
  const onClose = () => setQueueDock(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<PrinterFile[] | null>(null);
  const [filesBusy, setFilesBusy] = useState(false);
  const [fileQuery, setFileQuery] = useState('');
  const [plan, setPlan] = useState<PiQueuePlan | null>(null);

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

  const actProject = async (project: string) => {
    if (!window.confirm('Alle noch offenen Platten dieses Projekts aus der Warteschlange löschen?')) return;
    setBusy(true);
    setMsg(null);
    const r = await piQueueAction('remove', { project });
    if (r.items) setItems(r.items);
    setBusy(false);
  };

  // 1.273: Smart sortieren: erst Vorschlag zeigen, dann auf Wunsch übernehmen
  const optimizeQueue = async (apply: boolean) => {
    setBusy(true);
    setMsg(null);
    const r = await piQueueOptimize(apply);
    if (r.items.length) setItems(r.items);
    if (!r.ok || !r.plan) setMsg({ ok: false, text: r.text || 'Fehler' });
    else if (apply) {
      setPlan(null);
      setMsg({ ok: true, text: 'Neu sortiert.' });
    } else if (!r.plan.changed) {
      setPlan(null);
      setMsg({ ok: true, text: 'Schon gut sortiert, nichts zu verbessern.' });
    } else setPlan(r.plan);
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
        className="h-full flex flex-col border-l relative"
        style={{ width: QUEUE_PANEL_W, backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        aria-label="Warteschlange"
      >
        <PanelResizer panel="queue" edge="left" />
        <div className="flex items-center gap-2 px-3 py-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
          <ListOrdered className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-extrabold flex-1">Warteschlange ({items.length})</span>
          {items.length > 1 && (
            <button disabled={busy} onClick={() => void optimizeQueue(false)} className="p-1.5 rounded-lg cursor-pointer disabled:opacity-40" title="Smart sortieren: wenig Platten- und Spulenwechsel, lange Drucke nachts" aria-label="Smart sortieren">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </button>
          )}
          <button disabled={busy} onClick={() => void act('refresh')} className="p-1.5 rounded-lg cursor-pointer disabled:opacity-40" title="Auf dem Drucker nach neuen Dateien suchen" aria-label="Aktualisieren">
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer" aria-label="Schließen">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {plan && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px]" role="status">
              <div className="font-extrabold text-amber-400">Vorschlag: smart sortiert</div>
              <div className="mt-0.5">{plan.reasons.length ? plan.reasons.join(' · ') : 'Bessere Reihenfolge'}</div>
              <ol className="mt-1.5 list-decimal pl-4 space-y-0.5" style={{ color: 'var(--app-text-muted)' }}>
                {plan.names.map((n, k) => (
                  <li key={plan.order[k]} className="truncate">
                    {n}
                  </li>
                ))}
              </ol>
              <div className="flex gap-2 mt-2">
                <button disabled={busy} onClick={() => void optimizeQueue(true)} className="px-3 py-1 rounded-lg font-bold bg-amber-500 text-black disabled:opacity-40">
                  Übernehmen
                </button>
                <button disabled={busy} onClick={() => setPlan(null)} className="px-3 py-1 rounded-lg font-bold border" style={{ borderColor: 'var(--app-border)' }}>
                  Verwerfen
                </button>
              </div>
            </div>
          )}
          {items.length === 0 ? (
            <p className="text-xs leading-snug" style={{ color: 'var(--app-text-muted)' }}>
              Leer. In Bambu Studio „Senden“ drücken: die Datei kommt nach wenigen Sekunden hierher.
            </p>
          ) : (
            items.map((it, i) => (
              <React.Fragment key={it.id}>
              {it.project && items[i - 1]?.project?.id !== it.project.id && <ProjectHeader items={items} pid={it.project.id} busy={busy} onRemove={() => void actProject(it.project!.id)} />}
              <div
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
                {it.time && (
                  <div className="mt-1.5 text-[10px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
                    <div>
                      ⏱️ Slicer <b style={{ color: 'var(--app-text)' }}>{fmtDur(it.time.slicerSec)}</b> · berechnet{' '}
                      {it.time.learned ? <b style={{ color: 'var(--app-text)' }}>{fmtDur(it.time.calcSec)}</b> : <span>noch offen ({Math.min(it.time.n, 2)}/2 Drucke gelernt)</span>}
                    </div>
                    {it.time.endAt && <div>🏁 Fertig ca. {new Date(it.time.endAt).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} Uhr</div>}
                  </div>
                )}
                {it.setup && (it.setup.bed || it.setup.nozzles.length > 0) && (
                  <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                    {it.setup.bed && <span className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--app-card)' }}>🟦 {it.setup.bed}</span>}
                    {it.setup.nozzles.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--app-card)' }}>
                        🔩 {(it.setup.nozzles.every(n => n === it.setup!.nozzles[0]) ? [it.setup.nozzles[0]] : it.setup.nozzles).map(n => String(n).replace('.', ',')).join(' / ')} mm
                      </span>
                    )}
                  </div>
                )}
                {it.setup && it.setup.changes.length > 0 && (
                  <div className="mt-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-400" role="alert">
                    <div className="font-bold">{it.setup.changes.some(c => c.startsWith('Platte')) ? 'Vor dem Start wechseln' : 'Vor dem Start prüfen'}</div>
                    {it.setup.changes.map(c => (
                      <div key={c}>{c}</div>
                    ))}
                  </div>
                )}
                {it.missing.length > 0 && <div className="text-[10px] text-amber-400 mt-1.5">Im AMS fehlt: {it.missing.join(', ')}</div>}
                {it.enough && it.enough.some(e => e.tempNote) && (
                  <div className="mt-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-400" role="alert">
                    <div className="font-bold">Temperatur passt nicht</div>
                    {it.enough
                      .filter(e => e.tempNote)
                      .map(e => (
                        <div key={e.id}>
                          {e.spoolLabel}: {e.tempNote}
                        </div>
                      ))}
                  </div>
                )}
                {it.enough && it.enough.some(e => !e.ok) && (
                  <div className="mt-2 space-y-1.5" role="alert">
                    {it.enough
                      .filter(e => !e.ok)
                      .map(e => {
                        const buy = e.buy && (safeHttpUrl(e.buy.url) || generateAutoShopUrl(e.buy.brand, e.buy.material, e.buy.name, e.buy.colorName));
                        return (
                          <div key={e.id} className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px]">
                            <div className="font-bold text-rose-400">
                              {e.spoolLabel}: reicht nicht
                            </div>
                            <div style={{ color: 'var(--app-text-muted)' }}>
                              Braucht ca. {e.need} g, da {e.have} g (fehlen {e.missing} g)
                            </div>
                            {e.alternatives.length > 0 ? (
                              <div className="mt-1 space-y-0.5">
                                {e.alternatives.map(a => (
                                  <div key={a.id} className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.colorHex, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.3)' }} />
                                    <span className="truncate">Besser: {a.label}</span>
                                    <span className="shrink-0" style={{ color: 'var(--app-text-muted)' }}>{a.remaining} g</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-1" style={{ color: 'var(--app-text-muted)' }}>Keine passende Ersatz-Spule da.</div>
                            )}
                            {buy && (
                              <a href={buy} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-bold underline" style={{ color: 'var(--app-accent)' }}>
                                Nachkaufen <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
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
                          <SlotPicker
                            value={sl.auto ? '' : sl.tray}
                            auto={sl.auto}
                            tray={sl.tray}
                            trayLabel={sl.trayLabel}
                            trayColor={sl.trayColor}
                            options={sl.options}
                            disabled={busy}
                            label={`Material für ${sl.type} ${Math.round(sl.grams)} g wählen`}
                            onPick={k => void pick(it.id, sl.id, k)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </React.Fragment>
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
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-[var(--app-accent)] disabled:opacity-40 cursor-pointer"
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
