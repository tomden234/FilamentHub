import React, { useState } from 'react';
import { RefreshCw, Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { getSyncPass, setSyncPass, resetSyncPass, syncDevices, syncDetail, lastSyncAt, type SyncResult } from '../../utils/deviceSync';

const MESSAGES: Record<SyncResult, { text: string; ok: boolean }> = {
  pushed: { text: 'Dieses Gerät ist jetzt die Quelle: Drucker-Zugang und Einstellungen sind verschlüsselt in der Cloud.', ok: true },
  applied: { text: 'Drucker-Zugang und Einstellungen vom anderen Gerät übernommen. Die App verbindet sich selbst.', ok: true },
  same: { text: 'Alles ist schon gleich. Beide Geräte sind synchron.', ok: true },
  nopass: { text: 'Bitte ein Sync-Passwort eintragen.', ok: false },
  badpass: { text: 'Das Passwort passt nicht zu dem auf dem anderen Gerät.', ok: false },
  error: { text: 'Cloud gerade nicht erreichbar. Es wird automatisch nochmal versucht.', ok: false }
};

// Einmal pro Gerät: gleiches Sync-Passwort eintragen, danach gleichen Handy, Windows-App und Co. Drucker-Zugang, Einstellungen und Spulen selbst ab.
export const DeviceSyncCard: React.FC<{ cloudDbUrl: string }> = ({ cloudDbUrl }) => {
  const [pass, setPass] = useState(getSyncPass());
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [at, setAt] = useState(lastSyncAt());
  const [detail, setDetail] = useState('');
  const active = Boolean(getSyncPass());

  const run = async () => {
    setBusy(true);
    setSyncPass(pass);
    const r = await syncDevices(cloudDbUrl);
    setResult(r);
    const d = r === 'error' ? syncDetail() : '';
    setDetail(d);
    setAt(lastSyncAt());
    setBusy(false);
    window.dispatchEvent(new CustomEvent('filamenthub:sync-now'));
  };

  // Passwort vergessen: neues festlegen, dieses Gerät wird die Quelle
  const reset = async () => {
    if (!confirm('Neues Sync-Passwort festlegen?\n\nDieses Gerät verschlüsselt seine Einstellungen neu. Auf allen anderen Geräten musst du danach das neue Passwort eintragen. Das alte Passwort gilt nicht mehr.')) return;
    setBusy(true);
    const r = await resetSyncPass(cloudDbUrl, pass);
    setResult(r);
    setDetail(r === 'error' ? syncDetail() : '');
    setAt(lastSyncAt());
    setBusy(false);
  };

  return (
    <section className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
          <RefreshCw className="w-4 h-4" style={{ color: 'var(--app-accent-text)' }} />
          Geräte-Sync (Handy, Windows, …)
        </h3>
        {active && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> An
          </span>
        )}
      </header>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
        Trag auf jedem Gerät <strong>dasselbe Sync-Passwort</strong> ein. Danach gleichen sich Spulen, Verlauf, Einstellungen, Drucker-IP,
        Zugangscode, Seriennummer und Bambu-Login automatisch ab. IP und Code musst du nie wieder eintippen. Alles Private ist
        verschlüsselt, die Cloud sieht nur Zufallstext.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Lock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-60" />
          <input
            type={show ? 'text' : 'password'}
            value={pass}
            onChange={e => setPass(e.target.value)}
            placeholder="Sync-Passwort (min. 6 Zeichen)"
            className="w-full pl-8 pr-9 py-2 rounded-lg border text-xs outline-none"
            style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
          />
          <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 cursor-pointer">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          type="button"
          disabled={busy || pass.trim().length < 6}
          onClick={run}
          className="px-3 py-2 rounded-lg text-white text-xs font-extrabold cursor-pointer disabled:opacity-40"
          style={{ backgroundImage: 'var(--app-accent-gradient)' }}
        >
          {busy ? '…' : active ? 'Jetzt abgleichen' : 'Sync starten'}
        </button>
      </div>
      <button type="button" disabled={busy || pass.trim().length < 6} onClick={reset} className="text-[10px] font-bold underline cursor-pointer disabled:opacity-40 text-left" style={{ color: 'var(--app-text-muted)' }}>
        Passwort vergessen? Das eingetragene als neues Passwort festlegen
      </button>
      {result && (
        <p className={`text-[11px] font-bold ${MESSAGES[result].ok ? 'text-emerald-400' : 'text-amber-400'}`}>{MESSAGES[result].text}</p>
      )}
      {detail && <p className="text-[10px] break-words" style={{ color: 'var(--app-text-muted)' }}>Grund: {detail}</p>}
      {at > 0 && (
        <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
          Zuletzt abgeglichen: {new Date(at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      )}
    </section>
  );
};
