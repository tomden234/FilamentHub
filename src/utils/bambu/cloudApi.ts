// Bambu-Cloud-HTTP-Schnittstelle (Token-Prüfung, Profil, gebundene Drucker, Config-Import). Ohne Zustand und ohne Node-Abhängigkeiten,
// damit sie im Server und in der Android-App gleich läuft.
import { resolveBambuUserId } from '../bambuCloudLogin';

/**
 * Prüft den Token gegen die Bambu Cloud API.
 * 'valid' = akzeptiert, 'invalid' = abgelehnt (401/403), 'unknown' = Cloud nicht erreichbar (dann trotzdem versuchen)
 */
export async function checkToken(token: string): Promise<'valid' | 'invalid' | 'unknown'> {
  try {
    const res = await fetch('https://api.bambulab.com/v1/user-service/my/profile', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'BambuStudio/01.09.05.51' },
      signal: AbortSignal.timeout(6000)
    });
    if (res.status === 401 || res.status === 403) return 'invalid';
    return res.ok ? 'valid' : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Extrahiert User-ID aus JWT Token oder Bambu API
 */
export async function resolveUserId(token: string, explicitUserId?: string): Promise<string | null> {
  if (explicitUserId && explicitUserId.trim()) {
    return explicitUserId.trim().replace(/^u_/, '');
  }
  if (!token) return null;
  return resolveBambuUserId(token);
}

/**
 * Ruft alle gebundenen Bambu-Drucker des Benutzers direkt über die Bambu Cloud API ab
 */
export async function getBoundDevices(token: string): Promise<{
  success: boolean;
  userId?: string;
  account?: string;
  devices?: Array<{
    dev_id: string;
    name: string;
    online: boolean;
    print_status: string;
    dev_product_name: string;
    dev_access_code: string;
  }>;
  error?: string;
}> {
  if (!token || !token.trim()) {
    return { success: false, error: 'Kein Token übergeben.' };
  }

  const cleanToken = token.trim();

  try {
    let userId: string | undefined;
    let account: string | undefined;

    // 1. Profil abrufen
    try {
      const profRes = await fetch('https://api.bambulab.com/v1/user-service/my/profile', {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'User-Agent': 'BambuStudio/01.09.05.51'
        }
      });
      if (profRes.ok) {
        const profJson = await profRes.json();
        userId = String(profJson.uid || profJson.userId || '');
        account = profJson.account || profJson.name;
      }
    } catch (e) {
      console.warn('Fehler beim Profilabruf:', e);
    }

    // 2. Drucker abrufen
    const devRes = await fetch('https://api.bambulab.com/v1/iot-service/api/user/bind', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'User-Agent': 'BambuStudio/01.09.05.51'
      }
    });

    if (!devRes.ok) {
      return {
        success: false,
        error: `Bambu API Fehler (HTTP ${devRes.status}). Bitte Token prüfen.`
      };
    }

    const devJson = await devRes.json();
    const devices = Array.isArray(devJson.devices)
      ? devJson.devices.map((d: any) => ({
          dev_id: d.dev_id,
          name: d.name || d.dev_product_name || 'Bambu Drucker',
          online: Boolean(d.online),
          print_status: d.print_status || 'UNKNOWN',
          dev_product_name: d.dev_product_name || 'Bambu Lab',
          dev_access_code: d.dev_access_code || ''
        }))
      : [];

    return {
      success: true,
      userId,
      account,
      devices
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Netzwerkfehler beim Abrufen der Druckerliste.'
    };
  }
}

/**
 * Konfigurationsdatei aus Bambu Studio (%APPDATA%\BambuStudio) parsen
 */
