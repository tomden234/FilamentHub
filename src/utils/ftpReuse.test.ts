import { beforeEach, describe, expect, it, vi } from 'vitest';

// 1.279: Eine FTP-Sitzung wird wiederverwendet statt bei jeder Suche neu anzumelden
const calls = { access: 0, list: 0, quit: 0, failNext: '' as string };
vi.mock('basic-ftp', () => {
  class Client {
    closed = false;
    async access() {
      calls.access++;
      if (calls.failNext) {
        const m = calls.failNext;
        calls.failNext = '';
        throw new Error(m);
      }
    }
    async list(dir: string) {
      calls.list++;
      if (this.closed) throw new Error('Client is closed');
      return dir === '/' ? [{ name: 'cache', isDirectory: true, isFile: false }, { name: 'a.gcode.3mf', isFile: true, isDirectory: false, size: 1, modifiedAt: new Date() }] : [];
    }
    async sendIgnoringError() {
      calls.quit++;
    }
    close() {
      this.closed = true;
    }
  }
  return { Client };
});

describe('FTP-Sitzung', () => {
  beforeEach(() => {
    calls.access = 0;
    calls.list = 0;
  });
  it('zweite Suche nutzt dieselbe Anmeldung und merkt die Ordner', async () => {
    const { listJobFiles } = await import('../../server/bambuJobFile');
    const a = await listJobFiles('1.2.3.4', 'code');
    const listsFirst = calls.list;
    const b = await listJobFiles('1.2.3.4', 'code');
    expect(a.map(f => f.name)).toEqual(['a.gcode.3mf']);
    expect(b).toHaveLength(1);
    expect(calls.access).toBe(1);
    // Wurzel nicht noch einmal extra lesen, nicht vorhandene Ordner (/sdcard) nicht probieren
    expect(calls.list - listsFirst).toBeLessThan(listsFirst);
  });
  it('421 wird erkannt', async () => {
    const { isTooMany } = await import('../../server/bambuJobFile');
    expect(isTooMany('990 explizit: 421 There are too many connections from your internet address.')).toBe(true);
    expect(isTooMany('Zeitüberschreitung')).toBe(false);
  });
});
