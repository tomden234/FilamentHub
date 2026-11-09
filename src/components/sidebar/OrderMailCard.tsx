import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Link2, Loader2, RefreshCw } from 'lucide-react';
import { hasServer, piOrderStatus, piOrderTest, piProductFill, type OrderMailStatus, type ProductFillStatus } from '../../utils/recorderServer';

// 1.275/1.278: Bestell-Mails und Spulen-Links. Passwort und Schlüssel stehen nur in den Add-on-Optionen, nie hier.

const muted: React.CSSProperties = { color: 'var(--app-text-muted)' };
const btn = 'px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center gap-1.5 disabled:opacity-40';
const btnStyle: React.CSSProperties = { borderColor: 'var(--app-border)', color: 'var(--app-text)' };
const box = (ok: boolean | null) => `rounded-xl border px-3 py-2 ${ok === null ? 'border-amber-500/40 bg-amber-500/10' : ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}`;
const time = (t: number) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export const OrderMailCard: React.FC = () => {
  const [st, setSt] = useState<OrderMailStatus | null>(null);
  const [fill, setFill] = useState<ProductFillStatus | null>(null);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [loaded, setLoaded] = useState(false);
  const server = hasServer();

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([piOrderStatus(), piProductFill()]);
    setSt(a);
    setFill(b);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (server) void load();
  }, [server, load]);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    await fn();
    setBusy('');
  };

  if (!server) return <p className="text-[11px]" style={muted}>Das macht der Pi. Zuerst den Pi-Server verbinden.</p>;
  if (loaded && !st) return <p className="text-[11px]" style={muted}>Pi zu alt oder nicht erreichbar. Add-on „FilamentHub Server“ aktualisieren.</p>;

  return (
    <div className="space-y-2.5 text-[11px] leading-snug" style={muted}>
      {st && (
        <div className={box(!st.configured ? null : st.lastOk || !st.lastCheck)} role="status">
          <div className="font-bold" style={{ color: 'var(--app-text)' }}>
            {st.configured ? `Postfach ${st.account}` : 'Postfach fehlt: mail_user und mail_password im Add-on eintragen'}
          </div>
          {st.configured && (
            <div>
              {st.text}
              {st.lastCheck > 0 && ` · ${time(st.lastCheck)} Uhr`}
              {!st.gemini && ' · Gemini-Schlüssel fehlt'}
            </div>
          )}
        </div>
      )}
      {test && <div className={box(test.ok)}>{test.text}</div>}
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} style={btnStyle} disabled={!!busy || !st?.configured} onClick={() => void run('check', async () => setSt(await piOrderStatus(true)))}>
          {busy === 'check' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Jetzt prüfen
        </button>
        <button className={btn} style={btnStyle} disabled={!!busy} onClick={() => void run('test', async () => setTest(await piOrderTest()))} title="Liest eine eingebaute Beispiel-Mail aus, speichert nichts">
          {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
          Test-Mail auslesen
        </button>
      </div>

      <div className="pt-1 font-bold" style={{ color: 'var(--app-text)' }}>
        Spulen-Links
      </div>
      {fill && (
        <div className={box(fill.open === 0 ? true : null)}>
          {fill.filled} gefunden{fill.failed ? `, ${fill.failed} ohne Treffer` : ''}, {fill.open} offen. {fill.text}
          {fill.lastAt > 0 && ` · ${time(fill.lastAt)} Uhr`}
        </div>
      )}
      <button className={btn} style={btnStyle} disabled={!!busy} onClick={() => void run('fill', async () => setFill(await piProductFill(true)))} title="Sucht für die nächste Spule ohne Link die Produktseite (läuft sonst alle 3 Minuten von selbst)">
        {busy === 'fill' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
        Nächste Spule jetzt suchen
      </button>
    </div>
  );
};
