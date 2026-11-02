// Kamerabild direkt vom Drucker (Windows-App/Server im LAN-Modus). Geht es nicht, nutzt die App Home Assistant.
import { apiFetch } from '../api/client';

let failedUntil = 0;
let lastError = '';

export const getPrinterCameraError = () => lastError;

/** Ein Bild vom Drucker als Blob-URL, sonst null (dann 30 s Pause, bevor es wieder probiert wird) */
export async function fetchPrinterCameraBlobUrl(): Promise<string | null> {
  if (Date.now() < failedUntil) return null;
  try {
    const res = await apiFetch('/api/printer/camera-frame', { timeoutMs: 15000 });
    if (res.ok && res.headers.get('content-type')?.includes('image')) {
      lastError = '';
      return URL.createObjectURL(await res.blob());
    }
    const j = await res.json().catch(() => null);
    lastError = j?.error || '';
  } catch {
    lastError = 'Server nicht erreichbar.';
  }
  failedUntil = Date.now() + 30_000;
  return null;
}
