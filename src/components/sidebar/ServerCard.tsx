import React, { useEffect, useState } from 'react';
import { BellRing, Check, Download, HardDriveDownload, Loader2 } from 'lucide-react';
import {
  checkServer,
  downloadServerBackup,
  getServerKey,
  getServerUrl,
  listServerBackups,
  normalizeServerUrl,
  saveServer,
  serverBackupNow,
  testServerPush,
  type ServerBackup
} from '../../utils/recorderServer';
import { getHubInfo } from '../../utils/serverDeducts';
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
  const [hub, setHub] = useState(getHubInfo());
  const [hubMsg, setHubMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [hubBusy, setHubBusy] = useState<'' | 'push' | 'backup'>('');
  const [backups, setBackups] = useState<ServerBackup[]>([]);

  const loadBackups = async () => setBackups(await listServerBackups());
  useEffect(() => {
    if (getServerUrl() && hub?.enabled) void loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub?.enabled]);

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
    setHub(getHubInfo());
    setBusy(false);
  };

  const doPush = async () => {
    setHubBusy('push');
    setHubMsg(await testServerPush());
    setHub(getHubInfo());
    setHubBusy('');
  };

  const doBackup = async () => {
    setHubBusy('backup');
    setHubMsg(await serverBackupNow());
    await loadBackups();
    setHubBusy('');
  };

  const yes = (v: boolean | undefined) => (v ? '✅' : '—');

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
      {hub?.enabled && (
        <div className="rounded-xl border p-2.5 space-y-2" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-card-sub)' }}>
          <div className="text-[11px] font-extrabold" style={{ color: 'var(--app-text)' }}>
            Pi macht ohne App
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
            <span>{yes(hub.deduct)} Abzug (genau einmal)</span>
            <span>{yes(hub.ha)} Push aufs Handy</span>
            <span>{yes(hub.power)} Aus nach Druck/Trocknen</span>
            <span>{yes(hub.enabled)} Foto am Druckende</span>
            <span>{yes(hub.ha)} Warnungen</span>
            <span>{yes(hub.cloud)} Tägliche Sicherung</span>
          </div>
          {!hub.cloud && (
            <p className="text-[11px] leading-snug text-amber-300">Für Abzug und Sicherung braucht der Pi den Cloud-Speicher. Er bekommt ihn automatisch, sobald die App mit der Cloud verbunden ist.</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={doPush} disabled={!!hubBusy} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center justify-center gap-1.5" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
              {hubBusy === 'push' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
              Test-Push
            </button>
            <button type="button" onClick={doBackup} disabled={!!hubBusy} className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center justify-center gap-1.5" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
              {hubBusy === 'backup' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDriveDownload className="w-3.5 h-3.5" />}
              Jetzt sichern
            </button>
          </div>
          {hubMsg && <p className={`text-[11px] leading-snug ${hubMsg.ok ? 'text-emerald-400' : 'text-amber-300'}`}>{hubMsg.text}</p>}
          {backups.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-bold" style={{ color: 'var(--app-text)' }}>
                Sicherungen auf dem Pi ({backups.length}, jede Nacht neu, 30 Tage)
              </div>
              {backups.slice(0, 3).map(b => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => void downloadServerBackup(b.name)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg border text-[11px] cursor-pointer"
                  style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
                >
                  <span>{b.name.replace('filamenthub-', '').replace('.json', '')}</span>
                  <span className="flex items-center gap-1">
                    {Math.max(1, Math.round(b.size / 1024))} KB <Download className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {info && (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
          Letzter Abgleich ({new Date(info.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}): {info.text}
        </p>
      )}
    </div>
  );
};
