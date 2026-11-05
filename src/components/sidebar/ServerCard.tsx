import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { checkServer, getServerKey, getServerUrl, normalizeServerUrl, saveServer } from '../../utils/recorderServer';
import { getHaSyncInfo } from '../../utils/haPrintSync';
import { addSystemLog } from '../../utils/logService';

const inputCls = 'w-full px-2.5 py-2 rounded-lg border text-xs outline-none';
const inputStyle: React.CSSProperties = { backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' };
const label = 'text-[11px] font-bold block mb-1';

/** FilamentHub Server (Home-Assistant-App auf dem Pi): Adresse eintragen, damit die App Drucke nachträgt, die ohne offene App liefen. */
export const ServerCard: React.FC<{ onSaved?: () => void }> = ({ onSaved }) => {
  const [url, setUrl] = useState(getServerUrl());
  const [key, setKey] = useState(getServerKey());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const info = getHaSyncInfo();

  const save = () => {
    saveServer(url, key);
    setUrl(normalizeServerUrl(url));
    addSystemLog('system', 'FilamentHub Server gespeichert', normalizeServerUrl(url) || '(leer)', 'success');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved?.();
  };

  const check = async () => {
    save();
    setBusy(true);
    setResult(null);
    setResult(await checkServer());
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
        Die App „FilamentHub Server“ läuft auf deinem Pi (Home Assistant → Apps) und zeichnet jeden Druck rund um die Uhr auf. Hier trägst du ihre Adresse ein.
      </p>
      <div>
        <label className={label} style={{ color: 'var(--app-text)' }}>
          Adresse des Pi
        </label>
        <input className={inputCls} style={inputStyle} value={url} onChange={e => setUrl(e.target.value)} placeholder="192.168.68.10" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </div>
      <div>
        <label className={label} style={{ color: 'var(--app-text)' }}>
          API-Key (nur wenn im Server eingetragen)
        </label>
        <input className={inputCls} style={inputStyle} type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={save} className="flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5" style={{ backgroundColor: 'var(--app-accent)', color: 'var(--app-accent-fg, #fff)' }}>
          {saved ? <Check className="w-3.5 h-3.5" /> : null}
          {saved ? 'Gespeichert' : 'Speichern'}
        </button>
        <button type="button" onClick={check} disabled={busy} className="flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer flex items-center justify-center gap-1.5" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Prüfen
        </button>
      </div>
      {result && <p className={`text-[11px] leading-relaxed ${result.ok ? 'text-emerald-400' : 'text-amber-300'}`}>{result.text}</p>}
      {info && (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
          Letzter Abgleich ({new Date(info.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}): {info.text}
        </p>
      )}
    </div>
  );
};
