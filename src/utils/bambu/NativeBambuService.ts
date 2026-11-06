// Drucker-Dienst in der Android-App: gleicher Kern wie der Server, aber ohne Server.
// MQTT läuft über das native Plugin, Zugangsdaten liegen in localStorage, Änderungen gehen an Listener (statt SSE).
import { BambuMqttCore, type MqttLike, type MqttConnectOptions, type SavedBambuConfig } from './BambuMqttCore';
import { NativeMqttClient } from './NativeMqttClient';
import { handlePrinterRoute } from './printerRoutes';

const STORAGE_KEY = 'bambu_native_config';

class NativeBambuService extends BambuMqttCore {
  private listeners = new Set<() => void>();

  protected createClient(url: string, options: MqttConnectOptions): MqttLike {
    return new NativeMqttClient(url, options);
  }

  protected loadConfig(): SavedBambuConfig | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  protected saveConfig(config: Required<SavedBambuConfig>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Speicher nicht verfügbar
    }
  }

  /** Werte aus dem Login-Fenster (Token nach E-Mail-Login, Seriennummer, User-ID), falls noch nie verbunden wurde */
  protected fallbackConfig(): SavedBambuConfig | null {
    try {
      const get = (k: string) => localStorage.getItem(k) || undefined;
      const accessToken = get('bambu_access_token');
      if (!accessToken) return null;
      return {
        accessToken,
        serialNumber: get('bambu_serial_number'),
        userId: get('bambu_user_id'),
        adminPin: get('bambu_admin_pin')
      };
    } catch {
      return null;
    }
  }

  protected tlsVerify(): boolean {
    return true;
  }

  protected notifyChange(): void {
    this.listeners.forEach(l => {
      try {
        l();
      } catch {
        // ignorieren
      }
    });
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

let service: NativeBambuService | null = null;

function get(): NativeBambuService {
  if (!service) {
    const svc = new NativeBambuService();
    service = svc;
    svc.init();
    // App wieder im Vordergrund oder Netz wieder da: Verbindung prüfen und ggf. neu aufbauen
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') svc.ensureConnected();
      });
    }
    if (typeof window !== 'undefined') window.addEventListener('online', () => svc.ensureConnected());
  }
  return service;
}

/** Live-Status abonnieren (ersetzt den Server-Stream). Gibt eine Abmelde-Funktion zurück. */
export function subscribeNativePrinter(cb: (status: ReturnType<BambuMqttCore['getStatus']>) => void): () => void {
  const svc = get();
  return svc.subscribe(() => cb(svc.getStatus()));
}

/** Beantwortet /api/printer/* Aufrufe direkt in der App. Gibt null zurück, wenn der Pfad nicht unterstützt wird. */
export async function localPrinterFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  const [pathname, search = ''] = path.split('?');
  let body: any = {};
  if (typeof init.body === 'string' && init.body) {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = {};
    }
  }
  const result = await handlePrinterRoute(get(), init.method || 'GET', pathname, body, new URLSearchParams(search));
  if (!result) return null;
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json' } });
}
