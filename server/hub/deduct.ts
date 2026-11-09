// Hub: Druckende und Abzug in der Cloud – genau EINMAL je Druck (1.231 aus hub.ts herausgelöst).
import crypto from 'crypto';
import { fetchJobWeights } from '../bambuJobFile.js';
import { printRecorder, nameKey, type RecordedPrint } from '../printRecorder.js';
import { applyDeduction, deductedIn, planParts, type Part, type PrintInfo } from './deductPlan.js';
import { cloudReady, loadDoc, saveDoc } from './cloud.js';
import { startedJobFilaments, startedJobNear, startedJobTime } from './queue.js';
import { learnFromPrint } from './printTime.js';
import { isGenericPrintName } from '../../src/utils/printMatch.js';
import { publishImage } from './esphome.js';
import { type Fil, access, deductActive, durText, getHubConfig, hubEnabled, mainSlotOf, port, push, saveState, sleep, state, traysOf, updateHubConfig } from './core.js';
import { lastJpeg, readPhoto, takePhoto } from './photo.js';
import { statsGrams, statsPrint, type StatGram } from './printStats.js';
import { ratingForEnd } from './rating.js';

/** Gramm je Material und Farbe für das Dauer-Protokoll (Fun Facts) */
const gramsOf = (parts: Part[], spools: any[]): StatGram[] =>
  parts.map(p => {
    const sp = spools.find(x => x.id === p.spoolId);
    return [sp ? `${sp.material || ''} ${sp.colorName || ''}`.trim() || 'Unbekannt' : 'Unbekannt', String(sp?.colorHex || '#9ca3af'), p.grams, p.spoolId] as StatGram;
  });

/**
 * Gewichte eines Drucks. Reihenfolge (1.227):
 * 1. von der Warteschlange gestartet (Name oder Startzeit), 2. schon beim Druckstart geholt,
 * 3. Datei auf dem Drucker per Name, 4. ohne Namen: neueste Druckdatei vor dem Start.
 */
export async function jobWeights(name: string, startMs = 0, tries = 3): Promise<{ filaments: Fil[]; fileName?: string } | null> {
  const generic = isGenericPrintName(name);
  const known = generic ? null : startedJobFilaments(name);
  if (known) return { filaments: known };
  const near = startedJobNear(startMs);
  if (near) return { filaments: near.filaments, fileName: near.name };
  const of = state().openFil;
  if (of && startMs && Math.abs(of.startMs - startMs) < 5 * 60_000 && of.filaments.length) return { filaments: of.filaments, fileName: of.name };
  const lan = port?.getLanAccess();
  if (!lan) return null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetchJobWeights({ ip: lan.ip, code: lan.code, jobName: generic ? '' : name, newestBefore: generic ? startMs || Date.now() : undefined });
      if (!('error' in r) && r.filaments.length) return { filaments: r.filaments, fileName: r.fileName };
    } catch {
      /* nochmal */
    }
    if (i < tries - 1) await sleep(20_000);
  }
  return null;
}

/** 1.227: Schätzung, wenn gar nichts bekannt ist: Gramm je Minute aus deinen letzten abgezogenen Drucken */
function gramsPerMinute(): number {
  const s = state();
  let g = 0;
  let min = 0;
  const recs = printRecorder.list();
  for (const [id, m] of Object.entries(s.prints)) {
    if (m.deduct !== 'done' || !m.parts?.length || m.estimated) continue;
    const r = recs.find(p => p.id === id);
    const dur = r ? (r.endMs - r.startMs) / 60000 : 0;
    if (!r || r.state !== 'FINISH' || dur < 5) continue;
    g += m.parts.reduce((a, p) => a + p.grams, 0);
    min += dur;
  }
  return min >= 30 ? g / min : 0;
}

// ---------- Druckende ----------

/** Vom Rekorder: ein Druck ist gerade zu Ende gegangen */
export function onPrintEnd(rec: RecordedPrint, data: any): void {
  if (!hubEnabled()) return;
  const s = state();
  if (s.prints[rec.id]) return; // schon bearbeitet
  try {
    statsPrint(rec);
  } catch (e) {
    console.warn('[Statistik]', (e as Error)?.message || e);
  }
  try {
    learnFromPrint(rec, startedJobTime(rec.name, rec.startMs)); // 1.271: echte Dauer ÷ Slicer-Zeit lernen
  } catch (e) {
    console.warn('[Druckzeit]', (e as Error)?.message || e);
  }
  s.prints[rec.id] = { deduct: deductActive() ? 'pending' : 'off', tries: 0, lastTry: 0, photo: false, pushed: false, trays: traysOf(data), energyWh: Math.round(s.printWh), at: Date.now() };
  s.printWh = 0;
  saveState();
  void handleEnd(rec);
}

