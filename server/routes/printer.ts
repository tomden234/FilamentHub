import { Router } from 'express';
import path from 'path';
import { bambuService } from '../bambuMqtt.js';
import { fetchJobWeights, uploadJobFile } from '../bambuJobFile.js';
import { hubEnabled } from '../hub/hub.js';
import { queueAdd } from '../hub/queue.js';
import { isLanIp } from '../netCheck.js';
import { handlePrinterRoute, testCloudToken } from '../../src/utils/bambu/printerRoutes.js';

const router = Router();

// API-Route: Bambu Lab Verbindungstest (Cloud MQTT & LAN)
router.post('/api/bambu/test-connection', async (req, res) => {
  const b = req.body || {};
  const serialNumber = typeof b.serialNumber === 'string' ? b.serialNumber.slice(0, 40) : '';
  const accessToken = typeof b.accessToken === 'string' ? b.accessToken : '';
  let ip = typeof b.ip === 'string' && b.ip.trim() ? b.ip.trim() : 'us.mqtt.bambulab.com';
  // Bambu Lab nutzt weltweit us.mqtt.bambulab.com (eu.mqtt.bambulab.com hat keine DNS-Auflösung)
  if (ip === 'eu.mqtt.bambulab.com') ip = 'us.mqtt.bambulab.com';
  // 1.229: Port fest 8883 (MQTTS), Ziel nur Bambu Cloud oder Heimnetz
  const port = 8883;
  const isCloud = b.connectionType === 'cloud' || /(^|\.)bambulab\.com$/i.test(ip);

  if (isCloud) {
    // Falls Token übergeben wurde, verifiziere direkt gegen die echte Bambu Cloud API
    if (accessToken.trim()) {
      const result = await testCloudToken(bambuService, accessToken);
      return res.status(result.status).json(result.body);
    }
    if (!/(^|\.)bambulab\.com$/i.test(ip)) return res.status(400).json({ success: false, isCloud: true, error: 'Cloud-Test nur mit *.bambulab.com.' });

    const tls = await import('tls');
    let resolved = false;
    const done = (status: number, body: any) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      tlsSocket.destroy();
      res.status(status).json(body);
    };
    const tlsSocket = tls.connect({ host: ip, port, servername: ip, timeout: 4000 }, () => {
      const snInfo = serialNumber ? ` für SN „${serialNumber}“` : '';
      done(200, { success: true, isCloud: true, message: `Erfolgreich mit Bambu Cloud MQTT (${ip}:${port})${snInfo} verbunden!` });
    });
    const timer = setTimeout(
      () => done(504, { success: false, isCloud: true, error: `Bambu Cloud Broker ${ip}:${port} antwortet nicht (Zeitlimit). Internetverbindung des Servers prüfen.` }),
      4000
    );
    tlsSocket.on('error', err => done(502, { success: false, isCloud: true, error: `Bambu Cloud Broker ${ip} nicht erreichbar (${err.message}).` }));
    return;
  }

  // Lokaler LAN-Modus: nur Heimnetz/Tailscale, und nur „erfolgreich“, wenn der Drucker wirklich antwortet
  if (!isLanIp(ip)) return res.status(400).json({ success: false, error: 'Bitte eine Heimnetz-IP eintragen (z. B. 192.168.x.x oder Tailscale 100.x.x.x).' });
  const net = await import('net');
  const socket = new net.Socket();
  let resolved = false;
  const done = (status: number, body: any) => {
    if (resolved) return;
    resolved = true;
    clearTimeout(timer);
    socket.destroy();
    res.status(status).json(body);
  };
  const timer = setTimeout(
    () => done(504, { success: false, error: `Drucker unter ${ip}:${port} antwortet nicht. Ist er an und im selben Netz (oder Tailscale an)?` }),
    3000
  );
  socket.connect(port, ip, () => done(200, { success: true, message: `Erfolgreich mit Bambu Lab Drucker unter ${ip}:${port} verbunden! MQTTS ist erreichbar.` }));
  socket.on('error', err => done(502, { success: false, error: `Konnte Drucker unter ${ip}:${port} nicht erreichen (${err.message}).` }));
});

