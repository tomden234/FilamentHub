import React, { useCallback, useEffect, useState } from 'react';
import { Copy, FlaskConical, Inbox, Link2, Loader2, Mail, RefreshCw, Send, Trash2 } from 'lucide-react';
import { currentTestId, requestDeleteTestSpools, TEST_MAIL_MAIN, testMail, type TestMailKind } from '../../utils/incoming';
import { hasServer, piOrderStatus, piOrderTest, piOrderTestMail, piProductFill, type OrderMailStatus, type ProductFillStatus } from '../../utils/recorderServer';

// 1.275/1.278: Bestell-Mails und Spulen-Links. Passwort und Schlüssel stehen nur in den Add-on-Optionen, nie hier.

const muted: React.CSSProperties = { color: 'var(--app-text-muted)' };
const btn = 'px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center gap-1.5 disabled:opacity-40';
const btnStyle: React.CSSProperties = { borderColor: 'var(--app-border)', color: 'var(--app-text)' };
const box = (ok: boolean | null) => `rounded-xl border px-3 py-2 ${ok === null ? 'border-amber-500/40 bg-amber-500/10' : ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}`;
const TEST_KINDS: { kind: TestMailKind; label: string }[] = [
  { kind: 'ordered', label: '1 Bestellt' },
  { kind: 'shipped', label: '2 Versendet' },
  { kind: 'delivered', label: '3 Zugestellt' }
];
const time = (t: number) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export const OrderMailCard: React.FC = () => {
  const [st, setSt] = useState<OrderMailStatus | null>(null);
  const [fill, setFill] = useState<ProductFillStatus | null>(null);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
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

  const openTestMail = (kind: TestMailKind) => {
    const m = testMail(kind, currentTestId());
    window.location.href = `mailto:${TEST_MAIL_MAIN}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
  };
  const sendTestMail = (kind: TestMailKind, to: 'main' | 'self') =>
    void run(`tm-${kind}-${to}`, async () => setTest(await piOrderTestMail(kind, currentTestId(), to)));
  const copyTestMail = async (kind: TestMailKind) => {
    const m = testMail(kind, currentTestId());
    try {
      await navigator.clipboard.writeText(`${m.subject}\n\n${m.body}`);
      setCopied(kind);
      setTimeout(() => setCopied(''), 2500);
    } catch {
      setCopied('');
    }
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
        Test-Spule per Mail
      </div>
      <p>
        „An mein Konto“: Der Pi schickt die Mail über das Bestell-Postfach an {TEST_MAIL_MAIN} und legt eine Kopie gleich ins Bestell-Postfach (Gmail leitet Mails nicht an den eigenen Absender weiter, deshalb nicht über den Filter). „Direkt“ schickt nur ins Bestell-Postfach. Reihenfolge 1, 2, 3 zeigt den ganzen Ablauf.
      </p>
      {TEST_KINDS.map(t => (
        <div key={t.kind} className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 font-bold" style={{ color: 'var(--app-text)' }}>{t.label}</span>
          <button className={btn} style={btnStyle} disabled={!!busy} onClick={() => sendTestMail(t.kind, 'main')} title={`Pi schickt die Mail an ${TEST_MAIL_MAIN} und eine Kopie ins Bestell-Postfach`}>
            {busy === `tm-${t.kind}-main` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            An mein Konto
          </button>
          <button className={btn} style={btnStyle} disabled={!!busy} onClick={() => sendTestMail(t.kind, 'self')} title="Pi schickt die Mail ins Bestell-Postfach selbst">
            {busy === `tm-${t.kind}-self` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Inbox className="w-3.5 h-3.5" />}
            Direkt
          </button>
          <button className={btn} style={btnStyle} onClick={() => openTestMail(t.kind)} title="Mail-Programm öffnen" aria-label={`${t.label}: Mail-Programm öffnen`}>
            <Mail className="w-3.5 h-3.5" />
          </button>
          <button className={btn} style={btnStyle} onClick={() => void copyTestMail(t.kind)} title="Betreff und Text kopieren" aria-label={`${t.label}: Text kopieren`}>
            <Copy className="w-3.5 h-3.5" />
            {copied === t.kind ? 'Kopiert' : ''}
          </button>
        </div>
      ))}
      <button
        className={btn}
        style={btnStyle}
        onClick={() => {
          requestDeleteTestSpools();
          currentTestId(true);
        }}
        title="Löscht alle Testspulen aus der App. Es bleibt nichts zurück."
      >
        <Trash2 className="w-3.5 h-3.5" />
        Testspulen löschen
      </button>

      <div className="pt-1 font-bold" style={{ color: 'var(--app-text)' }}>
        Spulen-Links
      </div>
      {fill && (
        <div className={box(fill.open === 0 ? true : null)}>
          {fill.filled} gefunden{fill.failed ? `, ${fill.failed} ohne Treffer` : ''}, {fill.open} offen{fill.learned ? `, ${fill.learned} Produkte aus Bestellungen gelernt` : ''}. {fill.text}
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
