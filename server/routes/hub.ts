import { Router } from 'express';
import { backupNow, getHubConfig, hubStatus, listBackups, push, readBackup, readPhoto, resolvePrint, setPower, updateHubConfig } from '../hub/hub.js';

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

export default router;
