import { apiGet, apiPost, apiFetch, type ApiBase } from './client';

// Alle Aufrufe an den eigenen Server unter /api/homeassistant/*.
// Direkte Aufrufe an Home Assistant (Nabu Casa) bleiben in utils/haClient.ts.

export const homeAssistantApi = {
  getConfig: () => apiGet<{ haUrl?: string; [key: string]: any }>('/api/homeassistant/config'),

  /** Fire-and-forget: Zugangsdaten an den Server melden, Fehler werden ignoriert */
  saveConfig: (payload: { haUrl: string; haToken: string; cameraEntity?: string; switchEntity?: string }) =>
    apiFetch('/api/homeassistant/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => undefined),

  switchStatus: (entity: string) =>
    apiGet<any>(`/api/homeassistant/switch-status?entity=${encodeURIComponent(entity)}`),

  test: (haUrl: string, haToken: string) =>
    apiPost<any>('/api/homeassistant/test', { haUrl, haToken }),

  /** Proxy-Endpunkte für Dienste (Licht, Steckdose, Automation ...) */
  proxyService: (endpoint: string, body: unknown) => apiPost<any>(endpoint, body)
};
