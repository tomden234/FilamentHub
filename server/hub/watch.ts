// Hub: Druck beobachten (Spulen-Check, hängt, dauert lange), Strom, Drucker weg, Fehler mit Knöpfen, Wochenbericht, ESP-Update.
// 1.231 aus hub.ts herausgelöst.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { printRecorder, nameKey } from '../printRecorder.js';
import { activeSlotFromPrinter } from '../../src/utils/amsMatch.js';
import { expectedMinutes, shortages, tooLong } from './deductPlan.js';
import { cloudReady, loadDoc } from './cloud.js';
import { haAvailable, haPowerW } from './ha.js';
import { addEnergy, allTrays, missingMaterials, stalled, weekKey, weeklyReport } from './hubLogic.js';
import { syncEspYaml } from './esphome.js';
import { rootDir } from '../paths.js';
import { access, durText, getHubConfig, port, push, saveState, state, traysOf } from './core.js';
import { snapshotForPush } from './photo.js';
import { addReport, reportUrl } from './reports.js';
import { jobWeights } from './deduct.js';

export async function watchPrint(gs: string, d: any, now: number, dt: number): Promise<void> {
  const s = state();
  const open = printRecorder.status().open;
  if (!open || !['RUNNING', 'PREPARE', 'PAUSE'].includes(gs)) return;
  const key = `${nameKey(open.name)}|${open.startMs}`;
  if (s.openKey !== key) {
    s.openKey = key;
    s.startChecked = false;
    s.warned = false;
    s.expectedMin = 0;
    s.pausedMs = 0;
    saveState();
  }
  if (gs === 'PAUSE') s.pausedMs += dt;
  const elapsedMin = Math.max(0, (now - open.startMs - s.pausedMs) / 60000);

  // Erwartete Dauer: aus früheren Drucken, sonst Schätzung des Druckers (vergangene + Restzeit)
  if (!s.expectedMin && gs === 'RUNNING' && Number(d.mc_percent) >= 2) {
    const remain = Number(d.mc_remaining_time) || 0;
    s.expectedMin = expectedMinutes(printRecorder.list(), open.name, remain > 0 ? elapsedMin + remain : 0);
    saveState();
  }

  // 8. Reicht das Filament? (einmal, kurz nach dem Start)
  if (!s.startChecked && gs === 'RUNNING') {
    s.startChecked = true;
    saveState();
    // Läuft nebenher: das Laden der Druckdatei (FTP, bis ca. 1 Minute) hält den Takt nicht auf („Aus nach Druck“, Fehler-Push …)
    void (async () => {
      try {
        const [jw, doc] = await Promise.all([jobWeights(open.name, open.startMs), cloudReady(access()) ? loadDoc(access()).catch(() => ({})) : Promise.resolve({} as any)]);
        const filaments = jw?.filaments || null;
        // 1.227: Gewichte jetzt merken, solange der Drucker sicher an ist (am Ende ist er evtl. schon aus)
        if (filaments) {
          state().openFil = { startMs: open.startMs, name: jw?.fileName || open.name, filaments };
          saveState();
        }
        const left = Math.max(0, 1 - (Number(d.mc_percent) || 0) / 100);
        const probs = shortages({
          filaments,
          trays: traysOf(d),
          amsSlots: getHubConfig().amsSlots,
          spools: Array.isArray(doc?.spools) ? doc.spools : [],
          mainSlot: activeSlotFromPrinter(d.ams),
          knownGrams: Number(getHubConfig().jobGrams[nameKey(open.name)]) || 0,
          left
        });
        if (probs.length) await push('warn', '⚠️ Filament reicht evtl. nicht', `${open.name}\n${probs.join('\n')}`, 'spool-check');
        // Material-Wächter: fehlt ein Material der Datei im ganzen AMS? Dann gleich am Anfang anhalten
        const missing = filaments && getHubConfig().materialGuard && elapsedMin < 10 ? missingMaterials(filaments, allTrays(d.ams, d.vt_tray)) : [];
        if (missing.length && port) {
          xt.ownPauseAt = Date.now();
          await port.command('pause').catch(() => undefined);
          await askToContinue('🛑 Falsches Material', `${open.name} braucht ${missing.join(', ')}, das steckt nicht im AMS. Druck angehalten.`, 0);
        }
      } catch (e) {
        console.warn('[Hub] Spulen-Check:', (e as Error)?.message || e);
      }
    })();
  }

  // Hängt der Druck? (Fortschritt und Schicht 30 Minuten gleich)
  const progKey = `${d.mc_percent}|${d.layer_num}`;
  if (progKey !== xt.progKey || gs !== 'RUNNING') {
    xt.progKey = progKey;
    xt.progAt = now;
  } else if (stalled(xt.progAt, now) && xt.stallWarned !== key) {
    xt.stallWarned = key;
    await askToContinue('🐌 Druck hängt?', `${open.name}: seit 30 Minuten kein Fortschritt (${d.mc_percent} %, Schicht ${d.layer_num}).`, 0);
  }

  // 7. Dauert viel länger als gewohnt?
  if (!s.warned && gs === 'RUNNING' && tooLong(elapsedMin, s.expectedMin)) {
    s.warned = true;
    saveState();
    await push('warn', '⏰ Druck dauert länger als gewohnt', `${open.name} läuft seit ${durText(elapsedMin)} (normal ca. ${durText(s.expectedMin)}). Bitte kurz nachsehen.`, 'print-long');
  }
}

