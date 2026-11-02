import { describe, it, expect, vi } from 'vitest';

// Ohne Browser: Verlauf nachbauen, damit closeTopLayer ohne window.history läuft
describe('closeTopLayer', () => {
  it('gibt false zurück, wenn keine Ebene offen ist', async () => {
    (globalThis as any).window = { history: { back: vi.fn(), pushState: vi.fn() }, addEventListener: vi.fn() };
    const { closeTopLayer } = await import('./backNav');
    expect(closeTopLayer()).toBe(false);
  });
});
