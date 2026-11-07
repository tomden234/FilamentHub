// Geräte-Sync: Drucker-Zugang (IP, Zugangscode, Seriennummer, Bambu-Login) und Einstellungen laufen verschlüsselt über die gleiche
// Cloud-Datenbank wie die Spulen. Verschlüsselt wird im Gerät (AES-GCM, Schlüssel aus deinem Sync-Passwort), in der Cloud liegt nur Zufallstext.
// Abgleich wie bei Git: gemerkter Stand (Hash) = Basis. Hat sich nur lokal etwas geändert → hochladen, nur in der Cloud → übernehmen.
import { safeStorage } from './safeStorage';
import { STORAGE_KEY_SETTINGS } from './storageKeys';
import { printerApi } from '../api/printerApi';
import { cloudFetch, cloudUpdate } from './cloudFetch';

const PASS_KEY = 'filamenthub_sync_pass';
const BASE_HASH_KEY = 'filamenthub_sync_hash';
const AT_KEY = 'filamenthub_sync_at';
const RELOAD_KEY = 'filamenthub_sync_reload_at';

const PRINTER_KEYS = [
  'bambu_serial_number',
  'bambu_user_id',
  'bambu_access_token',
  'bambu_broker_host',
  'bambu_admin_pin',
  'bambu_lan_mode',
  'bambu_lan_ip',
  'bambu_lan_code'
];
const SETTING_KEYS = [
  STORAGE_KEY_SETTINGS,
  'filamenthub_workshop_settings',
  'filamenthub_ams_slots_x2d',
  'bambu_job_grams',
  'bambu_auto_deduct',
  // NFC-Tag ↔ Spule (damit jedes Gerät die Tags im AMS erkennt)
  'filamenthub_nfc_tag_mappings_v1',
  // 1.229: Schlüssel des Pi-Servers (Pflicht), einmal eintragen reicht
  'filamenthub_server_key',
  // 1.247: Adresse des Pi und die Pi-Einstellungen (Strompreis, Ruhezeit, Doppelklick …)
  'filamenthub_server_url',
  'filamenthub_hub_settings'
];
// Home Assistant (für Kamera, Steckdose und NFC-Leser im AMS)
const HA_KEYS = ['ha_nabu_url', 'ha_url', 'ha_long_lived_token', 'ha_token', 'ha_camera_entity', 'ha_switch_entity'];
const ALL_KEYS = [...PRINTER_KEYS, ...SETTING_KEYS, ...HA_KEYS];

export type SyncResult = 'pushed' | 'applied' | 'same' | 'nopass' | 'badpass' | 'error';

export const getSyncPass = () => safeStorage.getItem(PASS_KEY) || '';
export const setSyncPass = (p: string) => safeStorage.setItem(PASS_KEY, p.trim());
export const lastSyncAt = () => Number(safeStorage.getItem(AT_KEY)) || 0;

const b64 = (u: Uint8Array) => {
  let out = '';
  for (let i = 0; i < u.length; i += 0x8000) out += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(out);
};
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function keyFrom(pass: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encrypt(text: string, pass: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(pass, salt);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  return { s: b64(salt), i: b64(iv), d: b64(data) };
}

async function decrypt(box: { s: string; i: string; d: string }, pass: string): Promise<string | null> {
  try {
    const key = await keyFrom(pass, unb64(box.s));
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.i) }, key, unb64(box.d));
    return new TextDecoder().decode(out);
  } catch {
    return null;
  }
}

async function sha(text: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return b64(h).slice(0, 22);
}

function localBundle(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ALL_KEYS) {
    const v = safeStorage.getItem(k);
    if (v !== null && v !== '') out[k] = v;
  }
  return out;
}

const canon = (o: Record<string, string>) => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));

async function applyBundle(remote: Record<string, string>): Promise<{ printerChanged: boolean; settingsChanged: boolean }> {
  let printerChanged = false;
  let settingsChanged = false;
  for (const k of ALL_KEYS) {
    const r = remote[k];
    if (r === undefined) continue;
    if (safeStorage.getItem(k) === r) continue;
    safeStorage.setItem(k, r);
    if (PRINTER_KEYS.includes(k)) printerChanged = true;
    else settingsChanged = true;
  }
  return { printerChanged, settingsChanged };
}

/** Drucker mit den übernommenen Zugangsdaten verbinden (LAN oder Cloud), ohne dass etwas eingegeben werden muss */
export async function connectFromStored(): Promise<void> {
  const serial = safeStorage.getItem('bambu_serial_number') || '';
  const pin = safeStorage.getItem('bambu_admin_pin') || '1234';
  try {
    if (safeStorage.getItem('bambu_lan_mode') === '1') {
      const ip = safeStorage.getItem('bambu_lan_ip') || '';
      const code = safeStorage.getItem('bambu_lan_code') || '';
      if (ip && code && serial) await printerApi.connectLan({ serialNumber: serial, lanIp: ip, lanCode: code, adminPin: pin });
    } else {
      const token = safeStorage.getItem('bambu_access_token') || '';
      if (token && serial) {
        await printerApi.connect({
          serialNumber: serial,
          userId: safeStorage.getItem('bambu_user_id') || '',
          accessToken: token,
          brokerHost: safeStorage.getItem('bambu_broker_host') || 'us.mqtt.bambulab.com',
          adminPin: pin
        });
      }
    }
  } catch {
    /* beim nächsten Abgleich nochmal */
  }
}

