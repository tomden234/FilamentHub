// 1.234: npoint ist abgeschaltet. Steht auf diesem Gerät noch die alte npoint-Adresse, zieht die App die Daten beim Start
// von selbst auf den Pi um (wenn der Pi eingetragen ist). Sonst bleiben die Daten auf dem Gerät und ein Hinweis erscheint einmal.
import { useEffect, useRef } from 'react';
import { getLegacyNpoint } from '../utils/legacyNpoint';
import { moveDataToPi } from '../utils/moveToPi';
import { PI_URL } from '../utils/piDoc';
import { serverBase } from '../utils/serverEndpoint';
import { pushHubConfig } from '../utils/recorderServer';
import { safeStorage } from '../utils/safeStorage';

const HINT_KEY = 'filamenthub_npoint_hint_shown';

export function useLegacyNpointMove(cloudDbUrl: string, onMoved: (url: string) => void, showToast: (msg: string) => void) {
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || cloudDbUrl || !getLegacyNpoint()) return;
    tried.current = true;
    const hint = () => {
      if (safeStorage.getItem(HINT_KEY)) return;
      safeStorage.setItem(HINT_KEY, '1');
      showToast('npoint ist abgeschaltet. Deine Daten bleiben auf diesem Gerät. Zum Übernehmen: Menü → Verbindungen → Auf Pi-Server umstellen.');
    };
    if (serverBase() === null) return hint();
    void (async () => {
      try {
        const r = await moveDataToPi('', false);
        if (!r.ok) return hint();
        if (!r.wrote && !r.piHadSpools) return; // nichts zu übernehmen
        onMoved(PI_URL);
        void pushHubConfig(true).catch(() => undefined);
        showToast(r.piHadSpools ? 'npoint ist abgeschaltet. Auf dem Pi lagen schon Daten, die bleiben erhalten.' : 'npoint ist abgeschaltet. Deine Daten liegen jetzt auf dem Pi.');
      } catch {
        hint();
      }
    })();
  }, [cloudDbUrl, onMoved, showToast]);
}
