// Hub: „Aus nach Druck“ und „Aus nach Trocknen“ (Steckdose über Home Assistant). 1.231 aus hub.ts herausgelöst.
import { nameKey } from '../printRecorder.js';
import { dryOffAction } from '../../src/utils/dryAutoOff.js';
import { haAvailable, haState, haSwitch } from './ha.js';
import { type HubConfig, getHubConfig, port, push, state, storeHubConfig } from './core.js';

/** Vom Server erledigte „Aus nach Druck“-Schalter (armedAt) */
const doneArms = new Set<number>();

/** „Aus nach Druck“ / „Aus nach Trocknen“ von der App setzen */
export function setPower(body: any): HubConfig {
  const c = { ...getHubConfig() };
  if (body?.autoOff && typeof body.autoOff === 'object') {
    const a = body.autoOff;
    let next = a.armed ? { armed: true, jobName: String(a.jobName || '').slice(0, 200), armedAt: Number(a.armedAt) || Date.now() } : { armed: false, jobName: '', armedAt: 0 };
    // Der Server hat diesen Schalter schon erledigt (ausgeschaltet oder Druck fehlgeschlagen): alte Meldung einer App nicht wieder scharf machen
    if (next.armed && doneArms.has(next.armedAt)) next = { armed: false, jobName: '', armedAt: 0 };
    if (!next.armed && c.autoOff.armed && body?.byServer) doneArms.add(c.autoOff.armedAt);
    // Nur bei einem neuen Schalter-Stand die Zähler neu starten (gleiche Meldung beim App-Start ändert nichts)
    if (next.armed !== c.autoOff.armed || next.armedAt !== c.autoOff.armedAt) {
      rt.finishSince = 0;
      rt.stopTries = 0;
      rt.stoppedAt = 0;
      rt.lastStopTry = 0;
      rt.lastDrying = 0;
      rt.offFails = 0;
    }
    c.autoOff = next;
  }
  if (body?.dryOff && typeof body.dryOff === 'object') {
    const d = body.dryOff;
    const was = c.dryOff;
    c.dryOff = d.armed ? { armed: true, armedAt: was.armed ? was.armedAt : Number(d.armedAt) || Date.now() } : { armed: false, armedAt: 0 };
    if (!c.dryOff.armed) rt.dryLastAt = 0;
  }
  storeHubConfig(c);
  return c;
}

/** Laufzeit-Zähler für Ausschalten/Trocknen (lastTick/busy gehören dem Takt in hub.ts) */
export const rt = { finishSince: 0, stopTries: 0, stoppedAt: 0, lastStopTry: 0, lastDrying: 0, offFails: 0, dryLastAt: 0, lastTick: 0, busy: false };

export async function autoOff(gs: string, d: any, live: boolean, now: number): Promise<void> {
  const c = getHubConfig();
  const a = c.autoOff;
  if (!a.armed || !haAvailable()) return;
  const disarm = () => setPower({ autoOff: { armed: false }, byServer: true });
  if (now - a.armedAt > 36 * 3600_000) return void disarm();
  if (live && gs === 'FAILED') {
    disarm();
    await push('warn', 'Nicht ausgeschaltet', `„${a.jobName || 'Druck'}“ ist fehlgeschlagen. Der Drucker bleibt an, damit du nachsehen kannst.`, 'auto-off');
    return;
  }
  if (live && ['RUNNING', 'PREPARE', 'PAUSE'].includes(gs) && a.jobName && d.subtask_name && nameKey(d.subtask_name) !== nameKey(a.jobName)) return void disarm();
  if (live && gs === 'FINISH') {
    if (!rt.finishSince) rt.finishSince = now;
  } else if (live) {
    rt.finishSince = 0;
  }
  if (!rt.finishSince) return;
  const drying = live && Number(d.ams?.ams?.[0]?.dry_time) > 0;
  if (drying) {
    rt.lastDrying = now;
    if (rt.stoppedAt && now - rt.stoppedAt < 60_000) return;
    if (rt.stoppedAt) {
      disarm();
      await push('warn', 'Drucker bleibt an', 'Du hast die Trocknung neu gestartet. „Aus nach Druck“ ist abgewählt.', 'auto-off');
      return;
    }
    if (rt.stopTries < 3 && now - rt.lastStopTry >= 60_000 && port) {
      rt.lastStopTry = now;
      rt.stopTries++;
      if (await port.stopDrying().catch(() => false)) rt.stoppedAt = now;
    }
    if (now - rt.finishSince < 30 * 60_000) return;
  } else if (rt.lastDrying && now - rt.lastDrying < 3 * 60_000) {
    return;
  }
  if (now - rt.finishSince < 3 * 60_000) return;
  // 1.227: erst ausschalten, wenn der Abzug durch ist (braucht evtl. noch die Druckdatei vom Drucker), höchstens 10 min warten
  const busy = Object.values(state().prints).some(m => (m.deduct === 'pending' || m.deduct === 'working') && now - m.at < 15 * 60_000);
  if (busy && now - rt.finishSince < 10 * 60_000) return;
  const ok = await haSwitch(c.switchEntity, false);
  if (ok) {
    disarm();
    rt.finishSince = 0;
    console.log('[Hub] Drucker nach Druck ausgeschaltet.');
    await push('done', '🔌 Drucker ausgeschaltet', `Nach „${a.jobName || 'Druck'}“ automatisch ausgeschaltet.`, 'auto-off');
  } else if (++rt.offFails >= 4) {
    disarm();
    await push('warn', 'Ausschalten fehlgeschlagen', 'Home Assistant hat die Steckdose nicht ausgeschaltet. Bitte selbst ausschalten.', 'auto-off');
  }
}

export async function dryOff(gs: string, d: any, live: boolean, now: number): Promise<void> {
  const c = getHubConfig();
  if (!c.dryOff.armed || !haAvailable()) return;
  const dryingNow = live && Number(d.ams?.ams?.[0]?.dry_time) > 0;
  if (dryingNow) rt.dryLastAt = now;
  if (!rt.dryLastAt) return;
  const sw = await haState(c.switchEntity);
  const switchState = sw === 'on' || sw === 'off' ? sw : 'unknown';
  const act = dryOffAction({ armedAt: c.dryOff.armedAt, now, lastDryingAt: rt.dryLastAt, dryingNow, gcodeState: gs, switchState, settleMs: c.dryOffDelayMin * 60_000 });
  if (act === 'cancel-print' || act === 'cancel-socket-off') rt.dryLastAt = 0;
  if (act !== 'switch-off') return;
  rt.dryLastAt = 0;
  if (await haSwitch(c.switchEntity, false)) {
    console.log('[Hub] Nach Trocknen ausgeschaltet.');
    await push('done', '🔌 Trocknen fertig, Drucker aus', 'Die Trocknung ist zu Ende. Der Drucker wurde ausgeschaltet.', 'dry-off');
  } else {
    await push('warn', 'Ausschalten fehlgeschlagen', 'Nach dem Trocknen hat Home Assistant die Steckdose nicht ausgeschaltet.', 'dry-off');
  }
}
