// Abzug auf dem Server – reine Logik (ohne Netz, darum testbar).
// 1) planParts: Welche Spule verliert wie viel Gramm? (gleiche Regeln wie in der App, useLanDeduct)
// 2) applyDeduction: Abzug in das Cloud-Dokument schreiben (Spulen, Verlauf, Druckliste, serverDeducts).
//    Genau EINMAL: steht der Druck schon in serverDeducts oder hat er in der Druckliste schon Gramm (App hat abgezogen), passiert nichts.
import { baseMaterial, colorDistance, EXTERNAL_SLOT } from '../../src/utils/amsMatch.js';
import { bestSpool } from '../../src/utils/printUsage.js';
import { samePrint as samePrintCore } from '../../src/utils/printMatch.js';

interface SpoolLite {
  id: string;
  brand?: string;
  name?: string;
  material: string;
  colorHex?: string;
  pricePerKg?: number;
  remainingWeight: number;
  [k: string]: unknown;
}

export interface TrayLite {
  slot: number;
  type: string;
  colorHex: string | null;
  empty?: boolean;
}

export interface Part {
  spoolId: string;
  grams: number;
}

interface PlanInput {
  /** Gewicht je Filament aus der Druckdatei (null = unbekannt) */
  filaments: { type: string; colorHex: string; grams: number }[] | null;
  /** Fächer laut Drucker (AMS 1-4, extern 5) */
  trays: TrayLite[];
  /** Slots, die beim Druck aktiv waren */
  usedSlots: number[];
  /** Slot, der am längsten aktiv war */
  mainSlot: number | null;
  /** Zuordnung Slot → Spule aus der App */
  amsSlots: Record<string, string>;
  spools: SpoolLite[];
  /** Gemerktes Gewicht zum Auftragsnamen (0 = keins) */
  knownGrams: number;
}

const round1 = (g: number) => Math.round(g * 10) / 10;

/** Spule des Hauptslots: zugewiesen, sonst über Material und Farbe */
function mainSpoolId(i: Pick<PlanInput, 'mainSlot' | 'amsSlots' | 'spools' | 'trays'>): string {
  if (!i.mainSlot) return '';
  const assigned = i.amsSlots[String(i.mainSlot)];
  if (assigned && i.spools.some(s => s.id === assigned)) return assigned;
  const t = i.trays.find(x => x.slot === i.mainSlot && !x.empty && x.type);
  return t ? bestSpool(i.spools as any, t.type, t.colorHex || '#888888') : '';
}

/** Welche Spule verliert wie viel? Leere Liste = unbekannt (dann fragt die App). */
export function planParts(i: PlanInput): Part[] {
  const main = mainSpoolId(i);
  const fil = (i.filaments || []).filter(f => f && f.grams > 0);
  if (fil.length) {
    const all = i.trays.filter(t => !t.empty && t.type);
    const used = new Set(i.usedSlots);
    const usedOnly = all.filter(t => used.has(t.slot));
    const per = new Map<string, number>();
    // 1.225 Mehrfarbdruck: jede Farbe bekommt ihr EIGENES Fach (beste Farbnähe zuerst), damit z. B. Weiß und Schwarz PLA
    // nicht beide auf einer Spule landen. Erst wenn kein freies Fach mit dem Material übrig ist, darf ein Fach doppelt.
    // Fächer, die laut Drucker benutzt wurden, zuerst; andere nur, wenn dort nichts passt (kurzer Farbwechsel nicht erfasst)
    const pairs: { fi: number; t: TrayLite; d: number; off: number }[] = [];
    fil.forEach((f, fi) => {
      for (const t of all) {
        if (baseMaterial(t.type) !== baseMaterial(f.type)) continue;
        pairs.push({ fi, t, d: colorDistance(t.colorHex || '#888888', f.colorHex), off: usedOnly.length && !used.has(t.slot) ? 1 : 0 });
      }
    });
    pairs.sort((x, y) => x.off - y.off || x.d - y.d);
    const trayOf = new Map<number, TrayLite>();
    const taken = new Set<number>();
    for (const p of pairs) {
      if (trayOf.has(p.fi) || taken.has(p.t.slot)) continue;
      trayOf.set(p.fi, p.t);
      taken.add(p.t.slot);
    }
    for (const p of pairs) if (!trayOf.has(p.fi)) trayOf.set(p.fi, p.t);
    fil.forEach((f, fi) => {
      const t = trayOf.get(fi);
      const a = t ? i.amsSlots[String(t.slot)] : '';
      let target = a && i.spools.some(s => s.id === a) ? a : '';
      if (!target && t) target = bestSpool(i.spools as any, t.type, t.colorHex || f.colorHex);
      if (!target && fil.length === 1) target = main;
      if (!target) target = bestSpool(i.spools as any, f.type, f.colorHex);
      if (target) per.set(target, (per.get(target) || 0) + f.grams);
    });
    return Array.from(per, ([spoolId, grams]) => ({ spoolId, grams: round1(grams) })).filter(p => p.grams > 0);
  }
  if (i.knownGrams > 0 && main) return [{ spoolId: main, grams: round1(i.knownGrams) }];
  return [];
}

