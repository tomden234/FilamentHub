// Eingabefelder im Dashboard „Drucker“: Der Pi legt sie als Home-Assistant-Helfer an (input_select / input_number), hält sie mit Drucker und Spulen-Daten
// gleich und setzt Eingaben um: Soll-Temperatur → Drucker, Material/Farbe/Gramm → Spule im Cloud-Dokument (Spule, die dem Platz zugeordnet ist).
import { haService, haStates, haWsCommand } from './ha.js';
import { access, getHubConfig, port } from './core.js';
import { cloudReady, loadDoc, saveDoc } from './cloud.js';
import { allTrays } from './hubLogic.js';
import { mainSpoolId } from './deductPlan.js';
import { readTrays } from '../../src/utils/amsMatch.js';
import { ID, SLOTS, clampSoll, colorHexOf, helperDefs, materialOption, nearestColorName, parseSlotEntity, slotOfTray } from './dashboardEditLogic.js';

/** Zuletzt von uns gesetzte Werte: erkennt eigene Änderungen (kein Echo) und echte Eingaben */
const written = new Map<string, string>();
/** Nach einer Eingabe 2 min nicht überschreiben, bis die Daten nachgezogen haben */
const editedAt = new Map<string, number>();
const LOCK_MS = 120_000;

let docCache: { at: number; spools: any[] } | null = null;
const DOC_TTL = 5 * 60_000;

async function spools(force = false): Promise<any[]> {
  if (!force && docCache && Date.now() - docCache.at < DOC_TTL) return docCache.spools;
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

/** Fehlende Eingabefelder in Home Assistant anlegen. Gibt zurück, wie viele neu sind. */
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
  if (made) console.log(`[Hub] ${made} Eingabefelder für das Dashboard angelegt`);
  return made;
}

// ---------- Felder auf Stand bringen (Takt) ----------

async function setIfChanged(entity: string, value: string | number): Promise<void> {
  const v = String(value);
  if (written.get(entity) === v) return;
  if (Date.now() - (editedAt.get(entity) || 0) < LOCK_MS) return;
  const [domain, service, key] = entity.startsWith('input_select.') ? ['input_select', 'select_option', 'option'] : ['input_number', 'set_value', 'value'];
  const norm = domain === 'input_number' ? String(Number(value)) : v;
  const before = written.get(entity);
  written.set(entity, norm); // vorher merken: das Ereignis von Home Assistant kann schneller sein als die Antwort
  const ok = await haService(domain!, service!, { entity_id: entity, [key!]: domain === 'input_number' ? Number(value) : v });
  if (!ok) {
    if (before === undefined) written.delete(entity);
    else written.set(entity, before);
  }
}

/** Werte von Drucker und Spulen in die Eingabefelder übernehmen */
export async function syncEditFields(): Promise<void> {
  if (!port) return;
  const st: any = port.getStatus();
  if (!(st?.connected && st?.receivingData !== false)) return;
  const d = st.data || {};
  const n = Math.round(Number(d.nozzle_target_temper));
  const b = Math.round(Number(d.bed_target_temper));
  if (Number.isFinite(n)) await setIfChanged(ID.nozzleSoll, clampSoll('nozzle', n) ?? 0);
  if (Number.isFinite(b)) await setIfChanged(ID.bedSoll, clampSoll('bed', b) ?? 0);

  const list = await spools();
  const hwTrays = [...readTrays(d.ams)];
  const trays = allTrays(d.ams, d.vt_tray);
  const amsSlots = getHubConfig().amsSlots || {};
  for (const slot of SLOTS) {
    const t = trays.find(x => slotOfTray(x) === slot);
    const hw = hwTrays.find(x => x.slot === slot);
    const spool = list.find(s => s.id === amsSlots[String(slot)]) || (hw && !hw.empty ? list.find(s => s.id === mainSpoolId({ mainSlot: slot, amsSlots, spools: list, trays: hwTrays as any })) : undefined);
    const material = materialOption(spool?.material || t?.type || '');
    const color = spool?.colorName && colorHexOf(spool.colorName) ? spool.colorName : nearestColorName(spool?.colorHex || t?.colorHex || '#808080');
    if (material) await setIfChanged(ID.material(slot), material);
    if (spool || t) await setIfChanged(ID.color(slot), color);
    await setIfChanged(ID.grams(slot), Math.max(0, Math.min(1000, Math.round(Number(spool?.remainingWeight) || 0))));
  }
}

// ---------- Eingaben umsetzen ----------

let chain: Promise<unknown> = Promise.resolve();

async function applySpool(slot: number, patch: Record<string, unknown>): Promise<boolean> {
  const a = access();
  if (!cloudReady(a)) return false;
  const doc = await loadDoc(a);
  const list: any[] = Array.isArray(doc?.spools) ? doc.spools : [];
  const hw = readTrays((port?.getStatus() as any)?.data?.ams);
  const id = mainSpoolId({ mainSlot: slot, amsSlots: getHubConfig().amsSlots || {}, spools: list, trays: hw as any });
  const i = list.findIndex(s => s.id === id);
  if (i < 0) return false;
  list[i] = { ...list[i], ...patch };
  await saveDoc(a, { ...doc, spools: list });
  docCache = { at: Date.now(), spools: list };
  return true;
}

async function handleEdit(entity: string, value: string): Promise<void> {
  if (entity === ID.nozzleSoll || entity === ID.bedSoll) {
    const kind = entity === ID.nozzleSoll ? 'nozzle' : 'bed';
    const v = clampSoll(kind, value);
    if (v === null || !port) return;
    try {
      await (port as any).setTemperature?.(kind, v);
      console.log(`[Hub] Dashboard: ${kind === 'nozzle' ? 'Düse' : 'Bett'} Soll ${v} °C an den Drucker gesendet`);
    } catch (e) {
      console.warn('[Hub] Dashboard: Soll-Temperatur nicht gesendet:', (e as Error)?.message || e);
    }
    return;
  }
  const f = parseSlotEntity(entity);
  if (!f) return;
  const patch: Record<string, unknown> = {};
  if (f.field === 'material') patch.material = value;
  if (f.field === 'color') {
    const hex = colorHexOf(value);
    if (!hex) return;
    patch.colorName = value;
    patch.colorHex = hex;
  }
  if (f.field === 'grams') {
    const g = Number(value);
    if (!Number.isFinite(g) || g < 0) return;
    patch.remainingWeight = Math.min(1000, Math.round(g));
  }
  let ok = false;
  try {
    ok = await applySpool(f.slot, patch);
  } catch (e) {
    console.warn('[Hub] Dashboard: Spule nicht gespeichert:', (e as Error)?.message || e);
  }
  if (!ok) {
    // Keine Spule diesem Platz zugeordnet (oder Cloud weg): Feld zurücksetzen
    console.warn(`[Hub] Dashboard: Platz ${f.slot} hat keine zugeordnete Spule, Eingabe verworfen`);
    editedAt.delete(entity);
    written.delete(entity);
  }
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
  written.set(entity, norm);
  editedAt.set(entity, Date.now());
  chain = chain.then(() => handleEdit(entity, value)).catch(() => undefined);
}
