// Eingabefelder im Dashboard „Drucker“: Der Pi legt sie als Home-Assistant-Helfer an (input_select / input_number), hält sie mit Drucker und Lager
// gleich und setzt Eingaben um: Soll-Temperatur → Drucker, Spule je Platz → Platz-Belegung (die Apps übernehmen sie).
import { haService, haStates, haWsCommand } from './ha.js';
import { access, getHubConfig, port, setSlotSpool } from './core.js';
import { cloudReady, loadDoc } from './cloud.js';
import { mainSpoolId } from './deductPlan.js';
import { readTrays } from '../../src/utils/amsMatch.js';
import { EMPTY, ID, OLD_HELPERS, SLOTS, clampSoll, helperDefs, parseSpoolEntity, sollTarget, spoolOptions, type SpoolOptions } from './dashboardEditLogic.js';

/** Zuletzt von uns gesetzte Werte: erkennt eigene Änderungen (kein Echo) und echte Eingaben */
const written = new Map<string, string>();
/** Gesetzte Auswahl-Listen (Signatur je Feld) */
const optsSent = new Map<string, string>();
/** Nach einer Eingabe 2 min nicht überschreiben, bis die Daten nachgezogen haben */
const editedAt = new Map<string, number>();
/** Während die Liste neu gesetzt wird, springt die Auswahl kurz auf „leer“: das ist keine Eingabe */
const quietUntil = new Map<string, number>();
const LOCK_MS = 120_000;
const QUIET_MS = 8_000;

let docCache: { at: number; spools: any[] } | null = null;
const DOC_TTL = 2 * 60_000;
/** Letzte Auswahl-Liste (Text → Spulen-Id) für Eingaben */
let lastOpts: SpoolOptions | null = null;

async function spools(): Promise<any[]> {
  if (docCache && Date.now() - docCache.at < DOC_TTL) return docCache.spools;
  if (!cloudReady(access())) return [];
  try {
    const doc = await loadDoc(access());
    docCache = { at: Date.now(), spools: Array.isArray(doc?.spools) ? doc.spools : [] };
    return docCache.spools;
  } catch {
    return docCache?.spools || [];
  }
}

// ---------- Felder anlegen ----------

/** Fehlende Eingabefelder in Home Assistant anlegen, alte aus 1.305 löschen. Gibt zurück, wie viele neu sind. */
export async function ensureHelpers(): Promise<number> {
  const states = await haStates();
  if (!states) return 0;
  const have = new Set(states.map(s => String(s?.entity_id || '')));
  let made = 0;
  for (const d of helperDefs()) {
    if (have.has(d.id)) continue;
    const r = await haWsCommand({ type: `${d.domain}/create`, ...d.body });
    if (r.ok) made++;
    else console.warn(`[Hub] Eingabefeld ${d.id} anlegen: ${r.error}`);
  }
  for (const o of OLD_HELPERS) {
    if (!have.has(`${o.domain}.${o.id}`)) continue;
    const r = await haWsCommand({ type: `${o.domain}/delete`, [`${o.domain}_id`]: o.id });
    if (!r.ok) console.warn(`[Hub] altes Eingabefeld ${o.id} löschen: ${r.error}`);
  }
  if (made) console.log(`[Hub] ${made} Eingabefelder für das Dashboard angelegt`);
  return made;
}

// ---------- Felder auf Stand bringen (Takt) ----------

const locked = (entity: string) => Date.now() - (editedAt.get(entity) || 0) < LOCK_MS;

async function setIfChanged(entity: string, value: string | number): Promise<void> {
  const isSel = entity.startsWith('input_select.');
  const norm = isSel ? String(value) : String(Number(value));
  if (written.get(entity) === norm || locked(entity)) return;
  const before = written.get(entity);
  written.set(entity, norm); // vorher merken: das Ereignis von Home Assistant kann schneller sein als die Antwort
  const ok = isSel
    ? await haService('input_select', 'select_option', { entity_id: entity, option: norm })
    : await haService('input_number', 'set_value', { entity_id: entity, value: Number(value) });
  if (!ok) {
    if (before === undefined) written.delete(entity);
    else written.set(entity, before);
  }
}

