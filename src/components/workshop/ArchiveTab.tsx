import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Loader2, Printer, RefreshCw, Search, Star, Trash2, Pencil } from 'lucide-react';
import { fmtDur } from '../../utils/printTimeFmt';
import { piArchiveAction, piArchiveList, piArchivePrint, piArchiveThumb, type PiArchiveEntry } from '../../utils/recorderServer';

// 1.274: Datei-Archiv. Alle geslicten Dateien, die je in der Warteschlange waren, liegen auf dem Pi und lassen sich jederzeit nachdrucken.

type SortKey = 'new' | 'used' | 'name' | 'material' | 'grams' | 'time' | 'count';
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'new', label: 'Neueste' },
  { id: 'used', label: 'Zuletzt benutzt' },
  { id: 'name', label: 'Name A–Z' },
  { id: 'material', label: 'Material' },
  { id: 'grams', label: 'Gramm (viel zuerst)' },
  { id: 'time', label: 'Druckzeit (lang zuerst)' },
  { id: 'count', label: 'Oft gedruckt' }
];

// Feste Klassen, damit Tailwind sie findet
const MAT_TONE: Record<string, string> = {
  PLA: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
  PETG: 'text-sky-400 bg-sky-500/15 border-sky-500/40',
  ABS: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
  ASA: 'text-orange-400 bg-orange-500/15 border-orange-500/40',
  TPU: 'text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/40',
  PA: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
  PC: 'text-violet-400 bg-violet-500/15 border-violet-500/40'
};
const OTHER_TONE = 'text-slate-400 bg-slate-500/15 border-slate-500/40';
const toneOf = (m: string) => MAT_TONE[m.replace(/[-\s].*$/, '').toUpperCase()] || MAT_TONE[m.toUpperCase()] || OTHER_TONE;

const fmtSize = (b: number) => (b >= 1024 * 1024 * 1024 ? `${(b / 1024 / 1024 / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1024 / 1024))} MB`);
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

const Thumb: React.FC<{ e: PiArchiveEntry }> = ({ e }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (e.thumb) void piArchiveThumb(e.id).then(u => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [e.id, e.thumb]);
  return (
    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: 'var(--app-card)' }}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <Archive className="w-6 h-6" style={{ color: 'var(--app-text-muted)' }} />}
    </div>
  );
};

