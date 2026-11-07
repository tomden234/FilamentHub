// Server-Anbindung an den gemeinsamen MQTT-Kern (src/utils/bambu/BambuMqttCore.ts):
// Verbindung über das Node-Paket "mqtt", Zugangsdaten in .bambu-config.json, Live-Status per Server-Sent Events.
import mqtt from 'mqtt';
import { Response } from 'express';
import path from 'path';
import {
  BambuMqttCore,
  type MqttLike,
  type MqttConnectOptions,
  type SavedBambuConfig
} from '../src/utils/bambu/BambuMqttCore.js';
import { readJsonWithPrev, saveJsonConfig } from './jsonConfig.js';

import { printRecorder } from './printRecorder.js';
import { attachPrinter, onPrintEnd, tick as hubTick, hubEnabled } from './hub/hub.js';
import { parseStartMs } from '../src/utils/printSession.js';
import { activeSlotFromPrinter } from '../src/utils/amsMatch.js';

export type { BambuPrinterData, BambuPrinterStatusResponse } from '../src/utils/bambu/BambuMqttCore.js';

class BambuMqttService extends BambuMqttCore {
  private sseClients: Response[] = [];
  private readonly configFilePath: string = path.resolve(process.cwd(), '.bambu-config.json');

  protected createClient(url: string, options: MqttConnectOptions): MqttLike {
    const client = mqtt.connect(url, {
      username: options.username,
      password: options.password,
      // LAN: nie prüfen (Drucker hat ein selbstsigniertes Zertifikat). Cloud: prüfen, außer BAMBU_TLS_VERIFY=false.
      rejectUnauthorized: options.tlsVerify,
      port: 8883,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 6000,
      clientId: options.clientId
    });
    return client as unknown as MqttLike;
  }

  protected tlsVerify(): boolean {
    return process.env.BAMBU_TLS_VERIFY !== 'false'; // 1.229: Cloud-Zertifikat standardmäßig prüfen (LAN prüft nie, Drucker hat ein selbstsigniertes)
  }

  protected loadConfig(): SavedBambuConfig | null {
    return readJsonWithPrev<SavedBambuConfig>(this.configFilePath, d => Boolean(d && typeof d === 'object'));
  }

  /** 1.231: Zugangscode/Token nur für den Besitzer lesbar (0600) und nie als halbe Datei */
  protected saveConfig(config: Required<SavedBambuConfig>): void {
    saveJsonConfig(this.configFilePath, config, 'Drucker-Zugangsdaten', { keepPrev: true });
  }

  protected envOverrides(): SavedBambuConfig {
    return {
      serialNumber: process.env.BAMBU_SERIAL,
      userId: process.env.BAMBU_USER_ID,
      accessToken: process.env.BAMBU_ACCESS_TOKEN,
      adminPin: process.env.BAMBU_ADMIN_PIN
    };
  }

  /** Alle 10 s den Status schicken, auch ohne Änderung: so merkt die App, wenn der Drucker aus ist (keine frischen Daten),
   *  und die Verbindung bleibt offen. Läuft nur, solange jemand zuhört. */
  private sseHeartbeat: ReturnType<typeof setInterval> | null = null;

  public registerSseClient(res: Response) {
    this.sseClients.push(res);
    // Sofort ersten Status senden
    res.write(`data: ${JSON.stringify(this.getStatus())}\n\n`);
    if (!this.sseHeartbeat) this.sseHeartbeat = setInterval(() => this.notifyChange(), 10_000);

    res.on('close', () => {
      this.sseClients = this.sseClients.filter(c => c !== res);
      if (!this.sseClients.length && this.sseHeartbeat) {
        clearInterval(this.sseHeartbeat);
        this.sseHeartbeat = null;
      }
    });
  }

  /** Druck-Rekorder füttern: bei jeder Änderung und alle 30 s (damit „Leerlauf nach Druck“ auch ohne neue Meldung erkannt wird) */
  private recorderTick = setInterval(() => this.feedRecorder(), 30_000).unref();

  private feedRecorder(): void {
    try {
      const st = this.getStatus();
      const d: any = st.data || {};
      const done = printRecorder.feed({
        connected: Boolean(st.connected && st.receivingData !== false),
        state: d.gcode_state,
        name: d.subtask_name,
        startMs: parseStartMs(d.gcode_start_time),
        percent: Number(d.mc_percent) || 0,
        slot: activeSlotFromPrinter(d.ams)
      });
      if (done) onPrintEnd(done, d);
    } catch (e) {
      console.warn('[Rekorder] Fehler:', (e as Error)?.message || e);
    }
  }

  /** 1.229: Der Drucker schickt oft mehrere Meldungen pro Sekunde. Höchstens 1× pro Sekunde an Rekorder und Apps weitergeben (letzter Stand kommt immer an). */
  private lastNotify = 0;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  protected notifyChange(): void {
    const wait = 1000 - (Date.now() - this.lastNotify);
    if (wait > 0) {
      if (!this.notifyTimer) {
        this.notifyTimer = setTimeout(() => {
          this.notifyTimer = null;
          this.notifyChange();
        }, wait);
      }
      return;
    }
    this.lastNotify = Date.now();
    this.feedRecorder();
    const payload = `data: ${JSON.stringify(this.getStatus())}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {
        // Fehler ignorieren
      }
    }
  }
}

export const bambuService = new BambuMqttService();
bambuService.init();

// Hub (nur im Home-Assistant-Add-on): Push, Foto, Abzug, Auto-Aus, Warnungen, Sicherung
attachPrinter({
  getStatus: () => bambuService.getStatus() as any,
  getLanAccess: () => bambuService.getLanAccess(),
  stopDrying: async () => {
    try {
      await bambuService.setAmsDrying({ mode: 0 });
      return true;
    } catch {
      return false;
    }
  },
  command: cmd => bambuService.sendCommand(cmd),
  resumeAfterError: code => bambuService.resumeAfterError(code),
  delayedResume: () => bambuService.getDelayedResume(),
  startProject: p => bambuService.startProjectFile(p),
  cleanError: code => bambuService.cleanPrintError(code)
});
if (hubEnabled()) {
  setInterval(() => void hubTick(), 30_000).unref();
  console.log('[Hub] aktiv: Push, Foto, Abzug, Auto-Aus, Warnungen, Sicherung');
}
