import { Router } from 'express';
import { printRecorder } from '../printRecorder.js';
import { bambuService } from '../bambuMqtt.js';
import { hubStatus, printMeta } from '../hub/hub.js';

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
    hub: hubStatus(),
    now: Date.now()
  });
});

router.get('/api/recorder/prints', (req, res) => {
  const since = Number(req.query.since);
  // Je Druck: Stand des Abzugs auf dem Server (done = erledigt, ask = App soll fragen, pending = Server arbeitet noch) und ob es ein Foto gibt
  const prints = printRecorder.list(Number.isFinite(since) ? since : 0).map(p => {
    const m = printMeta(p.id);
    return { ...p, deduct: m?.deduct || 'off', resolved: Boolean(m?.resolved), photo: Boolean(m?.photo), parts: m?.parts };
  });
  res.json({ success: true, prints, hub: hubStatus(), now: Date.now() });
});

export default router;
