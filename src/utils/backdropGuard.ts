// Fenster schließen nicht mehr, wenn man die Maus im Fenster drückt (z. B. beim Markieren einer IP) und außerhalb loslässt.
// Der Browser schickt dann einen „Klick“ an den Hintergrund. Hier wird so ein Klick verworfen:
// Er zählt nur, wenn Drücken und Loslassen auf dem Hintergrund selbst passierten.

/** Klick verwerfen? Ja, wenn das Drücken in einem Kind des Hintergrunds begann und der Klick auf dem Hintergrund (Vollbild-Ebene) landet */
export function shouldSwallowClick(down: Node | null, target: Node | null, isOverlay: (n: Node) => boolean): boolean {
  if (!down || !target || down === target) return false;
  return target.contains(down) && isOverlay(target);
}

/** Vollbild-Ebene (fixed, fast so groß wie das Fenster) = Hintergrund eines Dialogs */
function isOverlayEl(n: Node): boolean {
  if (!(n instanceof HTMLElement)) return false;
  if (getComputedStyle(n).position !== 'fixed') return false;
  const r = n.getBoundingClientRect();
  return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9;
}

let installed = false;

export function installBackdropGuard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  let down: Node | null = null;
  // Capture-Phase am Fenster: kommt vor allen React-Handlern
  window.addEventListener('mousedown', e => (down = e.target as Node), true);
  window.addEventListener(
    'click',
    e => {
      if (shouldSwallowClick(down, e.target as Node, isOverlayEl)) {
        e.stopPropagation();
        e.preventDefault();
      }
      down = null;
    },
    true
  );
}
