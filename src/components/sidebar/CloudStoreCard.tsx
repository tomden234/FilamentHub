import React, { useState } from 'react';
import { Cloud, CheckCircle2, ExternalLink, KeyRound, Server } from 'lucide-react';
import { safeStorage } from '../../utils/safeStorage';
import { cloudFetch } from '../../utils/cloudFetch';
import { PI_URL, isPiUrl, piDocFetch } from '../../utils/piDoc';
import { serverBase } from '../../utils/serverEndpoint';
import { pushHubConfig } from '../../utils/recorderServer';
import {
  checkGistToken,
  createGist,
  getGistToken,
  gistIdOf,
  gistUrlOf,
  isGistUrl,
  parseGistPair,
  setGistToken,
  testGist,
  validGistId
} from '../../utils/gistStore';
import { STORAGE_KEY_HISTORY, STORAGE_KEY_SPOOLS, STORAGE_KEY_SPOOLS_AT } from '../../utils/storageKeys';

// Cloud-Speicher: privater GitHub-Gist statt npoint.io (das manche Schul- und Firmennetze sperren).
// Einmal anlegen, auf dem zweiten Gerät per QR-Code oder ID + Token verbinden.

const TOKEN_LINK = 'https://github.com/settings/tokens/new?scopes=gist&description=FilamentHub%20Sync';

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = safeStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const CloudStoreCard: React.FC<{ cloudDbUrl: string; onCloudUrlChange: (url: string) => void }> = ({ cloudDbUrl, onCloudUrlChange }) => {
  const piActive = isPiUrl(cloudDbUrl);
  const active = isGistUrl(cloudDbUrl);
  const [token, setToken] = useState(getGistToken());
  const [pairText, setPairText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const say = (text: string, ok: boolean) => setMsg({ text, ok });

  // 1.230: Spulen-Daten liegen als Datei auf dem Pi (SSD). Vorhandene Daten (alter Speicher, sonst dieses Gerät) werden einmal übernommen.
  const moveToPi = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (serverBase() === null) return say('Erst oben unter „FilamentHub Server (Pi)“ Adresse und Schlüssel eintragen.', false);
      const cur = await piDocFetch();
      if (!cur.ok) {
        let e = `Pi antwortet mit HTTP ${cur.status}.`;
        try {
          e = ((await cur.json()) as { error?: string })?.error || e;
        } catch {
          /* Text bleibt */
        }
        return say(e, false);
      }
      const etag = cur.headers.get('etag') || '';
      const piDoc = ((await cur.json()) as Record<string, unknown>) || {};
      const piHasSpools = Array.isArray(piDoc.spools) && piDoc.spools.length > 0;
      if (!piHasSpools) {
        let old: Record<string, unknown> = {};
        if (cloudDbUrl && !piActive) {
          try {
            const r = await cloudFetch(cloudDbUrl, { cache: 'no-store' });
            if (r.ok) old = ((await r.json()) as Record<string, unknown>) || {};
          } catch {
            old = {}; // alter Speicher nicht erreichbar: Daten dieses Geräts nehmen
          }
        }
        const localAt = Number(safeStorage.getItem(STORAGE_KEY_SPOOLS_AT)) || 0;
        const oldAt = Number(old.updatedAt) || 0;
        const useOld = Array.isArray(old.spools) && oldAt > localAt;
        const doc = {
          ...old, // enthält auch den verschlüsselten Geräte-Sync („secure“)
          updatedAt: useOld ? oldAt : localAt || Date.now(),
          spools: useOld ? old.spools : readJson(STORAGE_KEY_SPOOLS, [] as unknown[]),
          printHistory: useOld && Array.isArray(old.printHistory) ? old.printHistory : readJson(STORAGE_KEY_HISTORY, [] as unknown[])
        };
        const w = await piDocFetch({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : {}) }, body: JSON.stringify(doc) });
        if (!w.ok) return say(`Pi hat das Speichern abgelehnt (HTTP ${w.status}).`, false);
      }
      onCloudUrlChange(PI_URL);
      void pushHubConfig(true).catch(() => undefined);
      say(piHasSpools ? 'Fertig. Auf dem Pi lagen schon Daten, die bleiben erhalten.' : 'Fertig. Deine Daten liegen jetzt auf dem Pi. Alte Speicher (npoint/Gist) werden nicht mehr benutzt.', true);
    } finally {
      setBusy(false);
    }
  };

  // Neuen privaten Gist anlegen und die vorhandenen Daten hineinkopieren (aus dem alten Speicher, sonst aus diesem Gerät)
  const createAndMove = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const t = token.trim();
      if (!t) return say('Bitte zuerst das GitHub-Token eintragen.', false);
      const check = await checkGistToken(t);
      if (!check.ok) return say(check.error, false);

      let old: Record<string, unknown> = {};
      try {
        const r = await cloudFetch(cloudDbUrl, { cache: 'no-store' });
        if (r.ok) old = ((await r.json()) as Record<string, unknown>) || {};
      } catch {
        old = {}; // alter Speicher nicht erreichbar (z. B. Schulnetz): Daten dieses Geräts nehmen
      }
      const localAt = Number(safeStorage.getItem(STORAGE_KEY_SPOOLS_AT)) || 0;
      const oldAt = Number(old.updatedAt) || 0;
      const useOld = Array.isArray(old.spools) && oldAt > localAt;
      const doc = {
        ...old, // enthält auch den verschlüsselten Geräte-Sync („secure“)
        updatedAt: useOld ? oldAt : localAt || Date.now(),
        spools: useOld ? old.spools : readJson(STORAGE_KEY_SPOOLS, [] as unknown[]),
        printHistory: useOld && Array.isArray(old.printHistory) ? old.printHistory : readJson(STORAGE_KEY_HISTORY, [] as unknown[])
      };
      const made = await createGist(t, JSON.stringify(doc));
      if (!made.ok) return say(made.error, false);
      setGistToken(t);
      onCloudUrlChange(gistUrlOf(made.id));
      say(`Fertig. Privater Gist angelegt (Konto ${check.login || '?'}, ID ${made.id}). Zweites Gerät: QR-Code unter „Handy & App“ scannen.`, true);
    } finally {
      setBusy(false);
    }
  };

  // Zweites Gerät: ID und Token eintragen oder den Koppel-Link einfügen
  const connect = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const pasted = parseGistPair(pairText.includes('#') ? pairText.slice(pairText.indexOf('#')) : '');
      const id = (pasted?.id || pairText.trim().replace(/^gist:/, '')).trim();
      const t = (pasted?.token || token).trim();
      if (!validGistId(id)) return say('Gist-ID fehlt oder ist ungültig (nur Buchstaben und Zahlen).', false);
      if (!t) return say('Bitte das GitHub-Token eintragen.', false);
      setGistToken(t);
      setToken(t);
      const res = await testGist(gistUrlOf(id));
      if (!res.ok) return say(res.error, false);
      onCloudUrlChange(gistUrlOf(id));
      say('Verbunden. Die Daten werden jetzt abgeglichen.', true);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    if (piActive) {
      const r = await piDocFetch();
      say(r.ok ? 'Verbindung zum Pi funktioniert.' : `Pi antwortet mit HTTP ${r.status}.`, r.ok);
      setBusy(false);
      return;
    }
    const res = await testGist(cloudDbUrl);
    say(res.ok ? 'Verbindung zum privaten Gist funktioniert.' : res.error, res.ok);
    setBusy(false);
  };

  const clearLegacy = async () => {
    const legacyUrl = (prompt('Adresse des alten npoint-Speichers (https://api.npoint.io/…):') || '').trim();
    if (!legacyUrl) return;
    if (!/^https:\/\/api\.npoint\.io\/[A-Za-z0-9_-]+$/.test(legacyUrl)) {
      say('Das ist keine npoint-Adresse.', false);
      return;
    }
    if (
      !confirm(
        'Alten öffentlichen npoint-Speicher leeren?\n\nNur machen, wenn ALLE deine Geräte schon auf den privaten Gist umgestellt sind. Geräte, die noch npoint nutzen, laden sonst ihre Daten wieder dort hoch.'
      )
    )
      return;
    setBusy(true);
    try {
      const r = await cloudFetch(legacyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ info: 'Nicht mehr genutzt. FilamentHub speichert jetzt in einem privaten GitHub-Gist.' })
      });
      say(r.ok ? 'Alter npoint-Speicher ist geleert.' : `npoint antwortet mit HTTP ${r.status}.`, r.ok);
    } catch (e: any) {
      say(`npoint nicht erreichbar: ${e?.message || e}`, false);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-2.5 py-2 rounded-lg border text-xs outline-none';
  const inputStyle: React.CSSProperties = { backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' };
  const btn = 'px-3 py-2 rounded-lg text-white text-xs font-extrabold cursor-pointer disabled:opacity-40';

  return (
    <section className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
          <Cloud className="w-4 h-4" style={{ color: 'var(--app-accent-text)' }} />
          Cloud-Speicher
        </h3>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            active || piActive ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          }`}
        >
          {(active || piActive) && <CheckCircle2 className="w-3 h-3" />}
          {piActive ? 'Pi-Server (SSD)' : active ? 'Privater GitHub-Gist' : cloudDbUrl ? 'npoint.io (alt, öffentlich)' : 'Nicht eingerichtet'}
        </span>
      </header>

      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
        {piActive
          ? 'Deine Daten liegen als Datei auf dem Pi (SSD), nur mit deinem Schlüssel erreichbar. Kein Cloud-Dienst, kein Token. Unterwegs brauchst du Zugriff auf den Pi (z. B. Tailscale).'
          : active
          ? `Deine Daten liegen in einem privaten GitHub-Gist (ID ${gistIdOf(cloudDbUrl)}). Der Zugang zu Drucker und Home Assistant bleibt zusätzlich mit deinem Sync-Passwort verschlüsselt.`
          : cloudDbUrl
            ? 'Der alte Speicher npoint.io ist öffentlich lesbar und wird in manchen Schul- und Firmennetzen gesperrt. Ein privater GitHub-Gist ist geschützt und läuft über github.com.'
            : 'Ohne Cloud bleiben deine Daten nur auf diesem Gerät. Mit einem privaten GitHub-Gist (eigener Zugang, kostenlos) kannst du mehrere Geräte abgleichen.'}
      </p>

      <div className="space-y-1.5">
        {!piActive && (
          <button type="button" disabled={busy} onClick={moveToPi} className={`${btn} w-full flex items-center justify-center gap-1.5`} style={{ backgroundImage: 'var(--app-accent-gradient)' }}>
            <Server className="w-3.5 h-3.5" />
            {busy ? '…' : 'Auf Pi-Server umstellen (empfohlen)'}
          </button>
        )}
        {piActive && (
          <button type="button" disabled={busy} onClick={test} className="w-full py-2 rounded-lg border text-xs font-bold cursor-pointer disabled:opacity-40" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
            Verbindung zum Pi testen
          </button>
        )}
        <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
          Braucht Adresse und Schlüssel des Pi (Zeile „FilamentHub Server (Pi)“). Vorhandene Daten werden einmal übernommen.
        </p>
      </div>

      <details className="rounded-lg border p-2" style={{ borderColor: 'var(--app-border)' }}>
        <summary className="text-[11px] font-bold cursor-pointer" style={{ color: 'var(--app-text-muted)' }}>
          Alternative: GitHub-Gist (geht auch ohne Zugriff auf den Pi)
        </summary>
        <div className="space-y-3 pt-3">
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
          <KeyRound className="w-3.5 h-3.5" />
          GitHub-Token (Recht „gist“)
        </label>
        <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_… oder github_pat_…" className={input} style={inputStyle} autoComplete="off" />
        <a href={TOKEN_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold hover:underline" style={{ color: 'var(--app-accent-text)' }}>
          Token erstellen (nur Haken „gist“ setzen, Ablauf: keiner)
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {!active && (
        <button type="button" disabled={busy || !token.trim()} onClick={createAndMove} className={`${btn} w-full`} style={{ backgroundImage: 'var(--app-accent-gradient)' }}>
          {busy ? '…' : 'Privaten Gist anlegen und Daten übernehmen'}
        </button>
      )}

      <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: 'var(--app-border)' }}>
        <label className="text-[11px] font-bold" style={{ color: 'var(--app-text)' }}>
          Zweites Gerät verbinden
        </label>
        <input type="text" value={pairText} onChange={e => setPairText(e.target.value)} placeholder="Gist-ID oder Koppel-Link einfügen" className={input} style={inputStyle} autoComplete="off" />
        <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
          Einfacher: am ersten Gerät unter „Handy & App“ den QR-Code zeigen und am zweiten scannen. ID und Token werden dann automatisch übernommen.
        </p>
        <button type="button" disabled={busy || !pairText.trim()} onClick={connect} className={`${btn} w-full`} style={{ backgroundColor: 'var(--app-accent)' }}>
          {busy ? '…' : 'Verbinden'}
        </button>
      </div>

      {active && (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={test} className="flex-1 py-2 rounded-lg border text-xs font-bold cursor-pointer disabled:opacity-40" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
            Verbindung testen
          </button>
          <button type="button" disabled={busy} onClick={clearLegacy} className="flex-1 py-2 rounded-lg border text-xs font-bold cursor-pointer disabled:opacity-40 text-rose-400" style={{ borderColor: 'var(--app-border)' }}>
            Alten npoint-Speicher leeren
          </button>
        </div>
      )}

        </div>
      </details>

      {msg && <p className={`text-[11px] font-bold break-words ${msg.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{msg.text}</p>}
    </section>
  );
};
