import React, { useState, useEffect } from 'react';
import { printerApi } from '../api';
import { useEscapeClose } from '../hooks/useEscapeClose';
import {
  X,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  Sparkles,
  Lock,
  Mail,
  Zap,
  Info,
  ArrowRight,
  BookOpen,
  Wifi
} from 'lucide-react';
import { safeStorage } from '../utils/safeStorage';
import { IS_STATIC, IS_NATIVE } from '../utils/env';
import { bambuLogin, resolveBambuUserId, type BambuLoginInput, type BambuLoginResult } from '../utils/bambuCloudLogin';
import { ThreeDPrinterIcon } from './ThreeDPrinterIcon';

interface BambuSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const BambuSettingsModal: React.FC<BambuSettingsModalProps> = ({
  isOpen,
  onClose,
  onConnected
}) => {
  // Standard-Tab: Direkt das Token- & MQTTS-Formular
  const [activeTab, setActiveTab] = useState<'lan' | 'token' | 'guide' | 'login'>(() =>
    safeStorage.getItem('bambu_lan_mode') === '1' ? 'lan' : 'token'
  );

  // Felder für Token-Verbindung
  const [serialNumber, setSerialNumber] = useState(() => {
    return safeStorage.getItem('bambu_serial_number') || '';
  });
  const [userId, setUserId] = useState(() => {
    return safeStorage.getItem('bambu_user_id') || '';
  });
  const [accessToken, setAccessToken] = useState(() => {
    return safeStorage.getItem('bambu_access_token') || '';
  });
  const [brokerHost, setBrokerHost] = useState(() => {
    const saved = safeStorage.getItem('bambu_broker_host');
    return (saved === 'eu.mqtt.bambulab.com' || !saved) ? 'us.mqtt.bambulab.com' : saved;
  });
  const [adminPin, setAdminPin] = useState(() => {
    return safeStorage.getItem('bambu_admin_pin') || '1234';
  });

  // Felder für den LAN-Modus (direkt zum Drucker, ohne Cloud)
  const [lanIp, setLanIp] = useState(() => safeStorage.getItem('bambu_lan_ip') || '');
  const [lanCode, setLanCode] = useState(() => safeStorage.getItem('bambu_lan_code') || '');

  // Felder für Login-Tab
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [login2FACode, setLogin2FACode] = useState('');
  // Schritt: Zugangsdaten, Code aus der Bestätigungs-E-Mail oder Code der Authenticator-App
  const [loginStep, setLoginStep] = useState<'credentials' | 'code' | 'tfa'>('credentials');
  const [tfaKey, setTfaKey] = useState('');

  // Status & Lade-Zustände
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExtractingUid, setIsExtractingUid] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // ESC schließt nur dieses Fenster (eine Ebene)
  useEscapeClose(onClose, isOpen);

  if (!isOpen) return null;

  // 1. User ID automatisch aus Token auslesen
  const handleExtractUserId = async () => {
    if (!accessToken.trim()) {
      setFeedback({ type: 'error', message: 'Bitte zuerst das Bambu Cloud Access Token (JWT) einfügen.' });
      return;
    }
    setIsExtractingUid(true);
    setFeedback(null);

    try {
      // In der App ohne Server direkt bei Bambu nachfragen
      const data: any = IS_STATIC
        ? await resolveBambuUserId(accessToken.trim()).then(uid =>
            uid ? { success: true, userId: uid } : { success: false, error: 'User-ID konnte nicht ausgelesen werden.' }
          )
        : (await printerApi.extractUser(accessToken.trim(), userId.trim())).data;
      if (data.success && data.userId) {
        setUserId(data.userId);
        safeStorage.setItem('bambu_user_id', data.userId);
        setFeedback({
          type: 'success',
          message: `User-ID erfolgreich erkannt: ${data.userId} (Präfix u_${data.userId} wird für MQTTS automatisch verwendet).`
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'User-ID konnte nicht automatisch ausgelesen werden. Bitte manuell eingeben (siehe Guide-Tab).'
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Verbindungsfehler beim Extrahieren der User ID.'
      });
    } finally {
      setIsExtractingUid(false);
    }
  };

  // 1b. 1-Klick Auto-Erkennung aus Token (sucht Drucker & verbindet sofort)
  const handleAutoDetect = async (tokenOverride?: string) => {
    const token = (typeof tokenOverride === 'string' ? tokenOverride : accessToken).trim();
    if (!token) {
      setFeedback({ type: 'error', message: 'Bitte zuerst das Bambu Cloud Token oder Cookie einfügen.' });
      return;
    }
    setIsConnecting(true);
    setFeedback(typeof tokenOverride === 'string' ? { type: 'info', message: 'Login ok. Suche deinen Drucker und verbinde …' } : null);

    try {
      const res = await printerApi.autoConnect(token);
      const data = res.data;
      // Drucker gefunden: Seriennummer merken, auch wenn die Live-Verbindung (noch) nicht klappt
      if (data.device?.dev_id) {
        setSerialNumber(data.device.dev_id);
        safeStorage.setItem('bambu_serial_number', data.device.dev_id);
        safeStorage.setItem('bambu_access_token', token);
      }
      if (data.success && data.device) {
        setSerialNumber(data.device.dev_id);
        if (data.userId) {
          setUserId(String(data.userId));
          safeStorage.setItem('bambu_user_id', String(data.userId));
        }
        safeStorage.setItem('bambu_broker_host', 'us.mqtt.bambulab.com');
        safeStorage.setItem('bambu_lan_mode', '0');
        setBrokerHost('us.mqtt.bambulab.com');

        setFeedback({
          type: 'success',
          message: data.message || `Drucker ${data.device.name || data.device.dev_id} erfolgreich gekoppelt! Live-Telemetrie aktiv.`
        });
        if (onConnected) onConnected();
        setTimeout(() => {
          onClose();
        }, 1400);
      } else {
        setFeedback({
          type: 'error',
          message: data.error || data.message || 'Auto-Erkennung fehlgeschlagen. Bitte Token überprüfen.'
        });
        if (onConnected) onConnected();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Verbindungsfehler: ' + (err?.message || err)
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // 2. Mit Bambu Cloud MQTTS verbinden
  const handleConnect = async () => {
    if (!serialNumber.trim()) {
      setFeedback({ type: 'error', message: 'Bitte die Drucker-Seriennummer (SN) eingeben.' });
      return;
    }
    if (!accessToken.trim()) {
      setFeedback({ type: 'error', message: 'Bitte das Bambu Cloud Access Token eingeben.' });
      return;
    }

    const cleanHost = (brokerHost === 'eu.mqtt.bambulab.com' || !brokerHost.trim()) ? 'us.mqtt.bambulab.com' : brokerHost.trim();

    setIsConnecting(true);
    setFeedback(null);

    try {
      const res = await printerApi.connect({
        serialNumber: serialNumber.trim(),
        userId: userId.trim(),
        accessToken: accessToken.trim(),
        brokerHost: cleanHost,
        adminPin: adminPin.trim() || '1234'
      });
      const data = res.data;

      if (data.success) {
        safeStorage.setItem('bambu_serial_number', serialNumber.trim());
        if (data.status?.userId) {
          setUserId(data.status.userId);
          safeStorage.setItem('bambu_user_id', data.status.userId);
        }
        safeStorage.setItem('bambu_access_token', accessToken.trim());
        safeStorage.setItem('bambu_lan_mode', '0');
        safeStorage.setItem('bambu_broker_host', brokerHost.trim());
        safeStorage.setItem('bambu_admin_pin', adminPin.trim() || '1234');

        setFeedback({
          type: 'success',
          message: data.message || 'MQTTS-Verbindung zu Bambu Cloud hergestellt!'
        });

        if (onConnected) onConnected();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setFeedback({
          type: 'error',
          message: data.error || data.message || 'Verbindung fehlgeschlagen. Bitte Seriennummer und Token überprüfen.'
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Netzwerkfehler: Backend-Endpunkt /api/printer/connect nicht erreichbar.'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // 2b. LAN-Modus: direkt mit dem Drucker verbinden (Heimnetz oder Tailscale), ohne Bambu Cloud
  const handleConnectLan = async () => {
    if (!serialNumber.trim()) {
      setFeedback({ type: 'error', message: 'Bitte die Drucker-Seriennummer (SN) eingeben.' });
      return;
    }
    if (!lanIp.trim()) {
      setFeedback({ type: 'error', message: 'Bitte die IP-Adresse des Druckers eingeben (am Drucker unter Einstellungen → Nur LAN).' });
      return;
    }
    if (!lanCode.trim()) {
      setFeedback({ type: 'error', message: 'Bitte den Zugangscode eingeben (am Drucker unter Einstellungen → Nur LAN).' });
      return;
    }
    setIsConnecting(true);
    setFeedback(null);
    try {
      const res = await printerApi.connectLan({
        serialNumber: serialNumber.trim(),
        lanIp: lanIp.trim(),
        lanCode: lanCode.trim(),
        adminPin: adminPin.trim() || '1234'
      });
      const data = res.data;
      if (data.success) {
        safeStorage.setItem('bambu_serial_number', serialNumber.trim());
        safeStorage.setItem('bambu_lan_ip', lanIp.trim());
        safeStorage.setItem('bambu_lan_code', lanCode.trim());
        safeStorage.setItem('bambu_lan_mode', '1');
        setFeedback({ type: 'success', message: data.message || 'Direkt mit dem Drucker verbunden!' });
        if (onConnected) onConnected();
        setTimeout(() => onClose(), 1200);
      } else {
        setFeedback({
          type: 'error',
          message: data.error || data.message || 'LAN-Verbindung fehlgeschlagen. IP, Zugangscode und WLAN prüfen.'
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Netzwerkfehler: LAN-Verbindung konnte nicht aufgebaut werden.' });
    } finally {
      setIsConnecting(false);
    }
  };

  // 3. Login über Bambu Cloud API
  // In der App (ohne Server) fragt die App direkt bei Bambu an, sonst läuft es über den lokalen Server.
  const runLogin = async (input: BambuLoginInput): Promise<BambuLoginResult> => {
    if (IS_STATIC) return bambuLogin(input);
    const res = await printerApi.login(input);
    const data: any = res.data;
    if (data && typeof data.status === 'string') return data as BambuLoginResult;
    return { status: 'error', message: data?.message || data?.error || 'Login-Dienst nicht erreichbar.' };
  };

  const handleBambuLogin = async (e: React.FormEvent, resend = false) => {
    e.preventDefault();
    if (!loginEmail.trim() || (!loginPassword && loginStep === 'credentials')) {
      setFeedback({ type: 'error', message: 'Bitte E-Mail und Passwort eingeben.' });
      return;
    }
    if (!resend && loginStep !== 'credentials' && login2FACode.trim().length < 6) {
      setFeedback({ type: 'error', message: 'Bitte den 6-stelligen Code eingeben.' });
      return;
    }

    setIsLoggingIn(true);
    setFeedback(null);

    try {
      const result = await runLogin({
        email: loginEmail.trim(),
        password: loginPassword,
        code: loginStep === 'code' && !resend ? login2FACode.trim() : undefined,
        tfaKey: loginStep === 'tfa' ? tfaKey : undefined,
        tfaCode: loginStep === 'tfa' ? login2FACode.trim() : undefined,
        resend
      });

      if (result.status === 'needCode') {
        setLoginStep('code');
        setLogin2FACode('');
        setFeedback({ type: 'info', message: result.message });
      } else if (result.status === 'needTfa') {
        setLoginStep('tfa');
        setTfaKey(result.tfaKey);
        setLogin2FACode('');
        setFeedback({ type: 'info', message: result.message });
      } else if (result.status === 'ok') {
        setAccessToken(result.accessToken);
        safeStorage.setItem('bambu_access_token', result.accessToken);
        if (result.userId) {
          setUserId(result.userId);
          safeStorage.setItem('bambu_user_id', result.userId);
        }
        setLoginPassword('');
        setLogin2FACode('');
        setLoginStep('credentials');
        setTfaKey('');
        setActiveTab('token');
        // Direkt weiter: Drucker im Konto suchen und verbinden (vorher musste man noch extra tippen)
        await handleAutoDetect(result.accessToken);
      } else {
        setFeedback({ type: 'error', message: result.message });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Fehler bei der Verbindung zum Bambu Login-Dienst.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 4. Demo-Modus aktivieren
  const handleActivateDemo = async () => {
    try {
      await printerApi.demo();
      setFeedback({
        type: 'success',
        message: 'Demo-Telemetrie aktiv! Dashboard zeigt realistische X2D Druckdaten.'
      });
      if (onConnected) onConnected();
      setTimeout(() => onClose(), 800);
    } catch {
      setFeedback({ type: 'error', message: 'Konnte Demo-Modus nicht aktivieren.' });
    }
  };

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl border p-4 sm:p-5 shadow-2xl space-y-4 my-6 transition-colors max-h-[92vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)'
        }}
      >
        {/* Header mit echtem 3D-Drucker Icon */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--app-accent)] flex items-center justify-center shadow-lg shrink-0 text-white">
              <ThreeDPrinterIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
                <span>Bambu Lab X2D Verbindung</span>
                <span className="text-[10px] font-mono-num font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  MQTTS :8883
                </span>
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Live-Telemetrie, Dual-Extruder & Steuerung per MQTT (Cloud oder LAN)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:opacity-80 transition cursor-pointer"
            style={{ color: 'var(--app-text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab-Navigation: 4 übersichtliche Tabs */}
        <div
          className="grid grid-cols-4 gap-1 p-1 rounded-xl border text-[11px] font-bold transition-colors"
          style={{
            backgroundColor: 'var(--app-card-sub)',
            borderColor: 'var(--app-border)'
          }}
        >
          <button
            onClick={() => setActiveTab('lan')}
            className={`py-2 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 truncate ${
              activeTab === 'lan' ? 'shadow-sm text-white' : 'hover:opacity-80'
            }`}
            style={{
              backgroundColor: activeTab === 'lan' ? 'var(--app-accent)' : 'transparent',
              color: activeTab === 'lan' ? '#ffffff' : 'var(--app-text-muted)'
            }}
          >
            <Wifi className="w-3.5 h-3.5 shrink-0" />
            <span>LAN</span>
          </button>

          <button
            onClick={() => setActiveTab('token')}
            className={`py-2 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 truncate ${
              activeTab === 'token' ? 'shadow-sm text-white' : 'hover:opacity-80'
            }`}
            style={{
              backgroundColor: activeTab === 'token' ? 'var(--app-accent)' : 'transparent',
              color: activeTab === 'token' ? '#ffffff' : 'var(--app-text-muted)'
            }}
          >
            <Key className="w-3.5 h-3.5 shrink-0" />
            <span>Cloud</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`py-2 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 truncate ${
              activeTab === 'guide' ? 'shadow-sm text-white' : 'hover:opacity-80'
            }`}
            style={{
              backgroundColor: activeTab === 'guide' ? 'var(--app-accent)' : 'transparent',
              color: activeTab === 'guide' ? '#ffffff' : 'var(--app-text-muted)'
            }}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Hilfe</span>
          </button>

          <button
            onClick={() => setActiveTab('login')}
            className={`py-2 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 truncate ${
              activeTab === 'login' ? 'shadow-sm text-white' : 'hover:opacity-80'
            }`}
            style={{
              backgroundColor: activeTab === 'login' ? 'var(--app-accent)' : 'transparent',
              color: activeTab === 'login' ? '#ffffff' : 'var(--app-text-muted)'
            }}
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span>E-Mail</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : feedback.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            ) : (
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
            )}
            <span className="leading-relaxed">{feedback.message}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB LAN: DIREKT ZUM DRUCKER (HEIMNETZ ODER TAILSCALE), OHNE CLOUD  */}
        {/* ================================================================= */}
        {activeTab === 'lan' && (
          <div className="space-y-3.5 text-xs">
            <div
              className="p-3 rounded-xl border space-y-1.5 text-[11px] leading-relaxed"
              style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
            >
              <p className="font-bold" style={{ color: 'var(--app-text)' }}>So geht's:</p>
              <p>1. Am Drucker: Einstellungen → Nur LAN einschalten, auch Entwicklermodus (sonst lehnt der Drucker Slot-Befehle ab).</p>
              <p>2. IP-Adresse und Zugangscode von dort hier eintragen.</p>
              <p>3. Unterwegs: Tailscale am Handy an und der Raspberry Pi als Subnetz-Router. Dann klappt dieselbe IP von überall.</p>
              {!IS_NATIVE && (
                <p className="font-bold text-amber-400">Der LAN-Modus läuft in der Handy-App (APK) oder über den eigenen Server, nicht im Browser auf GitHub Pages.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="font-bold flex items-center justify-between" style={{ color: 'var(--app-text)' }}>
                <span className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-orange-400" />
                  <span>1. IP-Adresse des Druckers</span>
                </span>
                <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>z. B. 192.168.1.50</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="IP aus Einstellungen → Nur LAN"
                value={lanIp}
                onChange={e => setLanIp(e.target.value.trim())}
                className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num font-bold outline-none"
                style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                <Key className="w-3.5 h-3.5 text-orange-400" />
                <span>2. Zugangscode</span>
              </label>
              <input
                type="password"
                autoComplete="off"
                placeholder="8 Zeichen aus Einstellungen → Nur LAN"
                value={lanCode}
                onChange={e => setLanCode(e.target.value.trim())}
                className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num font-bold outline-none"
                style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                <Cpu className="w-3.5 h-3.5 text-orange-400" />
                <span>3. Seriennummer (SN)</span>
              </label>
              <input
                type="text"
                placeholder="Seriennummer deines Bambu Lab X2D"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value.toUpperCase().trim())}
                className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num font-bold outline-none uppercase"
                style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              />
              <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                Steht am Drucker unter <em>Einstellungen → Allgemein → Geräteinfo</em>. Wenn du schon mit der Cloud verbunden warst, ist sie schon eingetragen.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold flex items-center justify-between" style={{ color: 'var(--app-text)' }}>
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Admin-PIN (Stopp/Pause):</span>
                </span>
                <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>Standard: 1234</span>
              </label>
              <input
                type="password"
                maxLength={8}
                placeholder="1234"
                value={adminPin}
                onChange={e => setAdminPin(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num outline-none"
                style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleConnectLan}
                disabled={isConnecting}
                className="w-full py-2.5 px-4 rounded-xl text-white font-extrabold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--app-accent)' }}
              >
                {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>{isConnecting ? 'Verbinde direkt mit dem Drucker...' : 'Direkt mit dem Drucker verbinden'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: TOKEN & DATEN DIREKT EINGEBEN                              */}
        {/* ================================================================= */}
        {activeTab === 'token' && (
          <div className="space-y-3.5 text-xs">
            {/* 1. Printer Serial Number */}
            <div className="space-y-1">
              <label className="font-bold flex items-center justify-between" style={{ color: 'var(--app-text)' }}>
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-orange-400" />
                  <span>1. Drucker-Seriennummer (SN)</span>
                </span>
                <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  z. B. 03900A381900123
                </span>
              </label>
              <input
                type="text"
                placeholder="Seriennummer deines Bambu Lab X2D"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value.toUpperCase().trim())}
                className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num font-bold outline-none uppercase"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
              <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                Steht auf dem Drucker-Display unter <em>Einstellungen → Allgemein → Geräteinfo</em> oder in der Bambu Handy App.
              </p>
            </div>

            {/* 2. Bambu Cloud User ID mit Auto-Extract */}
            <div className="space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="font-bold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                  <Shield className="w-3.5 h-3.5 text-orange-400" />
                  <span>2. Bambu Cloud User ID (numerische UID)</span>
                </label>
                <button
                  type="button"
                  onClick={handleExtractUserId}
                  disabled={isExtractingUid || !accessToken.trim()}
                  className="text-[10px] font-bold text-orange-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  title="Liest deine numerische User-ID direkt aus dem Token aus"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{isExtractingUid ? 'Ermittle...' : 'User ID automatisch ermitteln'}</span>
                </button>
              </div>
              <input
                type="text"
                placeholder="Numerische UID (z.B. 123456789) - Präfix u_ wird automatisch gesetzt"
                value={userId}
                onChange={e => setUserId(e.target.value.trim().replace(/^u_/, ''))}
                className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
              <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                Deine Bambu Kundennummer (in Bambu Handy unter <em>Profil → Kontoname</em>).
              </p>
            </div>

            {/* 3. Bambu Cloud Access Token */}
            <div className="space-y-1">
              <label className="font-bold flex items-center justify-between" style={{ color: 'var(--app-text)' }}>
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-orange-400" />
                  <span>3. Bambu Cloud Access Token / Browser-Cookie</span>
                </span>
                <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  AQBl... oder eyJ...
                </span>
              </label>
              <textarea
                rows={2}
                placeholder="Füge hier deinen Token (beginnend mit AQBl... oder eyJ...) ein"
                value={accessToken}
                onChange={e => setAccessToken(e.target.value.trim())}
                className="w-full px-3 py-2 rounded-xl border text-[11px] font-mono-num outline-none resize-none leading-relaxed"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                  Funktioniert direkt mit dem Cookie <code className="font-mono">token</code> (z.B. aus Firefox DevTools) oder Bambu Studio.
                </p>
                <button
                  type="button"
                  onClick={() => handleAutoDetect()}
                  disabled={isConnecting || !accessToken.trim()}
                  className="px-3 py-1.5 rounded-lg border font-bold text-xs text-emerald-400 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>1-Klick: Drucker suchen & live verbinden</span>
                </button>
              </div>
            </div>

            {/* 4. Broker-Host & Admin-PIN (2 Spalten) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                  Broker-Host (Port 8883 MQTTS):
                </label>
                <select
                  value={brokerHost}
                  onChange={e => setBrokerHost(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num outline-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                >
                  <option value="us.mqtt.bambulab.com">us.mqtt.bambulab.com (Weltweit, Europa & DE - Standard)</option>
                  <option value="cn.mqtt.bambulab.com">cn.mqtt.bambulab.com (Asien / China)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold flex items-center justify-between" style={{ color: 'var(--app-text)' }}>
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Admin-PIN (Stopp/Pause):</span>
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>Standard: 1234</span>
                </label>
                <input
                  type="password"
                  maxLength={8}
                  placeholder="1234"
                  value={adminPin}
                  onChange={e => setAdminPin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-mono-num outline-none"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              </div>
            </div>

            {/* Aktionen */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex-1 py-2.5 px-4 rounded-xl text-white font-extrabold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--app-accent)'
                }}
              >
                {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>{isConnecting ? 'Verbinde mit Bambu Cloud...' : 'Jetzt mit Bambu Cloud verbinden'}</span>
              </button>

              <button
                type="button"
                onClick={handleActivateDemo}
                className="py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 hover:opacity-80"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
                title="Aktiviert realistische Telemetrie für sofortigen Funktionstest"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Live-Demo</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: AUSFÜHRLICHER TOKEN & MQTT GUIDE                           */}
        {/* ================================================================= */}
        {activeTab === 'guide' && (
          <div className="space-y-3.5 text-xs leading-relaxed" style={{ color: 'var(--app-text)' }}>
            <div
              className="p-3.5 rounded-2xl border space-y-2"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              <h4 className="font-extrabold text-sm flex items-center gap-2" style={{ color: 'var(--app-accent-text)' }}>
                <BookOpen className="w-4 h-4" />
                <span>Was brauche ich und wo finde ich es?</span>
              </h4>
              <p className="text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
                Bambu Lab kommuniziert über gesichertes MQTT (Port 8883 mit TLS). Du benötigst genau drei Datenpunkte für deine Verbindung:
              </p>
            </div>

            <div className="space-y-3">
              {/* 1. Seriennummer */}
              <div
                className="p-3 rounded-2xl border space-y-1.5"
                style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg text-white font-extrabold flex items-center justify-center text-xs" style={{ backgroundColor: 'var(--app-accent)' }}>
                    1
                  </span>
                  <strong className="text-xs" style={{ color: 'var(--app-text)' }}>
                    Drucker-Seriennummer (SN)
                  </strong>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  <strong>Wo finde ich sie?</strong>
                  <br />• <strong>Am Drucker-Touchscreen:</strong> Tippe auf das Zahnrad <em>(Einstellungen) → Allgemein → Geräteinformationen</em>.
                  <br />• <strong>In der Bambu Handy App:</strong> Wähle deinen Drucker aus → tippe oben rechts auf die 3 Punkte → <em>Geräteinfo</em>.
                  <br />• <strong>Aufkleber:</strong> Befindet sich auf der Rückseite des Druckers.
                  <br />(Format beginnt meist mit <code className="font-mono text-orange-400">0390...</code> oder <code className="font-mono text-orange-400">01P0...</code>).
                </p>
              </div>

              {/* 2. User ID */}
              <div
                className="p-3 rounded-2xl border space-y-1.5"
                style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg text-white font-extrabold flex items-center justify-center text-xs" style={{ backgroundColor: 'var(--app-accent)' }}>
                    2
                  </span>
                  <strong className="text-xs" style={{ color: 'var(--app-text)' }}>
                    Bambu Cloud User ID (numerische UID)
                  </strong>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  <strong>Was ist das?</strong> Deine persönliche Kunden-ID bei Bambu Lab (eine reine Zahl wie z.B. <code className="font-mono">123456789</code>).
                  <br /><strong>Wo finde ich sie?</strong>
                  <br />• <strong>Bambu Handy App:</strong> Tippe unten auf <em>„Mein Profil“</em> → klicke ganz oben auf dein Profilbild/Namen. Dort steht deine <strong>Benutzer-ID</strong>.
                  <br />• <strong>Noch einfacher:</strong> Wenn du dein Access Token im 1. Tab einfügst, klicke einfach auf <em>„User ID automatisch ermitteln“</em> – die App dekodiert sie direkt für dich!
                </p>
              </div>

              {/* 3. Bambu Cloud Access Token */}
              <div
                className="p-3 rounded-2xl border space-y-1.5"
                style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg text-white font-extrabold flex items-center justify-center text-xs" style={{ backgroundColor: 'var(--app-accent)' }}>
                    3
                  </span>
                  <strong className="text-xs" style={{ color: 'var(--app-text)' }}>
                    Bambu Cloud Access Token (JWT)
                  </strong>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  <strong>Was ist das?</strong> Der verschlüsselte Authentifizierungsschlüssel, den Bambu Studio und die App für den sicheren MQTT-Stream nutzen. Er beginnt typischerweise mit <code className="font-mono text-orange-400">eyJhbGciOi...</code>.
                  <br /><strong>Wie bekomme ich ihn am schnellsten?</strong>
                  <br />• <strong>Option A (Empfohlen):</strong> Nutze den 3. Tab <em>„E-Mail Login“</em> hier im Fenster. Gib deine Bambu-Zugangsdaten ein, und die Cloud generiert das Token automatisch.
                  <br />• <strong>Option B (Aus Bambu Studio Datei):</strong> Öffne den Windows-Explorer und navigiere zu <code className="font-mono">%APPDATA%\BambuStudio</code>. Öffne die Datei <code className="font-mono">bambu_network.json</code> oder <code className="font-mono">bambustudio.conf</code> im Windows Editor (Notepad). Kopiere den langen Text hinter <code className="font-mono">access_token</code> heraus.
                </p>
              </div>

              {/* 4. Broker & Port */}
              <div
                className="p-3 rounded-2xl border space-y-1.5"
                style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg text-white font-extrabold flex items-center justify-center text-xs" style={{ backgroundColor: 'var(--app-accent)' }}>
                    4
                  </span>
                  <strong className="text-xs" style={{ color: 'var(--app-text)' }}>
                    Broker-Host & Port 8883
                  </strong>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Bambu Cloud MQTT benötigt SSL-Verschlüsselung über Port 8883.
                  <br />• Für europäische Accounts: <code className="font-mono text-orange-400">eu.mqtt.bambulab.com</code>
                  <br />• Für globale Accounts: <code className="font-mono text-orange-400">us.mqtt.bambulab.com</code>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('token')}
              className="w-full py-2.5 px-4 rounded-xl text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--app-accent)' }}
            >
              <span>Jetzt Daten im Token-Tab eingeben</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: BAMBU CLOUD LOGIN (E-Mail + Passwort + 2FA)                */}
        {/* ================================================================= */}
        {activeTab === 'login' && (
          <form onSubmit={handleBambuLogin} className="space-y-3 text-xs">
            <div
              className="p-3 rounded-xl border space-y-1"
              style={{
                backgroundColor: 'var(--app-card-sub)',
                borderColor: 'var(--app-border)'
              }}
            >
              <span className="font-bold block" style={{ color: 'var(--app-text)' }}>
                Direkter Login über Bambu Cloud API
              </span>
              <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Logge dich mit deinen Bambu Lab Kontodaten ein. Das System ruft dein Cloud-Token und deine User-ID automatisch ab.
              </p>
            </div>

            <div className="space-y-1">
              <label className="font-bold block" style={{ color: 'var(--app-text)' }}>
                Bambu Lab E-Mail-Adresse:
              </label>
              <input
                type="email"
                placeholder="deine-email@beispiel.de"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold block" style={{ color: 'var(--app-text)' }}>
                Bambu Lab Passwort:
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-xs outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
            </div>

            {/* Code-Eingabe (E-Mail-Code oder Authenticator-App), wenn Bambu ihn verlangt */}
            {loginStep !== 'credentials' && (
              <div
                className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1.5"
              >
                <label className="font-bold block text-amber-400">
                  {loginStep === 'tfa' ? '6-stelliger Code deiner Authenticator-App:' : '6-stelliger Code aus der Bestätigungs-E-Mail:'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={login2FACode}
                  onChange={e => setLogin2FACode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 rounded-xl border border-amber-500/40 text-sm font-mono-num font-bold text-center outline-none bg-black/40 text-amber-300"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-amber-400 block">
                    {loginStep === 'tfa'
                      ? 'Den Code findest du in deiner Authenticator-App.'
                      : 'Schau auch im Spam-Ordner nach der Mail von Bambu Lab.'}
                  </span>
                  {loginStep === 'code' && (
                    <button
                      type="button"
                      disabled={isLoggingIn}
                      onClick={e => handleBambuLogin(e as unknown as React.FormEvent, true)}
                      className="text-[10px] font-bold underline text-amber-300 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      Code erneut senden
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 rounded-xl text-white font-extrabold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: 'var(--app-accent)' }}
            >
              {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              <span>{isLoggingIn ? 'Logge ein...' : loginStep !== 'credentials' ? 'Mit Code bestätigen' : 'Token jetzt abrufen'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
