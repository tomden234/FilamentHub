// Live-Status des Druckers für das Drucker-Widget. 1.231 aus BambuPrinterWidget.tsx herausgelöst.
// Server: Server-Sent Events (/api/printer/stream), bei Abbruch Abfrage alle 3 s und Neuaufbau mit wachsender Pause.
// Android-App: direkt aus dem nativen Drucker-Kern. GitHub Pages: nichts (kein Server).
import { useEffect, useState } from 'react';
import { printerApi, withApiKey } from '../../api';
import { IS_NATIVE, IS_STATIC } from '../../utils/env';
import type { BambuLiveState } from '../../types/bambu';

export const DEFAULT_LIVE_STATE: BambuLiveState = {
  connected: false,
  connecting: false,
  error: null,
  serialNumber: '',
  userId: '',
  brokerHost: 'us.mqtt.bambulab.com',
  hasAdminPin: true,
  hasToken: false,
  retryInSec: null,
  lastUpdated: null,
  data: {
    gcode_state: 'IDLE',
    subtask_name: '',
    gcode_file: '',
    mc_percent: 0,
    mc_remaining_time: 0,
    layer_num: 0,
    total_layer_num: 0,
    bed_temper: 0,
    bed_target_temper: 0,
    chamber_temper: 0,
    nozzle_temper: 0,
    nozzle_target_temper: 0,
    nozzle2_temper: 0,
    nozzle2_target_temper: 0,
    fan_gear: 0,
    spd_mag: 100,
    ams: null,
    vt_tray: null,
    lights_report: [{ node: 'chamber_light', mode: 'off' }]
  },
  formatted: {
    remainingTimeStr: '--',
    etaClockStr: '--:-- Uhr',
    statusText: 'Ausgeschaltet (Stromlos)',
    statusColor: '#64748b'
  }
};

export function usePrinterLiveState() {
  const [liveState, setLiveState] = useState<BambuLiveState>(DEFAULT_LIVE_STATE);

  // Server: Stream (SSE); nur wenn er ausfällt, alle 3 s abfragen und den Stream mit wachsender Pause (5-60 s) neu aufbauen.
  // Android-App: Status kommt direkt vom nativen MQTT; eine Abfrage alle 10 s hält „Drucker aus?“ aktuell.
  useEffect(() => {
    let stopped = false;
    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 5000;

    const fetchStatus = async () => {
      try {
        const res = await printerApi.status();
        if (!stopped && res.ok && res.data?.data) setLiveState(res.data);
      } catch {
        /* Server gerade nicht erreichbar */
      }
    };
    const startPolling = (ms: number) => {
      if (pollInterval) return;
      void fetchStatus();
      pollInterval = setInterval(fetchStatus, ms);
    };
    const stopPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = null;
    };

    // Auf GitHub Pages gibt es keinen Server: kein Polling, kein Stream
    if (IS_STATIC && !IS_NATIVE) return;

    if (IS_NATIVE) {
      let off: (() => void) | undefined;
      import('../../utils/bambu/NativeBambuService').then(m => {
        if (stopped) return;
        off = m.subscribeNativePrinter(st => setLiveState(st as any));
      });
      startPolling(10_000);
      return () => {
        stopped = true;
        off?.();
        stopPolling();
      };
    }

    const connectSSE = () => {
      if (stopped) return;
      try {
        eventSource = new EventSource(withApiKey('/api/printer/stream'));
        eventSource.onopen = () => {
          retryDelay = 5000;
          stopPolling(); // Stream läuft: keine zusätzliche Abfrage
        };
        eventSource.onmessage = event => {
          try {
            const data: BambuLiveState = JSON.parse(event.data);
            if (data && data.data) setLiveState(data);
          } catch {
            /* kaputtes Paket überspringen */
          }
        };
        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
          startPolling(3000); // bis der Stream wieder läuft
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(connectSSE, retryDelay);
          retryDelay = Math.min(60_000, retryDelay * 2);
        };
      } catch {
        startPolling(3000);
      }
    };

    void fetchStatus();
    connectSSE();

    return () => {
      stopped = true;
      eventSource?.close();
      stopPolling();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  return [liveState, setLiveState] as const;
}
