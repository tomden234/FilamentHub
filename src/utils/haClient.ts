import { safeStorage } from './safeStorage';
import { homeAssistantApi } from '../api/homeAssistantApi';

// Einheitliche Keys für Browser & Server
const KEY_NABU_URL = 'ha_nabu_url';
const KEY_HA_URL = 'ha_url';
const KEY_LONG_LIVED_TOKEN = 'ha_long_lived_token';
const KEY_HA_TOKEN = 'ha_token';
const KEY_CAMERA_ENTITY = 'ha_camera_entity';
const KEY_SWITCH_ENTITY = 'ha_switch_entity';

// Fallback Nabu Casa URL aus Benutzer-Konfiguration
export const DEFAULT_NABU_URL = 'https://tylfgfybmxzyfz2lycc0ea6ozjeja4w5.ui.nabu.casa';
export const DEFAULT_CAMERA_ENTITY = 'camera.bambu_x2d';
export const DEFAULT_SWITCH_ENTITY = 'switch.3d_drucker_steckdose';

export interface HaCredentials {
  url: string;
  token: string;
  cameraEntity: string;
  switchEntity: string;
  isDirectOrigin: boolean;
}

/**
 * Ermittelt die Home Assistant Basis-URL und Zugangsdaten intelligent:
 * Wenn die Website direkt in HA (z.B. unter *.ui.nabu.casa/local/...) läuft,
 * wird automatisch der aktuelle Origin verwendet!
 */
export function getHaCredentials(): HaCredentials {
  let isDirectOrigin = false;
  let url = safeStorage.getItem(KEY_NABU_URL) || safeStorage.getItem(KEY_HA_URL) || safeStorage.getItem('nabu_ha_url') || '';

  // Wenn wir direkt in Home Assistant / Nabu Casa laufen (z.B. /local/filament-website/...)
  if (typeof window !== 'undefined') {
    const loc = window.location;
    if (loc && (loc.hostname?.includes('nabu.casa') || loc.pathname?.includes('/local/') || loc.port === '8123')) {
      isDirectOrigin = true;
      if (!url || url.includes('homeassistant.local') || url.includes('xxxxxxxxxxxx')) {
        url = loc.origin || '';
      }
    }
  }

  if (!url || url.includes('xxxxxxxxxxxx')) {
    url = DEFAULT_NABU_URL;
  }

  url = url.trim().replace(/\/+$/, '');

  const token = (
    safeStorage.getItem(KEY_LONG_LIVED_TOKEN) ||
    safeStorage.getItem(KEY_HA_TOKEN) ||
    safeStorage.getItem('nabu_ha_token') ||
    ''
  ).trim();

  const cameraEntity = safeStorage.getItem(KEY_CAMERA_ENTITY) || DEFAULT_CAMERA_ENTITY;
  const switchEntity = safeStorage.getItem(KEY_SWITCH_ENTITY) || DEFAULT_SWITCH_ENTITY;

  return {
    url,
    token,
    cameraEntity,
    switchEntity,
    isDirectOrigin
  };
}

/**
 * Speichert Zugangsdaten dauerhaft in allen relevanten Keys
 */
export function saveHaCredentials(creds: Partial<HaCredentials>) {
  if (creds.url) {
    const cleanUrl = creds.url.trim().replace(/\/+$/, '');
    safeStorage.setItem(KEY_NABU_URL, cleanUrl);
    safeStorage.setItem(KEY_HA_URL, cleanUrl);
    safeStorage.setItem('nabu_ha_url', cleanUrl);
  }
  if (creds.token !== undefined) {
    const cleanToken = creds.token.trim();
    safeStorage.setItem(KEY_LONG_LIVED_TOKEN, cleanToken);
    safeStorage.setItem(KEY_HA_TOKEN, cleanToken);
    safeStorage.setItem('nabu_ha_token', cleanToken);
  }
  if (creds.cameraEntity) {
    safeStorage.setItem(KEY_CAMERA_ENTITY, creds.cameraEntity.trim());
  }
  if (creds.switchEntity) {
    safeStorage.setItem(KEY_SWITCH_ENTITY, creds.switchEntity.trim());
  }

  // Optional an Express Server melden, falls vorhanden (fängt 404 sicher ab)
  try {
    homeAssistantApi.saveConfig({
      haUrl: creds.url as string,
      haToken: creds.token as string,
      cameraEntity: creds.cameraEntity,
      switchEntity: creds.switchEntity
    });
  } catch {}
}

/**
 * Führt einen Home Assistant REST API Service-Aufruf aus.
 * Versucht ZUERST den direkten Browser-Aufruf (funktioniert perfekt auf Nabu Casa / Same Origin).
 * Fällt nur bei Bedarf auf den Express Proxy zurück, ohne bei HTML-Fehlerseiten zu crashen.
 */
