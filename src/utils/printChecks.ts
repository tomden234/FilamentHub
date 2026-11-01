// Spulen- und Material-Check beim Druckstart (auch wenn der Druck nicht über die App gestartet wurde):
//  - Reicht das Filament der Spule für den Druck? (Gewicht aus der Druckdatei oder gemerkt zum Auftragsnamen)
//  - Liegt das Material im AMS, das der Druck braucht?
//  - Passt das Material laut Drucker zur Spule, die die App dem Slot zugeordnet hat?
//  - Ist die Spule im aktiven Slot fast leer?
import type { Spool } from '../types/filament';
import { printerApi } from '../api/printerApi';
import { activeSlotFromPrinter, baseMaterial, colorDistance, EXTERNAL_SLOT, readExternal, readTrays, type HwTray } from './amsMatch';
import { jobKey, readJobGrams } from './printUsage';
import { raiseAlert } from './alerts';
import { getWorkshopSettings } from './workshopSettings';
import type { PrintSession } from './printSession';

interface Ctx {
  spools: Spool[];
  amsSlots: Record<number, string>;
  ams: any;
  vtTray: any;
  percent: number;
  showToast?: (t: string) => void;
}

interface Problem {
  title: string;
  sub: string;
  color?: string;
}

const slotName = (slot: number) => (slot === EXTERNAL_SLOT ? 'Extern' : `Slot ${slot}`);

export async function checkPrintStart(s: PrintSession, ctx: Ctx): Promise<Problem[]> {
  const name = s.name || 'Druckauftrag';
  const trays: HwTray[] = [...readTrays(ctx.ams).filter(t => !t.empty)];
  const ext = readExternal(ctx.vtTray);
  if (ext && !ext.empty) trays.push(ext);
  const spoolOf = (slot: number) => ctx.spools.find(x => x.id === ctx.amsSlots[slot]);
  const left = Math.max(0, 1 - (Number(ctx.percent) || 0) / 100);
  const problems: Problem[] = [];
  const usedSlots = new Set<number>();

  // Gewicht je Filament: aus der Druckdatei (Windows-/Server-App) oder gemerkt
  let filaments: { type: string; colorHex: string; grams: number }[] = [];
  try {
    const res = await printerApi.jobWeights({ jobName: name });
    if (res.ok && res.data?.success && res.data.filaments?.length) filaments = res.data.filaments;
  } catch {
    /* nur in der Windows-App möglich */
  }

  if (filaments.length) {
    for (const f of filaments) {
      const same = trays.filter(t => baseMaterial(t.type) === baseMaterial(f.type));
      if (!same.length) {
        problems.push({ title: `Kein ${baseMaterial(f.type) || f.type} im AMS`, sub: `Der Druck braucht ca. ${Math.round(f.grams)} g ${f.type}.`, color: f.colorHex });
        continue;
      }
      const tray = same.reduce((a, b) => (colorDistance(a.colorHex || '#888888', f.colorHex) <= colorDistance(b.colorHex || '#888888', f.colorHex) ? a : b));
      usedSlots.add(tray.slot);
      const sp = spoolOf(tray.slot);
      const need = f.grams * left;
      if (sp && need > 0 && sp.remainingWeight < need * 1.05) {
        problems.push({
          title: `${sp.brand} ${sp.name} reicht evtl. nicht`,
          sub: `${slotName(tray.slot)} · braucht ca. ${Math.round(need)} g · da ${Math.round(sp.remainingWeight)} g`,
          color: sp.colorHex
        });
      }
    }
  } else {
    const slot = activeSlotFromPrinter(ctx.ams);
    if (slot) {
      usedSlots.add(slot);
      const sp = spoolOf(slot);
      const known = readJobGrams()[jobKey(name)] || 0;
      const need = known * left;
      if (sp && need > 0 && sp.remainingWeight < need * 1.05) {
        problems.push({ title: `${sp.brand} ${sp.name} reicht evtl. nicht`, sub: `${slotName(slot)} · braucht ca. ${Math.round(need)} g · da ${Math.round(sp.remainingWeight)} g`, color: sp.colorHex });
      } else if (sp && sp.remainingWeight < getWorkshopSettings().nearlyEmptyG) {
        problems.push({ title: `${sp.brand} ${sp.name} ist fast leer`, sub: `${slotName(slot)} · nur noch ${Math.round(sp.remainingWeight)} g`, color: sp.colorHex });
      }
    }
  }

  // Material laut Drucker ≠ Spule laut App
  usedSlots.forEach(slot => {
    const sp = spoolOf(slot);
    const tray = trays.find(t => t.slot === slot);
    if (!sp || !tray || !tray.type) return;
    if (baseMaterial(sp.material) !== baseMaterial(tray.type)) {
      problems.push({
        title: `${slotName(slot)}: Material passt nicht`,
        sub: `Drucker meldet ${tray.type}, laut App liegt dort ${sp.brand} ${sp.name} (${sp.material}).`,
        color: sp.colorHex
      });
    }
  });

  if (problems.length) {
    const text = problems.length === 1 ? `${name}: ${problems[0].title}.` : `${name}: ${problems.length} Punkte prüfen (Filament/Material).`;
    void raiseAlert(
      { kind: 'print-check', key: `print-check-${s.id}`, title: 'Spulen-Check', text, toast: `🧐 ${text}`, items: problems },
      ctx.showToast
    );
  }
  return problems;
}
