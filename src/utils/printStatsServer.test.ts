import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-stats-'));
beforeAll(() => {
  process.env.FILAMENT_DATA_DIR = dir;
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('1.244 Dauer-Protokoll', () => {
  it('speichert Druck und Gramm, über 200 Einträge hinaus, und übersteht Neustart', async () => {
    vi.resetModules();
    const m = await import('../../server/hub/printStats');
    m._resetStats();
    for (let i = 0; i < 260; i++) m.statsPrint({ id: `d${i}`, name: 'x', startMs: i * 1000, endMs: i * 1000 + 600000, state: 'FINISH', percent: 100, slots: {} });
    m.statsGrams({ id: 'd5', startMs: 5000, endMs: 605000 }, [['PLA Weiß', '#fff', 42.04, 's1']]);
    expect(m.statsAll().length).toBe(260);
    m._resetStats();
    const again = m.statsAll();
    expect(again.length).toBe(260);
    expect(again.find(x => x.id === 'd5')?.g?.[0]).toEqual(['PLA Weiß', '#fff', 42, 's1']);
  });
});
