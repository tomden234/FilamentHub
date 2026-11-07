import { useState, useEffect } from 'react';
import { type HaCredentials, getHaCredentials, fetchHaSwitchStatus, toggleHaSwitch } from '../../utils/haClient';
import { addSystemLog } from '../../utils/logService';

interface useHaSwitchParams {
  setActionToast: any;
}

export function useHaSwitch({ setActionToast }: useHaSwitchParams) {
  const [haCreds, setHaCreds] = useState<HaCredentials>(getHaCredentials);

  const [haSwitchState, setHaSwitchState] = useState<{
    configured: boolean;
    state: 'on' | 'off' | 'unknown' | 'error';
    power?: number | null;
    friendly_name?: string;
  }>({ configured: true, state: 'unknown' }); // 'unknown' bis zur ersten Abfrage (sonst gilt der Drucker kurz als stromlos)

  const [haSwitchLoading, setHaSwitchLoading] = useState<boolean>(false);

  const [haCameraBlobUrl, setHaCameraBlobUrl] = useState<string | null>(null);

  const handleFetchSwitchStatus = async () => {
    try {
      const res = await fetchHaSwitchStatus();
      setHaSwitchState(res);
    } catch {}
  };

  useEffect(() => {
    setHaCreds(getHaCredentials());
    handleFetchSwitchStatus();
    const interval = setInterval(handleFetchSwitchStatus, 7000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSwitch = async () => {
    setHaSwitchLoading(true);
    try {
      const nextState = haSwitchState.state === 'on' ? 'off' : 'on';
      const result = await toggleHaSwitch(nextState);
      if (result.success) {
        setActionToast({ text: result.message, ok: true });
        setHaSwitchState(prev => ({ ...prev, state: nextState }));
        addSystemLog(
          'steckdose',
          `LAN-Steckdose ${nextState === 'on' ? 'eingeschaltet (Strom AN)' : 'ausgeschaltet (Strom AUS)'}`,
          `Home Assistant: ${haCreds.switchEntity}${haSwitchState.power ? ` • ${haSwitchState.power} W` : ''}`,
          nextState === 'on' ? 'success' : 'warn'
        );
        setTimeout(handleFetchSwitchStatus, 700);
      } else {
        setActionToast({ text: result.message || 'Fehler beim Schalten der Steckdose.', ok: false });
        addSystemLog('steckdose', `Fehler beim Schalten der Steckdose: ${result.message}`, haCreds.switchEntity, 'error');
      }
    } catch (err: any) {
      setActionToast({ text: 'Verbindungsfehler zu Home Assistant: ' + (err?.message || err), ok: false });
      addSystemLog('steckdose', 'Verbindungsfehler zu Home Assistant', haCreds.url, 'error');
    } finally {
      setHaSwitchLoading(false);
    }
  };

  return { setHaCameraBlobUrl, haCreds, haSwitchState, handleToggleSwitch, haSwitchLoading, handleFetchSwitchStatus, haCameraBlobUrl };
}
