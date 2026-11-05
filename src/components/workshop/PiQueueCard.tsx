import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Play, Plus, RefreshCw, Server, Trash2 } from 'lucide-react';
import { piPrinterFiles, piQueue, piQueueAction, type PiQueueItem, type PrinterFile } from '../../utils/recorderServer';
import { Card } from './ui';

// Warteschlange auf dem Pi: Dateien, die schon auf dem Drucker liegen (aus Bambu Studio „Senden“), vormerken.
// Der Taster „Platte frei“ am AMS-ESP startet den nächsten Druck, der LED-Streifen zeigt, wie viele warten.

export const PiQueueCard: React.FC = () => {
  const [items, setItems] = useState<PiQueueItem[] | null>(null);
  const [files, setFiles] = useState<PrinterFile[] | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = async () => setItems(await piQueue());
  useEffect(() => {
    void reload();
    const iv = setInterval(() => void reload(), 20_000);
    return () => clearInterval(iv);
  }, []);

  if (items === null) return null; // kein Pi mit Hub

  const act = async (action: 'add' | 'remove' | 'move' | 'start', body: Record<string, unknown> = {}, label: string = action) => {
    setBusy(label);
    setMsg(null);
    const r = await piQueueAction(action, body);
    if (r.items) setItems(r.items);
    if (r.text || !r.ok) setMsg({ ok: r.ok, text: r.text || 'Fehler' });
    setBusy('');
    return r;
  };

  const loadFiles = async () => {
    setBusy('files');
    const r = await piPrinterFiles();
    setFiles(r.files);
    if (r.error) setMsg({ ok: false, text: r.error });
    setBusy('');
  };

  const btn = 'p-1 rounded-lg cursor-pointer disabled:opacity-30';

  return (
    <Card>
      <div className="flex items-center gap-2 text-xs font-extrabold">
        <Server className="w-4 h-4 text-sky-400" />
        <span>Warteschlange auf dem Pi ({items.length})</span>
      </div>
      <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
        In Bambu Studio „Senden“ (nicht „Drucken“), dann hier die Datei vormerken. Platte leer machen, Taster „Platte frei“ am AMS drücken: der nächste Druck startet.
        Die LEDs zeigen, wie viele warten.
      </p>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={it.id} className="p-2 rounded-xl border space-y-1" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-card-sub)' }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold w-5 text-center">{i + 1}</span>
                <span className="text-xs font-bold truncate flex-1">{it.name}</span>
                <button className={btn} disabled={i === 0 || !!busy} onClick={() => void act('move', { id: it.id, dir: -1 })} title="Nach oben">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button className={btn} disabled={i === items.length - 1 || !!busy} onClick={() => void act('move', { id: it.id, dir: 1 })} title="Nach unten">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button className={btn} disabled={!!busy} onClick={() => void act('remove', { id: it.id })} title="Entfernen" style={{ color: 'var(--app-text-muted)' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] leading-snug pl-6" style={{ color: 'var(--app-text-muted)' }}>
                {it.mapping.map(l => (
                  <div key={l}>{l}</div>
                ))}
                {it.missing.length > 0 && <div className="text-rose-400 font-bold">Fehlt im AMS: {it.missing.join(', ')}</div>}
              </div>
            </div>
          ))}
          <button
            type="button"
            disabled={!!busy}
            onClick={() => {
              if (window.confirm(`Ist die Druckplatte leer? Dann startet „${items[0].name}“ jetzt.`)) void act('start', {}, 'start');
            }}
            className="w-full py-2 rounded-xl text-white text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ backgroundImage: 'var(--app-accent-gradient)' }}
          >
            {busy === 'start' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Platte frei: nächsten starten
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={!!busy}
        onClick={() => void loadFiles()}
        className="w-full py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center justify-center gap-1.5"
        style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
      >
        {busy === 'files' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        Dateien auf dem Drucker zeigen
      </button>
      {files && (
        <div className="max-h-56 overflow-y-auto space-y-1">
          {files.length === 0 && (
            <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
              Keine .3mf-Dateien gefunden.
            </p>
          )}
          {files.map(f => (
            <button
              key={f.path}
              type="button"
              disabled={!!busy}
              onClick={async () => {
                const r = await act('add', { path: f.path }, 'add:' + f.path);
                if (r.ok) setMsg({ ok: true, text: `„${f.name}“ vorgemerkt.` });
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] text-left cursor-pointer"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            >
              {busy === 'add:' + f.path ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <Plus className="w-3 h-3 shrink-0" />}
              <span className="truncate flex-1">{f.name.replace(/\.gcode\.3mf$|\.3mf$/i, '')}</span>
              <span className="shrink-0" style={{ color: 'var(--app-text-muted)' }}>
                {f.time ? new Date(f.time).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : ''}
              </span>
            </button>
          ))}
        </div>
      )}
      {msg && <p className={`text-[11px] leading-snug ${msg.ok ? 'text-emerald-400' : 'text-amber-300'}`}>{msg.text}</p>}
    </Card>
  );
};
