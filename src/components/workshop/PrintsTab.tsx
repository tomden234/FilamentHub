import React, { useEffect, useState } from 'react';
import { Camera, CheckCircle2, Clock, ImageOff, Trash2, XCircle } from 'lucide-react';
import { loadPhoto, removePrintRecord, savePhoto, usePrintLog, type PrintRecord } from '../../utils/printLog';
import { fetchServerPhoto, getServerUrl } from '../../utils/recorderServer';
import { Card, buttonStyle } from './ui';

// Druck-Verlauf mit Foto: jeder Druck mit Kamerabild vom Ende, Dauer, Verbrauch und Kosten.

const fmtDate = (ms: number) => new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
const fmtDur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
const euro = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

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

const Row: React.FC<{ r: PrintRecord; onOpen: (url: string) => void }> = ({ r, onOpen }) => {
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
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {r.spools.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border" style={{ borderColor: 'var(--app-border)' }}>
              <span className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: s.color, borderColor: 'var(--app-border)' }} />
              <span className="truncate max-w-[9rem]">{s.label}</span>
              <span className="font-mono-num font-bold">{Math.round(s.grams)} g</span>
            </span>
          ))}
          {r.grams > 0 ? (
            <span className="font-bold">
              {Math.round(r.grams)} g · {euro(r.cost)}
            </span>
          ) : (
            <span style={{ color: 'var(--app-text-muted)' }}>Verbrauch noch nicht abgezogen</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const PrintsTab: React.FC = () => {
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
        <Row key={r.id} r={r} onOpen={setBig} />
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
