import React, { useEffect, useState } from 'react';
import { Camera, CheckCircle2, Clock, ImageOff, Loader2, MinusCircle, Repeat, Trash2, XCircle } from 'lucide-react';
import { loadPhoto, removePrintRecord, savePhoto, usePrintLog, type PrintRecord } from '../../utils/printLog';
import { fetchServerPhoto, getServerUrl, piDeductManual, piDeductSuggest, piQueueAction } from '../../utils/recorderServer';
import type { Spool } from '../../types/filament';
import { Card, buttonStyle } from './ui';

// Druck-Verlauf mit Foto: jeder Druck mit Kamerabild vom Ende, Dauer, Verbrauch und Kosten.

const fmtDate = (ms: number) => new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
const fmtDur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
const euro = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
/** Gramm mit einer Nachkommastelle unter 10 g (z. B. 2,4 g), sonst ganz */
const fmtG = (g: number) => (g > 0 && g < 10 ? (Math.round(g * 10) / 10).toLocaleString('de-DE') : String(Math.round(g)));

/** Fotos, die beim Pi-Server schon gesucht wurden (nicht dauernd neu fragen) */
const askedServer = new Set<string>();

const Photo: React.FC<{ id: string; has: boolean; onOpen: (url: string) => void }> = ({ id, has, onOpen }) => {
  const [url, setUrl] = useState<string | null>(null);
  // Kein Foto auf diesem Gerät: der Pi-Server hat evtl. eins am Druckende gemacht
  useEffect(() => {
    if (has || askedServer.has(id) || !getServerUrl()) return;
    askedServer.add(id);
    void fetchServerPhoto(id).then(b => {
      if (b) void savePhoto(id, b);
    });
  }, [id, has]);
  useEffect(() => {
    if (!has) return;
    let u: string | null = null;
    let live = true;
    void loadPhoto(id).then(b => {
      if (!b || !live) return;
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id, has]);
  if (!url)
    return (
      <div className="w-24 h-20 sm:w-32 sm:h-24 rounded-lg border flex items-center justify-center shrink-0" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
        {has ? <Camera className="w-5 h-5 animate-pulse" /> : <ImageOff className="w-5 h-5" />}
      </div>
    );
  return (
    <button onClick={() => onOpen(url)} className="shrink-0 cursor-zoom-in">
      <img src={url} alt="Foto vom Druckende" className="w-24 h-20 sm:w-32 sm:h-24 rounded-lg object-cover border" style={{ borderColor: 'var(--app-border)' }} />
    </button>
  );
};

interface Line {
  spoolId: string;
  grams: string;
}

/** Manuell abziehen: Pi schlägt Spule und Gramm vor, du kannst ändern. Der Pi bucht es in die Cloud (nie doppelt). */
const DeductEditor: React.FC<{ r: PrintRecord; spools: Spool[]; onDone: () => void }> = ({ r, spools, onDone }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const start = async () => {
    setOpen(true);
    setBusy(true);
    setMsg(null);
    const sug = await piDeductSuggest({ id: r.id, name: r.name, startMs: r.startMs, endMs: r.endMs });
    const ls = (sug?.parts || []).map(p => ({ spoolId: p.spoolId, grams: String(Math.round(p.grams * 10) / 10) }));
    setLines(ls.length ? ls : [{ spoolId: '', grams: '' }]);
    if (!sug) setMsg({ ok: false, text: 'Pi nicht erreichbar. Spule und Gramm von Hand eintragen.' });
    else if (!ls.length) setMsg({ ok: false, text: 'Gewicht unbekannt. Spule und Gramm von Hand eintragen.' });
    setBusy(false);
  };
  const set = (i: number, v: Partial<Line>) => setLines(l => l.map((x, k) => (k === i ? { ...x, ...v } : x)));
  const save = async () => {
    const parts = lines.map(l => ({ spoolId: l.spoolId, grams: Number(l.grams.replace(',', '.')) })).filter(p => p.spoolId && p.grams > 0);
    if (!parts.length) return setMsg({ ok: false, text: 'Bitte Spule und Gramm angeben.' });
    setBusy(true);
    const res = await piDeductManual({ id: r.id, name: r.name, startMs: r.startMs, endMs: r.endMs, state: r.state, percent: r.percent, parts });
    setMsg({ ok: res.ok, text: res.text });
    setBusy(false);
    if (res.ok) {
      window.dispatchEvent(new CustomEvent('filamenthub:sync-now'));
      setTimeout(onDone, 1200);
    }
  };

  if (!open)
    return (
      <button onClick={() => void start()} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer" style={buttonStyle}>
        <MinusCircle className="w-3 h-3" /> Jetzt abziehen
      </button>
    );
  return (
    <div className="w-full space-y-1.5 pt-1">
      {busy && !lines.length && (
        <div className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>
          <Loader2 className="w-3 h-3 animate-spin" /> Pi sucht das Gewicht …
        </div>
      )}
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select value={l.spoolId} onChange={e => set(i, { spoolId: e.target.value })} className="flex-1 min-w-0 px-1.5 py-1 rounded-lg border text-[11px]" style={{ ...buttonStyle, backgroundColor: 'var(--app-card)' }}>
            <option value="">Spule wählen …</option>
            {spools.map(sp => (
              <option key={sp.id} value={sp.id}>
                {sp.brand} {sp.name} ({Math.round(sp.remainingWeight)} g)
              </option>
            ))}
          </select>
          <input value={l.grams} onChange={e => set(i, { grams: e.target.value })} inputMode="decimal" placeholder="g" className="w-16 px-1.5 py-1 rounded-lg border text-[11px] text-right" style={{ ...buttonStyle, backgroundColor: 'var(--app-card)' }} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <button disabled={busy} onClick={() => void save()} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-emerald-600 disabled:opacity-40 cursor-pointer">
          {busy ? 'Moment …' : 'Abziehen'}
        </button>
        <button disabled={busy} onClick={() => setLines(l => [...l, { spoolId: '', grams: '' }])} className="px-2 py-1 rounded-lg border text-[11px] cursor-pointer" style={buttonStyle}>
          + Spule
        </button>
        <button disabled={busy} onClick={() => setOpen(false)} className="px-2 py-1 rounded-lg text-[11px] cursor-pointer" style={{ color: 'var(--app-text-muted)' }}>
          Abbrechen
        </button>
      </div>
      {msg && <div className={`text-[11px] ${msg.ok ? 'text-emerald-400' : 'text-amber-300'}`}>{msg.text}</div>}
    </div>
  );
};

/** Nochmal drucken: dieselbe Datei auf dem Drucker noch einmal in die Warteschlange */
const ReprintButton: React.FC<{ name: string }> = ({ name }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const go = async () => {
    setBusy(true);
    setMsg(null);
    const r = await piQueueAction('reprint', { name });
    setMsg({ ok: r.ok, text: r.text || (r.ok ? 'Vorgemerkt.' : 'Fehler') });
    setBusy(false);
  };
  return (
    <>
      <button disabled={busy} onClick={() => void go()} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer disabled:opacity-40" style={buttonStyle}>
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Repeat className="w-3 h-3" />} Nochmal drucken
      </button>
      {msg && <span className={`text-[11px] ${msg.ok ? 'text-emerald-400' : 'text-amber-300'}`}>{msg.text}</span>}
    </>
  );
};

const Row: React.FC<{ r: PrintRecord; spools: Spool[]; onOpen: (url: string) => void }> = ({ r, spools, onOpen }) => {
  const [hidden, setHidden] = useState(false);
  void hidden;
  const ok = r.state === 'FINISH';
  return (
    <div className="flex gap-3 p-2.5 rounded-xl border" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
      <Photo id={r.id} has={r.hasPhoto} onOpen={onOpen} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-extrabold truncate">{r.name}</div>
          <button
            onClick={() => window.confirm(`„${r.name}“ aus dem Verlauf löschen?`) && removePrintRecord(r.id)}
            className="p-1 rounded-lg cursor-pointer shrink-0"
            style={{ color: 'var(--app-text-muted)' }}
            title="Aus dem Verlauf löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
          <span className={`inline-flex items-center gap-1 font-bold ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>
            {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {ok ? 'Fertig' : `Abgebrochen${r.percent ? ` (${r.percent} %)` : ''}`}
          </span>
          <span>{fmtDate(r.endMs)}</span>
          {r.durationMin > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {fmtDur(r.durationMin)}
            </span>
          )}
        </div>
        {r.grams > 0 && r.spools.length > 0 ? (
          // 1.226: jede abgezogene Spule als eigene Zeile (Mehrfarb-/Mehrmaterialdruck), darunter die Summe
          <div className="rounded-lg border text-[11px] divide-y" style={{ borderColor: 'var(--app-border)' }}>
            {r.spools.length > 1 && (
              <div className="px-2 py-1 font-bold" style={{ color: 'var(--app-text-muted)', borderColor: 'var(--app-border)' }}>
                Mehrfarbdruck · {r.spools.length} Spulen abgezogen
              </div>
            )}
            {r.spools.map(s => {
              const mat = spools.find(x => x.id === s.id)?.material;
              return (
                <div key={s.id} className="flex items-center gap-1.5 px-2 py-1" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="w-2.5 h-2.5 rounded-full border shrink-0" style={{ backgroundColor: s.color, borderColor: 'var(--app-border)' }} />
                  <span className="min-w-0 flex-1 truncate">
                    {s.label}
                    {mat && !s.label.toLowerCase().includes(mat.toLowerCase()) ? <span style={{ color: 'var(--app-text-muted)' }}> · {mat}</span> : null}
                  </span>
                  <span className="font-mono-num font-bold shrink-0">−{fmtG(s.grams)} g</span>
                  <span className="font-mono-num shrink-0 w-14 text-right" style={{ color: 'var(--app-text-muted)' }}>{euro(s.cost)}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 px-2 py-1 font-bold" style={{ borderColor: 'var(--app-border)' }}>
              <span className="flex-1">Gesamt</span>
              <span className="font-mono-num shrink-0">{fmtG(r.grams)} g</span>
              <span className="font-mono-num shrink-0 w-14 text-right">{euro(r.cost)}</span>
            </div>
          </div>
        ) : r.grams > 0 ? (
          <div className="text-[11px] font-bold">
            {fmtG(r.grams)} g · {euro(r.cost)}
          </div>
        ) : (
          <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>Verbrauch noch nicht abgezogen</div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {r.grams <= 0 && <DeductEditor r={r} spools={spools} onDone={() => setHidden(true)} />}
          <ReprintButton name={r.name} />
        </div>
      </div>
    </div>
  );
};

export const PrintsTab: React.FC<{ spools?: Spool[] }> = ({ spools = [] }) => {
  const log = usePrintLog();
  const [big, setBig] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);

  if (!log.length)
    return (
      <Card>
        <div className="text-xs font-extrabold">Noch keine Drucke</div>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Ab jetzt landet jeder Druck hier: egal ob über Bambu Studio, Handy oder Display gestartet. Am Ende macht die App ein Foto über die Kamera in Home Assistant und trägt Verbrauch und Kosten ein, sobald abgezogen ist.
        </p>
      </Card>
    );

  return (
    <div className="space-y-2">
      {log.slice(0, limit).map(r => (
        <Row key={r.id} r={r} spools={spools} onOpen={setBig} />
      ))}
      {log.length > limit && (
        <button onClick={() => setLimit(l => l + 30)} className="w-full py-2 rounded-xl border text-xs font-bold cursor-pointer" style={buttonStyle}>
          Mehr anzeigen ({log.length - limit})
        </button>
      )}
      {big && (
        <div className="fixed inset-0 z-[130] bg-black/85 flex items-center justify-center p-3" onClick={() => setBig(null)}>
          <img src={big} alt="Foto vom Druckende" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
};