export const ArchiveTab: React.FC = () => {
  const [items, setItems] = useState<PiArchiveEntry[] | null>(null);
  const [bytes, setBytes] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('new');
  const [mat, setMat] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);

  const load = async () => {
    setBusy('load');
    const r = await piArchiveList();
    if (r.ok) {
      setItems(r.items);
      setBytes(r.bytes);
      setError('');
    } else setError(r.error || 'Pi nicht erreichbar');
    setBusy('');
  };
  useEffect(() => {
    void load();
  }, []);

  const materials = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of items || []) for (const m of e.materials) c.set(m, (c.get(m) || 0) + 1);
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (items || []).filter(e => (!onlyFav || e.fav) && (!mat || e.materials.includes(mat)) && (!term || `${e.name} ${e.fileName} ${e.materials.join(' ')} ${e.bed || ''}`.toLowerCase().includes(term)));
    const by: Record<SortKey, (a: PiArchiveEntry, b: PiArchiveEntry) => number> = {
      new: (a, b) => b.addedAt - a.addedAt,
      used: (a, b) => b.lastUsed - a.lastUsed,
      name: (a, b) => a.name.localeCompare(b.name, 'de'),
      material: (a, b) => (a.materials[0] || 'zzz').localeCompare(b.materials[0] || 'zzz') || a.name.localeCompare(b.name, 'de'),
      grams: (a, b) => b.grams - a.grams,
      time: (a, b) => b.sec - a.sec,
      count: (a, b) => b.printCount - a.printCount
    };
    // Markierte (Stern) stehen immer oben
    return [...list].sort((a, b) => Number(b.fav) - Number(a.fav) || by[sort](a, b));
  }, [items, q, sort, mat, onlyFav]);

  const print = async (e: PiArchiveEntry, plate?: number) => {
    setBusy(e.id);
    setMsg(null);
    const r = await piArchivePrint(e.id, plate);
    setMsg(r);
    if (r.ok) void load();
    setBusy('');
  };
  const fav = async (e: PiArchiveEntry) => {
    const r = await piArchiveAction('fav', { id: e.id, fav: !e.fav });
    if (r) setItems(r);
  };
  const del = async (e: PiArchiveEntry) => {
    if (!window.confirm(`„${e.name}“ aus dem Archiv löschen? Die Datei auf dem Pi ist dann weg.`)) return;
    const r = await piArchiveAction('delete', { id: e.id });
    if (r) {
      setItems(r);
      setBytes(r.reduce((a, x) => a + x.size, 0));
    }
  };
  const rename = async (e: PiArchiveEntry) => {
    const n = window.prompt('Neuer Name', e.name);
    if (!n || n.trim() === e.name) return;
    const r = await piArchiveAction('rename', { id: e.id, name: n });
    if (r) setItems(r);
  };

  const input: React.CSSProperties = { backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text)' };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border p-3 flex items-center gap-2 border-l-4 border-l-indigo-400" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
        <Archive className="w-5 h-5 text-indigo-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold">Datei-Archiv</div>
          <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
            {items ? `${items.length} Dateien · ${fmtSize(bytes)} von 2 GB` : 'Lädt …'}. Jede Datei aus der Warteschlange wird hier gesichert.
          </div>
        </div>
        <button onClick={() => void load()} disabled={busy === 'load'} className="p-1.5 rounded-lg cursor-pointer disabled:opacity-40" aria-label="Aktualisieren">
          <RefreshCw className={`w-4 h-4 ${busy === 'load' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-400" role="alert">
          {error}. Das Archiv liegt auf dem Pi: Verbindung zum Pi prüfen (Verbindungen).
        </div>
      )}

      <div className={`grid gap-2 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto]`}>
        <label className="relative block">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Suchen: Name, Material, Platte …" className="w-full pl-8 pr-3 py-2 rounded-xl border text-xs" style={input} aria-label="Archiv durchsuchen" />
        </label>
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)} className="px-2 py-2 rounded-xl border text-xs" style={input} aria-label="Sortieren">
          {SORTS.map(s => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button onClick={() => setOnlyFav(v => !v)} className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${onlyFav ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : ''}`} style={onlyFav ? undefined : input} aria-pressed={onlyFav}>
          <Star className="w-3.5 h-3.5" /> Markiert
        </button>
      </div>

      {materials.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setMat('')} className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${mat === '' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : ''}`} style={mat === '' ? undefined : input}>
            Alle ({items?.length || 0})
          </button>
          {materials.map(([m, n]) => (
            <button key={m} onClick={() => setMat(mat === m ? '' : m)} className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${toneOf(m)} ${mat === m ? 'ring-2 ring-current' : 'opacity-80'}`} aria-pressed={mat === m}>
              {m} ({n})
            </button>
          ))}
        </div>
      )}

      {msg && (
        <div className={`rounded-xl border px-3 py-2 text-[11px] ${msg.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/40 bg-rose-500/10 text-rose-400'}`} role="status">
          {msg.text}
          {msg.ok && ' Du findest sie in der Warteschlange (Drucker-Leiste).'}
        </div>
      )}

      {items && shown.length === 0 && (
        <p className="text-xs leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          {items.length === 0 ? 'Noch leer. Sobald eine Datei in die Warteschlange kommt (in Bambu Studio „Senden“), landet sie auch hier.' : 'Nichts gefunden.'}
        </p>
      )}

      <div className="space-y-2">
        {shown.map(e => (
          <div key={e.id} className={`p-2.5 rounded-2xl border border-l-4 ${e.fav ? 'border-l-amber-400' : 'border-l-indigo-400/60'}`} style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
            <div className="flex gap-2.5">
              <Thumb e={e} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1">
                  <div className="text-xs font-bold truncate flex-1" title={e.name}>
                    {e.name}
                  </div>
                  <button onClick={() => void rename(e)} className="p-1 rounded-lg" aria-label="Umbenennen" title="Umbenennen">
                    <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--app-text-muted)' }} />
                  </button>
                  <button onClick={() => void fav(e)} className="p-1 rounded-lg" aria-label={e.fav ? 'Markierung entfernen' : 'Markieren'} aria-pressed={e.fav} title="Markieren (wird nie automatisch gelöscht)">
                    <Star className={`w-3.5 h-3.5 ${e.fav ? 'text-amber-400 fill-amber-400' : ''}`} style={e.fav ? undefined : { color: 'var(--app-text-muted)' }} />
                  </button>
                  <button onClick={() => void del(e)} className="p-1 rounded-lg" aria-label="Löschen" title="Löschen">
                    <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--app-text-muted)' }} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {e.materials.map(m => (
                    <span key={m} className={`px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${toneOf(m)}`}>
                      {m}
                    </span>
                  ))}
                  {e.colors.map(c => (
                    <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.35)' }} />
                  ))}
                </div>
                <div className="text-[10px] mt-1 leading-snug" style={{ color: 'var(--app-text-muted)' }}>
                  {e.plates.length > 1 ? `${e.plates.length} Platten · ` : ''}
                  {Math.round(e.grams)} g{e.sec > 0 ? ` · ${fmtDur(e.sec)}` : ''}
                  {e.bed ? ` · ${e.bed}` : ''}
                  {e.nozzles?.length ? ` · Düse ${e.nozzles[0]} mm` : ''}
                  <br />
                  Gesichert {fmtDate(e.addedAt)} · {fmtSize(e.size)}
                  {e.printCount > 0 ? ` · ${e.printCount}× nachgedruckt` : ''}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <button disabled={busy === e.id} onClick={() => void print(e)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 text-white flex items-center gap-1.5 disabled:opacity-40">
                {busy === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                {e.plates.length > 1 ? 'Alle Platten drucken' : 'Nochmal drucken'}
              </button>
              {e.plates.length > 1 &&
                e.plates.map(p => (
                  <button key={p.plate} disabled={busy === e.id} onClick={() => void print(e, p.plate)} className="px-2 py-1.5 rounded-lg text-[11px] font-bold border disabled:opacity-40" style={input} title={`Nur Platte ${p.plate}: ${Math.round(p.grams)} g`}>
                    Platte {p.plate}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
