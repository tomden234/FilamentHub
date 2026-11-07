import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { dataDir } from '../paths.js';
import { saveJsonConfig } from '../jsonConfig.js';

const router = Router();

// 1.234: Die Route /api/cloud-proxy (Umweg zu npoint.io) ist entfernt, npoint ist abgeschaltet.

// Dauerhafter Speicher für verdrucktes Filament & Zähler
const statsFilePath = path.join(dataDir, 'filamenthub-storage.json');

// API-Route: Dauerhafter Speicher für verdrucktes Filament & Zähler
router.get('/api/storage/stats', (_req, res) => {
  try {
    if (fs.existsSync(statsFilePath)) {
      const data = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));
      return res.json({ success: true, stats: data });
    }
    return res.json({ success: true, stats: { manualUsedGrams: 0 } });
  } catch {
    return res.json({ success: true, stats: { manualUsedGrams: 0 } });
  }
});

router.post('/api/storage/stats', (req, res) => {
  // 1.229: nur bekannte Felder übernehmen (vorher landete jeder beliebige Inhalt in der Datei)
  const g = Number(req.body?.manualUsedGrams);
  if (!Number.isFinite(g) || g < 0 || g > 1e7) return res.status(400).json({ success: false, error: 'manualUsedGrams fehlt oder ist ungültig.' });
  let current: Record<string, unknown> = {};
  try {
    if (fs.existsSync(statsFilePath)) current = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8')) || {};
  } catch {
    current = {};
  }
  const updated = { ...current, manualUsedGrams: Math.round(g * 10) / 10, updatedAt: new Date().toISOString() };
  if (!saveJsonConfig(statsFilePath, updated, 'Statistik')) return res.status(500).json({ success: false, error: 'Konnte Statistiken nicht speichern.' });
  return res.json({ success: true, stats: updated });
});

export default router;
