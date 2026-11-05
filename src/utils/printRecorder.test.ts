import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PrintRecorder, makeId } from '../../server/printRecorder';
import { makePrintId } from './printSession';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rec-')), 'p.json');
const T0 = Date.parse('2026-11-04T10:00:00Z');
const min = (n: number) => T0 + n * 60_000;
const on = (state: string, extra: object = {}) => ({ connected: true, state, name: 'Benchy.gcode.3mf', startMs: min(0), percent: 0, slot: 2, ...extra });

describe('Druck-Rekorder auf dem Server', () => {
  it('nimmt einen Druck von Start bis Fertig auf', () => {
    const r = new PrintRecorder(tmp());
    r.feed(on('PREPARE'), min(0));
    for (let m = 1; m <= 60; m += 1) r.feed(on('RUNNING', { percent: m }), min(m));
    const done = r.feed(on('FINISH', { percent: 100 }), min(61));
    expect(done?.state).toBe('FINISH');
    expect(done?.percent).toBe(100);
    expect(done?.name).toBe('Benchy.gcode.3mf');
    expect(done?.endMs).toBe(min(61));
    expect(done?.slots['2']).toBeGreaterThan(1000); // Slot 2 über die Zeit gezählt
    expect(r.list()).toHaveLength(1);
    expect(r.status().open).toBeNull();
  });
  it('hat dieselbe Kennung wie die App (kein Doppeln in der Druckliste)', () => {
    expect(makeId('Benchy.gcode.3mf', min(0), 0)).toBe(makePrintId('Benchy.gcode.3mf', min(0), 0));
    expect(makeId('x', 0, 5)).toBe(makePrintId('x', 0, 5));
  });
  it('abgebrochener Druck mit letztem Fortschritt', () => {
    const r = new PrintRecorder(tmp());
    r.feed(on('RUNNING', { percent: 10 }), min(1));
    r.feed(on('RUNNING', { percent: 47 }), min(20));
    const done = r.feed(on('FAILED', { percent: 0 }), min(21));
    expect(done?.state).toBe('FAILED');
    expect(done?.percent).toBe(47);
  });
  it('Drucker aus oder ohne Daten: offener Druck bleibt', () => {
    const r = new PrintRecorder(tmp());
    r.feed(on('RUNNING', { percent: 30 }), min(5));
    r.feed({ connected: false }, min(10));
    expect(r.status().open?.percent).toBe(30);
    expect(r.list()).toHaveLength(0);
  });
  it('Leerlauf nach fast 100 %: nach 1 Minute fertig; bei 40 %: abgebrochen', () => {
    const a = new PrintRecorder(tmp());
    a.feed(on('RUNNING', { percent: 98 }), min(30));
    expect(a.feed(on('IDLE'), min(31))).toBeNull();
    expect(a.feed(on('IDLE'), min(32.2))?.state).toBe('FINISH');
    const b = new PrintRecorder(tmp());
    b.feed(on('RUNNING', { percent: 40 }), min(30));
    b.feed(on('IDLE'), min(31));
    expect(b.feed(on('IDLE'), min(32.2))?.state).toBe('FAILED');
  });
  it('Ende eines nie gesehenen Drucks und Zucken unter 1 Minute werden ignoriert', () => {
    const r = new PrintRecorder(tmp());
    expect(r.feed(on('FINISH'), min(5))).toBeNull();
    r.feed(on('RUNNING', { startMs: min(10) }), min(10));
    expect(r.feed(on('FINISH', { startMs: min(10) }), min(10.5))).toBeNull();
    expect(r.list()).toHaveLength(0);
  });
  it('anderer Auftrag während einer offenen Sitzung: alter fast fertiger zählt als fertig', () => {
    const r = new PrintRecorder(tmp());
    r.feed(on('RUNNING', { percent: 97 }), min(30));
    r.feed(on('RUNNING', { name: 'Neu.gcode.3mf', startMs: min(50), percent: 1 }), min(50));
    expect(r.list().map(p => p.name)).toEqual(['Benchy.gcode.3mf']);
    expect(r.status().open?.name).toBe('Neu.gcode.3mf');
  });
  it('übersteht einen Neustart des Servers mitten im Druck', () => {
    const f = tmp();
    const a = new PrintRecorder(f);
    a.feed(on('RUNNING', { percent: 20 }), min(5));
    a.feed(on('RUNNING', { percent: 21, slot: 3 }), min(6)); // neuer Slot: sofort gespeichert
    const b = new PrintRecorder(f);
    expect(b.status().open?.name).toBe('Benchy.gcode.3mf');
    expect(b.feed(on('FINISH'), min(40))?.state).toBe('FINISH');
    expect(new PrintRecorder(f).list()).toHaveLength(1);
  });
  it('list(since) liefert nur neuere Drucke, älteste zuerst', () => {
    const r = new PrintRecorder(tmp());
    for (const [i, n] of ['A', 'B'].entries()) {
      const st = min(i * 100);
      r.feed(on('RUNNING', { name: n, startMs: st, percent: 50 }), st + 1000);
      r.feed(on('FINISH', { name: n, startMs: st }), st + 10 * 60_000);
    }
    expect(r.list().map(p => p.name)).toEqual(['A', 'B']);
    expect(r.list(min(50)).map(p => p.name)).toEqual(['B']);
  });
});
