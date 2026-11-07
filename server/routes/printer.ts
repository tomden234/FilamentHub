import { Router } from 'express';
import path from 'path';
import { bambuService } from '../bambuMqtt.js';
import { fetchJobWeights, uploadJobFile } from '../bambuJobFile.js';
import { hubEnabled } from '../hub/hub.js';
import { queueAdd } from '../hub/queue.js';
import { handlePrinterRoute } from '../../src/utils/bambu/printerRoutes.js';

const router = Router();

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
// (1.231: ungenutzte Routen /api/bambu/test-connection und /api/printer/devices entfernt)
router.all(['/api/printer/*', '/api/bambu/status'], async (req, res, next) => {
  const query = new URLSearchParams(req.query as Record<string, string>);
  const result = await handlePrinterRoute(bambuService, req.method, req.path, req.body, query);
  if (!result) return next();
  return res.status(result.status).json(result.body);
});

export default router;