// ============================================================================
// BAMBU LAB CLOUD MQTT API-ENDPUNKTE
// Die meisten Routen (Status, Verbinden, Befehle, AMS, Temperatur, Licht ...) liegen in
// src/utils/bambu/printerRoutes.ts und werden unten eingehängt, damit die Android-App denselben Code nutzt.
// ============================================================================

// Echtzeit-Stream (Server-Sent Events)
router.get('/api/printer/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Für Nginx / Cloud Run
  res.flushHeaders?.();

  bambuService.registerSseClient(res);
});

// Gewicht je Filament des aktuellen/letzten Drucks direkt aus der Datei auf dem Drucker (nur LAN-Modus)
router.post('/api/printer/job-weights', async (req, res) => {
  const lan = bambuService.getLanAccess();
  if (!lan) return res.status(400).json({ success: false, error: 'Nur im LAN-Modus verfügbar.' });
  const jobName = String(req.body?.jobName || '');
  const plate = Number(req.body?.plate) || 1;
  const r = await fetchJobWeights({ ip: lan.ip, code: lan.code, jobName, plate });
  if ('error' in r) return res.json({ success: false, error: r.error });
  return res.json({ success: true, ...r });
});

// G-Code / .3mf aus der App auf den Drucker laden (1.229: vorher lag die Datei nur auf dem Server und „Drucken“ lief nie)
router.post('/api/printer/upload-gcode', async (req, res) => {
  try {
    const { fileName, fileContent } = req.body || {};
    if (typeof fileName !== 'string' || typeof fileContent !== 'string' || !fileName || !fileContent) {
      return res.status(400).json({ success: false, error: 'fileName und fileContent (Text oder Base64) erforderlich.' });
    }
    if (!/\.(gcode|3mf)$/i.test(fileName)) return res.status(400).json({ success: false, error: 'Nur .gcode oder .3mf.' });
    const lan = bambuService.getLanAccess();
    if (!lan) return res.status(400).json({ success: false, error: 'Hochladen auf den Drucker geht nur im LAN-Modus.' });

    const bytes = fileContent.startsWith('data:')
      ? Buffer.from(fileContent.replace(/^data:[^;]*;base64,/, ''), 'base64')
      : Buffer.from(fileContent, 'utf8');
    if (bytes.length < 10) return res.status(400).json({ success: false, error: 'Datei ist leer.' });
    const remote = await uploadJobFile(lan.ip, lan.code, path.basename(fileName), bytes);

    // .3mf auf dem Pi: gleich in die Warteschlange (dort stimmt die AMS-Zuordnung, Start per Taster oder App)
    let queued = false;
    if (hubEnabled() && /\.3mf$/i.test(remote)) {
      try {
        await queueAdd(remote, 1);
        queued = true;
      } catch (e: any) {
        console.warn('[Upload] Warteschlange:', e?.message || e);
      }
    }
    return res.json({
      success: true,
      fileName: remote.slice(1),
      fileSize: bytes.length,
      queued,
      message: queued
        ? `„${remote.slice(1)}“ liegt auf dem Drucker und steht in der Warteschlange. Start per Taster oder Warteschlange.`
        : `„${remote.slice(1)}“ liegt auf dem Drucker. Starten am Drucker-Display (Dateien).`
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: `Hochladen fehlgeschlagen: ${err?.message || err}` });
  }
});

// Alle übrigen Drucker-Routen laufen über die gemeinsame Logik
router.all(['/api/printer/*', '/api/bambu/status'], async (req, res, next) => {
  const query = new URLSearchParams(req.query as Record<string, string>);
  const result = await handlePrinterRoute(bambuService, req.method, req.path, req.body, query);
  if (!result) return next();
  return res.status(result.status).json(result.body);
});

export default router;
