import { describe, expect, it } from 'vitest';
import { buildLiveStatus, fmtClock, fmtDuration, type LiveStatusInput } from './liveStatus';

const NOW = new Date(2026, 10, 1, 16, 30).getTime();
const base: LiveStatusInput = { connected: true, gcodeState: 'IDLE', percent: 0, remainingMin: 0, dryMinLeft: 0, dryTotalMin: 0, dryOffEndedAt: 0, now: NOW };

describe('liveStatus', () => {
  it('zeigt nichts, wenn nichts läuft oder der Drucker offline ist', () => {
    expect(buildLiveStatus(base)).toBeNull();
    expect(buildLiveStatus({ ...base, connected: false, gcodeState: 'RUNNING' })).toBeNull();
  });
  it('Druck: Prozent, Uhrzeit des Endes und Restzeit', () => {
    const s = buildLiveStatus({ ...base, gcodeState: 'RUNNING', percent: 45, remainingMin: 72, jobName: 'Case' })!;
    expect(s.kind).toBe('print');
    expect(s.title).toBe('🖨️ Druck 45 %');
    expect(s.text).toContain('Fertig 17:42 Uhr');
    expect(s.text).toContain('noch 1 h 12 min');
    expect(s.progress).toBe(45);
    expect(s.etaMs).toBe(NOW + 72 * 60_000);
  });
  it('Pause: keine laufende Zeit', () => {
    const s = buildLiveStatus({ ...base, gcodeState: 'PAUSE', percent: 10, remainingMin: 30 })!;
    expect(s.title).toContain('pausiert');
    expect(s.etaMs).toBe(0);
  });
  it('Trocknen mit Balken aus der Gesamtdauer', () => {
    const s = buildLiveStatus({ ...base, dryMinLeft: 180, dryTotalMin: 360 })!;
    expect(s.kind).toBe('dry');
    expect(s.progress).toBe(50);
    expect(s.text).toContain('Fertig 19:30 Uhr');
  });
  it('Trocknen ohne bekannte Gesamtdauer: Balken unbekannt', () => {
    expect(buildLiveStatus({ ...base, dryMinLeft: 60 })!.progress).toBe(-1);
  });
  it('Druck und Trocknen zusammen: Druck vorne, Trocknen in der Zeile darunter', () => {
    const s = buildLiveStatus({ ...base, gcodeState: 'RUNNING', percent: 5, remainingMin: 20, dryMinLeft: 90 })!;
    expect(s.kind).toBe('print');
    expect(s.text).toContain('Trocknen: fertig');
  });
  it('3-Minuten-Zähler nach dem Trocknen', () => {
    const s = buildLiveStatus({ ...base, dryOffEndedAt: NOW - 60_000 })!;
    expect(s.kind).toBe('dryoff');
    expect(s.text).toBe('Drucker geht aus in 2:00');
    expect(s.progress).toBe(33);
  });
  it('Zähler abgelaufen: nichts mehr anzeigen', () => {
    expect(buildLiveStatus({ ...base, dryOffEndedAt: NOW - 200_000 })).toBeNull();
  });
  it('Formate', () => {
    expect(fmtDuration(5)).toBe('5 min');
    expect(fmtDuration(125)).toBe('2 h 05 min');
    expect(fmtClock(NOW + 24 * 3600_000, NOW)).toContain('morgen');
  });
});
