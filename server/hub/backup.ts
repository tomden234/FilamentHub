// Hub: tägliche Sicherung des Spulen-Dokuments auf dem Pi (1.231 aus hub.ts herausgelöst).
import fs from 'fs';
import path from 'path';
import { cloudReady, loadDoc } from './cloud.js';
import { writeFileAtomic } from '../jsonConfig.js';
import { access, backupDir, saveState, state } from './core.js';

// ---------- 10. Sicherung ----------

const dayOf = (t: number) => {
  const x = new Date(t);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export async function backupNow(now = Date.now()): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!cloudReady(access())) return { ok: false, error: 'Cloud nicht eingerichtet (App einmal mit dem Server abgleichen)' };
  try {
    const doc = await loadDoc(access());
    if (!doc || !Array.isArray(doc.spools)) return { ok: false, error: 'Cloud-Dokument ohne Spulen' };
    fs.mkdirSync(backupDir(), { recursive: true });
    const name = `filamenthub-${dayOf(now)}.json`;
    writeFileAtomic(path.join(backupDir(), name), JSON.stringify(doc));
    const files = listBackups();
    for (const f of files.slice(30)) fs.unlinkSync(path.join(backupDir(), f.name));
    state().lastBackupDay = dayOf(now);
    saveState();
    console.log(`[Hub] Sicherung ${name} (${doc.spools.length} Spulen)`);
    return { ok: true, name };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || String(e) };
  }
}

let lastBackupTry = 0;
export async function dailyBackup(now: number): Promise<void> {
  if (state().lastBackupDay === dayOf(now) || new Date(now).getHours() < 3) return;
  if (!cloudReady(access()) || now - lastBackupTry < 30 * 60_000) return;
  lastBackupTry = now;
  await backupNow(now);
}

export function listBackups(): { name: string; size: number; at: number }[] {
  try {
    return fs
      .readdirSync(backupDir())
      .filter(f => /^filamenthub-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map(f => {
        const s = fs.statSync(path.join(backupDir(), f));
        return { name: f, size: s.size, at: s.mtimeMs };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
  } catch {
    return [];
  }
}

export function readBackup(name: string): string | null {
  if (!/^filamenthub-\d{4}-\d{2}-\d{2}\.json$/.test(name)) return null;
  try {
    return fs.readFileSync(path.join(backupDir(), name), 'utf-8');
  } catch {
    return null;
  }
}
