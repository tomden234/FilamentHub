// Zurück/Vor (Maus-Zurück- und Vor-Taste, Browser-Pfeile, Android-Zurück, Esc) für Menü, Fenster und Seiten.
// Jede geöffnete Ebene (Menü, Seite im Menü, Fenster, Leiste) legt einen Eintrag in den Browser-Verlauf.
// „Zurück“ schließt die oberste Ebene, statt die App zu verlassen. „Vor“ öffnet die zuletzt geschlossene wieder (1.191).
import { useEffect, useRef } from 'react';

interface Layer {
  id: string;
  close: () => void;
  /** Wiederöffnen per Vor-Taste (Stand des letzten Öffnens) */
  getReopen: () => (() => void) | undefined;
}

const stack: Layer[] = [];
/** Zuletzt geschlossene Ebenen, die „Vor“ wieder öffnen kann (neueste zuletzt) */
const forward: { id: string; reopen: () => void }[] = [];
/** Wie viele eigene Einträge gerade im Verlauf „vor“ uns liegen (= Tiefe der aktuellen Stelle) */
let curIdx = 0;
/** Gerade per „Vor“ wieder geöffnet: Eintrag existiert schon, nur übernehmen statt neu anlegen */
let reopening = 0;
let ignorePop = 0;
const ignoreTimers: ReturnType<typeof setTimeout>[] = [];

/** Eigener history.back(): das zugehörige popstate ignorieren, aber nur kurz. Kommt keins, wird der Zähler wieder freigegeben. */
function expectOwnPop(): void {
  ignorePop++;
  ignoreTimers.push(
    setTimeout(() => {
      ignoreTimers.shift();
      if (ignorePop > 0) ignorePop--;
    }, 700)
  );
}
function ownPopArrived(): void {
  const t = ignoreTimers.shift();
  if (t) clearTimeout(t);
}
function ownBack(): void {
  expectOwnPop();
  try {
    window.history.back();
  } catch {
    ignorePop--;
    ownPopArrived();
  }
}
function remember(layer: Layer): void {
  const r = layer.getReopen();
  if (!r) return;
  forward.push({ id: layer.id, reopen: () => r() });
  if (forward.length > 20) forward.shift();
}

let installed = false;
function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', e => {
    const idx = Number((e.state as any)?.fhIdx) || 0;
    if (ignorePop > 0) {
      ignorePop--;
      ownPopArrived();
      curIdx = idx;
      return;
    }
    if (idx < curIdx) {
      // Zurück: so viele Ebenen schließen, wie Schritte zurückgegangen wurden
      for (let n = curIdx - idx; n > 0; n--) {
        const top = stack.pop();
        if (!top) break;
        remember(top);
        top.close();
      }
    } else if (idx > curIdx) {
      // Vor: zuletzt geschlossene Ebene wieder öffnen
      for (let n = idx - curIdx; n > 0; n--) {
        const r = forward.pop();
        if (!r) break;
        reopening++;
        r.reopen();
      }
    }
    curIdx = idx;
  });
}

/** Esc-Taste: genau die oberste Ebene schließen (wie die Zurück-Taste). Gibt false zurück, wenn keine offen ist. */
export function closeTopLayer(): boolean {
  const top = stack.pop();
  if (!top) return false;
  remember(top);
  ownBack();
  top.close();
  return true;
}

/**
 * Solange `active` wahr ist, gehört diese Ebene zum Verlauf: „Zurück“ ruft `close` auf.
 * `reopen` (optional): öffnet die Ebene wieder, wenn danach „Vor“ gedrückt wird.
 */
export function useBackLayer(active: boolean, close: () => void, id: string, reopen?: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  const reopenRef = useRef(reopen);
  // Nur solange offen: beim Schließen per Knopf zählt der letzte offene Stand (z. B. die Menü-Seite)
  if (active) reopenRef.current = reopen;
  useEffect(() => {
    if (!active) return;
    install();
    const layer: Layer = { id, close: () => closeRef.current(), getReopen: () => reopenRef.current };
    stack.push(layer);
    const state = { fhLayer: id, fhIdx: stack.length };
    try {
      if (reopening > 0) {
        reopening--;
        window.history.replaceState(state, '');
      } else {
        forward.length = 0; // neuer Weg: alte „Vor“-Schritte gelten nicht mehr
        window.history.pushState(state, '');
      }
      curIdx = stack.length;
    } catch {
      /* Verlauf nicht erlaubt, dann gibt es eben kein Zurück */
    }
    return () => {
      const i = stack.indexOf(layer);
      if (i < 0) return; // per Zurück-Taste/Esc geschlossen: Eintrag ist schon weg
      stack.splice(i, 1);
      // Per Knopf geschlossen: den eigenen Verlaufs-Eintrag wieder entfernen (nur wenn er oben liegt). „Vor“ öffnet ihn wieder.
      if (i === stack.length) {
        const r = reopenRef.current;
        if (r) forward.push({ id, reopen: () => r() });
        ownBack();
      }
    };
  }, [active, id]);
}