async function handleEnd(rec: RecordedPrint): Promise<void> {
  const m = state().prints[rec.id];
  if (!m) return;
  m.photo = await takePhoto(rec.id);
  saveState();
  if (m.deduct === 'pending') {
    await sleep(60_000); // Druckdatei und Cloud kurz zur Ruhe kommen lassen
    await tryDeduct(rec);
  }
  await pushEnd(rec);
}

async function pushEnd(rec: RecordedPrint): Promise<void> {
  const m = state().prints[rec.id];
  if (!m || m.pushed) return;
  if (m.deduct === 'pending' || m.deduct === 'working') return; // Push kommt nach dem Abzug
  m.pushed = true;
  saveState();
  const dur = durText((rec.endMs - rec.startMs) / 60000);
  const image = m.photo && lastJpeg ? publishImage(lastJpeg, `${crypto.randomBytes(8).toString('hex')}.jpg`) || undefined : undefined;
  if (rec.state === 'FINISH') {
    const extra = m.deduct === 'done' && m.texts?.length ? `\nAbgezogen: ${m.texts.join(', ')}` : m.deduct === 'ask' ? '\nBitte in der App bestätigen: Spule abziehen?' : '';
    // 1.280: 👍/👎 + was bei diesem Modell früher gut oder schlecht lief
    let actions: { action: string; title: string }[] | undefined;
    let hint = '';
    try {
      const fils = m.fils?.length ? m.fils : m.trays?.filter(t => !t.empty && t.slot === mainSlotOf(rec.slots)).map(t => t.type) || [];
      const r = ratingForEnd({ id: rec.id, name: rec.name, fils });
      actions = r.actions;
      hint = r.hint ? `\n${r.hint}` : '';
    } catch {
      /* ohne Knöpfe weiter */
    }
    await push('done', '✅ Druck fertig', `${rec.name} · ${dur}${extra}${hint}`, { tag: `print-${rec.id}`, image, actions });
  } else {
    await push('failed', '❌ Druck abgebrochen', `${rec.name} bei ${rec.percent} % · ${dur}\nIn der App: Spule anteilig abziehen?`, { tag: `print-${rec.id}`, image });
  }
}

/** 1.263: Test „Druck fertig“ mit einem echten alten Druck (neuester fertiger mit Foto, sonst neuester fertiger): Bild, Dauer, Abzug, Strom */
export async function pushOldDone(): Promise<{ ok: boolean; name?: string; hasImage: boolean; info: string }> {
  const done = printRecorder.list().filter(r => r.state === 'FINISH').sort((a, b) => b.endMs - a.endMs);
  const rec = done.find(r => readPhoto(r.id)) || done[0];
  if (!rec) return { ok: false, hasImage: false, info: 'Noch kein fertiger Druck am Pi aufgezeichnet.' };
  const jpeg = readPhoto(rec.id);
  const image = jpeg ? publishImage(jpeg, `${crypto.randomBytes(8).toString('hex')}.jpg`) || undefined : undefined;
  const m = state().prints[rec.id];
  const lines = [`${rec.name} · ${durText((rec.endMs - rec.startMs) / 60000)}`];
  if (m?.deduct === 'done' && m.texts?.length) lines.push(`Abgezogen: ${m.texts.join(', ')}`);
  if (m?.energyWh && m.energyWh > 0) lines.push(`⚡ ${(m.energyWh / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} kWh`);
  const when = new Date(rec.endMs).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  lines.push(`(Test mit altem Druck vom ${when})`);
  const ok = await push('test', '✅ Druck fertig', lines.join('\n'), { tag: 'test-done-old', image });
  return { ok, name: rec.name, hasImage: Boolean(image), info: `${rec.name} (${when})${image ? ' mit Foto' : ' ohne Foto (keins gespeichert oder Bild-Weg nicht verfügbar)'}` };
}

