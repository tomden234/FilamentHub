import type { Spool } from '../types/filament';

// Unmögliche Restgewichte reparieren. Eine Spule kann nie mehr Filament haben, als sie nominal fasst.
// Häufiger Fehler beim Einsprechen/Einwiegen: Brutto (mit Spule) statt Netto eingetragen.

interface WeightFix {
  id: string;
  label: string;
  from: number;
  to: number;
  reason: string;
}

export function fixSpoolWeights(spools: Spool[]): { spools: Spool[]; fixes: WeightFix[] } {
  const fixes: WeightFix[] = [];
  const out = spools.map(sp => {
    let initial = Number(sp.initialWeight) || 1000;
    const rest = Number(sp.remainingWeight);
    const tara = Number(sp.emptySpoolWeight) || 0;
    if (!isFinite(rest)) return sp;
    const label = `${sp.brand} ${sp.name}`.trim();

    // Hellgrün: laut Besitzer eine 1,2-kg-Spule
    if (sp.id === 'sp-3' && /hellgr/i.test(sp.name) && initial === 1000 && rest > 1000) {
      fixes.push({ id: sp.id, label, from: rest, to: 1200, reason: 'Spule fasst 1200 g (Angabe des Besitzers)' });
      return { ...sp, initialWeight: 1200, remainingWeight: 1200 };
    }

    if (rest < 0) {
      fixes.push({ id: sp.id, label, from: rest, to: 0, reason: 'negatives Gewicht' });
      return { ...sp, remainingWeight: 0 };
    }
    if (rest <= initial) return sp;

    // Zu viel für diese Spule: sieht nach Brutto aus (mit Spule gewogen)
    const net = rest - tara;
    if (tara > 0 && net > 0 && net <= initial) {
      fixes.push({ id: sp.id, label, from: rest, to: Math.round(net), reason: `Brutto ${rest} g minus Spule ${tara} g` });
      return { ...sp, remainingWeight: Math.round(net) };
    }
    fixes.push({ id: sp.id, label, from: rest, to: initial, reason: `mehr als die ${initial} g, die die Spule fasst` });
    initial = Math.round(initial);
    return { ...sp, remainingWeight: initial };
  });
  return { spools: fixes.length ? out : spools, fixes };
}
