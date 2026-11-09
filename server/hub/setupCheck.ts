// 1.270: Muss vor dem Druck die Platte oder Düse gewechselt werden? Der Drucker meldet beides nicht,
// darum vergleichen wir mit dem Druck davor (letzter in der Warteschlange oder zuletzt gestartet).
import type { JobSetup } from '../bambuJobFile.js';

export interface SetupInfo {
  bed: string;
  nozzles: number[];
  /** Was sich gegenüber dem Druck davor ändert, z. B. „Platte: Glatte PEI → Texturierte PEI“ (leer = nichts) */
  changes: string[];
}

const mm = (n: number) => String(n).replace('.', ',');
export const nozzleText = (n: number[]): string => {
  const u = n.length && n.every(x => x === n[0]) ? [n[0]] : n;
  return u.map(mm).join(' / ');
};

export function setupInfo(cur: Partial<JobSetup>, ref?: Partial<JobSetup> | null): SetupInfo {
  const bed = cur.bed || '';
  const nozzles = Array.isArray(cur.nozzles) ? cur.nozzles : [];
  const changes: string[] = [];
  if (ref) {
    if (bed && ref.bed && bed !== ref.bed) changes.push(`Platte: ${ref.bed} → ${bed}`);
    const rn = Array.isArray(ref.nozzles) ? ref.nozzles : [];
    if (nozzles.length && rn.length && nozzleText(nozzles) !== nozzleText(rn)) changes.push(`Düse: ${nozzleText(rn)} → ${nozzleText(nozzles)} mm`);
  }
  return { bed, nozzles, changes };
}
