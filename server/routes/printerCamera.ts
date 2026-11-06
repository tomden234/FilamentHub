import { Router } from 'express';
import { bambuService } from '../bambuMqtt.js';
import { getPrinterFrame } from '../printerCameraStream.js';

const router = Router();

// Echtes Kamerabild direkt vom Drucker (LAN-Modus): ffmpeg liest den RTSPS-Stream, hier kommt das neueste JPEG.
// 1.229: Platzhalter-Bild, VLC-Link und alte Snapshot-Route entfernt (zeigten erfundene Daten bzw. wurden nicht genutzt).
router.get('/api/printer/camera-frame', async (_req, res) => {
  const lan = bambuService.getLanAccess();
  if (!lan) return res.status(503).json({ success: false, error: 'Kamera direkt braucht den LAN-Modus (Drucker-IP und Zugangscode).' });
  const r = await getPrinterFrame(lan.ip, lan.code);
  if (!r.ok) return res.status(503).json({ success: false, error: r.error });
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.send(r.jpeg);
});

export default router;