export interface PrintInfo {
  id: string;
  name: string;
  startMs: number;
  endMs: number;
  state: 'FINISH' | 'FAILED';
  percent: number;
}

export interface ServerDeduct {
  id: string;
  name: string;
  endMs: number;
  parts: Part[];
  at: number;
}

const nameKey = (n: string) =>
  String(n || '')
    .toLowerCase()
    .replace(/\.(gcode\.3mf|3mf|gcode)$/g, '')
    .trim();

/** Gleicher Druck? Gleiche Regel wie in der App (printMatch.ts): Name+Ende, „Druckauftrag“ ohne Namen, überlappende Laufzeit */
export const samePrint = samePrintCore;

/** Wurde dieser Druck schon abgezogen (vom Server oder von einer App)? */
export function deductedIn(doc: any, p: { id: string; name: string; endMs: number }): 'server' | 'app' | null {
  const sds: ServerDeduct[] = Array.isArray(doc?.serverDeducts) ? doc.serverDeducts : [];
  if (sds.some(d => d && (d.id === p.id || samePrint(d, p, 10 * 60_000)))) return 'server';
  const log: any[] = Array.isArray(doc?.printLog) ? doc.printLog : [];
  if (log.some(r => r && (r.id === p.id || samePrint(r, p, 10 * 60_000)) && Number(r.grams) > 0)) return 'app';
  return null;
}

export const historyIdOf = (printId: string, spoolId: string) => `srv:${printId}:${spoolId}`;

/** Abzug in das Cloud-Dokument schreiben. Gibt das neue Dokument zurück, oder null mit Grund, wenn nichts zu tun ist. */
export function applyDeduction(doc: any, p: PrintInfo, parts: Part[], now: number): { ok: true; doc: any; texts: string[] } | { ok: false; reason: string } {
  const already = deductedIn(doc, p);
  if (already) return { ok: false, reason: already === 'server' ? 'schon vom Server abgezogen' : 'schon in einer App abgezogen' };
  const spools: SpoolLite[] = Array.isArray(doc?.spools) ? doc.spools : [];
  const valid = parts.filter(x => x.grams > 0 && spools.some(s => s.id === x.spoolId));
  if (!valid.length) return { ok: false, reason: 'keine passende Spule' };

  const ts = new Date(p.endMs || now).toISOString();
  const texts: string[] = [];
  const recSpools: { id: string; label: string; color: string; grams: number; cost: number }[] = [];
  const newHistory: any[] = [];
  let nextSpools = spools;
  for (const part of valid) {
    const sp = nextSpools.find(s => s.id === part.spoolId)!;
    const label = `${sp.brand || ''} ${sp.name || ''}`.trim() || 'Spule';
    const grams = Math.round(part.grams);
    const rest = Math.max(0, Math.round((Number(sp.remainingWeight) || 0) - part.grams));
    nextSpools = nextSpools.map(s => (s.id === sp.id ? { ...s, remainingWeight: rest, sealed: false } : s));
    newHistory.push({ id: historyIdOf(p.id, sp.id), spoolId: sp.id, spoolLabel: label, grams, timestamp: ts });
    const cost = (Number(sp.pricePerKg) || 0) * (part.grams / 1000);
    recSpools.push({ id: sp.id, label, color: String(sp.colorHex || '#888888'), grams: part.grams, cost });
    texts.push(`${grams} g von ${label} (${rest} g übrig)`);
  }

  const gramsSum = recSpools.reduce((a, s) => a + s.grams, 0);
  const costSum = recSpools.reduce((a, s) => a + s.cost, 0);
  const log: any[] = Array.isArray(doc?.printLog) ? doc.printLog : [];
  const idx = log.findIndex(r => r && (r.id === p.id || samePrint(r, p, 10 * 60_000)));
  const base = {
    id: p.id,
    name: p.name,
    startMs: p.startMs,
    endMs: p.endMs,
    state: p.state,
    missed: false,
    percent: p.percent,
    durationMin: Math.max(0, Math.round((p.endMs - p.startMs) / 60000)),
    hasPhoto: false
  };
  const rec = idx >= 0 ? { ...log[idx], spools: recSpools, grams: gramsSum, cost: costSum } : { ...base, spools: recSpools, grams: gramsSum, cost: costSum };
  const nextLog = idx >= 0 ? log.map((r, i) => (i === idx ? rec : r)) : [rec, ...log];

  const sds: ServerDeduct[] = Array.isArray(doc?.serverDeducts) ? doc.serverDeducts : [];
  const sd: ServerDeduct = { id: p.id, name: p.name, endMs: p.endMs, parts: valid.map(x => ({ spoolId: x.spoolId, grams: x.grams })), at: now };
  const keepSds = [sd, ...sds.filter(d => d && now - Number(d.at) < 30 * 86400_000)].slice(0, 150);

  return {
    ok: true,
    doc: {
      ...doc,
      updatedAt: now,
      spools: nextSpools,
      printHistory: [...newHistory, ...(Array.isArray(doc?.printHistory) ? doc.printHistory : [])],
      printLog: nextLog.slice(0, 400),
      serverDeducts: keepSds
    },
    texts
  };
}