export async function callHaService(domain: string, service: string, serviceData: Record<string, any> = {}): Promise<{ success: boolean; message: string; details?: any }> {
  const { url, token } = getHaCredentials();

  // 1. Direkter Aufruf an Home Assistant
  // 1.229: Lief der direkte Aufruf in die Zeitgrenze, kam er evtl. trotzdem an. Ein „toggle“ dann nicht nochmal senden (sonst wieder aus).
  let maybeSent = false;
  if (token) {
    try {
      const directEndpoint = `${url}/api/services/${domain}/${service}`;
      const directRes = await fetch(directEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(serviceData),
        signal: AbortSignal.timeout(6000)
      });

      if (directRes.ok) {
        return {
          success: true,
          message: `Home Assistant: ${domain}.${service} erfolgreich ausgeführt!`
        };
      }
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') maybeSent = true;
      console.warn('[HA Client] Direkter Service-Aufruf fehlgeschlagen, versuche Proxy-Fallback:', err?.message);
    }
  }
  if (maybeSent && service === 'toggle') {
    return { success: false, message: 'Home Assistant hat zu langsam geantwortet. Bitte den Schaltzustand prüfen, bevor du nochmal schaltest.' };
  }

  // 2. Fallback: Express Server Proxy (/api/homeassistant/...)
  try {
    if (domain === 'switch' && (service === 'turn_on' || service === 'turn_off' || service === 'toggle')) {
      const proxyRes = await homeAssistantApi.proxyService('/api/homeassistant/toggle-switch', {
        entity: serviceData.entity_id,
        state: service === 'turn_on' ? 'on' : service === 'turn_off' ? 'off' : undefined
      });
      if (proxyRes.ok && proxyRes.isJson) {
        const proxyData = proxyRes.data;
        if (proxyData.success) return { success: true, message: proxyData.message || 'Befehl ausgeführt!' };
        return { success: false, message: proxyData.error || 'Home Assistant Fehler' };
      }
    } else if (domain === 'automation' && (service === 'turn_on' || service === 'turn_off')) {
      const r = await homeAssistantApi.proxyService('/api/homeassistant/raw', {
        haUrl: url,
        haToken: token,
        method: 'POST',
        path: `/api/services/automation/${service}`,
        body: serviceData
      });
      if (r.ok && r.isJson && r.data?.success && r.data.status < 300) return { success: true, message: `Home Assistant: automation.${service} ausgeführt.` };
    }
  } catch {}

  if (!token) {
    return {
      success: false,
      message: 'Bitte trage zuerst deinen Home Assistant Token im Menü unter Home Assistant ein.'
    };
  }

  return {
    success: false,
    message: `Konnte ${domain}.${service} nicht ausführen. Prüfe ob Nabu Casa URL & Token erreichbar sind.`
  };
}

/**
 * Steckdose schalten
 */
export async function toggleHaSwitch(targetState?: 'on' | 'off'): Promise<{ success: boolean; state: 'on' | 'off' | 'error'; message: string }> {
  const { switchEntity } = getHaCredentials();
  const service = targetState === 'on' ? 'turn_on' : targetState === 'off' ? 'turn_off' : 'toggle';
  const result = await callHaService('switch', service, { entity_id: switchEntity });

  return {
    success: result.success,
    state: result.success ? (targetState || 'on') : 'error',
    message: result.message
  };
}

/**
 * Steckdosen-Status abfragen (Direkt oder über Proxy)
 */
