import { apiGet, apiPost, type ApiBase, type ApiResult } from './client';
import type { BambuLiveState } from '../types/bambu';
import type { BambuLoginInput, BambuLoginResult } from '../utils/bambuCloudLogin';

// Alle /api/printer/* und /api/bambu/* Aufrufe an einem Ort.

export interface BambuDevice {
  dev_id: string;
  name?: string;
  dev_product_name?: string;
  [key: string]: any;
}

export interface ConnectResponse extends ApiBase {
  status?: { userId?: string; [key: string]: any };
  [key: string]: any;
}

export interface AutoConnectResponse extends ApiBase {
  device?: BambuDevice;
  userId?: string | number;
  account?: any;
  [key: string]: any;
}

export interface BambuStatusResponse extends ApiBase {
  printName?: string;
  subtask_name?: string;
  printGrams?: number;
  totalSeconds?: number;
  [key: string]: any;
}

export interface AmsFilamentResponse extends ApiBase {
  /** Drucker hat den Slot wirklich gesetzt */
  confirmed?: boolean;
  /** Bambu hat den Fremd-Befehl abgelehnt (MQTT command verification failed) */
  blocked?: boolean;
  /** Slot ist laut Drucker leer */
  emptySlot?: boolean;
  /** Die Verbindung war beim Senden direkt per LAN (false = Bambu Cloud) */
  lan?: boolean;
}

export interface PrintTask {
  id: string;
  title: string;
  jobName?: string;
  status: number;
  startTime: string;
  endTime: string;
  totalGrams: number;
  /** Druckdauer in Sekunden */
  costTime?: number;
  cover?: string;
  filaments: Array<{ material: string; colorHex: string; grams: number; slot?: number }>;
}

import { noteDryOffActivity } from '../utils/dryOffActivity';

export const printerApi = {
  /** Letzte Druckaufträge mit Filamentverbrauch (Bambu Cloud) */
  tasks: (limit = 15) => apiPost<ApiBase & { tasks?: PrintTask[] }>('/api/printer/tasks', { limit }, { timeoutMs: 20000 }),

  /** Aktueller Live-Zustand (Polling, wird zusätzlich zum SSE-Stream genutzt) */
  status: () => apiGet<BambuLiveState>('/api/printer/status', { timeoutMs: 8000 }),

  refresh: () => apiPost<ApiBase>('/api/printer/refresh'),

  /** Verbindung sofort neu aufbauen (nutzt gespeicherte Zugangsdaten, sucht ggf. den Drucker im Konto) */
  reconnect: () => apiPost<ApiBase & { status?: BambuLiveState }>('/api/printer/reconnect', undefined, { timeoutMs: 45000 }),

  command: (command: 'pause' | 'resume' | 'stop', pin?: string) => {
    noteDryOffActivity('Druck-Befehl');
    return apiPost<ApiBase>('/api/printer/command', { command, pin });
  },

  /** „Druck verzögern“: Sicherheitsnetz im Drucker-Kern (resumeAt in ms, 0 = aus) */
  delayResume: (resumeAt: number) => apiPost<ApiBase>('/api/printer/delay-resume', { resumeAt }),

  gcodeLine: (gcode: string) => {
    noteDryOffActivity('Drucker bewegt oder bedient');
    return apiPost<ApiBase>('/api/printer/gcode-line', { gcode });
  },

  temperature: (target: 'nozzle1' | 'nozzle2' | 'bed', temp: number) => {
    if (temp > 0) noteDryOffActivity('Heizen');
    return apiPost<ApiBase>('/api/printer/temperature', { target, temp });
  },

  light: (mode: 'on' | 'off') => apiPost<ApiBase>('/api/printer/light', { mode }),

  uploadGcode: (payload: { fileName: string; fileContent: string; startPrint: boolean }) => {
    noteDryOffActivity('Druckdatei gesendet');
    return apiPost<ApiBase>('/api/printer/upload-gcode', payload);
  },

  /** Slot-Daten (Farbe, Material, Temperatur) an den Drucker senden. Wartet, bis der Drucker es bestätigt oder ablehnt. */
  amsFilament: (payload: {
    slotIdx: number;
    colorHex: string;
    material: string;
    minTemp: number;
    maxTemp: number;
    /** true = externe Spule (5.), slotIdx wird dann ignoriert */
    external?: boolean;
  }) => apiPost<AmsFilamentResponse>('/api/printer/ams-filament', payload, { timeoutMs: 25000 }),

  /** Gewicht je Filament aus der Druckdatei auf dem Drucker (nur Windows-/Server-App im LAN-Modus) */
  jobWeights: (payload: { jobName: string; plate?: number }) =>
    apiPost<
      ApiBase & { fileName?: string; plate?: number; totalGrams?: number; filaments?: Array<{ id: number; type: string; colorHex: string; grams: number }> }
    >('/api/printer/job-weights', payload, { timeoutMs: 60000 }),

  amsDrying: (payload: { amsId: number; mode: number; duration: number; temp: number }) =>
    apiPost<ApiBase>('/api/printer/ams-drying', payload, { timeoutMs: 40000 }),

  extractUser: (accessToken: string, userId: string) =>
    apiPost<ApiBase & { userId?: string }>('/api/printer/extract-user', { accessToken, userId }),

  autoConnect: (accessToken: string): Promise<ApiResult<AutoConnectResponse>> =>
    apiPost<AutoConnectResponse>('/api/printer/auto-connect', { accessToken }),

  connect: (payload: {
    serialNumber: string;
    userId?: string;
    accessToken: string;
    brokerHost: string;
    adminPin?: string;
  }): Promise<ApiResult<ConnectResponse>> => apiPost<ConnectResponse>('/api/printer/connect', payload),

  /** LAN-Modus: direkt zum Drucker im Heimnetz (oder über Tailscale), ohne Bambu Cloud */
  connectLan: (payload: {
    serialNumber: string;
    lanIp: string;
    lanCode: string;
    adminPin?: string;
  }): Promise<ApiResult<ConnectResponse>> => apiPost<ConnectResponse>('/api/printer/connect-lan', payload, { timeoutMs: 30000 }),

  /** E-Mail-Login über den lokalen Server (in der App läuft der Login direkt, siehe utils/bambuCloudLogin.ts) */
  login: (payload: BambuLoginInput) => apiPost<BambuLoginResult | { status?: undefined; error?: string; message?: string }>('/api/printer/login', payload),

  demo: () => apiPost<ApiBase>('/api/printer/demo'),

  /** Druckdatei-Infos des laufenden Auftrags */
  bambuStatus: () => apiGet<BambuStatusResponse>('/api/bambu/status'),

  bambuTestConnection: (payload: {
    ip: string;
    connectionType: string;
    serialNumber: string;
    accessCode: string;
    accessToken: string;
    port: number | string;
  }) => apiPost<AutoConnectResponse>('/api/bambu/test-connection', payload)
};
