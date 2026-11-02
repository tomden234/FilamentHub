// Zurück/Vor (Maus-Zurücktaste, Browser-Zurück, Android-Zurück) für Menü, Fenster und Seiten.
// Jede geöffnete Ebene (Menü, Seite im Menü, Fenster, Leiste) legt einen Eintrag in den Browser-Verlauf.
// „Zurück“ schließt dann die oberste Ebene, statt die App zu verlassen. Schließt man per Knopf, wird der Eintrag wieder entfernt.
import { useEffect, useRef } from 'react';

interface Layer {
  id: string;
  close: () => void;
}

const stack: Layer[] = [];
let ignorePop = 0;
let installed = false;

function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', () => {
    if (ignorePop > 0) {
      ignorePop--;
      return;
    }
    // Zurück-Taste: oberste Ebene schließen
    const top = stack.pop();
    if (top) top.close();
  });
}

/** Solange `active` wahr ist, gehört diese Ebene zum Verlauf: „Zurück“ ruft `close` auf. */
export function useBackLayer(active: boolean, close: () => void, id: string): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active) return;
    install();
    const layer: Layer = { id, close: () => closeRef.current() };
    stack.push(layer);
    try {
      window.history.pushState({ fhLayer: id }, '');
    } catch {
      /* Verlauf nicht erlaubt, dann gibt es eben kein Zurück */
    }
    return () => {
      const i = stack.indexOf(layer);
      if (i < 0) return; // per Zurück-Taste geschlossen: Eintrag ist schon weg
      stack.splice(i, 1);
      // Per Knopf geschlossen: den eigenen Verlaufs-Eintrag wieder entfernen (nur wenn er oben liegt)
      if (i === stack.length) {
        ignorePop++;
        try {
          window.history.back();
        } catch {
          ignorePop--;
        }
      }
    };
  }, [active, id]);
}
