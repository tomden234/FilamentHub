import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, Download, Check, Copy, ShieldCheck, Share } from 'lucide-react';
import { APK_URL, IS_NATIVE } from '../../utils/env';
import { installApkInApp } from '../../utils/liveUpdate';

interface ConnectTabProps {
  qrCodeDataUrl: any;
  handleCopyPairLink: (...args: any[]) => any;
  copiedLink: any;
  onOpenPWAInstall?: () => void;
}

const card: React.CSSProperties = { backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' };
const muted: React.CSSProperties = { color: 'var(--app-text-muted)' };

export const ConnectTab: React.FC<ConnectTabProps> = ({
  qrCodeDataUrl,
  handleCopyPairLink,
  copiedLink,
  onOpenPWAInstall
}) => {
  const [apkQr, setApkQr] = useState('');
  const [copiedApk, setCopiedApk] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installNote, setInstallNote] = useState('');

  // In der App: direkt laden und den Android-Installer öffnen (kein Browser nötig)
  const installHere = async () => {
    setInstalling(true);
    setInstallNote('Lade neue App …');
    const r = await installApkInApp();
    setInstalling(false);
    if (r === 'started') setInstallNote('Fertig geladen. Bitte „Installieren“ bestätigen.');
    else if (r === 'needPermission') setInstallNote('Erlaube „Installieren“ für FilamentHub in den Einstellungen, dann hier nochmal tippen.');
    else if (r === 'browser') window.location.href = APK_URL;
    else setInstallNote('Download fehlgeschlagen. Bitte nochmal tippen.');
  };

  useEffect(() => {
    QRCode.toDataURL(APK_URL, { width: 320, margin: 1.5, color: { dark: '#0b111e', light: '#ffffff' } })
      .then(setApkQr)
      .catch(() => {});
  }, []);

  const copyApk = async () => {
    try {
      await navigator.clipboard.writeText(APK_URL);
      setCopiedApk(true);
      setTimeout(() => setCopiedApk(false), 2000);
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Android-App per QR */}
      <div className="rounded-2xl border p-4 space-y-3.5 shadow-md" style={card}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Smartphone className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm" style={{ color: 'var(--app-text)' }}>
              Android-App installieren
            </h4>
            <p className="text-[10px]" style={muted}>
              {IS_NATIVE ? 'Du nutzt bereits die App.' : 'QR-Code mit dem Handy scannen'}
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          {apkQr ? (
            <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-200">
              <img src={apkQr} alt="QR-Code zum APK-Download" className="w-40 h-40 object-contain" />
            </div>
          ) : (
            <div className="w-40 h-40 fh-skeleton" />
          )}
        </div>

        {IS_NATIVE && (
          <>
            <button
              type="button"
              onClick={installHere}
              disabled={installing}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>{installing ? 'Lade …' : 'Neue App jetzt installieren'}</span>
            </button>
            {installNote && (
              <p className="text-[11px] font-bold text-center" style={{ color: 'var(--app-text)' }}>
                {installNote}
              </p>
            )}
          </>
        )}
        <a
          href={APK_URL}
          className="w-full py-2.5 px-4 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>FilamentHub.apk herunterladen</span>
        </a>
        <button
          type="button"
          onClick={copyApk}
          className="w-full py-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          {copiedApk ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedApk ? 'Link kopiert!' : 'Download-Link kopieren'}
        </button>

        <ol className="text-[11px] space-y-1 leading-relaxed list-decimal pl-4" style={muted}>
          <li>QR-Code scannen oder Button tippen – die Datei wird geladen.</li>
          <li>Datei öffnen und „Aus dieser Quelle installieren“ erlauben.</li>
          <li>Installieren und die App „FilamentHub“ starten.</li>
        </ol>
        <p className="text-[10px] flex items-start gap-1.5" style={muted}>
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          Die APK wird bei jeder Änderung automatisch auf GitHub gebaut (Actions) und ist immer die neueste Version.
        </p>
      </div>

      {/* Sync-Kopplung */}
      <div className="rounded-2xl border p-4 space-y-3" style={card}>
        <span className="font-bold text-xs block" style={{ color: 'var(--app-text)' }}>
          Daten mit dem Handy koppeln
        </span>
        <p className="text-[11px]" style={muted}>
          Öffnet die Seite am Handy und überträgt deinen Sync-Link.
        </p>
        <div className="flex justify-center p-2 rounded-xl" style={{ backgroundColor: 'var(--app-card)' }}>
          {qrCodeDataUrl && (
            <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
              <img src={qrCodeDataUrl} alt="Koppeln" className="w-32 h-32 object-contain" />
            </div>
          )}
        </div>
        <button
          onClick={handleCopyPairLink}
          className="w-full py-2 rounded-xl border font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
          style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedLink ? 'Koppel-Link kopiert!' : 'Koppel-Link kopieren'}</span>
        </button>
      </div>

      {onOpenPWAInstall && (
        <button
          type="button"
          onClick={onOpenPWAInstall}
          className="w-full py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          style={card}
        >
          <Share className="w-3.5 h-3.5" />
          <span style={{ color: 'var(--app-text)' }}>iPhone / ohne APK: Als Web-App installieren</span>
        </button>
      )}
    </div>
  );
};
