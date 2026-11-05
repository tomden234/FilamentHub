import { Router } from 'express';
import { backupNow, energyWeeks, espSyncNow, getHubConfig, hubStatus, listBackups, push, readBackup, readPhoto, resolvePrint, setPower, updateHubConfig, weeklyReportNow } from '../hub/hub.js';
import { autoAddOn, printerFiles, queueAdd, queueList, queueMove, queueRemove, queueReorder, setAutoAdd, startNext, thumbPath } from '../hub/queue.js';

// Hub-Routen: Apps schicken Einstellungen, holen Status, Fotos und Sicherungen.
const router = Router();

router.get('/api/hub/status', (_req, res) => {
  res.json({ success: true, ...hubStatus() });
});

router.post('/api/hub/config', (req, res) => {
  updateHubConfig(req.body || {});
  res.json({ success: true, ...hubStatus() });
});

router.post('/api/hub/power', (req, res) => {
  setPower(req.body || {});
  res.json({ success: true, autoOff: getHubConfig().autoOff, dryOff: getHubConfig().dryOff });
});

router.post('/api/hub/resolve', (req, res) => {
  res.json({ success: resolvePrint(String(req.body?.id || '')) });
});

router.post('/api/hub/test-push', async (_req, res) => {
  const ok = await push('test', '🧪 FilamentHub', 'Test vom Pi-Server: Push klappt.', 'test');
  res.json({ success: ok, ...hubStatus() });
});

router.post('/api/hub/backup-now', async (_req, res) => {
  res.json({ success: true, result: await backupNow(), backups: listBackups() });
});

router.get('/api/hub/backups', (_req, res) => {
  res.json({ success: true, backups: listBackups() });
});

router.get('/api/hub/backup', (req, res) => {
  const name = String(req.query.name || '');
  const text = readBackup(name);
  if (text === null) return res.status(404).json({ success: false, error: 'Sicherung nicht gefunden' });
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.type('application/json').send(text);
});

router.get('/api/recorder/photo', (req, res) => {
  const jpeg = readPhoto(String(req.query.id || ''));
  if (!jpeg) return res.status(404).json({ success: false, error: 'kein Foto' });
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.type('image/jpeg').send(jpeg);
});

router.get('/api/hub/energy', (_req, res) => {
  res.json({ success: true, weeks: energyWeeks(), kwhPrice: getHubConfig().kwhPrice });
});

router.post('/api/hub/report-now', async (_req, res) => {
  res.json({ success: true, report: await weeklyReportNow() });
});

router.post('/api/hub/esp-sync', async (_req, res) => {
  const r = await espSyncNow();
  res.json({ success: r.info.ok, ...r });
});

// --- Warteschlange ---
router.get('/api/hub/queue', (_req, res) => {
  res.json({ success: true, items: queueList(), auto: autoAddOn() });
});

router.post('/api/hub/queue/auto', (req, res) => {
  setAutoAdd(Boolean(req.body?.on));
  res.json({ success: true, items: queueList(), auto: autoAddOn() });
});

router.get('/api/hub/printer-files', async (_req, res) => {
  try {
    res.json({ success: true, files: await printerFiles() });
  } catch (e: any) {
    res.json({ success: false, error: String(e?.message || e) });
  }
});

router.post('/api/hub/queue/add', async (req, res) => {
  try {
    res.json({ success: true, item: await queueAdd(String(req.body?.path || ''), Number(req.body?.plate) || 1), items: queueList() });
  } catch (e: any) {
    res.json({ success: false, error: String(e?.message || e) });
  }
});

router.post('/api/hub/queue/remove', (req, res) => {
  queueRemove(String(req.body?.id || ''));
  res.json({ success: true, items: queueList() });
});

router.post('/api/hub/queue/reorder', (req, res) => {
  queueReorder(Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []);
  res.json({ success: true, items: queueList() });
});

router.get('/api/hub/queue/thumb/:id', (req, res) => {
  const p = thumbPath(String(req.params.id || ''));
  if (!p) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.type('png').sendFile(p);
});

router.post('/api/hub/queue/move', (req, res) => {
  queueMove(String(req.body?.id || ''), Number(req.body?.dir) < 0 ? -1 : 1);
  res.json({ success: true, items: queueList() });
});

router.post('/api/hub/queue/start', async (_req, res) => {
  const r = await startNext('App');
  res.json({ success: r.ok, text: r.text, items: queueList() });
});

export default router;
