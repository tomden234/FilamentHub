// Gemeinsame Verarbeitung aller /api/printer/* Anfragen. Der Server (Express) und die Android-App (ohne Server)
// nutzen genau dieselbe Logik: die App ruft sie direkt auf, der Server leitet seine Routen hierher.
import type { BambuMqttCore } from './BambuMqttCore';
import { bambuLogin } from '../bambuCloudLogin';

export interface RouteResult {
  status: number;
  body: any;
}

const ok = (body: any): RouteResult => ({ status: 200, body });
const fail = (status: number, body: any): RouteResult => ({ status, body });
const errText = (e: any) => e?.message || String(e);

/** Cloud-Token prüfen und gebundene Drucker auflisten (Verbindungstest mit Token) */
export async function testCloudToken(svc: BambuMqttCore, accessToken: string): Promise<RouteResult> {
  try {
    const bound = await svc.getBoundDevices(accessToken.trim());
    if (bound.success && bound.devices && bound.devices.length > 0) {
      const firstDev = bound.devices.find(d => d.online) || bound.devices[0];
      return ok({
        success: true,
        isCloud: true,
        device: firstDev,
        devices: bound.devices,
        userId: bound.userId,
        account: bound.account,
        message: `Bambu Cloud Token erfolgreich verifiziert! Gefundener Drucker: ${firstDev.name || firstDev.dev_product_name} (${firstDev.dev_id}, ${firstDev.online ? 'Online' : 'Offline'}).`
      });
    }
    // Token wurde geprüft, aber nicht akzeptiert oder es gibt keinen Drucker: ehrlich melden statt „erfolgreich"
    return fail(401, {
      success: false,
      error: bound.error || 'Token akzeptiert, aber es ist kein Drucker an dein Bambu-Konto gebunden.'
    });
  } catch (err: any) {
    return fail(502, { success: false, error: `Bambu Cloud nicht erreichbar: ${errText(err)}` });
  }
}

function bambuStatusCompat(svc: BambuMqttCore): RouteResult {
  const current = svc.getStatus();
  if (current.connected) {
    return ok({
      success: true,
      serialNumber: current.serialNumber,
      model: 'Bambu Lab X2D',
      source: current.lanMode ? 'LAN direkt (Port 8883)' : 'Bambu Cloud MQTT (Port 8883)',
      status: current.data.gcode_state === 'RUNNING' ? 'printing' : 'idle',
      nozzleTemp: current.data.nozzle_temper,
      targetNozzleTemp: current.data.nozzle_target_temper,
      bedTemp: current.data.bed_temper,
      targetBedTemp: current.data.bed_target_temper,
      fanSpeed: current.data.fan_gear,
      printName: current.data.subtask_name || current.data.gcode_file || undefined,
      currentLayer: current.data.layer_num,
      totalLayers: current.data.total_layer_num,
      progressPct: current.data.mc_percent,
      elapsedSeconds: 0,
      totalSeconds: current.data.mc_remaining_time * 60,
      // Echter Verbrauch kommt aus der Bambu Cloud (Auto-Abzug), hier kein Schätzwert
      printGrams: 0,
      activeSlot: 1,
      timestamp: current.lastUpdated || new Date().toISOString()
    });
  }

  // 1.229: keine erfundenen Werte mehr (vorher Fantasie-Seriennummer und 24 °C), sondern ehrlich „nicht verbunden“
  return ok({ success: false, connected: false, error: 'Drucker nicht verbunden.', timestamp: new Date().toISOString() });
}

/**
 * Bearbeitet eine Drucker-Anfrage. Gibt null zurück, wenn der Pfad hier nicht behandelt wird
 * (Server: Kamera, Live-Stream, G-Code-Upload und LAN-Test laufen weiterhin über eigene Routen).
 */