/** Liste und Auswahl eines Spulen-Felds setzen */
async function setSpoolField(entity: string, opts: SpoolOptions, choice: string): Promise<void> {
  if (locked(entity)) return;
  const sig = opts.options.join('\n');
  if (optsSent.get(entity) !== sig) {
    quietUntil.set(entity, Date.now() + QUIET_MS);
    written.delete(entity);
    if (!(await haService('input_select', 'set_options', { entity_id: entity, options: opts.options }))) return;
    optsSent.set(entity, sig);
  }
  await setIfChanged(entity, choice);
}

/** Werte von Drucker und Lager in die Eingabefelder übernehmen */
export async function syncEditFields(): Promise<void> {
  if (!port) return;
  const st: any = port.getStatus();
  if (!(st?.connected && st?.receivingData !== false)) return;
  const d = st.data || {};
  for (const [entity, v, kind] of [
    [ID.nozzleSoll, d.nozzle_target_temper, 'nozzle'],
    [ID.nozzle2Soll, d.nozzle2_target_temper, 'nozzle'],
    [ID.bedSoll, d.bed_target_temper, 'bed']
  ] as const) {
    const n = Math.round(Number(v));
    if (v !== undefined && v !== null && Number.isFinite(n)) await setIfChanged(entity, clampSoll(kind, n) ?? 0);
  }

  const list = await spools();
  if (!list.length) return; // Lager nicht lesbar: Felder nicht leeren
  const hw = [...readTrays(d.ams)];
  const amsSlots = getHubConfig().amsSlots || {};
  // Belegt: eigene Zuordnung, sonst die Spule, die zur Farbe im Drucker passt (wie beim Abzug)
  const current = (slot: number): string => {
    if (amsSlots[String(slot)]) return amsSlots[String(slot)]!;
    const t = hw.find(x => x.slot === slot);
    return t && !t.empty ? mainSpoolId({ mainSlot: slot, amsSlots, spools: list, trays: hw as any }) || '' : '';
  };
  const ids = SLOTS.map(current);
  const opts = spoolOptions(list, ids);
  lastOpts = opts;
  for (const [i, slot] of SLOTS.entries()) await setSpoolField(ID.spool(slot), opts, opts.labelOf.get(ids[i]!) || EMPTY);
}

// ---------- Eingaben umsetzen ----------

let chain: Promise<unknown> = Promise.resolve();

async function handleEdit(entity: string, value: string): Promise<void> {
  const soll = sollTarget(entity);
  if (soll) {
    const v = clampSoll(soll.kind, value);
    if (v === null || !port) return;
    try {
      await port.setTemperature(soll.target, v);
      console.log(`[Hub] Dashboard: ${soll.label} Soll ${v} °C an den Drucker gesendet`);
    } catch (e) {
      console.warn('[Hub] Dashboard: Soll-Temperatur nicht gesendet:', (e as Error)?.message || e);
    }
    return;
  }
  const slot = parseSpoolEntity(entity);
  if (!slot) return;
  const id = value === EMPTY ? '' : lastOpts?.idOf.get(value);
  if (id === undefined) {
    console.warn(`[Hub] Dashboard: Spule „${value}“ nicht in der Liste, Eingabe verworfen`);
    editedAt.delete(entity);
    written.delete(entity);
    return;
  }
  setSlotSpool(slot, id);
  console.log(`[Hub] Dashboard: ${slot === 5 ? 'Extern' : `Slot ${slot}`} → ${id ? value : 'leer'}`);
}

/** Ereignis von Home Assistant: Änderung an einem unserer Eingabefelder durch den Nutzer */
export function onEditEvent(ev: { event_type: string; data: any }): void {
  if (ev.event_type !== 'state_changed') return;
  const entity = String(ev.data?.entity_id || '');
  if (!/^input_(select|number)\.filamenthub_/.test(entity)) return;
  const value = String(ev.data?.new_state?.state ?? '');
  if (!value || value === 'unknown' || value === 'unavailable') return;
  // Neu angelegtes Feld oder Wiederkehr nach Neustart ist keine Eingabe (sonst ginge z. B. „0 °C“ an den Drucker)
  const was = String(ev.data?.old_state?.state ?? '');
  if (!ev.data?.old_state || was === 'unknown' || was === 'unavailable') return;
  const norm = entity.startsWith('input_number.') ? String(Number(value)) : value;
  if (written.get(entity) === norm) return; // unser eigener Wert
  if (Date.now() < (quietUntil.get(entity) || 0)) return; // Liste wird gerade neu gesetzt
  written.set(entity, norm);
  editedAt.set(entity, Date.now());
  chain = chain.then(() => handleEdit(entity, value)).catch(() => undefined);
}
