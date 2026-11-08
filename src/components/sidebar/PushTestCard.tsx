import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { hasServer, pushTestKinds, serverReports, testServerPush, type ServerReport } from '../../utils/recorderServer';

// 1.261 Testmenü: jede Push-Meldung des Pi einzeln auslösen, alle nacheinander, Wochenbericht neu senden und die letzten Berichte als Seite lesen.

const btn = 'px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 text-left';
const btnStyle: React.CSSProperties = { borderColor: 'var(--app-border)', color: 'var(--app-text)' };
const muted: React.CSSProperties = { color: 'var(--app-text-muted)' };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const fmt = (t: number) => new Date(t).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const PushTestCard: React.FC = () => {
  const [kinds, setKinds] = useState<{ id: string; label: string }[]>([]);
  const [reports, setReports] = useState<ServerReport[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [openId, setOpenId] = useState('');
  const [loading, setLoading] = useState(true);
  const stop = useRef(false);
  const server = hasServer();

  const load = useCallback(async () => {
    setLoading(true);
    const [k, r] = await Promise.all([pushTestKinds(), serverReports()]);
    setKinds(k);
    setReports(r);
    setLoading(false);
  }, []);
  useEffect(() => {
    if (server) void load();
    else setLoading(false);
    return () => {
      stop.current = true;
    };
  }, [server, load]);

  const send = async (id: string, label: string) => {
    setBusy(id);
    const r = await testServerPush(id);
    setMsg({ ok: r.ok, text: r.ok ? `„${label}“ gesendet. ${r.text.replace(/^Push gesendet\s*/, '')}`.trim() : r.text });
    if (id === 'weekly') setReports(await serverReports());
    setBusy('');
    return r.ok;
  };

  const all = async () => {
    stop.current = false;
    setBusy('all');
    let n = 0;
    for (const k of kinds) {
      if (stop.current) break;
      setMsg({ ok: true, text: `Sende ${n + 1} von ${kinds.length}: ${k.label}` });
      const r = await testServerPush(k.id);
      if (!r.ok) {
        setMsg({ ok: false, text: `Stopp bei „${k.label}“: ${r.text}` });
        setBusy('');
        return;
      }
      n++;
      await wait(1800);
    }
    setReports(await serverReports());
    setMsg({ ok: true, text: `${n} Meldungen gesendet. Schau aufs Handy.` });
    setBusy('');
  };

  if (!server) return <p className="text-[11px] leading-snug" style={muted}>Kein Pi-Server eingetragen. Menü → Verbindungen → FilamentHub Server.</p>;

  return (
    <>
      <p className="text-[11px] leading-snug" style={muted}>
        Schickt Beispiel-Meldungen über Home Assistant aufs Handy, auch wenn die Schalter unter „Mitteilungen“ aus sind. In der Ruhezeit kommen sie lautlos.
      </p>
      <div className="flex gap-2">
        <button className={`${btn} flex-1`} style={btnStyle} disabled={Boolean(busy) || loading || !kinds.length} onClick={() => void all()}>
          {busy === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Alle nacheinander
        </button>
        <button className={btn} style={btnStyle} disabled={busy === 'all'} onClick={() => void load()} aria-label="Neu laden" title="Neu laden">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {!kinds.length && !loading && <p className="text-[11px] text-amber-300 leading-snug">Der Pi kennt die Test-Meldungen noch nicht. In Home Assistant das Add-on „FilamentHub Server“ auf 1.3.20 aktualisieren.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {kinds.map(k => (
          <button key={k.id} className={btn} style={btnStyle} disabled={Boolean(busy)} onClick={() => void send(k.id, k.label)}>
            {busy === k.id ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : null}
            <span className="flex-1">{k.label}</span>
          </button>
        ))}
      </div>
      {msg && <p className={`text-[11px] leading-snug ${msg.ok ? 'text-emerald-400' : 'text-amber-300'}`}>{msg.text}</p>}

      <div className="pt-2">
        <div className="text-[11px] font-extrabold mb-1.5">Letzte Wochenberichte</div>
        {reports.length === 0 ? (
          <p className="text-[11px] leading-snug" style={muted}>Noch keiner gespeichert. „Wochenbericht (mit Seite)“ oben senden, dann steht er hier.</p>
        ) : (
          <div className="space-y-1.5">
            {reports.map(r => (
              <div key={r.id} className="rounded-xl border" style={{ borderColor: 'var(--app-border)' }}>
                <button type="button" className="w-full flex items-center gap-2 p-2 text-[11px] font-bold cursor-pointer text-left" aria-expanded={openId === r.id} onClick={() => setOpenId(o => (o === r.id ? '' : r.id))}>
                  <span className="flex-1">{fmt(r.at)}</span>
                  <span style={muted}>{openId === r.id ? 'zuklappen' : 'lesen'}</span>
                </button>
                {openId === r.id && (
                  <div className="px-2 pb-2 space-y-1.5">
                    {r.text
                      .split('\n')
                      .filter(Boolean)
                      .map((l, i) => (
                        <div key={i} className="rounded-lg px-2 py-1.5 text-[11px]" style={{ backgroundColor: 'var(--app-card-sub)' }}>
                          {l}
                        </div>
                      ))}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold underline" style={{ color: 'var(--app-accent)' }}>
                        Als Seite öffnen <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] leading-snug mt-2" style={muted}>
          Tippst du am Handy auf den Wochenbericht-Push, öffnet sich dieselbe Seite direkt vom Pi (im Heimnetz oder über Tailscale).
        </p>
      </div>
    </>
  );
};
