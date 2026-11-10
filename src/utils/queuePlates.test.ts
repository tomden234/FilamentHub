import fs from 'fs';
import os from 'os';
import path from 'path';
import { zipSync, strToU8 } from 'fflate';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// 1.294: Mehrere Platten kommen sauber getrennt in die Warteschlange (eine Datei mit allen Platten, und Einzelplatten mit eigener Nummer).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-queue-plates-'));
process.env.FILAMENT_DATA_DIR = tmp;

const plateXml = (i: number, g: number, type: string, color: string) =>
  `<plate><metadata key="index" value="${i}"/><metadata key="prediction" value="${i * 600}"/><filament id="1" type="${type}" color="${color}" used_g="${g}"/></plate>`;
const png = (n: number) => new Uint8Array(200).fill(n);
const threeMf = (plates: [number, number, string, string][]) =>
  zipSync({
    'Metadata/slice_info.config': strToU8(`<config>${plates.map(p => plateXml(...p)).join('')}</config>`),
    ...Object.fromEntries(plates.map(p => [`Metadata/plate_${p[0]}.png`, png(p[0])]))
  });

let remote: Record<string, Uint8Array> = {};
let list: { path: string; name: string; size: number; time: number }[] = [];

vi.mock('../../server/bambuJobFile', async () => {
  const real = await vi.importActual<typeof import('../../server/bambuJobFile')>('../../server/bambuJobFile');
  return {
    ...real,
    ftpBusy: () => false,
    listJobFiles: async () => list,
    readJobFile: async (_ip: string, _code: string, p: string, plate = 1) => {
      const bytes = remote[p];
      const w = real.weightsFromThreeMf(bytes, plate);
      if (!w) return null;
      return { ...w, thumb: real.thumbFromThreeMf(bytes, w.plate), setup: null, bytes };
    },
    renameJobFile: async (_ip: string, _code: string, from: string, name: string) => {
      const to = '/' + name;
      remote[to] = remote[from];
      delete remote[from];
      return to;
    }
  };
});

type Q = typeof import('../../server/hub/queue');
let q: Q;
const now = Date.now();

beforeAll(async () => {
  q = await import('../../server/hub/queue');
  q.attachQueue({ getStatus: () => ({ connected: true, data: {} }), getLanAccess: () => ({ ip: '1.2.3.4', code: 'x' }), startProject: vi.fn() } as never, async () => undefined);
  await q.autoScan(true); // Erster Abgleich (leer)
});

describe('Warteschlange: Platten unterscheiden', () => {
  it('Eine Datei mit 3 Platten: drei Karten mit eigener Nummer, Gramm, Zeit und Bild', async () => {
    remote['/Projekt.gcode.3mf'] = threeMf([[1, 10, 'PLA', '#FF0000'], [2, 20, 'PETG', '#00FF00'], [3, 30, 'PLA', '#0000FF']]);
    list = [{ path: '/Projekt.gcode.3mf', name: 'Projekt.gcode.3mf', size: 1000, time: now }];
    const r = await q.autoScan(true);
    expect(r.added).toBe(3);
    const items = q.queueList();
    expect(items.map(i => i.plate)).toEqual([1, 2, 3]);
    expect(items.map(i => i.name)).toEqual(['Projekt (Platte 1/3)', 'Projekt (Platte 2/3)', 'Projekt (Platte 3/3)']);
    expect(items.map(i => i.filaments[0].grams)).toEqual([10, 20, 30]);
    expect(items.map(i => i.predSec)).toEqual([600, 1200, 1800]);
    expect(items.every(i => i.thumb)).toBe(true);
    expect(new Set(items.map(i => i.project?.id)).size).toBe(1);
  });
  it('Zwei Dateien mit je einer Platte (eigene Namen): beide bleiben getrennt', async () => {
    remote['/Teil_A.gcode.3mf'] = threeMf([[1, 5, 'PLA', '#111111']]);
    remote['/Teil_B.gcode.3mf'] = threeMf([[2, 7, 'PLA', '#222222']]); // Einzelplatte mit Nummer 2 in der Datei
    list = [
      ...list,
      { path: '/Teil_A.gcode.3mf', name: 'Teil_A.gcode.3mf', size: 500, time: now + 1000 },
      { path: '/Teil_B.gcode.3mf', name: 'Teil_B.gcode.3mf', size: 600, time: now + 2000 }
    ];
    await q.autoScan(true);
    const items = q.queueList();
    expect(items).toHaveLength(5);
    const b = items.find(i => i.path === '/Teil_B.gcode.3mf')!;
    expect(b.plate).toBe(2);
    expect(b.filaments[0].grams).toBe(7);
  });
});
