import { Router } from 'express';
import { printRecorder } from '../printRecorder.js';
import { bambuService } from '../bambuMqtt.js';

// Drucke, die der Server selbst aufgezeichnet hat (Home-Assistant-Add-on, läuft rund um die Uhr)
const router = Router();

router.get('/api/recorder/status', (_req, res) => {
  const st = bambuService.getStatus();
  res.json({
    success: true,
    server: 'filamenthub',
    printerConnected: Boolean(st.connected),
    receivingData: Boolean(st.receivingData),
    lanMode: Boolean(st.lanMode),
    ...printRecorder.status(),
    now: Date.now()
  });
});

router.get('/api/recorder/prints', (req, res) => {
  const since = Number(req.query.since);
  res.json({ success: true, prints: printRecorder.list(Number.isFinite(since) ? since : 0), now: Date.now() });
});

export default router;
