import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// 1.293: Eine Datei, die noch einmal gesendet wird, darf die alten Einträge nur ersetzen, wenn sie wirklich gelesen wurde.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-queue-safe-'));
process.env.FILAMENT_DATA_DIR = tmp;

let files: { path: string; name: string; size: number; time: number }[] = [];
let readFails = true;
const fil = [{ id: 1, type: 'PLA', colorHex: '#ffffff', grams: 10 }];

vi.mock('../../server/bambuJobFile', async () => {
  const real = await vi.importActual<typeof import('../../server/bambuJobFile')>('../../server/bambuJobFile');
  return {
    ...real,
    ftpBusy: () => false,
    listJobFiles: async () => files,
    readJobFile: async () => {
      if (readFails) throw new Error('421 Too many connections');
      return { filaments: fil, bytes: new Uint8Array(10), thumb: null, setup: undefined };
    },
    platesFromThreeMf: () => [],
    renameJobFile: async (_ip: string, _code: string, _from: string, name: string) => `/${name}`
  };
});

type Q = typeof import('../../server/hub/queue');
let q: Q;
const now = Date.now();
const old = { path: '/a.gcode.3mf', name: 'a.gcode.3mf', size: 100, time: now - 3_600_000 };
const keyOf = (f: { path: string; size: number; time: number }) => `${f.path}|${f.size}|${f.time}`;

beforeAll(async () => {
  fs.writeFileSync(
    path.join(tmp, 'hub-queue.json'),
    JSON.stringify({
      items: [
        { id: 'aaaaaaaaaaaa', path: '/a.gcode.3mf', fkey: keyOf(old), name: 'A', plate: 1, filaments: fil, addedAt: 1 },
        { id: 'bbbbbbbbbbbb', path: '/b.gcode.3mf', name: 'B', plate: 1, filaments: fil, addedAt: 2 }
      ],
      seen: [keyOf(old)],
      auto: true
    })
  );
  q = await import('../../server/hub/queue');
  q.attachQueue({ getStatus: () => ({ connected: true, data: {} }), getLanAccess: () => ({ ip: '1.2.3.4', code: 'x' }), startProject: vi.fn() } as never, async () => undefined);
  files = [old];
});

describe('Warteschlange: Ersetzen ohne Verlust', () => {
  it('Fehler beim Lesen (Drucker belegt): alte Einträge bleiben', async () => {
    await q.autoScan(true); // Abgleich: alles bekannt
    files = [{ ...old, size: 120, time: now }]; // dieselbe Datei neu gesendet
    readFails = true;
    await q.autoScan(true);
    expect(q.queueList().map(x => x.name)).toEqual(['A', 'B']);
  });
  it('nächste Runde klappt: A wird ersetzt, B bleibt', async () => {
    readFails = false;
    const r = await q.autoScan(true);
    expect(r.added).toBe(1);
    const list = q.queueList();
    expect(list).toHaveLength(2);
    expect(list.filter(x => x.id === 'aaaaaaaaaaaa')).toHaveLength(0);
    expect(list.some(x => x.name === 'B')).toBe(true);
  });
  it('1.302: selbst umbenannter Pfad taucht mit gleicher Größe und Zeit wieder auf: zählt als neu', async () => {
    const same = { path: '/c.gcode.3mf', name: 'c.gcode.3mf', size: 77, time: now };
    files = [same];
    readFails = false;
    const first = await q.autoScan(true);
    expect(first.added).toBe(1);
    files = []; // umbenannt (fh_…)
    await q.autoScan(true);
    files = [same]; // gleiche Datei noch einmal gesendet, gleiche Größe und Minute
    const again = await q.autoScan(true);
    expect(again.added).toBe(1);
  });
});
