import type React from 'react';
import { hasServer, piProductLink } from './recorderServer';
import { rememberProductUrl } from './shopLinks';

// 1.276: Klick auf den Shop-Link einer Spule ohne eigenen Link: der Pi sucht die genaue Produktseite (Gemini + Google-Suche),
// der Tab öffnet direkt dort. Findet er nichts, öffnet sich wie bisher die Shop-Suche.

export interface ShopSpec {
  brand: string;
  material: string;
  name: string;
  colorName: string;
}

export function openShop(e: React.MouseEvent, spec: ShopSpec, link: { url: string; auto: boolean }): void {
  if (!link.auto || !hasServer()) return; // normaler Link
  e.preventDefault();
  e.stopPropagation();
  const w = window.open('', '_blank');
  if (w) {
    try {
      w.opener = null;
      w.document.title = 'Produktseite wird gesucht …';
      w.document.body.style.cssText = 'font-family:system-ui;padding:2rem;color:#334155';
      w.document.body.textContent = 'Der Pi sucht die Produktseite …';
    } catch {
      /* Tab lässt sich nicht beschriften */
    }
  }
  void piProductLink(spec).then(url => {
    const target = url || link.url;
    if (url) rememberProductUrl(spec.brand, spec.material, spec.name, spec.colorName, url);
    if (w) w.location.href = target;
    else window.open(target, '_blank', 'noopener');
  });
}