// ---------- Strom, Drucker weg, Fehler mit Knöpfen, Wochenbericht, ESP-Update ----------

const xt = { goneSince: 0, goneWarned: false, errKey: '', action: null as null | { nonce: string; code: number; at: number }, ownPauseAt: 0, progKey: '', progAt: 0, stallWarned: '', lastEsp: 0, espNotified: '' };

export async function energyTick(gs: string, now: number, dt: number): Promise<void> {
  if (!haAvailable() || !dt) return;
  const w = await haPowerW(getHubConfig().switchEntity);
  if (w === null) return;
  const printing = ['RUNNING', 'PREPARE', 'PAUSE'].includes(gs);
  const s = state();
  s.energy = addEnergy(s.energy || {}, now, w, dt, printing);
  if (printing && dt <= 5 * 60_000) s.printWh = (s.printWh || 0) + (w * dt) / 3600_000;
  // 1.231: Strom nur alle 5 Minuten auf die SSD schreiben (vorher alle 30 s die ganze Zustandsdatei). Andere Änderungen speichern sofort mit.
  if (now - lastEnergySave >= 5 * 60_000) {
    lastEnergySave = now;
    saveState();
  }
}
let lastEnergySave = 0;

export async function goneWatch(live: boolean, now: number): Promise<void> {
  const open = printRecorder.status().open;
  if (live || !open) {
    xt.goneSince = 0;
    xt.goneWarned = false;
    return;
  }
  if (!xt.goneSince) xt.goneSince = now;
  if (!xt.goneWarned && now - xt.goneSince >= 2 * 60_000) {
    xt.goneWarned = true;
    await push('warn', '📡 Drucker antwortet nicht', `Seit 2 Minuten keine Daten vom Drucker, obwohl „${open.name}“ lief (${open.percent} %). Strom, WLAN oder Absturz?`, { tag: 'printer-gone' });
  }
}

