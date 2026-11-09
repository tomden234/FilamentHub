import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { hasServer, piOrderStatus, type OrderMailStatus } from '../../utils/recorderServer';

// 1.275: Bestell-Mails. Der Pi liest ein eigenes Gmail-Postfach; Passwort steht nur in den Add-on-Optionen, nie hier.

const muted: React.CSSProperties = { color: 'var(--app-text-muted)' };

export const OrderMailCard: React.FC = () => {
  const [st, setSt] = useState<OrderMailStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const server = hasServer();

  const load = useCallback(async (check = false) => {
    setBusy(true);
    setSt(await piOrderStatus(check));
    setLoaded(true);
    setBusy(false);
  }, []);
  useEffect(() => {
    if (server) void load();
  }, [server, load]);

  if (!server) return <p className="text-[11px]" style={muted}>Bestell-Mails liest der Pi. Zuerst den Pi-Server verbinden.</p>;
  if (loaded && !st) return <p className="text-[11px]" style={muted}>Server zu alt oder nicht erreichbar. Add-on „FilamentHub Server“ auf 1.3.31 aktualisieren.</p>;

  return (
    <div className="space-y-2.5 text-[11px] leading-snug" style={muted}>
      {st && (
        <div className={`rounded-xl border px-3 py-2 ${st.configured ? (st.lastOk || !st.lastCheck ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10') : 'border-amber-500/40 bg-amber-500/10'}`} role="status">
          <div className="font-bold" style={{ color: 'var(--app-text)' }}>
            {st.configured ? `Postfach ${st.account}` : 'Noch nicht eingerichtet'}
          </div>
          {st.configured ? (
            <div>
              {st.text}
              {st.lastCheck > 0 && ` · ${new Date(st.lastCheck).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`}
              {!st.gemini && ' · Gemini-Schlüssel fehlt im Add-on'}
            </div>
          ) : (
            <div>Trage im Add-on „FilamentHub Server“ unter Konfiguration die Adresse und das App-Passwort des zweiten Gmail-Kontos ein.</div>
          )}
        </div>
      )}
      <button
        onClick={() => void load(true)}
        disabled={busy || !st?.configured}
        className="px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
        style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        Jetzt prüfen
      </button>
      <ol className="list-decimal pl-4 space-y-1">
        <li>Zweites Gmail-Konto anlegen, dort Einstellungen → Weiterleitung und POP/IMAP → IMAP aktivieren, 2-Schritt-Bestätigung an, unter Sicherheit ein App-Passwort erzeugen.</li>
        <li>Im Hauptkonto einen Filter: „Enthält die Wörter“ Filament (bei „Enthält nicht“ zum Beispiel github), → Weiterleiten an das zweite Konto (Adresse dort erst bestätigen). Der Pi sortiert Werbung selbst aus.</li>
        <li>Im Add-on „FilamentHub Server“ Adresse und App-Passwort bei mail_user und mail_password eintragen, Add-on neu starten.</li>
      </ol>
      <p>Bestellung → Spule erscheint sofort („Kommt in 3 Tagen“), Versand → genaueres Lieferdatum, Zustellung → Push „Filament zugestellt“. Sobald du die Spule hast, tippst du an der Karte auf „Habe ich“: dann wird sie zur normalen Spule. Alte Mails im Hauptkonto bleiben unberührt.</p>
    </div>
  );
};
