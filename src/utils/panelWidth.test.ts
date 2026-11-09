import { beforeEach, describe, expect, it, vi } from 'vitest';

const store: Record<string, string> = {};
vi.mock('./safeStorage', () => ({
  safeStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] }
}));

describe('Breite der Seitenteile', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.resetModules();
    (globalThis as any).window = { innerWidth: 1000 };
  });

  it('Standardwerte ohne gespeicherte Breite', async () => {
    const m = await import('./panelWidth');
    expect(m.menuWidth({}, true)).toBe(310);
    expect(m.menuWidth({}, false)).toBe(340);
    expect(m.queueWidthCss({})).toBe('min(72vw, 18rem)');
    expect(m.logWidthCss({})).toBe('min(100vw, 420px)');
  });

  it('Ziehen begrenzt auf Mindestbreite und Fenster, Speichern bleibt', async () => {
    const m = await import('./panelWidth');
    m.setPanelW('log', 100);
    m.setPanelW('queue', 5000);
    m.setPanelW('menu', 500);
    m.savePanelW();
    expect(JSON.parse(store.filamenthub_panel_widths)).toEqual({ log: 240, queue: 940, menu: 500 });
  });

  it('nach Neustart wieder da, Doppelklick setzt zurück', async () => {
    store.filamenthub_panel_widths = JSON.stringify({ log: 640, menu: 'kaputt', queue: 10 });
    const m = await import('./panelWidth');
    let w: any;
    const un = (m as any); void un;
    m.setPanelW('menu', 400);
    m.resetPanelW('menu');
    w = JSON.parse(store.filamenthub_panel_widths);
    expect(w.log).toBe(640);
    expect(w.menu).toBeUndefined();
    expect(w.queue).toBeUndefined();
  });
});
