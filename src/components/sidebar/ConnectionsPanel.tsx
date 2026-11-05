import React, { useState } from 'react';
import { Home, Cloud, Nfc, Smartphone, ChevronDown, Settings2, Server } from 'lucide-react';
import { getHaCredentials } from '../../utils/haClient';
import { IS_DESKTOP, IS_NATIVE, IS_STATIC, isAppShell } from '../../utils/env';
import { isGistUrl } from '../../utils/gistStore';
import { useWorkshopSettings } from '../../utils/workshopSettings';
import { getSyncPass } from '../../utils/deviceSync';
import { CloudStoreCard } from './CloudStoreCard';
import { DeviceSyncCard } from './DeviceSyncCard';
import { HomeAssistantCard } from './HomeAssistantCard';
import { ServerCard } from './ServerCard';
import { getServerUrl } from '../../utils/recorderServer';
import { Toggle } from '../workshop/ui';
import { ThreeDPrinterIcon } from '../ThreeDPrinterIcon';
import { usePrinterLive, isPrinterConfigured, isPrinterLan } from '../../utils/printerLive';

export interface ConnectionsPanelProps {
  cloudDbUrl: string;
  onCloudUrlChange: (url: string) => void;
  /** Öffnet das Bambu-Lab-Verbindungsfenster */
  onOpenBambu: () => void;
  /** Zeigt den Bereich „Handy koppeln“ (QR-Codes) */
  onOpenPhone: () => void;
  onOpenPWAInstall?: () => void;
  /** Schließt das Menü (z. B. bevor das Mitteilungs-Fenster aufgeht) */
  onClose: () => void;
}

type Level = 'ok' | 'warn' | 'off';

const muted: React.CSSProperties = { color: 'var(--app-text-muted)' };

const DOT: Record<Level, string> = { ok: 'bg-emerald-400', warn: 'bg-amber-400', off: 'bg-slate-500' };

interface RowProps {
  id: string;
  open: string | null;
  setOpen: (id: string | null) => void;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  status: string;
  level: Level;
  children: React.ReactNode;
}

