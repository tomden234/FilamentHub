// FilamentHub-Assistent (läuft komplett im Gerät, ohne Internet).
// Versteht freie Sätze: Spulen werden unscharf erkannt (Marke, Name, Farbe, Material, Lagerort), Zahlen mit g/kg,
// Rückbezüge („davon“, „die“), Rückfragen bei mehreren Treffern (Antwort mit Nummer) und viele Fragen zum Bestand.
import type { Spool } from '../types/filament';
import { getDryingStatus } from './shopLinks';
import { isSealed, isInEibos } from './spoolState';

type AssistantAction =
  | { type: 'deduct'; spoolId: string; grams: number }
  | { type: 'add'; spoolId: string; grams: number }
  | { type: 'dried'; spoolId: string }
  | { type: 'camera' }
  | { type: 'view'; mode: 'simple' | 'full' }
  | { type: 'tab'; tab: 'settings' | 'tools' | 'gcode' | 'connect' }
  | { type: 'version'; id: string };

export interface AssistantMemory {
  /** zuletzt genannte Spule (für „davon“, „die“) */
  lastSpoolId?: string;
  /** offene Rückfrage: welche Spule? (Antwort mit Nummer) */
  pending?: { candidates: string[]; intent: 'deduct' | 'add' | 'set' | 'dried' | 'info'; grams?: number };
}

interface AssistantResult {
  reply: string;
  actions: AssistantAction[];
  memory: AssistantMemory;
}

interface AssistantContext {
  spools: Spool[];
  lowWeightG: number;
  eibosTara?: number;
  versions: { id: string; label: string }[];
  /** Android-App: ohne G-Code-Rechner und Backup */
  noGcode?: boolean;
}

const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9.,+ -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP = new Set(
  'bitte mal von der die das den dem des ein eine einen einem ich habe hab hat noch auf als ist sind wie viel viele welche welcher welches was wo zieh ziehe abziehen ab minus plus hinzu fuegen fuege dazu setze setz stell stelle markiere markier getrocknet trocken trocknen spule spulen rolle filament gramm g kg und mit fuer zu im in an es sie davon dafuer jetzt gerade heute neu verbraucht benutzt gedruckt'.split(
    ' '
  )
);

const MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PCTG', 'PC', 'PA', 'NYLON', 'PVA', 'HIPS', 'PET'];

const fmtG = (g: number) => (Math.abs(g) >= 1000 ? `${(g / 1000).toFixed(2).replace('.', ',')} kg` : `${Math.round(g)} g`);
const label = (s: Spool) => `${s.brand} ${s.name}`.trim();
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

/** Gramm aus dem Satz (12 g, 1,5 kg, 300gramm). Null = keine Zahl. */
function parseGrams(text: string): number | null {
  const t = text.toLowerCase().replace(',', '.');
  const kg = t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/);
  if (kg) return Math.round(parseFloat(kg[1]) * 1000);
  const g = t.match(/(\d+(?:\.\d+)?)\s*(?:g\b|gr\b|gramm)/);
  if (g) return Math.round(parseFloat(g[1]) * 10) / 10;
  const n = t.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
  return n ? parseFloat(n[1]) : null;
}

function materialIn(q: string): string | null {
  const up = ` ${q.toUpperCase()} `;
  return MATERIALS.find(m => up.includes(` ${m} `) || up.includes(` ${m}-`)) || null;
}