/**
 * Sync-Passwort vergessen: neues festlegen. Dieses Gerät wird die Quelle und verschlüsselt seine Einstellungen neu.
 * Andere Geräte brauchen danach das neue Passwort (das alte Paket in der Cloud wird ersetzt).
 */
export async function resetSyncPass(cloudUrl: string, newPass: string): Promise<SyncResult> {
  const p = newPass.trim();
  lastDetail = '';
  if (p.length < 6) return 'nopass';
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    lastDetail = 'Verschlüsselung nicht verfügbar: Die Seite läuft ohne sichere Verbindung (http). Bitte die App/Windows-App oder https nutzen.';
    return 'error';
  }
  const local = localBundle();
  if (!Object.keys(local).length) {
    lastDetail = 'Dieses Gerät hat noch keine Einstellungen zum Hochladen. Bitte zuerst am Gerät mit den Einstellungen (z. B. Windows-App) ausführen.';
    return 'error';
  }
  try {
    const enc = await encrypt(JSON.stringify(local), p);
    const ok = await cloudUpdate(cloudUrl, fresh => ({ ...fresh, secure: { ...enc, at: Date.now() } }));
    if (!ok) {
      lastDetail = 'Speicher hat das Speichern abgelehnt.';
      return 'error';
    }
    setSyncPass(p);
    safeStorage.setItem(BASE_HASH_KEY, await sha(canon(local)));
    safeStorage.setItem(AT_KEY, String(Date.now()));
    return 'pushed';
  } catch (e: any) {
    lastDetail = String(e?.message || e);
    return 'error';
  }
}

let busy = false;
let lastDetail = '';
/** Technischer Grund des letzten Fehlers (für die Anzeige) */
export const syncDetail = () => lastDetail;

export async function syncDevices(cloudUrl: string): Promise<SyncResult> {
  const pass = getSyncPass();
  lastDetail = '';
  if (!pass) return 'nopass';
  if (busy) return 'same';
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    lastDetail = 'Verschlüsselung nicht verfügbar: Die Seite läuft ohne sichere Verbindung (http). Bitte die App/Windows-App oder https nutzen.';
    return 'error';
  }
  busy = true;
  try {
    const res = await cloudFetch(cloudUrl, { cache: 'no-store' });
    if (!res.ok) {
      let extra = '';
      try {
        extra = ((await res.json()) as any)?.error || '';
      } catch {
        extra = '';
      }
      lastDetail = `Cloud antwortet mit HTTP ${res.status}. ${extra}`.trim();
      return 'error';
    }
    const doc: any = await res.json();
    const box = doc?.secure;
    const local = localBundle();
    const localHash = await sha(canon(local));
    const baseHash = safeStorage.getItem(BASE_HASH_KEY) || '';

    let remote: Record<string, string> | null = null;
    let remoteHash = '';
    if (box?.d) {
      const text = await decrypt(box, pass);
      if (text === null) return 'badpass';
      remote = JSON.parse(text);
      remoteHash = await sha(canon(remote!));
    }

    const upload = async () => {
      const enc = await encrypt(JSON.stringify(local), pass);
      // frischen Stand holen, damit Spulen/Verlauf anderer Geräte nicht überschrieben werden
      const ok = await cloudUpdate(cloudUrl, fresh => ({ ...fresh, secure: { ...enc, at: Date.now() } }));
      if (!ok) {
        lastDetail = 'Cloud hat das Speichern abgelehnt.';
        return 'error' as SyncResult;
      }
      safeStorage.setItem(BASE_HASH_KEY, localHash);
      safeStorage.setItem(AT_KEY, String(Date.now()));
      return 'pushed' as SyncResult;
    };

    if (!remote) return Object.keys(local).length ? await upload() : 'same';
    if (localHash === remoteHash) {
      safeStorage.setItem(BASE_HASH_KEY, localHash);
      safeStorage.setItem(AT_KEY, String(Date.now()));
      return 'same';
    }
    const localChanged = localHash !== baseHash;
    // Neues Gerät (noch nie abgeglichen) ohne eigene Drucker-Daten: Cloud übernehmen. Sonst gewinnt, was sich seit dem letzten Abgleich geändert hat.
    const firstTimeEmpty = !baseHash && !PRINTER_KEYS.some(k => local[k]);
    if (localChanged && !firstTimeEmpty) return await upload();

    const { printerChanged, settingsChanged } = await applyBundle(remote);
    safeStorage.setItem(BASE_HASH_KEY, await sha(canon(localBundle())));
    safeStorage.setItem(AT_KEY, String(Date.now()));
    if (printerChanged) await connectFromStored();
    if (settingsChanged) {
      const last = Number(safeStorage.getItem(RELOAD_KEY)) || 0;
      if (Date.now() - last > 120000) {
        safeStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    }
    window.dispatchEvent(new CustomEvent('filamenthub:device-synced', { detail: { printerChanged, settingsChanged } }));
    return 'applied';
  } catch (e: any) {
    lastDetail = String(e?.message || e);
    return 'error';
  } finally {
    busy = false;
  }
}