/** Drucke, deren Abzug gerade läuft (nie zwei Versuche gleichzeitig, sonst könnte doppelt abgezogen werden) */
const inFlight = new Set<string>();

/** Alle Schreibvorgänge ins Cloud-Dokument nacheinander (Auto- und manueller Abzug dürfen nie gleichzeitig lesen → schreiben) */
let cloudChain: Promise<unknown> = Promise.resolve();
export function withCloudLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = cloudChain.then(fn, fn);
  cloudChain = run.catch(() => undefined);
  return run;
}

/** Text „x g von Spule“ aus einem schon gespeicherten Server-Abzug (falls die Antwort beim Speichern verloren ging) */
function textsFromServerDeduct(doc: any, id: string): string[] {
  const sd = (Array.isArray(doc?.serverDeducts) ? doc.serverDeducts : []).find((d: any) => d?.id === id);
  if (!sd) return [];
  const spools: any[] = Array.isArray(doc?.spools) ? doc.spools : [];
  return (sd.parts || []).map((p: Part) => {
    const sp = spools.find(s => s.id === p.spoolId);
    const label = sp ? `${sp.brand || ''} ${sp.name || ''}`.trim() || 'Spule' : 'Spule';
    return `${Math.round(p.grams)} g von ${label}${sp ? ` (${Math.round(Number(sp.remainingWeight) || 0)} g übrig)` : ''}`;
  });
}

export async function tryDeduct(rec: RecordedPrint): Promise<void> {
  if (inFlight.has(rec.id)) return;
  inFlight.add(rec.id);
  try {
    await tryDeductOnce(rec);
  } finally {
    inFlight.delete(rec.id);
  }
}