export function parseConfiguration(rawText: string): {
  success: boolean;
  accessToken?: string;
  userId?: string;
  serialNumber?: string;
  error?: string;
} {
  let foundToken = '';
  let foundUid = '';
  let foundSerial = '';

  // 1. JSON-Parsing (bambu_network.json)
  try {
    const json = JSON.parse(rawText);
    foundToken = json.access_token || json.token || json.user?.token || '';
    foundUid = json.user_id || json.uid || json.user?.uid || '';

    if (Array.isArray(json.devices) && json.devices.length > 0) {
      foundSerial = json.devices[0].dev_id || json.devices[0].serial || '';
    }
  } catch {
    // 2. INI / Text-Parsing (BambuStudio.conf)
    const tokenMatch = rawText.match(/access_token\s*[:=]\s*"?([^"\r\n]+)"?/);
    if (tokenMatch) foundToken = tokenMatch[1].trim();

    const uidMatch = rawText.match(/user_id\s*[:=]\s*"?([^"\r\n]+)"?/);
    if (uidMatch) foundUid = uidMatch[1].trim();

    const devMatch = rawText.match(/dev_id\s*[:=]\s*"?([^"\r\n]+)"?/);
    if (devMatch) foundSerial = devMatch[1].trim();
  }

  if (!foundToken && !foundUid && !foundSerial) {
    return {
      success: false,
      error: 'Keine Zugangsdaten in der Datei gefunden. Bitte sicherstellen, dass Bambu Studio auf dem PC eingeloggt ist.'
    };
  }

  return {
    success: true,
    accessToken: foundToken,
    userId: foundUid ? String(foundUid).replace(/^u_/, '') : undefined,
    serialNumber: foundSerial ? foundSerial.toUpperCase() : undefined
  };
}

export interface BambuTaskFilament {
  material: string;
  colorHex: string;
  grams: number;
  slot?: number;
}

export interface BambuTask {
  id: string;
  title: string;
  /** Auftragsname wie am Drucker (subtask_name), zum Abgleich mit der Druckliste */
  jobName?: string;
  status: number; // 2 = fertig, 3 = abgebrochen/fehlgeschlagen
  startTime: string;
  endTime: string;
  totalGrams: number;
  /** Druckdauer in Sekunden (laut Bambu Cloud) */
  costTime?: number;
  cover?: string;
  filaments: BambuTaskFilament[];
}

/**
 * Letzte Druckaufträge aus der Bambu Cloud (Dateiname, Zeit und Filamentverbrauch pro Farbe).
 * Die Gramm sind die Schätzung des Slicers für den ganzen Auftrag, bei abgebrochenen Drucken also zu hoch.
 */
export async function getRecentTasks(token: string, limit = 15): Promise<{ success: boolean; tasks?: BambuTask[]; error?: string }> {
  if (!token || !token.trim()) return { success: false, error: 'Kein Access Token vorhanden.' };
  try {
    const res = await fetch(`https://api.bambulab.com/v1/user-service/my/tasks?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token.trim()}`, 'User-Agent': 'BambuStudio/01.09.05.51' },
      signal: AbortSignal.timeout(15000)
    });
    if (res.status === 401 || res.status === 403) return { success: false, error: 'Token abgelehnt. Bitte neu anmelden.' };
    if (!res.ok) return { success: false, error: `Bambu Cloud antwortet mit HTTP ${res.status}.` };
    const json: any = await res.json();
    const hits: any[] = Array.isArray(json?.hits) ? json.hits : [];
    const tasks: BambuTask[] = hits.map(t => {
      const filaments: BambuTaskFilament[] = (Array.isArray(t.amsDetailMapping) ? t.amsDetailMapping : [])
        .map((f: any) => ({
          material: String(f.filamentType || f.targetFilamentType || ''),
          colorHex: '#' + String(f.targetColor || f.sourceColor || 'CCCCCC').slice(0, 6),
          grams: Math.round((Number(f.weight) || 0) * 10) / 10,
          slot: Number.isFinite(Number(f.amsId)) && Number.isFinite(Number(f.slotId)) ? Number(f.amsId) * 4 + Number(f.slotId) : undefined
        }))
        .filter((f: BambuTaskFilament) => f.grams > 0);
      return {
        id: String(t.id),
        title: String(t.designTitle || t.title || 'Druckauftrag'),
        jobName: String(t.title || t.designTitle || ''),
        status: Number(t.status) || 0,
        startTime: String(t.startTime || ''),
        endTime: String(t.endTime || ''),
        totalGrams: Math.round((Number(t.weight) || filaments.reduce((a, f) => a + f.grams, 0)) * 10) / 10,
        costTime: (() => {
          const c = Number(t.costTime);
          if (Number.isFinite(c) && c > 0) return c;
          const d = (new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / 1000;
          return Number.isFinite(d) && d > 0 ? d : 0;
        })(),
        cover: t.cover ? String(t.cover) : undefined,
        filaments
      };
    });
    return { success: true, tasks };
  } catch (err: any) {
    return { success: false, error: `Bambu Cloud nicht erreichbar: ${err?.message || err}` };
  }
}
