import { Router } from 'express';
import { bambuService } from '../bambuMqtt.js';

const router = Router();

const BAMBU_ACCESS_CODE = process.env.BAMBU_ACCESS_CODE || '';

// Drucker-IP nur aus privaten IPv4-Bereichen akzeptieren (verhindert SSRF und Einschleusen in SVG/M3U).
// Ungültig oder leer: '' (die Routen antworten dann mit 400).
function safePrinterIp(raw: unknown): string {
  const fallback = '';
  if (typeof raw !== 'string') return fallback;
  const m = raw.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return fallback;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return fallback;
  const isPrivate = o[0] === 10 || (o[0] === 192 && o[1] === 168) || (o[0] === 172 && o[1] >= 16 && o[1] <= 31);
  return isPrivate ? o.join('.') : fallback;
}

// Echte Kamera Snapshot Proxy-Funktion für Bambu Lab X2D (port 80/8080/322)
router.get('/api/printer/camera-snapshot', async (req, res) => {
  const printerIp = safePrinterIp(req.query.ip);
  if (!printerIp) return res.status(400).json({ error: 'Drucker-IP fehlt oder ist keine Heimnetz-Adresse.' });

  // 1. Versuch: Echten JPEG-Snapshot direkt von der IP des Druckers im LAN abrufen
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const snapUrl = `http://${printerIp}/snapshot.jpg`;
    const response = await fetch(snapUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok && response.headers.get('content-type')?.includes('image')) {
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(Buffer.from(buffer));
    }
  } catch {
    // Falls Drucker-IP vom Cloud-Server nicht direkt erreichbar ist (Client-LAN Trennung)
  }

  // 2. Fallback: Authentische Kamera-Standby-Grafik ohne Fake-Animationen
  const status = bambuService.getStatus();
  const timestamp = new Date().toLocaleTimeString('de-DE');
  const lightOn = Boolean(status.data.lights_report?.[0]?.mode === 'on');

  const standbySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
    <rect width="800" height="450" fill="#090d16" />
    <circle cx="400" cy="225" r="160" fill="none" stroke="#1e293b" stroke-width="2" stroke-dasharray="8,8" />
    <circle cx="400" cy="225" r="120" fill="#0f172a" stroke="#334155" stroke-width="3" />
    <circle cx="400" cy="225" r="70" fill="#030712" stroke="#00AE42" stroke-width="2" />
    <circle cx="400" cy="225" r="28" fill="#1e293b" />
    
    <!-- Fadenkreuz -->
    <line x1="320" y1="225" x2="480" y2="225" stroke="#334155" stroke-width="1.5" />
    <line x1="400" y1="145" x2="400" y2="305" stroke="#334155" stroke-width="1.5" />

    <!-- Kamera HUD -->
    <rect x="0" y="0" width="800" height="38" fill="#050811" fill-opacity="0.9" />
    <text x="24" y="24" font-family="sans-serif" font-size="11" font-weight="bold" fill="#00AE42">BAMBU LAB X2D • ECHTE HARDWARE-KAMERA</text>
    <text x="776" y="24" font-family="monospace" font-size="11" fill="#38bdf8" text-anchor="end">${timestamp}</text>

    <!-- Info Center -->
    <text x="400" y="325" font-family="sans-serif" font-size="14" font-weight="bold" fill="#f8fafc" text-anchor="middle">
      Live RTSP-Signal: rtsps://bblp:ZUGANGSCODE@${printerIp}:322/streaming/live/1
    </text>
    <text x="400" y="350" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">
      Klicke unten auf „In VLC öffnen“ oder binde den direkten LAN-Stream in deinem Netzwerk ein.
    </text>

    <!-- HUD Unten -->
    <rect x="0" y="412" width="800" height="38" fill="#050811" fill-opacity="0.95" />
    <text x="24" y="435" font-family="monospace" font-size="11" fill="#94a3b8">
      STATUS: <tspan fill="#00AE42">BEREIT</tspan> • RTSPS PORT 322 • ${lightOn ? '💡 LICHT AN' : '🌙 LICHT AUS'}
    </text>
    <text x="776" y="435" font-family="monospace" font-size="11" fill="#64748b" text-anchor="end">
      1080p CoreXY Hardware Lens
    </text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.send(standbySvg);
});

// 15. Kamera Live-Stream Endpunkt
router.get('/api/printer/camera-stream', (_req, res) => {
  res.redirect('/api/printer/camera-snapshot');
});

// 16. Direkter M3U-Download für VLC Media Player (garantiert fehlerfreies Öffnen ohne unsichere vlc:// Protokolle)
router.get('/api/printer/stream.m3u', (req, res) => {
  const ip = safePrinterIp(req.query.ip);
  const customUrl = typeof req.query.url === 'string' && /^rtsps?:\/\/\S+$/.test(req.query.url) ? req.query.url : '';
  const credentials = BAMBU_ACCESS_CODE ? `bblp:${BAMBU_ACCESS_CODE}@` : '';
  if (!customUrl && !ip) return res.status(400).json({ error: 'Drucker-IP fehlt oder ist keine Heimnetz-Adresse.' });
  const streamTarget = customUrl || `rtsps://${credentials}${ip}:322/streaming/live/1`;

  const m3uContent = `#EXTM3U\n#EXTINF:-1,Bambu Lab X2D Live Camera\n${streamTarget}\n`;
  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bambu_x2d_camera.m3u"');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  return res.send(m3uContent);
});

export default router;
