import { Router } from 'express';
import { backupNow, deductSuggest, energyWeeks, manualDeduct, espSyncNow, getHubConfig, hubStatus, listBackups, push, readBackup, readPhoto, resolvePrint, setPower, updateHubConfig, weeklyReportNow } from '../hub/hub.js';
import { readLocalDoc, writeLocalDoc } from '../hub/localDoc.js';
import { setLedTest, autoScan, autoAddOn, queuePick, queueWatch, queueDuplicate, queueReprint, printerFiles, queueAdd, queueList, queueMove, queueRemove, queueReorder, setAutoAdd, startNext, thumbPath } from '../hub/queue.js';

// Hub-Routen: Apps schicken Einstellungen, holen Status, Fotos und Sicherungen.
const router = Router();

router.get('/api/hub/status', (_req, res) => {
  res.json({ success: true, ...hubStatus() });
});

// Spulen-Dokument auf dem Pi (ab 1.230). ETag = Versionszähler, POST mit If-Match schreibt nur, wenn niemand dazwischen war.
router.get('/api/hub/doc', (_req, res) => {
  const d = readLocalDoc();
  res.setHeader('ETag', `"${d.rev}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.json(d.doc);
});

router.post('/api/hub/doc', (req, res) => {
  const m = /^"?(\d+)"?$/.exec(String(req.headers['if-match'] || '').trim());
  const w = writeLocalDoc(req.body, m ? Number(m[1]) : undefined);
  if (!w.ok) return res.status(w.status).json({ error: w.error });
  res.setHeader('ETag', `"${w.rev}"`);
  res.json({ success: true, rev: w.rev });
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

router.post('/api/hub/deduct/suggest', async (req, res) => {
  try {
    const r = await deductSuggest({ id: String(req.body?.id || ''), name: String(req.body?.name || ''), startMs: Number(req.body?.startMs) || 0, endMs: Number(req.body?.endMs) || 0 });
    res.json({ success: true, ...r });
  } catch (e: any) {
    res.json({ success: false, error: String(e?.message || e) });
  }
});

router.post('/api/hub/deduct/manual', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await manualDeduct(
      {
        id: String(b.id || ''),
        name: String(b.name || ''),
        startMs: Number(b.startMs) || 0,
        endMs: Number(b.endMs) || Date.now(),
        state: b.state === 'FAILED' ? 'FAILED' : 'FINISH',
        percent: Number(b.percent) || 0
      },
      Array.isArray(b.parts) ? b.parts : []
    );
    res.json({ success: r.ok, text: r.text });
  } catch (e: any) {
    res.json({ success: false, text: String(e?.message || e) });
  }
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
  queueWatch();
  res.json({ success: true, items: queueList(), auto: autoAddOn() });
});

router.post('/api/hub/queue/ledtest', (req, res) => {
  setLedTest(Boolean(req.body?.on));
  res.json({ success: true });
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

router.post('/api/hub/queue/refresh', async (_req, res) => {
  const r = await autoScan(true);
  res.json({ success: r.ok, text: r.text, items: queueList() });
});

router.post('/api/hub/queue/reprint', async (req, res) => {
  try {
    const item = await queueReprint(String(req.body?.name || ''));
    res.json({ success: true, text: `„${item.name}“ vorgemerkt.`, items: queueList() });
  } catch (e: any) {
    res.json({ success: false, text: String(e?.message || e), items: queueList() });
  }
});

router.post('/api/hub/queue/duplicate', (req, res) => {
  const ok = queueDuplicate(String(req.body?.id || ''));
  res.json({ success: ok, text: ok ? 'Kopiert.' : 'Eintrag nicht gefunden', items: queueList() });
});

router.post('/api/hub/queue/remove', (req, res) => {
  queueRemove(String(req.body?.id || ''));
  res.json({ success: true, items: queueList() });
});

router.post('/api/hub/queue/pick', (req, res) => {
  const ok = queuePick(String(req.body?.id || ''), Number(req.body?.filament), String(req.body?.tray || ''));
  res.json({ success: ok, text: ok ? 'Gespeichert.' : 'Platz nicht gefunden (AMS gewechselt?)', items: queueList() });
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
