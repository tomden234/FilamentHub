import { describe, expect, it } from 'vitest';
import { PUSH_KINDS, shouldPush } from './pushPolicy';

describe('shouldPush', () => {
  it('schickt im Standard nur das Wichtige als Push', () => {
    const std = { systemPush: true, pushAll: false };
    for (const k of ['print-done', 'print-fail', 'printer-error', 'dry-done'] as const) expect(shouldPush(k, std)).toBe(true);
    for (const k of ['print-start', 'print-check', 'humidity', 'dry-due', 'dry-stop', 'low', 'info'] as const) expect(shouldPush(k, std)).toBe(false);
  });
  it('„auch weniger wichtige“ schaltet alles frei', () => {
    expect(shouldPush('info', { systemPush: true, pushAll: true })).toBe(true);
    expect(shouldPush('dry-due', { systemPush: true, pushAll: true })).toBe(true);
  });
  it('Hauptschalter aus: nie Push', () => {
    expect(shouldPush('print-done', { systemPush: false, pushAll: true })).toBe(false);
  });
  it('die Liste der Push-Arten ist klein', () => {
    expect(PUSH_KINDS.size).toBe(4);
  });
});
