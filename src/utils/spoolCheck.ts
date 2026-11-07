// "Reicht die Spule?": vergleicht den Bedarf eines Drucks mit dem Restgewicht der Spulen.
import type { Spool } from '../types/filament';

/** Reserve für Reinigung, Wechsel und Schwankungen (5 %) */
export const FIT_RESERVE = 0.05;

/** Material auf eine Familie vereinheitlichen, damit "PLA+" und "PLA" zusammenpassen */
export function normMaterial(m?: string): string {
  const u = (m || '').toUpperCase().replace(/\s+/g, '');
  if (!u) return '';
  if (u.includes('CF') || u.includes('GF')) return 'CF';
  if (u.startsWith('PLA')) return 'PLA';
  if (u.startsWith('PETG')) return 'PETG';
  if (u.startsWith('TPU') || u.startsWith('TPE')) return 'TPU';
  if (u.startsWith('ABS')) return 'ABS';
  if (u.startsWith('ASA')) return 'ASA';
  if (u.startsWith('PC')) return 'PC';
  if (u.startsWith('PA') || u.includes('NYLON')) return 'PA';
  return u;
}

interface SpoolFit {
  spool: Spool;
  /** Benötigte Gramm inklusive Reserve */
  need: number;
  remaining: number;
  ok: boolean;
  /** Rest nach dem Druck (negativ = so viel fehlt) */
  diff: number;
  sameMaterial: boolean;
  /** AMS-Slot (1 bis 4), falls die Spule dort zugewiesen ist */
  amsSlot?: number;
}

export function neededGrams(grams: number): number {
  return Math.ceil(Math.max(0, grams) * (1 + FIT_RESERVE));
}

export function checkSpoolFit(
  spools: Spool[],
  grams: number,
  material?: string,
  amsSlots?: Record<number, string>
): SpoolFit[] {
  const need = neededGrams(grams);
  const mat = normMaterial(material);
  const slotOf = (id: string): number | undefined => {
    if (!amsSlots) return undefined;
    const hit = Object.entries(amsSlots).find(([, v]) => v === id);
    return hit ? Number(hit[0]) : undefined;
  };
  const list: SpoolFit[] = spools.map(spool => {
    const remaining = Number(spool.remainingWeight) || 0;
    return {
      spool,
      need,
      remaining,
      ok: remaining >= need,
      diff: remaining - need,
      sameMaterial: !mat || normMaterial(spool.material) === mat,
      amsSlot: slotOf(spool.id)
    };
  });
  return list.sort((a, b) => {
    if (a.sameMaterial !== b.sameMaterial) return a.sameMaterial ? -1 : 1;
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    // passend: zuerst die Spule, die danach am wenigsten übrig hat (leert angefangene Spulen zuerst)
    return a.ok ? a.diff - b.diff : b.diff - a.diff;
  });
}