const Row: React.FC<RowProps> = ({ id, open, setOpen, icon: Icon, tone, title, status, level, children }) => {
  const isOpen = open === id;
  return (
    <section className="rounded-2xl border overflow-hidden transition-colors" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: isOpen ? 'var(--app-accent)' : 'var(--app-border)' }}>
      <button type="button" onClick={() => setOpen(isOpen ? null : id)} className="w-full flex items-center gap-3 p-3 text-left cursor-pointer" aria-expanded={isOpen}>
        <span className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}>
          <Icon className="w-5 h-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold leading-tight" style={{ color: 'var(--app-text)' }}>
            {title}
          </span>
          <span className="flex items-center gap-1.5 mt-0.5 text-[11px] leading-tight" style={muted}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[level]}`} />
            <span className="truncate">{status}</span>
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={muted} />
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-3 space-y-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
          {children}
        </div>
      )}
    </section>
  );
};

const Steps: React.FC<{ items: string[] }> = ({ items }) => (
  <ol className="space-y-1.5 text-[11px] leading-relaxed" style={muted}>
    {items.map((t, i) => (
      <li key={i} className="flex gap-2">
        <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-extrabold text-white" style={{ backgroundColor: 'var(--app-accent)' }}>
          {i + 1}
        </span>
        <span>{t}</span>
      </li>
    ))}
  </ol>
);

const ActionButton: React.FC<{ onClick: () => void; children: React.ReactNode; primary?: boolean }> = ({ onClick, children, primary }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full py-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition"
    style={{
      backgroundColor: primary ? 'var(--app-accent)' : 'var(--app-card)',
      borderColor: primary ? 'var(--app-accent)' : 'var(--app-border)',
      color: primary ? '#ffffff' : 'var(--app-text)'
    }}
  >
    {children}
  </button>
);

/**
 * Verbindungen: eine aufgeräumte Liste. Jede Zeile zeigt den Stand auf einen Blick, Details klappen auf.
 * Was es auf dem Gerät nicht gibt, wird gar nicht erst gezeigt (z. B. keine App-Installation in der App).
 */
export const ConnectionsPanel: React.FC<ConnectionsPanelProps> = ({ cloudDbUrl, onCloudUrlChange, onOpenBambu, onOpenPhone, onOpenPWAInstall }) => {
  const [open, setOpen] = useState<string | null>(null);
  const [rev, setRev] = useState(0); // erzwingt Neuberechnung des Stands nach „Speichern“
  const [settings, update] = useWorkshopSettings();

  const live = usePrinterLive();
  const bambuOk = isPrinterConfigured();
  const ha = getHaCredentials();
  const haOk = !!ha.url?.trim() && !!ha.token;
  const gist = isGistUrl(cloudDbUrl);
  const syncPass = !!getSyncPass();
  void rev;

  const way = isPrinterLan() ? 'Heimnetz' : IS_NATIVE ? 'direkt über die App' : 'Bambu Cloud';
  let printerStatus: string;
  let printerLevel: Level;
  if (!bambuOk) {
    printerStatus = 'Nicht eingerichtet';
    printerLevel = 'warn';
  } else if (live.level === 'online') {
    printerStatus = `Online · ${live.text || 'bereit'} · ${way}`;
    printerLevel = 'ok';
  } else if (live.level === 'connecting') {
    printerStatus = 'Verbindet …';
    printerLevel = 'warn';
  } else if (live.level === 'standby') {
    printerStatus = `Verbunden · ${live.text || 'Drucker aus / nicht erreichbar'}`;
    printerLevel = 'warn';
  } else if (live.level === 'offline') {
    printerStatus = 'Offline · Drucker nicht verbunden';
    printerLevel = 'warn';
  } else {
    printerStatus = `Eingerichtet · ${way}`;
    printerLevel = 'ok';
  }
  const syncStatus = gist ? `Privater Gist${syncPass ? ' · Geräte-Sync an' : ''}` : cloudDbUrl ? 'npoint.io (alt, öffentlich)' : 'Nicht eingerichtet (nur auf diesem Gerät)';

  return (
    <div className="space-y-2.5">
      <Row id="printer" open={open} setOpen={setOpen} icon={ThreeDPrinterIcon} tone="text-emerald-400 bg-emerald-500/15 border-emerald-500/30" title="Bambu-Drucker" status={printerStatus} level={printerLevel}>
        {IS_STATIC && !IS_NATIVE && !IS_DESKTOP && (
          <p className="text-[11px] leading-relaxed text-amber-300">Live-Daten vom Drucker gibt es nur in der App oder mit lokalem Server. Im Browser ohne Server bleibt die Verbindung ohne Anzeige.</p>
        )}
        {!bambuOk && <Steps items={['„Verbindung einrichten“ tippen.', 'Token einfügen oder per E-Mail-Login holen.', 'Seriennummer eintragen und „Verbinden“ drücken.']} />}
        <ActionButton primary onClick={onOpenBambu}>
          <Settings2 className="w-4 h-4" />
          {bambuOk ? 'Verbindung ändern' : 'Verbindung einrichten'}
        </ActionButton>
      </Row>

      <Row id="ha" open={open} setOpen={setOpen} icon={Home} tone="text-sky-400 bg-sky-500/15 border-sky-500/30" title="Home Assistant" status={haOk ? 'Eingerichtet · Kamera, Steckdose, NFC-Leser' : ha.url?.trim() && !ha.token ? 'Token fehlt' : 'Nicht eingerichtet'} level={haOk ? 'ok' : 'warn'}>
        <HomeAssistantCard onSaved={() => setRev(r => r + 1)} />
      </Row>

      <Row id="server" open={open} setOpen={setOpen} icon={Server} tone="text-amber-400 bg-amber-500/15 border-amber-500/30" title="FilamentHub Server (Pi)" status={getServerUrl() ? `Adresse: ${getServerUrl().replace(/^https?:\/\//, '')}` : 'Nicht eingerichtet · zeichnet Drucke rund um die Uhr auf'} level={getServerUrl() ? 'ok' : 'off'}>
        <ServerCard onSaved={() => setRev(r => r + 1)} />
      </Row>

      <Row id="sync" open={open} setOpen={setOpen} icon={Cloud} tone="text-violet-400 bg-violet-500/15 border-violet-500/30" title="Cloud & Geräte-Sync" status={syncStatus} level={gist ? 'ok' : 'warn'}>
        <CloudStoreCard cloudDbUrl={cloudDbUrl} onCloudUrlChange={onCloudUrlChange} />
        <DeviceSyncCard cloudDbUrl={cloudDbUrl} />
      </Row>

      <Row id="nfc" open={open} setOpen={setOpen} icon={Nfc} tone="text-teal-400 bg-teal-500/15 border-teal-500/30" title="NFC-Leser im AMS" status={settings.amsNfcOn ? (haOk ? 'An · über Home Assistant' : 'An · braucht Home Assistant') : 'Aus'} level={settings.amsNfcOn && haOk ? 'ok' : settings.amsNfcOn ? 'warn' : 'off'}>
        <Toggle on={settings.amsNfcOn} onChange={v => update({ amsNfcOn: v })} label="Spulen per Leser im AMS zuordnen" hint="Braucht die ESPHome-Leser (Ordner hardware/ams-nfc) und die Home-Assistant-Verbindung." />
        <Steps
          items={[
            'ESP32 mit RC522-Lesern (1 bis 5) bauen und in Home Assistant über ESPHome einbinden (Ordner hardware/ams-nfc, README dort).',
            'Oben bei Home Assistant Adresse und Token eintragen und „Testen“ drücken.',
            'Schalter hier an lassen. Dann jeder Spule einen NFC-Tag geben (Spule öffnen → NFC) und sie ins AMS legen.',
            'Beim ersten Mal „Unbekannter Tag in Slot X“ antippen und die Spule wählen. Danach erkennt der Leser sie selbst.'
          ]}
        />
        <Toggle on={settings.amsNfcToPrinter} onChange={v => update({ amsNfcToPrinter: v })} label="Material und Farbe an den Drucker senden" hint="Nur wenn der Slot im Drucker nicht passt. Entwickler-Modus nötig." />
      </Row>


      {!IS_NATIVE && (
        <Row id="phone" open={open} setOpen={setOpen} icon={Smartphone} tone="text-rose-400 bg-rose-500/15 border-rose-500/30" title="Handy koppeln" status="Android-App installieren, QR-Code" level="off">
          <ActionButton primary onClick={onOpenPhone}>
            <Smartphone className="w-4 h-4" />
            App-Download und QR-Code
          </ActionButton>
          {!isAppShell() && !IS_DESKTOP && onOpenPWAInstall && <ActionButton onClick={onOpenPWAInstall}>iPhone: Als Web-App installieren</ActionButton>}
        </Row>
      )}
    </div>
  );
};