export async function fetchHaSwitchStatus(): Promise<{ configured: boolean; state: 'on' | 'off' | 'unknown' | 'error'; power: number | null; friendly_name: string }> {
  const { url, token, switchEntity } = getHaCredentials();
  if (!token) {
    return { configured: false, state: 'unknown', power: null, friendly_name: switchEntity };
  }

  // 1. Direkter Aufruf
  try {
    const res = await fetch(`${url}/api/states/${switchEntity}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const stateObj = await res.json();
      return {
        configured: true,
        state: stateObj.state === 'on' ? 'on' : stateObj.state === 'off' ? 'off' : 'unknown',
        power: stateObj.attributes?.current_power_w || stateObj.attributes?.power || null,
        friendly_name: stateObj.attributes?.friendly_name || switchEntity
      };
    }
  } catch {}

  // 2. Proxy Fallback
  try {
    const proxyRes = await homeAssistantApi.switchStatus(switchEntity);
    if (proxyRes.ok && proxyRes.isJson) {
      const data = proxyRes.data;
      if (data && data.configured) {
        return {
          configured: true,
          state: data.state || 'unknown',
          power: data.power || null,
          friendly_name: data.friendly_name || switchEntity
        };
      }
    }
  } catch {}

  return { configured: Boolean(token), state: 'unknown', power: null, friendly_name: switchEntity };
}

/**
 * Kamera-Snapshot abrufen (erzeugt einen sauberen ObjectURL-Blob direkt vom HA Server)
 */
export async function fetchHaCameraBlobUrl(): Promise<string | null> {
  const { url, token, cameraEntity } = getHaCredentials();
  if (!token) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(`${url}/api/camera_proxy/${cameraEntity}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok && res.headers.get('content-type')?.includes('image')) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch {}

  return null;
}

/**
 * Sagt in einfachen Worten, warum die Kamera über Home Assistant (nicht) geht.
 */
export async function diagnoseHaCamera(): Promise<{ ok: boolean; text: string }> {
  const { url, token, cameraEntity } = getHaCredentials();
  if (!token) {
    return { ok: false, text: 'Kein Home-Assistant-Token in der App. Menü → Einstellungen → Verbindungen → Home Assistant: Token einfügen.' };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`${url}/api/camera_proxy/${cameraEntity}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok && res.headers.get('content-type')?.includes('image')) return { ok: true, text: 'Kamera liefert ein Bild.' };
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        text: 'Home Assistant lehnt den Token ab (ungültig oder widerrufen). In HA unter Profil → Sicherheit → Langlebige Zugangs-Token ein neues erstellen und in der App einfügen.'
      };
    }
    if (res.status === 404) {
      return { ok: false, text: `Die Kamera „${cameraEntity}“ gibt es in Home Assistant nicht. Name unter Einstellungen → Verbindungen → Home Assistant prüfen.` };
    }
    return {
      ok: false,
      text: `Home Assistant antwortet (${res.status}), aber die Kamera liefert kein Bild. Ist der Drucker an und die Kamera in der Bambu-Integration aktiv?`
    };
  } catch {
    return {
      ok: false,
      text: 'Home Assistant ist von hier nicht erreichbar (Nabu Casa offline, URL falsch oder Browser blockiert die Anfrage). URL unter Einstellungen → Verbindungen → Home Assistant prüfen.'
    };
  }
}

/**
 * Testet die Home Assistant Verbindung (direkt oder via Proxy)
 */
export async function testHaConnection(customUrl?: string, customToken?: string): Promise<{ success: boolean; message: string; isUnauthorized?: boolean; cameras?: any[]; switches?: any[] }> {
  const { url: defaultUrl, token: defaultToken } = getHaCredentials();
  const url = (customUrl || defaultUrl || '').trim().replace(/\/+$/, '');
  const token = (customToken || defaultToken || '').trim();

  if (!url || !token) {
    return {
      success: false,
      message: 'Bitte Home Assistant URL und Long-Lived Token angeben.'
    };
  }

  // 1. Direkter Aufruf über Browser (funktioniert super auf Nabu Casa / Same Origin)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${url}/api/states`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const states = await res.json() as any[];
      const cameras = states
        .filter((s: any) => s.entity_id && s.entity_id.startsWith('camera.'))
        .map((s: any) => ({ entity_id: s.entity_id, name: s.attributes?.friendly_name || s.entity_id, state: s.state }));

      const switches = states
        .filter((s: any) => s.entity_id && (s.entity_id.startsWith('switch.') || s.entity_id.startsWith('light.')))
        .map((s: any) => ({ entity_id: s.entity_id, name: s.attributes?.friendly_name || s.entity_id, state: s.state }));

      return {
        success: true,
        message: `Erfolgreich mit Home Assistant verbunden! Gefunden: ${cameras.length} Kameras, ${switches.length} Steckdosen/Schalter.`,
        cameras,
        switches
      };
    }

    if (res.status === 401) {
      return {
        success: false,
        isUnauthorized: true,
        message: 'Home Assistant meldet HTTP 401 Unauthorized: Dein Token wurde in HA widerrufen oder ist ungültig. Bitte in HA (Profil unten links → Langlebige Zugangs-Token) ein neues Token generieren!'
      };
    }
  } catch (err: any) {
    console.warn('[HA Client] Direkter Test fehlgeschlagen, versuche Proxy-Test:', err?.message);
  }

  // 2. Proxy Fallback (/api/homeassistant/test)
  try {
    const proxyRes = await homeAssistantApi.test(url, token);

    if (proxyRes.isJson) {
      const data = proxyRes.data;
      return {
        success: Boolean(data.success),
        isUnauthorized: data.status === 401 || (typeof data.error === 'string' && data.error.includes('401')),
        message: data.message || data.error || 'Verbindung zu Home Assistant fehlgeschlagen.'
      };
    }
  } catch {}

  return {
    success: false,
    message: 'Verbindung zu Home Assistant fehlgeschlagen. Bitte prüfe ob Nabu Casa online ist und der Token gültig ist.'
  };
}
