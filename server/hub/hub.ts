// FilamentHub-Hub: läuft nur im Home-Assistant-Add-on (FILAMENTHUB_HUB=1) rund um die Uhr und erledigt, was sonst eine offene App brauchte:
//  1. Push aufs Handy (Home-Assistant-App) bei Druck fertig / abgebrochen / Warnungen
//  2. Kamerafoto am Druckende (abrufbar für die Druckliste)
//  3. Abzug der Gramm direkt in der Cloud – genau EINMAL je Druck (serverDeducts + Prüfung der Druckliste)
//  4. „Aus nach Druck“ und „Aus nach Trocknen“ (Steckdose über Home Assistant)
//  7. Warnung, wenn ein Druck viel länger dauert als gewohnt
//  8. Spulen-Check beim Druckstart (reicht das Filament?)
// 10. Tägliche Sicherung des Cloud-Dokuments (Spulen, Verlauf, Druckliste) auf dem Pi
// Die Apps schicken ihre Einstellungen (Cloud-Zugang, Slot-Zuordnung, Steckdose …) über /api/hub/config.
import { ledGuard } from './ledGuard.js';
import { cloudReady } from './cloud.js';
import { haAvailable, haListen } from './ha.js';
import { attachQueue, autoScanTick, onHaEvent as queueEvent, refreshLeds } from './queue.js';
import { espInfo as espInfoFn } from './esphome.js';
import { type PrinterPort, access, deductActive, getHubConfig, hubEnabled, lastPush, port, powerActive, setPort, push, state } from './core.js';
import { retryDeducts, tryDeduct } from './deduct.js';
import { autoOff, dryOff, rt } from './power.js';
import { energyTick, energyWeeks, errorWatch, espTick, goneWatch, onAction, watchPrint, weeklyTick } from './watch.js';
import { dailyBackup, listBackups } from './backup.js';

// Öffentliche Schnittstelle des Hubs (Routen, bambuMqtt, Tests): alles weiter über hub.js erreichbar
export { hubEnabled, getHubConfig, updateHubConfig, printMeta, resolvePrint, push } from './core.js';
export { setPower } from './power.js';
export { readPhoto } from './photo.js';
export { onPrintEnd, deductSuggest, manualDeduct } from './deduct.js';
export { espSyncNow, energyWeeks, weeklyReportNow } from './watch.js';
export { backupNow, listBackups, readBackup } from './backup.js';

export function attachPrinter(p: PrinterPort): void {
  setPort(p);
  attachQueue(p, (title, text) => push('done', title, text, { tag: 'queue' }));
  if (hubEnabled()) {
    haListen(ev => {
      queueEvent(ev);
      onAction(ev);
    });
    setTimeout(() => refreshLeds(), 20_000);
    // Neue Dateien aus Bambu Studio suchen: 1.231 alle 20-60 s statt alle 3 s (schont den Drucker), bei Änderung am Drucker sofort
    setInterval(() => void autoScanTick(), 5_000).unref();
  }
}

// ---------- Takt (alle 30 s) ----------


export async function tick(now = Date.now()): Promise<void> {
  if (!hubEnabled() || !port || rt.busy) return;
  rt.busy = true;
  try {
    const status = port.getStatus();
    const live = Boolean(status.connected && status.receivingData !== false);
    const d = status.data || {};
    const gs = live ? String(d.gcode_state || '') : '';
    const dt = rt.lastTick ? Math.min(120_000, now - rt.lastTick) : 0;
    rt.lastTick = now;
    await retryDeducts(now);
    await energyTick(gs, now, dt);
    await goneWatch(live, now);
    if (live) await errorWatch(gs, d, now);
    if (live) await ledGuard(gs, d);
    if (live) await watchPrint(gs, d, now, dt);
    await autoOff(gs, d, live, now);
    await dryOff(gs, d, live, now);
    await dailyBackup(now);
    await weeklyTick(now);
    await espTick(now);
  } catch (e) {
    console.warn('[Hub] Takt-Fehler:', (e as Error)?.message || e);
  } finally {
    rt.busy = false;
  }
}

// ---------- Status für die Apps ----------

function espInfoSafe() {
  const i = espInfoFn();
  return i ? { ok: i.ok, text: i.text, revision: i.revision } : null;
}

export function hubStatus() {
  const c = getHubConfig();
  const b = listBackups();
  return {
    enabled: hubEnabled(),
    ha: hubEnabled() && haAvailable(),
    cloud: cloudReady(access()),
    deduct: deductActive(),
    power: powerActive(),
    autoOff: c.autoOff,
    dryOff: c.dryOff,
    lastPush,
    backups: b.length,
    lastBackup: b[0]?.name || '',
    configAt: c.updatedAt,
    kwhPrice: c.kwhPrice,
    quietFrom: c.quietFrom,
    quietTo: c.quietTo,
    materialGuard: c.materialGuard,
    energyWeek: energyWeeks().slice(-1)[0] || null,
    esp: espInfoSafe()
  };
}

/** Nur für Tests */
export const _test = { tryDeduct, state: () => state() };