let hmsTable: { e: Record<string, string>; h: Record<string, string> } | null = null;
function errorText(code: number, hms: any[]): string {
  try {
    if (!hmsTable) hmsTable = JSON.parse(fs.readFileSync(path.join(rootDir, 'public', 'hms_de.json'), 'utf-8'));
  } catch {
    hmsTable = { e: {}, h: {} };
  }
  const hex = (n: number) => (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
  if (code) {
    const t = hmsTable!.e?.[hex(code)];
    if (t) return t;
  }
  for (const h of hms || []) {
    const k = hex(Number(h?.attr)) + hex(Number(h?.code));
    if (hmsTable!.h?.[k]) return hmsTable!.h[k];
  }
  return code ? `Fehler ${hex(code).slice(0, 4)}_${hex(code).slice(4)}` : 'Der Drucker hat angehalten.';
}

/** Drucker hält an (z. B. Objekt auf dem Bett, KI-Fehlererkennung, Spaghetti): Push mit Foto und Knöpfen „Weiter“ / „Abbrechen“ */
export async function errorWatch(gs: string, d: any, now: number): Promise<void> {
  const code = Number(d.print_error) || 0;
  // Nur ernste HMS-Meldungen (Stufe 1-2), keine Hinweise
  const hms: any[] = (Array.isArray(d.hms) ? d.hms : []).filter((h: any) => {
    const lvl = Math.floor((Number(h?.code) >>> 0) / 0x10000);
    return lvl >= 1 && lvl <= 2;
  });
  const paused = gs === 'PAUSE';
  if (!paused || (!code && !hms.length) || port?.delayedResume()) {
    if (gs === 'RUNNING' || gs === 'IDLE' || gs === 'FINISH') xt.errKey = '';
    return;
  }
  if (now - xt.ownPauseAt < 3 * 60_000) return; // Material-Wächter hat selbst pausiert und schon gemeldet
  const key = `${state().openKey}|${code}|${hms.map(h => `${h?.attr}:${h?.code}`).join(',')}`;
  if (key === xt.errKey) return;
  xt.errKey = key;
  await askToContinue('⏸️ Drucker wartet', `${d.subtask_name || 'Druck'}: ${errorText(code, hms)}`, code);
}

async function askToContinue(title: string, text: string, code: number): Promise<void> {
  const nonce = crypto.randomBytes(5).toString('hex');
  xt.action = { nonce, code, at: Date.now() };
  const image = await snapshotForPush();
  await push('warn', title, `${text}\nWeiter = am Drucker bestätigen.`, {
    tag: 'printer-wait',
    image,
    actions: [
      { action: `FH_RESUME_${nonce}`, title: '▶️ Weiter' },
      { action: `FH_STOP_${nonce}`, title: '⏹️ Abbrechen' }
    ]
  });
}

/** Knopf in der Push-Meldung gedrückt */
export function onAction(ev: { event_type: string; data: any }): void {
  if (ev.event_type !== 'mobile_app_notification_action') return;
  const m = String(ev.data?.action || '').match(/^FH_(RESUME|STOP)_([0-9a-f]+)$/);
  const a = xt.action;
  if (!m || !a || m[2] !== a.nonce || Date.now() - a.at > 6 * 3600_000) return;
  xt.action = null;
  void (async () => {
    const gs = String(port?.getStatus().data?.gcode_state || '');
    if (gs !== 'PAUSE') return void push('warn', 'Nichts zu tun', 'Der Drucker wartet nicht mehr.', { tag: 'printer-wait' });
    try {
      if (m[1] === 'RESUME') {
        await port!.resumeAfterError(a.code);
        await push('done', '▶️ Weiter', 'Der Druck läuft weiter.', { tag: 'printer-wait' });
      } else {
        await port!.command('stop');
        await push('done', '⏹️ Abgebrochen', 'Der Druck wurde abgebrochen.', { tag: 'printer-wait' });
      }
    } catch (e) {
      await push('warn', 'Hat nicht geklappt', `${(e as Error)?.message || e}. Bitte am Drucker bestätigen.`, { tag: 'printer-wait' });
    }
  })();
}

export async function weeklyTick(now: number): Promise<void> {
  const d = new Date(now);
  const s = state();
  if (d.getDay() !== 0 || d.getHours() < 18 || s.lastReportWeek === weekKey(now)) return;
  s.lastReportWeek = weekKey(now);
  saveState();
  let doc: any = {};
  try {
    if (cloudReady(access())) doc = await loadDoc(access());
  } catch {
    doc = {};
  }
  const c = getHubConfig();
  const r = weeklyReport({
    now,
    prints: printRecorder.list(),
    history: Array.isArray(doc?.printHistory) ? doc.printHistory : [],
    spools: Array.isArray(doc?.spools) ? doc.spools : [],
    energy: s.energy?.[weekKey(now)],
    kwhPrice: c.kwhPrice,
    lowWeightG: c.lowWeightG
  });
  const rep = addReport(r.title, r.text, now);
  await push('done', r.title, r.text, { tag: 'weekly', url: reportUrl(rep.id) });
}

export async function espTick(now: number): Promise<void> {
  if (now - xt.lastEsp < 6 * 3600_000) return;
  xt.lastEsp = now;
  const r = await syncEspYaml();
  if (r.changed && r.info.revision && r.info.revision !== xt.espNotified) {
    xt.espNotified = r.info.revision;
    await push('warn', '🔧 ESP-Update bereit', `Neue AMS-ESP-Fassung (Revision ${r.info.revision}). Home Assistant → ESPHome → Filament AMS → Installieren → Drahtlos.`, { tag: 'esp-update' });
  }
}

/** Sofort prüfen (Knopf in der App) */
export async function espSyncNow() {
  xt.lastEsp = Date.now();
  return syncEspYaml();
}

export function energyWeeks(): { week: string; totalWh: number; printWh: number; cost: number }[] {
  const e = state().energy || {};
  const price = getHubConfig().kwhPrice;
  return Object.keys(e)
    .sort()
    .slice(-12)
    .map(k => ({ week: k, totalWh: Math.round(e[k].totalWh), printWh: Math.round(e[k].printWh), cost: Math.round((e[k].totalWh / 1000) * price * 100) / 100 }));
}

export async function weeklyReportNow(): Promise<{ title: string; text: string; id: string; url: string }> {
  let doc: any = {};
  try {
    if (cloudReady(access())) doc = await loadDoc(access());
  } catch {
    doc = {};
  }
  const c = getHubConfig();
  const now = Date.now();
  const r = weeklyReport({
    now,
    prints: printRecorder.list(),
    history: Array.isArray(doc?.printHistory) ? doc.printHistory : [],
    spools: Array.isArray(doc?.spools) ? doc.spools : [],
    energy: state().energy?.[weekKey(now)],
    kwhPrice: c.kwhPrice,
    lowWeightG: c.lowWeightG
  });
  const rep = addReport(r.title, r.text, now);
  const url = reportUrl(rep.id);
  await push('test', r.title, r.text, { tag: 'weekly', url });
  return { ...r, id: rep.id, url };
}
