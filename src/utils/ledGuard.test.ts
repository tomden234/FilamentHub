import { describe, it, expect } from 'vitest';
import { guardStep, newGuard, errorOpen } from '../../server/hub/ledGuard';

describe('Status-LED nach „Fehler quittiert“ aus', () => {
  it('Fehler offen: nichts ausschalten, Fehler merken', () => {
    const r = guardStep(newGuard(), 'FAILED', { print_error: 50348044 });
    expect(r.turnOff).toBe(false);
    expect(r.next.seenError).toBe(true);
  });
  it('Fehler weg, Status bleibt FAILED: genau einmal ausschalten', () => {
    let g = guardStep(newGuard(), 'FAILED', { print_error: 50348044 }).next;
    const a = guardStep(g, 'FAILED', { print_error: 0 });
    expect(a.turnOff).toBe(true);
    const b = guardStep(a.next, 'FAILED', { print_error: 0 });
    expect(b.turnOff).toBe(false);
  });
  it('FAILED ohne je einen Fehler gesehen: nicht ausschalten (Blinken bleibt)', () => {
    expect(guardStep(newGuard(), 'FAILED', { print_error: 0 }).turnOff).toBe(false);
  });
  it('ernste HMS-Meldung zählt als offener Fehler, Hinweis nicht', () => {
    expect(errorOpen({ hms: [{ code: 0x00010001 }] })).toBe(true);
    expect(errorOpen({ hms: [{ code: 0x00030001 }] })).toBe(false);
  });
  it('anderer Status setzt zurück', () => {
    const g = guardStep(newGuard(), 'FAILED', { print_error: 1 }).next;
    expect(guardStep(g, 'IDLE', {}).next).toEqual(newGuard());
  });
});
