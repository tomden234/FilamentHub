import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { prevOf, readJsonWithPrev, saveJsonConfig, writeFileAtomic } from '../../server/jsonConfig';
import { PrintRecorder } from '../../server/printRecorder';
import { scanIntervalMs } from '../../server/hub/queue';
import { isAllowedHaUrl, isLanIp } from './netCheck';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fh1231-'));

describe('1.231: sicher speichern', () => {
  it('schreibt atomar, nur für den Besitzer lesbar, und behält die Vorversion', () => {
    const f = path.join(tmp(), 'a.json');
    expect(saveJsonConfig(f, { v: 1 }, 'Test', { keepPrev: true })).toBe(true);
    expect(saveJsonConfig(f, { v: 2 }, 'Test', { keepPrev: true })).toBe(true);
    expect(JSON.parse(fs.readFileSync(f, 'utf8')).v).toBe(2);
    expect(JSON.parse(fs.readFileSync(prevOf(f), 'utf8')).v).toBe(1);
    if (process.platform !== 'win32') expect(fs.statSync(f).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(path.dirname(f)).some(n => n.endsWith('.tmp'))).toBe(false);
  });

  it('kaputte Datei → Vorversion wird gelesen', () => {
    const f = path.join(tmp(), 'b.json');
    saveJsonConfig(f, { prints: [1] }, 'Test', { keepPrev: true });
    saveJsonConfig(f, { prints: [1, 2] }, 'Test', { keepPrev: true });
    fs.writeFileSync(f, '{"prints": [1, 2'); // Stromausfall mitten im Schreiben (alte Art)
    expect(readJsonWithPrev<any>(f)?.prints).toEqual([1]);
  });

  it('Druck-Rekorder verliert bei kaputter Datei seine Drucke nicht', () => {
    const f = path.join(tmp(), 'recorded-prints.json');
    const r1 = new PrintRecorder(f);
    const t = 1_800_000_000_000;
    r1.feed({ connected: true, state: 'RUNNING', name: 'Benchy', startMs: t, percent: 10, slot: 1 }, t);
    r1.feed({ connected: true, state: 'FINISH', name: 'Benchy', startMs: t, percent: 100, slot: 1 }, t + 3600_000);
    r1.feed({ connected: true, state: 'RUNNING', name: 'Box', startMs: t + 4000_000, percent: 5, slot: 1 }, t + 4000_000);
    fs.writeFileSync(f, '{"open":null,"prints":[{"id":'); // halb geschrieben
    const r2 = new PrintRecorder(f);
    expect(r2.list().map(p => p.name)).toEqual(['Benchy']);
  });

  it('writeFileAtomic schreibt Binärdaten', () => {
    const f = path.join(tmp(), 'x.png');
    writeFileAtomic(f, new Uint8Array([1, 2, 3]), { mode: 0o644 });
    expect([...fs.readFileSync(f)]).toEqual([1, 2, 3]);
  });
});

describe('1.231: Drucker schonen', () => {
  it('sucht neue Dateien höchstens alle 20 s, ohne Neues langsamer, beim Drucken alle 60 s', () => {
    expect(scanIntervalMs(false, 0)).toBe(20_000);
    expect(scanIntervalMs(false, 1)).toBe(20_000);
    expect(scanIntervalMs(false, 2)).toBe(20_000);
    expect(scanIntervalMs(false, 3)).toBe(30_000);
    expect(scanIntervalMs(false, 9)).toBe(30_000);
    expect(scanIntervalMs(true, 0)).toBe(60_000);
  });
});

describe('1.231: Netz-Prüfungen an einer Stelle', () => {
  it('Heimnetz/Tailscale', () => {
    expect(isLanIp('192.168.68.5')).toBe(true);
    expect(isLanIp('100.64.0.1')).toBe(true);
    expect(isLanIp('8.8.8.8')).toBe(false);
  });
  it('erlaubte Home-Assistant-Adressen', () => {
    expect(isAllowedHaUrl('https://xyz.ui.nabu.casa')).toBe(true);
    expect(isAllowedHaUrl('http://homeassistant.local:8123')).toBe(true);
    expect(isAllowedHaUrl('http://192.168.68.2:8123')).toBe(true);
    expect(isAllowedHaUrl('https://evil.example')).toBe(false);
    expect(isAllowedHaUrl('https://user:pw@xyz.ui.nabu.casa')).toBe(false);
    expect(isAllowedHaUrl('ftp://192.168.1.1')).toBe(false);
  });
});

describe('1.231: Gramm-Gedächtnis', () => {
  it('behält die neuesten 300 Namen (vorher fror es ab 300 ein)', async () => {
    process.env.FILAMENT_DATA_DIR = tmp();
    const hub = await import('../../server/hub/hub');
    const many: Record<string, number> = {};
    for (let i = 0; i < 305; i++) many[`druck${i}`] = 10 + i;
    const c = hub.updateHubConfig({ jobGrams: many });
    expect(Object.keys(c.jobGrams)).toHaveLength(300);
    expect(c.jobGrams.druck304).toBe(314);
    expect(c.jobGrams.druck0).toBeUndefined();
  });
});
