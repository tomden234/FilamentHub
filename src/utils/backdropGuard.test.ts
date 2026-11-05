import { describe, expect, it } from 'vitest';
import { shouldSwallowClick } from './backdropGuard';

// Kleine Knoten-Attrappe: contains() wie im Browser (ein Knoten enthält sich selbst und seine Kinder)
const node = (children: any[] = []) => {
  const n: any = { children };
  n.contains = (x: any): boolean => x === n || n.children.some((c: any) => c.contains(x));
  return n;
};
const always = () => true;
const never = () => false;

describe('Hintergrund-Klick nach Ziehen', () => {
  it('Drücken im Fenster, Loslassen auf dem Hintergrund: Klick wird verworfen', () => {
    const input = node();
    const panel = node([input]);
    const backdrop = node([panel]);
    expect(shouldSwallowClick(input, backdrop, always)).toBe(true);
    expect(shouldSwallowClick(panel, backdrop, always)).toBe(true);
  });
  it('Drücken und Loslassen auf dem Hintergrund: schließt wie gewohnt', () => {
    const backdrop = node([node()]);
    expect(shouldSwallowClick(backdrop, backdrop, always)).toBe(false);
  });
  it('normaler Klick auf einen Knopf bleibt unberührt', () => {
    const button = node();
    expect(shouldSwallowClick(button, button, always)).toBe(false);
  });
  it('kleine Mausbewegung im Knopf (Drücken auf Text, Klick auf Knopf) bleibt unberührt: kein Hintergrund', () => {
    const text = node();
    const button = node([text]);
    expect(shouldSwallowClick(text, button, never)).toBe(false);
  });
  it('ohne bekannte Maustaste nichts verwerfen', () => {
    expect(shouldSwallowClick(null, node(), always)).toBe(false);
    expect(shouldSwallowClick(node(), null, always)).toBe(false);
  });
  it('Drücken außerhalb des Hintergrunds (anderer Zweig): nichts verwerfen', () => {
    expect(shouldSwallowClick(node(), node([node()]), always)).toBe(false);
  });
});