/** Spulen nach Ähnlichkeit sortiert (bester Treffer zuerst). Score 0 = kein Bezug. */
function rankSpools(spools: Spool[], text: string): { spool: Spool; score: number }[] {
  const words = norm(text)
    .split(' ')
    .filter(w => w && !STOP.has(w) && !/^\d/.test(w));
  if (!words.length) return [];
  const mat = materialIn(norm(text));
  return spools
    .map(s => {
      const hay = norm(`${s.brand} ${s.name} ${s.colorName} ${s.material} ${s.location || ''} ${s.id}`);
      const tokens = hay.split(' ');
      let score = 0;
      for (const w of words) {
        if (tokens.includes(w)) score += w.length >= 3 ? 3 : 1;
        else if (w.length >= 4 && tokens.some(t => t.startsWith(w) || (t.length >= 4 && w.startsWith(t)))) score += 2;
        else if (w.length >= 4 && hay.includes(w)) score += 1;
      }
      if (mat && s.material.toUpperCase().startsWith(mat)) score += 1;
      return { spool: s, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.spool.remainingWeight - b.spool.remainingWeight);
}

function pick(ctx: AssistantContext, text: string, mem: AssistantMemory): { spool?: Spool; candidates?: Spool[] } {
  const q = norm(text);
  if (/\b(davon|die|diese|dieselbe|der|dafuer|sie)\b/.test(q) && mem.lastSpoolId) {
    const ranked = rankSpools(ctx.spools, text);
    if (!ranked.length) {
      const s = ctx.spools.find(x => x.id === mem.lastSpoolId);
      if (s) return { spool: s };
    }
  }
  const ranked = rankSpools(ctx.spools, text);
  if (!ranked.length) return {};
  const top = ranked[0].score;
  const best = ranked.filter(r => r.score === top);
  if (best.length === 1 || top >= 6) return { spool: best[0].spool };
  return { candidates: best.slice(0, 6).map(r => r.spool) };
}

function ask(cands: Spool[], intent: NonNullable<AssistantMemory['pending']>['intent'], grams: number | undefined, mem: AssistantMemory): AssistantResult {
  return {
    reply: `Welche meinst du?\n${cands.map((s, i) => `${i + 1}. ${label(s)} (${s.colorName}, ${fmtG(s.remainingWeight)})`).join('\n')}\nAntworte einfach mit der Nummer.`,
    actions: [],
    memory: { ...mem, pending: { candidates: cands.map(c => c.id), intent, grams } }
  };
}

function act(ctx: AssistantContext, spool: Spool, intent: NonNullable<AssistantMemory['pending']>['intent'], grams: number | undefined, mem: AssistantMemory): AssistantResult {
  const m: AssistantMemory = { lastSpoolId: spool.id };
  if (intent === 'deduct') {
    if (!grams || grams <= 0) return { reply: `Wie viel Gramm soll ich von ${label(spool)} abziehen?`, actions: [], memory: { ...m, pending: { candidates: [spool.id], intent, grams } } };
    const rest = Math.max(0, spool.remainingWeight - grams);
    const warn = rest <= ctx.lowWeightG ? ` Achtung: nur noch ${fmtG(rest)}, fast leer.` : '';
    return { reply: `✅ ${fmtG(grams)} von ${label(spool)} abgezogen. Rest: ${fmtG(rest)}.${warn}`, actions: [{ type: 'deduct', spoolId: spool.id, grams }], memory: m };
  }
  if (intent === 'add') {
    if (!grams || grams <= 0) return { reply: `Wie viel Gramm soll ich zu ${label(spool)} hinzufügen?`, actions: [], memory: { ...m, pending: { candidates: [spool.id], intent, grams } } };
    return { reply: `✅ ${fmtG(grams)} zu ${label(spool)} hinzugefügt. Jetzt: ${fmtG(spool.remainingWeight + grams)}.`, actions: [{ type: 'add', spoolId: spool.id, grams }], memory: m };
  }
  if (intent === 'set') {
    if (grams == null || grams < 0) return { reply: `Auf wie viel Gramm soll ich ${label(spool)} setzen?`, actions: [], memory: { ...m, pending: { candidates: [spool.id], intent, grams } } };
    const diff = Math.round((grams - spool.remainingWeight) * 10) / 10;
    if (diff === 0) return { reply: `${label(spool)} hat schon genau ${fmtG(grams)}.`, actions: [], memory: m };
    return {
      reply: `✅ ${label(spool)} auf ${fmtG(grams)} gesetzt (${diff > 0 ? '+' : ''}${fmtG(diff)}).`,
      actions: [diff > 0 ? { type: 'add', spoolId: spool.id, grams: diff } : { type: 'deduct', spoolId: spool.id, grams: -diff }],
      memory: m
    };
  }
  if (intent === 'dried') return { reply: `☀️ ${label(spool)} ist als getrocknet markiert.`, actions: [{ type: 'dried', spoolId: spool.id }], memory: m };
  // info
  const d = getDryingStatus(spool);
  const days = Math.round(Math.abs(d.diffMs) / 86400000);
  const value = (spool.remainingWeight / 1000) * (spool.pricePerKg || 0);
  return {
    reply: [
      `📦 ${label(spool)} (${spool.material}, ${spool.colorName})`,
      `Rest: ${fmtG(spool.remainingWeight)} von ${fmtG(spool.initialWeight)} (${Math.round((spool.remainingWeight / Math.max(1, spool.initialWeight)) * 100)} %)`,
      `Trocknen: ${d.isOverdue ? `seit ${days} Tagen fällig` : `in ${days} Tagen`} · ${spool.dryTemp} °C für ${spool.dryHours} h`,
      spool.location ? `Lagerort: ${spool.location}` : '',
      spool.pricePerKg ? `Wert des Rests: ${eur(value)} (${eur(spool.pricePerKg)}/kg)` : '',
      spool.nozzleTemp ? `Düse ${spool.nozzleTemp} °C${spool.bedTemp ? ` · Bett ${spool.bedTemp} °C` : ''}` : ''
    ]
      .filter(Boolean)
      .join('\n'),
    actions: [],
    memory: m
  };
}

const has = (q: string, ...w: string[]) => w.some(x => q.includes(x));

/** Spar-Tipps aus dem eigenen Bestand: Reste zuerst, doppelte Farben, ungeöffnete Spulen, Vorrat, Preisunterschiede, Trocknen */
function savingTips(ctx: AssistantContext): string {
  const spools = ctx.spools.filter(s => (s.remainingWeight || 0) > 0);
  if (!spools.length) return 'Du hast noch keine Spulen eingetragen. Trag sie ein, dann zeige ich dir, wo du sparen kannst.';
  const tips: string[] = [];
  const valueOf = (s: Spool) => ((s.remainingWeight || 0) / 1000) * (s.pricePerKg || 0);
  const open = spools.filter(s => !isSealed(s));

  // 1. Reste zuerst
  const rests = open
    .filter(s => (s.initialWeight || 1000) > 0 && s.remainingWeight / (s.initialWeight || 1000) <= 0.25)
    .sort((a, b) => a.remainingWeight - b.remainingWeight)
    .slice(0, 4);
  if (rests.length) tips.push(`🧵 Reste zuerst verdrucken (kleine Teile, Tests, Stützen):\n${rests.map(s => `   • ${label(s)}: ${fmtG(s.remainingWeight)}`).join('\n')}`);

  // 2. Gleiche Farbe doppelt angebrochen
  const groups = new Map<string, Spool[]>();
  open.forEach(s => {
    const k = `${s.material}|${norm(s.colorName || s.name)}`;
    groups.set(k, [...(groups.get(k) || []), s]);
  });
  const doubles = [...groups.values()].filter(g => g.length >= 2).slice(0, 3);
  if (doubles.length) tips.push(`🎨 Gleiche Farbe mehrfach angebrochen, erst eine leer machen:\n${doubles.map(g => `   • ${g[0].material} ${g[0].colorName || g[0].name}: ${g.length} Spulen (${fmtG(g.reduce((a, x) => a + x.remainingWeight, 0))})`).join('\n')}`);

  // 3. Vorrat reicht
  const byMat = new Map<string, number>();
  spools.forEach(s => byMat.set(s.material, (byMat.get(s.material) || 0) + s.remainingWeight));
  const plenty = [...byMat.entries()].filter(([, g]) => g >= 3000).sort((a, b) => b[1] - a[1]);
  if (plenty.length) tips.push(`📦 Genug auf Lager, erstmal nicht nachkaufen: ${plenty.map(([m, g]) => `${m} (${fmtG(g)})`).join(', ')}.`);

  // 4. Preisunterschied je Material
  const diffs: string[] = [];
  byMat.forEach((_, m) => {
    const priced = spools.filter(s => s.material === m && s.pricePerKg > 0).sort((a, b) => a.pricePerKg - b.pricePerKg);
    if (priced.length >= 2 && priced[priced.length - 1].pricePerKg - priced[0].pricePerKg >= 4) {
      diffs.push(`${m}: ${label(priced[0])} (${eur(priced[0].pricePerKg)}/kg) statt ${label(priced[priced.length - 1])} (${eur(priced[priced.length - 1].pricePerKg)}/kg) für Prototypen`);
    }
  });
  if (diffs.length) tips.push(`💶 Günstigere Spule für Tests nehmen:\n${diffs.slice(0, 3).map(d => `   • ${d}`).join('\n')}`);

  // 5. Trocknen nur wo nötig
  const sealed = spools.filter(s => isSealed(s) && !s.needsDrying);
  const dueDry = spools.filter(s => s.needsDrying || getDryingStatus(s).statusLevel === 'overdue');
  const noBag = dueDry.filter(s => !isInEibos(s));
  const dryParts: string[] = [];
  if (sealed.length) dryParts.push(`${sealed.length} verschweißte Spule(n) brauchen kein Trocknen`);
  if (noBag.length) dryParts.push(`${noBag.length} fällige Spule(n) danach im Eibos-Beutel lagern, dann hält es länger`);
  if (dryParts.length) tips.push(`☀️ Strom und Zeit beim Trocknen sparen: ${dryParts.join('; ')}.`);

  // 6. Gebundenes Geld in ungeöffneten Spulen
  const sealedValue = sealed.reduce((a, s) => a + valueOf(s), 0);
  if (sealed.length >= 3 && sealedValue > 0) tips.push(`🔒 In ${sealed.length} ungeöffneten Spulen stecken ca. ${eur(sealedValue)}. Erst die angebrochenen leer machen.`);

  return tips.length ? `💡 So sparst du:\n${tips.join('\n')}` : 'Dein Bestand ist schon schlank: keine Reste, keine doppelten Farben, kein Überfluss. Weiter so.';
}

export function runAssistant(input: string, ctx: AssistantContext, mem: AssistantMemory): AssistantResult {
  const q = norm(input);
  const grams = parseGrams(input);

  // Antwort auf Rückfrage („2“)
  if (mem.pending && /^\d+$/.test(q)) {
    const idx = parseInt(q, 10) - 1;
    const id = mem.pending.candidates[idx] ?? (mem.pending.candidates.length === 1 ? mem.pending.candidates[0] : undefined);
    const s = ctx.spools.find(x => x.id === id);
    if (s && mem.pending.candidates.length > 1) return act(ctx, s, mem.pending.intent, mem.pending.grams, mem);
    if (s && mem.pending.candidates.length === 1) return act(ctx, s, mem.pending.intent, parseFloat(q), mem);
  }
  // Nur eine Zahl nach „wie viel Gramm?“
  if (mem.pending && mem.pending.candidates.length === 1 && grams != null && !rankSpools(ctx.spools, input).length) {
    const s = ctx.spools.find(x => x.id === mem.pending!.candidates[0]);
    if (s) return act(ctx, s, mem.pending.intent, grams, mem);
  }

  // Fragen („Was muss getrocknet werden?“) sind keine Befehle
  const isQuestion = /\?\s*$/.test(input.trim()) || /^(was|welche|welcher|welches|wie|wo|wann|gibt|hab|habe|ist|sind)\b/.test(q);

  // Aktionen mit Spule
  let intent: NonNullable<AssistantMemory['pending']>['intent'] | null = null;
  if (!isQuestion && has(q, 'zieh', 'abzieh', 'minus', 'verbraucht', 'verdruckt', 'benutzt', 'gedruckt', 'weg ', 'abbuch')) intent = 'deduct';
  else if (!isQuestion && has(q, 'hinzu', 'dazu', 'plus', 'aufgefuellt', 'nachgefuellt', 'addier')) intent = 'add';
  else if (/(setz|stell|korrigier|wiegt|hat noch|sind noch|noch \d|auf \d+)/.test(q) && grams != null && !has(q, 'wie viel', 'wieviel')) intent = 'set';
  else if (!isQuestion && has(q, 'getrocknet', 'trocken markier', 'markiere', 'als trocken', 'fertig getrocknet')) intent = 'dried';

  if (intent) {
    const r = pick(ctx, input, mem);
    if (r.spool) return act(ctx, r.spool, intent, grams ?? undefined, mem);
    if (r.candidates) return ask(r.candidates, intent, grams ?? undefined, mem);
    return { reply: 'Welche Spule? Nenn Marke, Farbe oder Material, z. B. „Zieh 25 g von Bambu PLA Weiß ab“.', actions: [], memory: mem };
  }

  // Sparen
  if (has(q, 'spar', 'einspar', 'sparfunktion', 'spartipp')) return { reply: savingTips(ctx), actions: [], memory: mem };

  // Navigation & Ansicht
  if (has(q, 'kamera', 'foto', 'scann', 'fotografier')) return { reply: '📷 Kamera geöffnet.', actions: [{ type: 'camera' }], memory: mem };
  if (has(q, 'vereinfacht', 'kompakt', 'einfache ansicht')) return { reply: 'Vereinfachte Ansicht an.', actions: [{ type: 'view', mode: 'simple' }], memory: mem };
  if (has(q, 'vollstaendig', 'volle ansicht', 'trocknungsbalken', 'details an')) return { reply: 'Vollständige Ansicht an.', actions: [{ type: 'view', mode: 'full' }], memory: mem };
  if (has(q, 'gcode', 'g-code', 'rechner', 'kosten berechnen')) return { reply: ctx.noGcode ? 'Den G-Code-Rechner gibt es nur in der Windows-App und im Browser.' : 'G-Code-Rechner geöffnet.', actions: ctx.noGcode ? [] : [{ type: 'tab', tab: 'gcode' }], memory: mem };
  if (has(q, 'backup', 'tools', 'werkzeug')) return { reply: ctx.noGcode ? 'Tools geöffnet (Cloud-Abgleich, Spulenbestand).' : 'Tools geöffnet (Backup, Cloud-Sync).', actions: [{ type: 'tab', tab: 'tools' }], memory: mem };
  if (has(q, 'tara', 'eibos')) return { reply: `Einstellungen geöffnet. Eibos-Tara ist ${ctx.eibosTara ?? '–'} g.`, actions: [{ type: 'tab', tab: 'settings' }], memory: mem };
  if (has(q, 'einstellung', 'design', 'farbe aendern', 'theme')) return { reply: 'Einstellungen geöffnet.', actions: [{ type: 'tab', tab: 'settings' }], memory: mem };
  const v = ctx.versions.find(x => q.includes(norm(x.id)) || q.includes(norm(x.id).replace('v', '')));
  if (v && has(q, 'version', 'profil', 'wechsel')) return { reply: `Profil ${v.label} aktiv.`, actions: [{ type: 'version', id: v.id }], memory: mem };

  const spools = ctx.spools;
  const total = spools.reduce((a, s) => a + (s.remainingWeight || 0), 0);

  // Fragen zum Bestand
  if (has(q, 'fast leer', 'leer', 'nachkaufen', 'bestellen', 'knapp', 'wenig')) {
    const low = spools.filter(s => s.remainingWeight <= ctx.lowWeightG).sort((a, b) => a.remainingWeight - b.remainingWeight);
    return {
      reply: low.length
        ? `🛒 ${low.length} Spule(n) unter ${fmtG(ctx.lowWeightG)}:\n${low.map(s => `• ${label(s)}: ${fmtG(s.remainingWeight)}`).join('\n')}`
        : `Keine Spule unter ${fmtG(ctx.lowWeightG)}. Alles gut gefüllt.`,
      actions: [],
      memory: mem
    };
  }
  if (has(q, 'trocknen', 'trocknung', 'getrocknet', 'trocken', 'feucht', 'nass')) {
    const due = spools
      .map(s => ({ s, d: getDryingStatus(s) }))
      .filter(x => x.d.statusLevel !== 'ok')
      .sort((a, b) => a.d.diffMs - b.d.diffMs);
    return {
      reply: due.length
        ? `☀️ Trocknen:\n${due
            .slice(0, 10)
            .map(x => `• ${label(x.s)}: ${x.d.isOverdue ? `seit ${Math.round(-x.d.diffMs / 86400000)} T fällig` : `bald (${Math.round(x.d.diffMs / 86400000)} T)`} · ${x.s.dryTemp} °C/${x.s.dryHours} h`)
            .join('\n')}${due.length > 10 ? `\n… und ${due.length - 10} weitere` : ''}`
        : 'Keine Spule muss gerade getrocknet werden.',
      actions: [],
      memory: mem
    };
  }
  if (has(q, 'wert', 'kosten', 'euro', 'geld', 'preis')) {
    const value = spools.reduce((a, s) => a + (s.remainingWeight / 1000) * (s.pricePerKg || 0), 0);
    const priced = [...spools].filter(s => s.pricePerKg > 0).sort((a, b) => a.pricePerKg - b.pricePerKg);
    return {
      reply: `💶 Restbestand ist ca. ${eur(value)} wert (${fmtG(total)}).${priced.length ? `\nGünstigste: ${label(priced[0])} (${eur(priced[0].pricePerKg)}/kg)\nTeuerste: ${label(priced[priced.length - 1])} (${eur(priced[priced.length - 1].pricePerKg)}/kg)` : ''}`,
      actions: [],
      memory: mem
    };
  }
  if (has(q, 'wo ', 'lagerort', 'wo liegt', 'wo ist')) {
    const r = pick(ctx, input, mem);
    if (r.spool) return { reply: r.spool.location ? `📍 ${label(r.spool)} liegt: ${r.spool.location}` : `${label(r.spool)} hat keinen Lagerort eingetragen.`, actions: [], memory: { lastSpoolId: r.spool.id } };
  }
  const mat = materialIn(q);
  if (has(q, 'wie viel', 'wieviel', 'bestand', 'uebersicht', 'insgesamt', 'habe ich', 'hab ich', 'statistik')) {
    if (mat) {
      const list = spools.filter(s => s.material.toUpperCase().startsWith(mat));
      const sum = list.reduce((a, s) => a + s.remainingWeight, 0);
      return { reply: `${mat}: ${list.length} Spule(n), zusammen ${fmtG(sum)}.\n${list.map(s => `• ${label(s)}: ${fmtG(s.remainingWeight)}`).join('\n')}`, actions: [], memory: mem };
    }
    const one = pick(ctx, input, mem);
    if (one.spool) return act(ctx, one.spool, 'info', undefined, mem);
    const byMat = new Map<string, number>();
    spools.forEach(s => byMat.set(s.material, (byMat.get(s.material) || 0) + s.remainingWeight));
    return {
      reply: `📊 ${spools.length} Spulen, zusammen ${fmtG(total)}.\n${[...byMat.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([m, g]) => `• ${m}: ${fmtG(g)}`)
        .join('\n')}`,
      actions: [],
      memory: mem
    };
  }
  if (has(q, 'meiste', 'groesste', 'vollste')) {
    const s = [...spools].sort((a, b) => b.remainingWeight - a.remainingWeight)[0];
    if (s) return { reply: `Am meisten: ${label(s)} mit ${fmtG(s.remainingWeight)}.`, actions: [], memory: { lastSpoolId: s.id } };
  }
  if (has(q, 'hilfe', 'was kannst', 'befehle', 'help')) {
    return {
      reply:
        'Das kann ich:\n• „Zieh 35 g von Bambu Weiß ab“ / „25 g PETG schwarz verbraucht“\n• „Setz Eryone Rot auf 640 g“ / „200 g zu Sunlu Grau hinzufügen“\n• „Markiere PETG Weiß als getrocknet“\n• „Was ist fast leer?“, „Was muss getrocknet werden?“\n• „Wie viel PLA habe ich?“, „Was ist mein Filament wert?“\n• „Info zu Geeetech Braun“, „Wo liegt …?“\n• „Wo kann ich sparen?“ (Spar-Tipps aus deinem Bestand)\n• „Kamera öffnen“, „G-Code-Rechner“, „Einstellungen“\nAuf Rückfragen einfach mit der Nummer antworten.',
      actions: [],
      memory: mem
    };
  }

  // Nur Spule genannt → Info
  const r = pick(ctx, input, mem);
  if (r.spool) return act(ctx, r.spool, 'info', undefined, mem);
  if (r.candidates) return ask(r.candidates, 'info', undefined, mem);

  return {
    reply: 'Das habe ich nicht verstanden. Schreib z. B. „Zieh 20 g von Bambu Weiß ab“, „Was ist fast leer?“ oder „Hilfe“.',
    actions: [],
    memory: mem
  };
}