/** Spulen-Check beim Druckstart: reicht das Filament? Gibt verständliche Texte zurück. */
export function shortages(i: {
  filaments: { type: string; colorHex: string; grams: number }[] | null;
  trays: TrayLite[];
  amsSlots: Record<string, string>;
  spools: SpoolLite[];
  mainSlot: number | null;
  knownGrams: number;
  /** Anteil, der noch gedruckt wird (0-1) */
  left: number;
}): string[] {
  const out: string[] = [];
  const spoolOf = (slot: number) => i.spools.find(s => s.id === i.amsSlots[String(slot)]);
  const label = (s: SpoolLite) => `${s.brand || ''} ${s.name || ''}`.trim();
  const slotName = (slot: number) => (slot === EXTERNAL_SLOT ? 'Extern' : `Slot ${slot}`);
  const fil = (i.filaments || []).filter(f => f.grams > 0);
  if (fil.length) {
    const trays = i.trays.filter(t => !t.empty && t.type);
    for (const f of fil) {
      const same = trays.filter(t => baseMaterial(t.type) === baseMaterial(f.type));
      if (!same.length) {
        out.push(`Kein ${baseMaterial(f.type) || f.type} im AMS (braucht ca. ${Math.round(f.grams)} g).`);
        continue;
      }
      const tray = same.reduce((a, b) => (colorDistance(a.colorHex || '#888888', f.colorHex) <= colorDistance(b.colorHex || '#888888', f.colorHex) ? a : b));
      const sp = spoolOf(tray.slot);
      const need = f.grams * i.left;
      if (sp && need > 0 && sp.remainingWeight < need * 1.05) out.push(`${label(sp)} (${slotName(tray.slot)}) reicht evtl. nicht: braucht ca. ${Math.round(need)} g, da ${Math.round(sp.remainingWeight)} g.`);
    }
    return out;
  }
  if (i.mainSlot && i.knownGrams > 0) {
    const sp = spoolOf(i.mainSlot);
    const need = i.knownGrams * i.left;
    if (sp && sp.remainingWeight < need * 1.05) out.push(`${label(sp)} (${slotName(i.mainSlot)}) reicht evtl. nicht: braucht ca. ${Math.round(need)} g, da ${Math.round(sp.remainingWeight)} g.`);
  }
  return out;
}

/** Druckdauer, die „normal“ ist: Mittel der letzten fertigen Drucke mit gleichem Namen, sonst Schätzung des Druckers */
export function expectedMinutes(history: { name: string; startMs: number; endMs: number; state: string }[], name: string, printerEstimateMin: number): number {
  const same = history.filter(h => h.state === 'FINISH' && nameKey(h.name) === nameKey(name) && h.endMs > h.startMs).slice(-5);
  if (same.length) return same.reduce((a, h) => a + (h.endMs - h.startMs) / 60000, 0) / same.length;
  return printerEstimateMin > 0 ? printerEstimateMin : 0;
}

/** Dauert der Druck viel länger als gewohnt? (mind. 30 % und 20 Minuten länger) */
export function tooLong(elapsedMin: number, expectedMin: number): boolean {
  if (!(expectedMin > 0)) return false;
  return elapsedMin > expectedMin * 1.3 && elapsedMin - expectedMin > 20;
}
