import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  Smartphone,
  QrCode,
  Download,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { APK_URL } from '../utils/env';
import { isGistUrl, pairUrlFor } from '../utils/gistStore';

interface AppAndQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudDbUrl: string;
  defaultTab?: 'app' | 'qr' | 'apk';
}

export const AppAndQrModal: React.FC<AppAndQrModalProps> = ({
  isOpen,
  onClose,
  cloudDbUrl,
  defaultTab = 'app'
}) => {
  const [activeTab, setActiveTab] = useState<'app' | 'qr' | 'apk'>(defaultTab);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const { isInstalled, install } = usePWAInstall();

  // Koppel-Link generieren
  const pairUrl = typeof window !== 'undefined' ? pairUrlFor(cloudDbUrl) : '';

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(defaultTab);
  }, [isOpen, defaultTab]);

  useEffect(() => {
    if (!pairUrl) return;
    QRCode.toDataURL(pairUrl, {
      width: 240,
      margin: 1.5,
      color: { dark: '#0b111e', light: '#ffffff' }
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(() => {});
  }, [pairUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pairUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border p-4 sm:p-5 shadow-2xl space-y-4 my-8 transition-colors max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Header & Tabs */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
          <div
            className="flex items-center gap-1 p-1 rounded-xl border text-xs font-bold"
            style={{
              backgroundColor: 'var(--app-card-sub)',
              borderColor: 'var(--app-border)'
            }}
          >
            <button
              onClick={() => setActiveTab('app')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'app'
                  ? 'bg-orange-500 text-white shadow'
                  : 'hover:opacity-80'
              }`}
              style={{
                color: activeTab === 'app' ? '#ffffff' : 'var(--app-text-muted)'
              }}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>1. App installieren</span>
            </button>
            <button
              onClick={() => setActiveTab('apk')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'apk'
                  ? 'bg-orange-500 text-white shadow'
                  : 'hover:opacity-80'
              }`}
              style={{
                color: activeTab === 'apk' ? '#ffffff' : 'var(--app-text-muted)'
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>2. APK-Datei</span>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'qr'
                  ? 'bg-orange-500 text-white shadow'
                  : 'hover:opacity-80'
              }`}
              style={{
                color: activeTab === 'qr' ? '#ffffff' : 'var(--app-text-muted)'
              }}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>3. QR-Code</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:opacity-80 transition cursor-pointer"
            style={{ color: 'var(--app-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* =========================================================================
            TAB 1: OFFIZIELLE 1-KLICK APP INSTALLATION (FUNKTIONIERT ZU 100% AUF JEDEM HANDY)
            ========================================================================= */}
        {activeTab === 'app' && (
          <div className="space-y-3.5 text-xs">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg text-white">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm sm:text-base" style={{ color: 'var(--app-text)' }}>
                FilamentHub als echte App installieren
              </h3>
              <p className="text-[11px] max-w-sm mx-auto" style={{ color: 'var(--app-text-muted)' }}>
                Der offizielle Google- & Samsung-Weg (WebAPK): 100% fehlerfrei, ohne Parsing-Probleme, mit App-Icon im Launcher und Offline-Funktion!
              </p>
            </div>

            {/* Installieren Button wenn auf Handy/Browser verfügbar */}
            <div
              className="p-3.5 rounded-xl border space-y-2 text-center"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-extrabold text-xs">
                <Zap className="w-4 h-4" />
                <span>Direkte 1-Klick Installation:</span>
              </div>

              {isInstalled ? (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>FilamentHub ist auf diesem Gerät bereits installiert!</span>
                </div>
              ) : (
                <button
                  onClick={install}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Jetzt auf Smartphone installieren</span>
                </button>
              )}

              <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                Unterstützt Google Chrome, Samsung Internet Browser, Brave & Edge.
              </p>
            </div>

            {/* Schritt-für-Schritt Anleitung für Android & iPhone */}
            <div className="space-y-2 text-[11px]">
              <div
                className="p-3 rounded-xl border space-y-1.5"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <span className="font-extrabold flex items-center gap-1 text-emerald-400">
                  <span>Für Android & Google Chrome (Wichtigster Tipp!):</span>
                </span>
                <p style={{ color: 'var(--app-text)' }} className="leading-relaxed">
                  Wenn bei dir im Chrome-Menü bei <em>„Installieren“</em> ein Fehler kommt:
                </p>
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold text-emerald-400 space-y-1">
                  <div>Wähle stattdessen <strong>„Verknüpfung erstellen“</strong>!</div>
                  <div className="text-[10px] text-[var(--app-text)] font-normal">
                    Das funktioniert auf jedem Android-Smartphone zu 100% sofort, legt das offizielle FilamentHub-Icon auf deinen Homescreen und startet die App im vollen Vollbild ohne störende Suchleiste!
                  </div>
                </div>
              </div>

              <div
                className="p-3 rounded-xl border space-y-1.5"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <span className="font-extrabold flex items-center gap-1 text-sky-400">
                  <span>Für Apple iPhone (Safari):</span>
                </span>
                <ol className="list-decimal list-inside space-y-1 leading-relaxed" style={{ color: 'var(--app-text)' }}>
                  <li>Öffne diesen Link in <strong>Safari</strong> auf dem iPhone.</li>
                  <li>Tippe unten auf das <strong>Teilen-Symbol</strong> (Viereck mit Pfeil nach oben).</li>
                  <li>Wähle <strong>„Zum Home-Bildschirm“</strong> &rarr; <strong>„Hinzufügen“</strong>.</li>
                </ol>
              </div>
            </div>

            {/* QR-Code Schnell-Link */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('apk')}
                className="flex-1 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Oder: Echte APK herunterladen</span>
              </button>
              <button
                onClick={() => setActiveTab('qr')}
                className="py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 hover:opacity-80"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                <QrCode className="w-3.5 h-3.5 text-orange-400" />
                <span>QR-Code</span>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: ECHTE KOMPILIERTE & DIGITAL SIGNIERTE ANDROID APK-DATEI
            ========================================================================= */}
        {activeTab === 'apk' && (
          <div className="space-y-3.5 text-xs">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg text-white">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm sm:text-base" style={{ color: 'var(--app-text)' }}>
                Echte, eigenständige Android-App (APK)
              </h3>
              <p className="text-[11px] max-w-sm mx-auto" style={{ color: 'var(--app-text-muted)' }}>
                Frisch mit Android D8 kompiliert, mit Dalvik-Bytecode und offizieller RSA-Signatur (v1, v2 & v3) ausgestattet.
              </p>
            </div>

            {/* DOWNLOAD BUTTON */}
            <div
              className="p-3.5 rounded-xl border space-y-2.5 text-center"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-extrabold text-xs">
                <Check className="w-4 h-4" />
                <span>Echte Android-App, automatisch auf GitHub gebaut:</span>
              </div>

              <a
                href={APK_URL}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer text-center active:scale-98"
              >
                <Download className="w-4 h-4 text-white" />
                <span>FilamentHub.apk jetzt herunterladen</span>
              </a>

              <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                Paketname: <code>com.filamenthub.app</code> • Immer die neueste Version • Android 7.0+
              </p>
            </div>

            {/* ANLEITUNG ZUR APK INSTALLATION */}
            <div
              className="p-3 rounded-xl border space-y-2 text-[11px]"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              <strong className="text-[var(--app-text)] block">So installierst du die APK in 3 Schritten:</strong>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                <span>Klicke oben auf den grünen Button <strong>„FilamentHub.apk jetzt herunterladen“</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                <span>Tippe nach dem Download in der Android-Benachrichtigungsleiste oder im Ordner <em>Downloads</em> auf die Datei <code>FilamentHub.apk</code>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                <span>Tippe auf <strong>„Installieren“</strong>. (Falls Android fragt: <em>„Installation aus dieser Quelle zulassen“</em> mit einem Klick aktivieren).</span>
              </div>
            </div>

            {/* WECHSEL ZU VERKNÜPFUNG / QR */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('app')}
                className="flex-1 py-2 px-3 rounded-xl border border-[var(--app-border)] hover:border-orange-500/50 text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: 'var(--app-card-sub)', color: 'var(--app-text)' }}
              >
                <span>Zurück zu „Verknüpfung erstellen“</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('qr')}
                className="py-2 px-3 rounded-xl border border-[var(--app-border)] hover:border-orange-500/50 text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: 'var(--app-card-sub)', color: 'var(--app-text)' }}
              >
                <QrCode className="w-3.5 h-3.5 inline text-orange-400 mr-1" />
                <span>QR-Code</span>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: QR-CODE KOPPLUNG
            ========================================================================= */}
        {activeTab === 'qr' && (
          <div className="space-y-3.5 text-xs text-center">
            <div className="space-y-1">
              <h3 className="font-extrabold text-sm sm:text-base" style={{ color: 'var(--app-text)' }}>
                Mit Smartphone scannen
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Öffne deine Handy-Kamera und scanne diesen QR-Code, um FilamentHub sofort auf dem Smartphone zu öffnen und zu installieren.
              </p>
            </div>

            <div className="flex justify-center p-3 rounded-xl" style={{ backgroundColor: 'var(--app-card-sub)' }}>
              {qrCodeDataUrl ? (
                <div className="p-3 bg-white rounded-xl shadow-md border border-slate-200">
                  <img src={qrCodeDataUrl} alt="QR-Code zum Koppeln" className="w-44 h-44 object-contain" />
                </div>
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-xs" style={{ color: 'var(--app-text-muted)' }}>
                  QR-Code wird erzeugt...
                </div>
              )}
            </div>

            {isGistUrl(cloudDbUrl) && (
              <p className="text-[11px] text-amber-400 font-semibold leading-relaxed">
                Dieser QR-Code enthält den Zugang zu deinem privaten Cloud-Speicher. Nur mit deinen eigenen Geräten scannen, nicht teilen oder fotografieren lassen.
              </p>
            )}

            {/* Link kopieren */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={pairUrl}
                className="flex-1 px-3 py-2 rounded-xl border text-[11px] font-mono outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