export async function handlePrinterRoute(
  svc: BambuMqttCore,
  method: string,
  path: string,
  body: any = {},
  query: URLSearchParams = new URLSearchParams()
): Promise<RouteResult | null> {
  const m = method.toUpperCase();
  const b = body ?? {};

  if (m === 'GET' && path === '/api/printer/status') return ok(svc.getStatus());
  if (m === 'GET' && path === '/api/bambu/status') return bambuStatusCompat(svc);
  if (m !== 'POST') return null;

  switch (path) {
    case '/api/printer/devices': {
      try {
        const { accessToken } = b;
        if (!accessToken || !String(accessToken).trim()) {
          return fail(400, { success: false, error: 'Kein Access Token übergeben.' });
        }
        return ok(await svc.getBoundDevices(String(accessToken).trim()));
      } catch (error: any) {
        return fail(500, { success: false, error: errText(error) || 'Fehler beim Abrufen der Druckerliste.' });
      }
    }

    case '/api/printer/tasks': {
      const res = await svc.getRecentTasks(Number(b.limit) || 15);
      return res.success ? ok(res) : fail(502, res);
    }

    case '/api/printer/connect': {
      try {
        const { serialNumber, userId, accessToken, brokerHost, adminPin } = b;
        const result = await svc.connect({
          serialNumber,
          userId,
          accessToken,
          brokerHost: brokerHost === 'eu.mqtt.bambulab.com' ? 'us.mqtt.bambulab.com' : brokerHost,
          adminPin
        });
        return ok(result);
      } catch (error: any) {
        return fail(400, { success: false, error: errText(error) || 'Verbindungsaufbau fehlgeschlagen' });
      }
    }

    case '/api/printer/connect-lan': {
      try {
        const { serialNumber, lanIp, lanCode, adminPin } = b;
        return ok(await svc.connectLan({ serialNumber, lanIp, lanCode, adminPin }));
      } catch (error: any) {
        return fail(400, { success: false, error: errText(error) || 'LAN-Verbindung fehlgeschlagen' });
      }
    }

    case '/api/printer/auto-connect': {
      try {
        const { accessToken } = b;
        if (!accessToken || !String(accessToken).trim()) {
          return fail(400, { success: false, error: 'Kein Access Token übergeben.' });
        }
        return ok(await svc.autoConnectByToken(String(accessToken).trim()));
      } catch (error: any) {
        return fail(400, { success: false, error: errText(error) || 'Auto-Connect mit Bambu Cloud fehlgeschlagen' });
      }
    }

    case '/api/printer/reconnect': {
      const r = await svc.ensureConnected(true);
      return ok({ ...r, status: svc.getStatus() });
    }

    case '/api/printer/refresh': {
      const sent = svc.requestPushall();
      return ok({ success: sent, status: svc.getStatus() });
    }

    case '/api/printer/command': {
      try {
        const { command, pin } = b;
        if (!command || !['pause', 'resume', 'stop'].includes(command)) {
          return fail(400, { error: 'Ungültiger Befehl (erlaubt: pause, resume, stop).' });
        }
        // 1.229: Abbrechen nur mit richtiger Admin-PIN (vorher lief „stop“ ohne PIN-Feld immer durch)
        if (command === 'stop' && !svc.checkAdminPin(pin)) {
          return fail(403, { success: false, error: 'Admin-PIN fehlt oder ist falsch. Druck nicht abgebrochen.' });
        }
        return ok(await svc.sendCommand(command, pin));
      } catch (error: any) {
        return fail(403, { success: false, error: errText(error) || 'Befehl konnte nicht ausgeführt werden.' });
      }
    }

    case '/api/printer/delay-resume': {
      // „Druck verzögern“: Sicherheitsnetz im Kern (setzt fort, auch wenn die App zu ist). resumeAt = 0 schaltet es ab.
      const at = Number(b.resumeAt) || 0;
      svc.setDelayedResume(at);
      return ok({ success: true, resumeAt: svc.getDelayedResume() });
    }

    case '/api/printer/login': {
      try {
        const { email, password, code, tfaKey, tfaCode, resend } = b;
        if (!email || (!password && !code && !resend)) {
          return fail(400, { status: 'error', message: 'E-Mail und Passwort erforderlich.' });
        }
        return ok(await bambuLogin({ email, password: password || '', code, tfaKey, tfaCode, resend }));
      } catch (error: any) {
        return fail(500, { status: 'error', message: 'Fehler beim Bambu Cloud Login: ' + errText(error) });
      }
    }

    case '/api/printer/extract-user': {
      try {
        const { accessToken, userId } = b;
        const resolved = await svc.resolveUserId(accessToken, userId);
        if (resolved) return ok({ success: true, userId: resolved });
        return fail(404, { success: false, error: 'Konnte numerische User-ID nicht auflösen. Bitte manuell eingeben.' });
      } catch (error: any) {
        return fail(500, { error: errText(error) });
      }
    }

    case '/api/printer/demo': {
      // 1.229: nie über einen echten Drucker legen (sonst zeichnet der Rekorder einen Fake-Druck auf)
      if (svc.getStatus().connected) return fail(409, { success: false, error: 'Drucker ist verbunden: Demo nur ohne echten Drucker.' });
      svc.seedDemoData();
      return ok({ success: true, message: 'Demo-Telemetrie aktiviert.', status: svc.getStatus() });
    }

    case '/api/printer/temperature': {
      try {
        const { target, temp } = b;
        if (!target || !['nozzle', 'nozzle1', 'nozzle2', 'bed'].includes(target) || temp === undefined) {
          return fail(400, { error: 'target ("nozzle1"|"nozzle2"|"bed") und temp erforderlich.' });
        }
        return ok(await svc.setTemperature(target, Number(temp)));
      } catch (err: any) {
        return fail(500, { success: false, error: errText(err) });
      }
    }

    case '/api/printer/light': {
      try {
        const { mode } = b;
        if (!mode || !['on', 'off'].includes(mode)) {
          return fail(400, { error: 'mode ("on"|"off") erforderlich.' });
        }
        return ok(await svc.toggleLight(mode));
      } catch (err: any) {
        return fail(500, { success: false, error: errText(err) });
      }
    }

    case '/api/printer/ams-filament': {
      try {
        const { slotIdx, colorHex, material, infoIdx, minTemp, maxTemp, external } = b;
        if (slotIdx === undefined || !colorHex || !material) {
          return fail(400, { error: 'slotIdx (0-3), colorHex und material erforderlich.' });
        }
        return ok(
          await svc.setAmsFilament(Number(slotIdx), {
            colorHex,
            material,
            infoIdx,
            minTemp: minTemp ? Number(minTemp) : undefined,
            maxTemp: maxTemp ? Number(maxTemp) : undefined,
            external: Boolean(external)
          })
        );
      } catch (err: any) {
        return fail(500, { success: false, error: errText(err) });
      }
    }

    case '/api/printer/ams-drying': {
      try {
        const { amsId, mode, duration, temp } = b;
        if (mode === undefined) {
          return fail(400, { error: 'mode (1 für Start, 0 für Stopp) erforderlich.' });
        }
        return ok(
          await svc.setAmsDrying({
            amsId: amsId !== undefined ? Number(amsId) : 0,
            mode: Number(mode) === 1 ? 1 : 0,
            duration: duration ? Number(duration) : 4,
            temp: temp ? Number(temp) : 50
          })
        );
      } catch (err: any) {
        return fail(500, { success: false, error: errText(err) });
      }
    }

    case '/api/printer/gcode-line': {
      try {
        const { gcode } = b;
        if (!gcode || typeof gcode !== 'string') {
          return fail(400, { error: 'gcode (Zeichenkette) erforderlich, z.B. M104 S220 oder M140 S60.' });
        }
        return ok(await svc.sendGcodeLine(gcode));
      } catch (err: any) {
        return fail(500, { success: false, error: errText(err) });
      }
    }

    case '/api/bambu/test-connection': {
      // In der App gibt es nur den Cloud-Test mit Token (LAN-/Socket-Tests brauchen den Server)
      const token = typeof b.accessToken === 'string' ? b.accessToken.trim() : '';
      if (token) return testCloudToken(svc, token);
      return null;
    }

    default:
      return null;
  }
}