async function tryDeductOnce(rec: RecordedPrint): Promise<void> {
  const s = state();
  const m = s.prints[rec.id];
  if (!m || (m.deduct !== 'pending' && m.deduct !== 'working')) return;
  const c = getHubConfig();
  if (!deductActive()) {
    m.deduct = 'off';
    return saveState();
  }
  if (rec.state === 'FAILED') {
    m.deduct = 'ask';
    m.reason = 'abgebrochen';
    return saveState();
  }
  m.tries += 1;
  m.lastTry = Date.now();
  try {
    const jw = await jobWeights(rec.name, rec.startMs);
    const filaments = jw?.filaments || null;
    // Druck ohne Namen: Namen aus der Druckdatei übernehmen (Liste zeigt dann „Air_Up_Fake_Pod“ statt „Druckauftrag“)
    if (jw?.fileName && isGenericPrintName(rec.name)) {
      const nice = jw.fileName.replace(/\.(gcode\.3mf|3mf|gcode)$/i, '');
      printRecorder.setName(rec.id, nice);
      rec = { ...rec, name: nice };
    }
    if (filaments && !isGenericPrintName(rec.name)) {
      const total = Math.round(filaments.reduce((a, f) => a + f.grams, 0) * 10) / 10;
      const k = nameKey(rec.name);
      const { [k]: _old, ...rest } = c.jobGrams; // gleicher Name rückt ans Ende (= neuester), damit er beim Kürzen nicht rausfällt
      updateHubConfig({ jobGrams: { ...rest, [k]: total } });
    }
    // Gar nichts bekannt: nach Druckzeit schätzen (deine letzten Drucke), damit trotzdem abgezogen wird
    const durMin = (rec.endMs - rec.startMs) / 60000;
    const gpm = gramsPerMinute();
    const estimate = !filaments && !(Number(c.jobGrams[nameKey(rec.name)]) > 0) && gpm > 0 && durMin >= 3 ? Math.round(gpm * durMin) : 0;
    // Lesen → rechnen → schreiben ohne Lücke: kein anderer Abzug (manuell aus der App) dazwischen
    const res = await withCloudLock(async () => {
      if (m.deduct !== 'pending' && m.deduct !== 'working') return null; // inzwischen manuell erledigt
      const doc = await loadDoc(access());
      const spools = Array.isArray(doc?.spools) ? doc.spools : [];
      const parts = planParts({
        filaments,
        trays: m.trays || [],
        usedSlots: Object.keys(rec.slots || {}).map(Number),
        mainSlot: mainSlotOf(rec.slots),
        amsSlots: getHubConfig().amsSlots,
        spools,
        knownGrams: Number(getHubConfig().jobGrams[nameKey(rec.name)]) || estimate
      });
      if (!parts.length) {
        m.deduct = 'ask';
        m.reason = 'Gewicht unbekannt';
        saveState();
        return null;
      }
      m.estimated = Boolean(estimate) && !filaments && !(Number(getHubConfig().jobGrams[nameKey(rec.name)]) > 0);
      m.deduct = 'working';
      m.parts = parts;
      saveState();
      const before = new Map<string, number>(spools.map((x: any) => [String(x.id), Number(x.remainingWeight) || 0]));
      const r = applyDeduction(doc, rec, parts, Date.now());
      if (!r.ok) {
        // Schon vom Server gebucht (Antwort beim letzten Speichern verloren): als erledigt zählen, nicht als „übersprungen“
        if (deductedIn(doc, rec) === 'server') {
          m.deduct = 'done';
          m.texts = textsFromServerDeduct(doc, rec.id);
        } else {
          m.deduct = 'skip';
          m.reason = r.reason;
        }
        console.log(`[Hub] Kein neuer Abzug für ${rec.name}: ${r.reason}`);
        saveState();
        return null;
      }
      await saveDoc(access(), r.doc);
      m.deduct = 'done';
      m.texts = m.estimated ? [...r.texts, 'geschätzt nach Druckzeit, bitte prüfen'] : r.texts;
      saveState();
      return { r, parts, before };
    });
    if (!res) return;
    const { r, parts, before } = res;
    console.log(`[Hub] Abgezogen: ${rec.name}: ${r.texts.join(', ')}`);
    try {
      const mm = state().prints[rec.id];
      if (mm)
        mm.fils = parts
          .map(pt => r.doc.spools.find((x: any) => x.id === pt.spoolId))
          .filter(Boolean)
          .map((sp: any) => `${sp.brand || ''} ${sp.material || ''} ${sp.colorName || ''}`.replace(/\s+/g, ' ').trim());
      saveState();
    } catch {
      /* 👍/👎 ist nur Zugabe */
    }
    try {
      statsGrams(rec, gramsOf(parts, r.doc.spools as any[]));
    } catch {
      /* Statistik ist nur Zugabe */
    }
    // Spule fast leer?
    const low = getHubConfig().lowWeightG;
    for (const sp of r.doc.spools as any[]) {
      const prev = before.get(sp.id);
      if (prev === undefined || !parts.some(p => p.spoolId === sp.id)) continue;
      if (low > 0 && prev > low && sp.remainingWeight <= low) {
        await push('low', '🧵 Spule fast leer', `${sp.brand || ''} ${sp.name || ''}: nur noch ${sp.remainingWeight} g übrig.`.trim(), `low-${sp.id}`);
      }
    }
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.warn(`[Hub] Abzug fehlgeschlagen (${m.tries}. Versuch): ${msg}`);
    if (m.deduct === 'working') {
      // Unklar, ob gespeichert wurde: beim nächsten Versuch prüft deductedIn die Cloud
      m.deduct = 'pending';
    }
    if (m.tries >= 5) {
      m.deduct = 'ask';
      m.reason = `Cloud: ${msg}`;
    }
    saveState();
  }
}

// ---------- Manueller Abzug (aus der App, läuft auf dem Pi) ----------

/** Vorschlag für den manuellen Abzug: Gewichte aus der Datei bzw. Warteschlange und passende Spulen */
export async function deductSuggest(p: { id: string; name: string; startMs?: number; endMs?: number }): Promise<{ filaments: { type: string; colorHex: string; grams: number }[] | null; parts: Part[] }> {
  // 1.227: auch ohne Namen (Startzeit → Warteschlange, beim Start geholte Gewichte, neueste Datei); sonst nach Druckzeit schätzen
  const rec = printRecorder.list().find(x => x.id === p.id);
  const startMs = Number(p.startMs) || rec?.startMs || 0;
  const filaments = (await jobWeights(p.name, startMs, 1))?.filaments || null;
  const dur = rec ? (rec.endMs - rec.startMs) / 60000 : Number(p.endMs) && startMs ? (Number(p.endMs) - startMs) / 60000 : 0;
  const est = !filaments && dur >= 3 ? Math.round(gramsPerMinute() * dur) : 0;
  const doc: any = cloudReady(access()) ? await loadDoc(access()).catch(() => ({})) : {};
  const spools = Array.isArray(doc?.spools) ? doc.spools : [];
  const m = state().prints[p.id];
  const trays = m?.trays?.length ? m.trays : traysOf(port?.getStatus().data || {});
  const parts = planParts({
    filaments,
    trays,
    usedSlots: [],
    mainSlot: null,
    amsSlots: getHubConfig().amsSlots,
    spools,
    knownGrams: Number(getHubConfig().jobGrams[nameKey(p.name)]) || est
  });
  return { filaments, parts };
}

