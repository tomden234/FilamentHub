import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RefreshCw, Lightbulb, Power, Plug, AlertTriangle, Maximize2, X } from 'lucide-react';
import { diagnoseHaCamera } from '../../utils/haClient';
import { getPrinterCameraError } from '../../utils/printerCamera';
import { withApiKey } from '../../api/client';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface PrinterCameraPanelProps {
  setCameraSnapshotKey: any;
  handleToggleLight: (...args: any[]) => any;
  isLightOn: any;
  isSocketOff: any;
  handleToggleSwitch: (...args: any[]) => any;
  haSwitchLoading: any;
  cameraSource: any;
  haCameraBlobUrl: any;
  haCreds: any;
  cameraSnapshotKey: any;
  printerLocalIp: any;
  haSwitchState: any;
}

export const PrinterCameraPanel: React.FC<PrinterCameraPanelProps> = ({
  setCameraSnapshotKey,
  handleToggleLight,
  isLightOn,
  isSocketOff,
  handleToggleSwitch,
  haSwitchLoading,
  cameraSource,
  haCameraBlobUrl,
  haCreds,
  cameraSnapshotKey,
  printerLocalIp,
  haSwitchState
}) => {
  // Kein Bild? Dann klar sagen, woran es liegt (Token, Kamera-Name, Erreichbarkeit)
  const [diag, setDiag] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    if (cameraSource === 'ha') {
      const r = await diagnoseHaCamera();
      const direct = getPrinterCameraError();
      setDiag(r.ok ? null : `${direct ? `Direkt vom Drucker: ${direct}\n\n` : ''}${r.text}`);
    } else {
      setDiag('Die Bambu-Cloud gibt kein Live-Bild heraus. Die Kamera geht über Home Assistant (Einstellungen → Verbindungen) oder per LAN im Heimnetz.');
    }
    setChecking(false);
  }, [cameraSource]);

  useEffect(() => {
    if (haCameraBlobUrl) {
      setDiag(null);
      return;
    }
    const t = setTimeout(() => void check(), 5000);
    return () => clearTimeout(t);
  }, [haCameraBlobUrl, check]);

  const [big, setBig] = useState(false);
  useEscapeClose(() => setBig(false), big);
  useEffect(() => {
    if (!big) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [big]);

  const imgSrc =
    haCameraBlobUrl ||
    (cameraSource === 'ha'
      ? withApiKey(`/api/homeassistant/camera-snapshot?entity=${encodeURIComponent(haCreds.cameraEntity)}&t=${cameraSnapshotKey}`)
      : withApiKey(`/api/printer/camera-frame?t=${cameraSnapshotKey}`));

  const image = (fit: 'cover' | 'contain') => (
    <img
      src={imgSrc}
      onError={e => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = haCameraBlobUrl || withApiKey(`/api/printer/camera-frame?t=${Date.now()}`);
      }}
      alt="Bambu Lab X2D Live Kamera"
      className={`w-full h-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
      draggable={false}
    />
  );

  const offline = (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center gap-2 bg-gradient-to-b from-slate-950 via-slate-900 to-black">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
        <Power className="w-6 h-6" />
      </div>
      <p className="text-sm font-bold text-slate-200">Kamera offline · Drucker stromlos</p>
      <button
        onClick={handleToggleSwitch}
        disabled={haSwitchLoading}
        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
      >
        <Power className="w-3.5 h-3.5" />
        <span>{haSwitchLoading ? 'Schaltet ein...' : 'Steckdose einschalten'}</span>
      </button>
    </div>
  );

  const diagBox =
    !haCameraBlobUrl && diag ? (
      <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-2 p-4 text-center">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <p className="text-xs font-bold text-amber-300 max-w-sm leading-relaxed">{diag}</p>
        <button
          onClick={() => {
            setCameraSnapshotKey(Date.now());
            void check();
          }}
          disabled={checking}
          className="px-3 py-1.5 rounded-lg border border-white/20 text-[11px] font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
          <span>Erneut prüfen</span>
        </button>
      </div>
    ) : null;

  const liveBadge = (
    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/65 text-white font-extrabold text-[10px] flex items-center gap-1.5 pointer-events-none">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      LIVE
    </span>
  );

  const btn = 'h-9 px-3 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer hover:bg-white/10';

  return (
    <div className="p-3 sm:p-4 border-b space-y-3 transition-all animate-fadeIn" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
      <div className="flex items-center gap-2 min-w-0">
        <Camera className="w-4 h-4 text-[#00AE42] shrink-0" />
        <span className="font-extrabold text-sm truncate" style={{ color: 'var(--app-text)' }}>
          Live Kamera
        </span>
      </div>

      {/* Kamera-Bild: keine Texte über dem Bild, nur LIVE und der Vollbild-Knopf */}
      <div className="relative rounded-2xl overflow-hidden border border-black/40 shadow-xl bg-black aspect-video">
        {isSocketOff ? (
          offline
        ) : (
          <>
            {image('cover')}
            {diagBox}
            {liveBadge}
            <button
              onClick={() => setBig(true)}
              className="absolute bottom-2 right-2 w-9 h-9 rounded-xl bg-black/65 text-white flex items-center justify-center cursor-pointer hover:bg-black/85 transition"
              title="Groß anzeigen"
              aria-label="Kamera groß anzeigen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Knöpfe in eigener Zeile, 3 gleich breite Spalten */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setCameraSnapshotKey(Date.now())} className={btn} style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }} title="Kamerabild jetzt neu abrufen">
          <RefreshCw className="w-3.5 h-3.5 text-[#00AE42]" />
          <span>Neu laden</span>
        </button>
        <button
          onClick={handleToggleLight}
          className={`${btn} ${isLightOn ? 'bg-amber-500/25 border-amber-500/50 text-amber-300' : ''}`}
          style={{ borderColor: isLightOn ? undefined : 'var(--app-border)', color: isLightOn ? undefined : 'var(--app-text)' }}
        >
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
          <span>{isLightOn ? 'Licht aus' : 'Licht an'}</span>
        </button>
        <button onClick={() => setBig(true)} disabled={isSocketOff} className={`${btn} disabled:opacity-40`} style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
          <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
          <span>Groß</span>
        </button>
      </div>

      {/* Vollbild */}
      {big &&
        createPortal(
          <div className="fixed inset-0 z-[1000] bg-black flex flex-col" onClick={() => setBig(false)}>
            <div className="relative flex-1 min-h-0" onClick={e => e.stopPropagation()}>
              {image('contain')}
              {liveBadge}
            </div>
            <div className="flex items-center justify-center gap-3 p-3 pb-6 bg-black" onClick={e => e.stopPropagation()}>
              <button onClick={handleToggleLight} className="h-11 px-5 rounded-xl bg-white/10 text-white font-bold text-sm flex items-center gap-2 cursor-pointer">
                <Lightbulb className={`w-4 h-4 ${isLightOn ? 'text-amber-300' : 'text-white/70'}`} />
                {isLightOn ? 'Licht aus' : 'Licht an'}
              </button>
              <button onClick={() => setBig(false)} className="h-11 px-5 rounded-xl bg-white text-black font-bold text-sm flex items-center gap-2 cursor-pointer">
                <X className="w-4 h-4" />
                Schließen
              </button>
            </div>
          </div>,
          document.body
        )}

          {/* LAN-STECKDOSE STATUS & SCHALTER DIREKT UNTER DER KAMERA */}
          <div
            className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2.5"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)'
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                  haSwitchState.state === 'on'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                }`}
              >
                <Plug className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                    LAN-Steckdose ({haCreds.switchEntity}):
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      haSwitchState.state === 'on'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    }`}
                  >
                    {haSwitchState.state === 'on' ? '🟢 EINGESCHALTET (STROM AN)' : '🔴 AUSGESCHALTET (STROM AUS)'}
                  </span>
                  {haSwitchState.power && (
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/30">
                      ⚡ {haSwitchState.power} W
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  Home Assistant ({haCreds.url})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSwitch}
                disabled={haSwitchLoading}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50 ${
                  haSwitchState.state === 'on'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {haSwitchLoading ? 'Schaltet...' : haSwitchState.state === 'on' ? 'Steckdose Ausschalten' : 'Steckdose Einschalten'}
                </span>
              </button>
            </div>
          </div>
        </div>
  );
};
