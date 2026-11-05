import { useEffect } from 'react';
import { IS_NATIVE } from '../utils/env';
import { setKeepAlive } from '../utils/notify';
import { isPrinterConfigured } from '../utils/printerLive';
import { useWorkshopSettings } from '../utils/workshopSettings';
import { hubPushActive } from '../utils/serverDeducts';

/** Android-App: Hintergrund-Dienst läuft, solange ein Drucker eingerichtet ist und der Schalter in den Mitteilungs-Einstellungen an ist (nicht, wenn der Pi die Meldungen schickt). */
export function useKeepAlive(): void {
  const [settings] = useWorkshopSettings();
  const anyAlert = settings.alertErrors || settings.alertHumidity || settings.alertPrintStart || settings.alertPrintDone || settings.alertPrintFail || settings.alertDryDone || settings.alertDryStop;
  // 1.209: Schickt der Pi die Meldungen aufs Handy, braucht es die dauerhafte Anzeige „Bleibt für Meldungen mit dem Drucker verbunden“ nicht
  const want = settings.keepAlive && anyAlert && settings.systemPush && !hubPushActive();
  useEffect(() => {
    if (!IS_NATIVE) return;
    const apply = () => void setKeepAlive(want && isPrinterConfigured());
    apply();
    // Drucker kann erst später eingerichtet werden: beim Zurückkehren in die App erneut prüfen
    const onVisible = () => {
      if (document.visibilityState === 'visible') apply();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [want]);
}