/** Manuell abziehen: schreibt wie der Auto-Abzug in die Cloud (Spulen, Verlauf, Druckliste). Nie doppelt. */
export async function manualDeduct(p: PrintInfo, parts: Part[]): Promise<{ ok: boolean; text: string }> {
  if (!cloudReady(access())) return { ok: false, text: 'Am Pi ist der Cloud-Abgleich nicht eingerichtet.' };
  const clean = parts.filter(x => x && typeof x.spoolId === 'string' && Number(x.grams) > 0).map(x => ({ spoolId: x.spoolId, grams: Math.round(Number(x.grams) * 10) / 10 }));
  if (!clean.length) return { ok: false, text: 'Keine Spule mit Gramm angegeben.' };
  if (inFlight.has(p.id)) return { ok: false, text: 'Der Pi zieht diesen Druck gerade selbst ab. Gleich nochmal ansehen.' };
  return withCloudLock(async () => {
    const doc = await loadDoc(access());
    const r = applyDeduction(doc, p, clean, Date.now());
    if (!r.ok) return { ok: false, text: r.reason };
    await saveDoc(access(), r.doc);
    const m = state().prints[p.id];
    if (m) {
      m.deduct = 'done';
      m.texts = r.texts;
      m.resolved = true;
      saveState();
    }
    console.log(`[Hub] Manuell abgezogen: ${p.name}: ${r.texts.join(', ')}`);
    try {
      statsGrams(p, gramsOf(clean, r.doc.spools as any[]));
    } catch {
      /* Statistik ist nur Zugabe */
    }
    return { ok: true, text: `Abgezogen: ${r.texts.join(', ')}` };
  });
}

export async function retryDeducts(now: number): Promise<void> {
  const s = state();
  for (const [id, m] of Object.entries(s.prints)) {
    if (inFlight.has(id)) continue; // läuft gerade
    if (m.deduct === 'working') {
      // Server war mitten im Abzug neu gestartet: in der Cloud nachsehen
      const rec = printRecorder.list().find(p => p.id === id);
      if (!rec) continue;
      try {
        const doc = await loadDoc(access());
        if (deductedIn(doc, rec)) {
          m.deduct = 'done';
          saveState();
          continue;
        }
      } catch {
        continue;
      }
      m.deduct = 'pending';
    }
    // 1.227: „Gewicht unbekannt“ (z. B. Druck ohne Namen) einmal neu versuchen, jetzt mit Startzeit, neuester Datei und Schätzung
    if (m.deduct === 'ask' && m.reason === 'Gewicht unbekannt' && !m.resolved && !m.retried && now - m.at < 2 * 86400_000) {
      m.retried = true;
      m.pushed = false; // danach kommt eine Meldung mit dem Ergebnis
      m.deduct = 'pending';
      m.tries = 0;
      m.lastTry = 0;
      m.at = Math.min(m.at, now - 3 * 60_000);
      saveState();
    }
    // Auch „noch nie versucht“ (Pi startete in der Minute nach dem Druckende neu): sonst bliebe der Abzug für immer liegen
    if (m.deduct === 'pending' && now - (m.lastTry || m.at) > 2 * 60_000) {
      const rec = printRecorder.list().find(p => p.id === id);
      // 1.231: nicht warten. Ein Abzug kann über 1 Minute dauern (Druckdatei per FTP, 3 Versuche) und hielt sonst den ganzen Takt auf
      // (Fehler-Push mit Knöpfen, „Aus nach Druck“). inFlight verhindert doppelte Versuche, withCloudLock doppeltes Schreiben.
      if (rec) void tryDeduct(rec).then(() => pushEnd(rec)).catch(e => console.warn('[Hub] Abzug im Hintergrund:', (e as Error)?.message || e));
    }
  }
}
