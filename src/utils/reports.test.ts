import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-reports-'));
process.env.FILAMENT_DATA_DIR = tmp;

type R = typeof import('../../server/hub/reports');
type T = typeof import('../../server/hub/pushTests');
type H = typeof import('../../server/hub/ha');
let r: R;
let t: T;
let h: H;
beforeAll(async () => {
  r = await import('../../server/hub/reports');
  t = await import('../../server/hub/pushTests');
  h = await import('../../server/hub/ha');
});

describe('1.261 Wochenberichte', () => {
  it('speichert, findet per Kennung, behält höchstens 12', () => {
    const first = r.addReport('📊 Woche', '🖨️ 3 Drucke\n🧵 100 g');
    expect(r.getReport(first.id)?.text).toContain('3 Drucke');
    for (let i = 0; i < 14; i++) r.addReport('x', `n${i}`);
    expect(r.listReports()).toHaveLength(12);
    expect(r.getReport(first.id)).toBeUndefined();
    expect(JSON.parse(fs.readFileSync(path.join(tmp, 'hub-reports.json'), 'utf-8'))).toHaveLength(12);
  });
  it('Kennung muss genau passen (kein Pfad-Trick)', () => {
    expect(r.getReport('../hub-reports')).toBeUndefined();
    expect(r.getReport('')).toBeUndefined();
  });
  it('Seite: HTML wird maskiert, keine Skripte', () => {
    const rep = r.addReport('<b>T</b>', '<script>alert(1)</script>\n⚡ 1 kWh');
    const html = r.reportPage(rep, r.listReports());
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<span class="i">⚡</span><span>1 kWh</span>');
    expect(html).toContain('Frühere Berichte');
  });
  it('Adresse des Pi: nur Heimnetz mit Port; Heimnetz geht vor Tailscale', () => {
    expect(r.getBase()).toBe('');
    r.rememberBase('localhost:3000');
    r.rememberBase('evil.example.com:3000');
    r.rememberBase('8.8.8.8:3000');
    expect(r.getBase()).toBe('');
    expect(r.reportUrl('abc')).toBe('');
    r.rememberBase('192.168.68.10:3000');
    expect(r.getBase()).toBe('http://192.168.68.10:3000');
    r.rememberBase('100.100.1.2:3000');
    expect(r.getBase()).toBe('http://192.168.68.10:3000');
    expect(r.reportUrl('0123456789abcdef01234567')).toBe('http://192.168.68.10:3000/bericht/0123456789abcdef01234567');
  });
});

describe('1.261 Push-Daten und Test-Meldungen', () => {
  it('url wird nur für http/https gesetzt', () => {
    expect(h.pushData({ url: 'http://192.168.68.10:3000/bericht/x' })).toMatchObject({ url: 'http://192.168.68.10:3000/bericht/x', clickAction: 'http://192.168.68.10:3000/bericht/x' });
    expect(h.pushData({ url: 'javascript:alert(1)' })).not.toHaveProperty('url');
    expect(h.pushData({})).not.toHaveProperty('clickAction');
  });
  it('Test-Liste: Wochenbericht zuerst, Kennungen eindeutig, jede Art auffindbar', () => {
    const list = t.pushTestList();
    expect(list[0].id).toBe('weekly');
    expect(new Set(list.map(x => x.id)).size).toBe(list.length);
    for (const x of list.slice(1)) expect(t.findPushTest(x.id)?.title).toBeTruthy();
    expect(t.findPushTest('nope')).toBeUndefined();
  });
  it('Warteschlangen-Test hat die drei Knöpfe', () => {
    expect(t.findPushTest('queue')?.opts.actions?.map(a => a.title)).toHaveLength(3);
  });
});
