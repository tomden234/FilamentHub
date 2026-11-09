import type React from 'react';
import { hasServer, piProductLink } from './recorderServer';
import { rememberProductUrl, shopQuery } from './shopLinks';

// 1.276/1.278: Klick auf den Shop-Link einer Spule ohne echte Produktseite: der Pi sucht sie
// (offizieller Shop über dessen Produktliste, sonst Amazon-Treffer + Gemini), der Tab öffnet direkt dort
// und die Spule bekommt den Link fest gespeichert. Findet er nichts, steht der Grund kurz im Tab, dann kommt die Shop-Suche.

export interface ShopSpec {
  id?: string;
  brand: string;
  material: string;
  name: string;
  colorName: string;
  onSpool?: boolean;
}

export const SET_PRODUCT_URL_EVENT = 'filamenthub:set-product-url';
/** Kurze Meldung in der App (Windows-App: dort gibt es keinen Zwischen-Tab) */
export const SHOP_TOAST_EVENT = 'filamenthub:shop-toast';
const toast = (text: string) => window.dispatchEvent(new CustomEvent(SHOP_TOAST_EVENT, { detail: text }));

const say = (w: Window | null, text: string) => {
  if (!w) return;
  try {
    w.document.title = 'FilamentHub';
    w.document.body.style.cssText = 'font-family:system-ui;padding:2rem;color:#334155;font-size:15px';
    w.document.body.textContent = text;
  } catch {
    /* Tab lässt sich nicht beschriften */
  }
};

/** Windows-App: Amazon-Treffer im unsichtbaren Fenster lesen (Amazon blockt den Pi oft). Sonst leer. */
async function desktopHits(spec: ShopSpec): Promise<{ asin: string; title: string; sponsored?: boolean }[] | undefined> {
  const bridge = typeof window !== 'undefined' ? (window as any).desktop : undefined;
  if (!bridge?.amazonSearch) return undefined;
  try {
    const hits = await bridge.amazonSearch(`${shopQuery(spec.brand, spec.material, spec.name, spec.colorName)} Filament`);
    return Array.isArray(hits) && hits.length ? hits.slice(0, 12) : undefined;
  } catch {
    return undefined;
  }
}

export function openShop(e: React.MouseEvent, spec: ShopSpec, link: { url: string; auto: boolean }): void {
  if (!link.auto || !hasServer()) return; // echte Produktseite: normaler Link
  e.preventDefault();
  e.stopPropagation();
  const w = window.open('', '_blank');
  if (w) {
    try {
      w.opener = null;
    } catch {
      /* egal */
    }
  }
  say(w, `Der Pi sucht die Produktseite für ${spec.brand} ${spec.name} …`);
  if (!w) toast(`Suche Produktseite für ${spec.brand} ${spec.name} …`);
  void desktopHits(spec)
    .then(hits => piProductLink({ brand: spec.brand, material: spec.material, name: spec.name, colorName: spec.colorName, refill: spec.onSpool === false, hits }))
    .then(r => {
    const go = (target: string) => {
      if (w) w.location.href = target;
      else window.open(target, '_blank', 'noopener');
    };
    if (r.url) {
      rememberProductUrl(spec.brand, spec.material, spec.name, spec.colorName, r.url);
      if (spec.id) window.dispatchEvent(new CustomEvent(SET_PRODUCT_URL_EVENT, { detail: { id: spec.id, url: r.url } }));
      go(r.url);
      return;
    }
    say(w, `Keine Produktseite gefunden (${r.error || 'unbekannt'}). Öffne die Shop-Suche …`);
    if (!w) toast(`Keine Produktseite gefunden: ${r.error || 'unbekannt'}. Öffne die Suche.`);
    setTimeout(() => go(link.url), w ? 1800 : 0);
  });
}
