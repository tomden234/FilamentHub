import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Eigener Datenordner, bevor das Modul geladen wird (dataDir wird beim Import festgelegt)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-queue-'));
process.env.FILAMENT_DATA_DIR = tmp;
const ID_A = '0123456789ab';
const ID_B = 'ba9876543210';
fs.writeFileSync(
  path.join(tmp, 'hub-queue.json'),
  JSON.stringify({ items: [{ id: ID_B, path: '/b.gcode.3mf', name: 'B', plate: 1, filaments: [], addedAt: 1 }, { id: ID_A, path: '/a.gcode.3mf', name: 'A', plate: 1, filaments: [], addedAt: 2 }], auto: true })
);

type Q = typeof import('../../server/hub/queue');
let q: Q;
const sent: { title: string; text: string; opts?: any }[] = [];
const ev = (action: string) => ({ event_type: 'mobile_app_notification_action', data: { action } });
const flush = () => new Promise(r => setTimeout(r, 20));

beforeAll(async () => {
  q = await import('../../server/hub/queue');
  q.attachQueue({ getStatus: () => ({ connected: false }), getLanAccess: () => null, startProject: vi.fn() } as never, async (title, text, opts) => void sent.push({ title, text, opts }));
});

describe('1.261 Push-Knöpfe der Warteschlange', () => {
  it('Knöpfe: starten, löschen, später, Tag je Eintrag', () => {
    const o = q.queueActions(ID_A);
    expect(o.tag).toBe(`queue-${ID_A}`);
    expect(o.actions?.map(a => a.action)).toEqual([`FH_Q_START_${ID_A}`, `FH_Q_DEL_${ID_A}`, `FH_Q_LATER_${ID_A}`]);
  });
  it('fremde oder kaputte Aktionen werden ignoriert', async () => {
    q.onQueueAction(ev('FH_RESUME_abc'));
    q.onQueueAction(ev(`FH_Q_DEL_${ID_A}; rm`));
    q.onQueueAction({ event_type: 'state_changed', data: { action: `FH_Q_DEL_${ID_A}` } });
    await flush();
    expect(sent).toHaveLength(0);
  });
  it('Später: bleibt in der Liste', async () => {
    q.onQueueAction(ev(`FH_Q_LATER_${ID_A}`));
    await flush();
    expect(sent.at(-1)?.title).toContain('Bleibt');
    expect(q.queueList().map(x => x.id)).toEqual([ID_B, ID_A]);
  });
  it('Jetzt starten ohne Drucker: Meldung statt Absturz, Eintrag nach vorn', async () => {
    q.onQueueAction(ev(`FH_Q_START_${ID_A}`));
    await flush();
    expect(sent.at(-1)?.title).toContain('Nicht gestartet');
    expect(q.queueList()[0].id).toBe(ID_A);
  });
  it('Löschen entfernt den Eintrag, danach „Nicht mehr da“', async () => {
    q.onQueueAction(ev(`FH_Q_DEL_${ID_A}`));
    await flush();
    expect(sent.at(-1)?.title).toContain('Gelöscht');
    expect(q.queueList().map(x => x.id)).toEqual([ID_B]);
    q.onQueueAction(ev(`FH_Q_DEL_${ID_A}`));
    await flush();
    expect(sent.at(-1)?.title).toContain('Nicht mehr da');
  });
});
