import { useEffect, useRef, useState } from 'react';
import type { Spool } from '../types/filament';
import { getHaCredentials } from '../utils/haClient';
import { getTagMappings, mapTagToSpool } from '../utils/nfcManager';
import { readTrays, mismatch, EXTERNAL_SLOT } from '../utils/amsMatch';
import { sendToSlot } from '../utils/slotAssign';
import { paramsFromSpool } from '../utils/spoolProfile';
import { addSystemLog } from '../utils/logService';
import { useWorkshopSettings } from '../utils/workshopSettings';
import { haFetch } from '../utils/haAutoOff';
import { resolveAms } from '../utils/amsEntities';

// NFC-Leser im AMS (ESPHome, siehe hardware/ams-nfc): liest über Home Assistant, welcher Tag in welchem Slot steckt,
// und ordnet die passende Spule automatisch zu. Optional werden Material und Farbe an den Drucker geschickt.

/** Tag-Nummer vergleichbar machen: „04-A1-B2“, „04:a1:b2“, „04a1b2“ → „04a1b2“ */
const normUid = (s: string) => String(s || '').toLowerCase().replace(/[^0-9a-f]/g, '');

// 1.206: Leser, Slots und letzter Tag über resolveAms (auch mit anderem ID-Anfang in Home Assistant)
const STATUS_MS = 30_000;
const POLL_MS = 1500;
const DISCOVER_MS = 5 * 60 * 1000;

interface NfcReaderState {
  /** gefundene Leser (Slot → entity_id) */
  entities: Record<number, string>;
  /** aktuelle Tag-Nummer je Slot ('' = keiner) */
  tags: Record<number, string>;
  /** unbekannte Tags je Slot */
  unknown: Record<number, string>;
  /** Zustand je Leser laut Firmware (leer = alte Firmware) */
  status: Record<number, string>;
  /** Zuletzt gelesener Tag (Test) */
  lastTag: string;
}

interface Params {
  spools: Spool[];
  amsSlots: Record<number, string>;
  handleSetAmsSlot: (slot: number, spoolId: string) => void;
  ams: any;
  printerConnected: boolean;
  notify: (t: { text: string; ok: boolean }) => void;
}

function findSpoolForUid(uid: string, spools: Spool[]): string {
  const n = normUid(uid);
  if (!n) return '';
  const maps = getTagMappings();
  for (const [k, id] of Object.entries(maps)) {
    if (normUid(k) === n && spools.some(s => s.id === id)) return id;
  }
  const byField = spools.find(s => s.nfcTagId && normUid(s.nfcTagId) === n);
  return byField?.id || '';
}

export function useAmsNfcReaders(p: Params): NfcReaderState & { learn: (slot: number, spoolId: string) => void } {
  const [settings] = useWorkshopSettings();
  const [state, setState] = useState<NfcReaderState>({ entities: {}, tags: {}, unknown: {}, status: {}, lastTag: '' });
  const latest = useRef(p);
  latest.current = p;
  const handled = useRef<Record<number, string>>({});
  const warned = useRef<Record<string, boolean>>({});
  const lastSend = useRef<Record<number, number>>({});
  const failShown = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (settings.amsNfcOn === false) return;
    let stop = false;
    let busy = false;
    let entities: Record<number, string> = {};
    let statusEntities: Record<number, string> = {};
    let lastEntity = '';
    let status: Record<number, string> = {};
    let lastStatus = 0;
    let lastDiscover = 0;
    const lastUid: Record<number, string> = {};

    // 1.200: über haFetch (direkt, sonst über den eigenen Server). Vorher blockte der Browser-Schutz (CORS) in der Windows-App
    // und im Browser die Abfrage still: die App sah dann keinen einzigen Leser.
    const discover = async () => {
      lastDiscover = Date.now();
      try {
        const res = await haFetch('/api/states');
        if (!res.ok) return;
        const dev = resolveAms(await res.json());
        const found: Record<number, string> = { ...(dev?.roles.slot || {}) };
        const st: Record<number, string> = {};
        statusEntities = { ...(dev?.roles.reader || {}) };
        for (const [n, id] of Object.entries(statusEntities)) st[Number(n)] = dev?.entities.find(x => x.id === id)?.state || '';
        lastEntity = dev?.roles.lastTag || '';
        entities = found;
        status = st;
        lastStatus = Date.now();
      } catch {
        /* HA nicht erreichbar */
      }
    };

    const readState = async (entity: string): Promise<string | null> => {
      try {
        const r = await haFetch(`/api/states/${entity}`);
        if (!r.ok) return null;
        const st = String((await r.json())?.state || '');
        return st === 'unknown' || st === 'unavailable' ? '' : st;
      } catch {
        return null;
      }
    };

    const poll = async () => {
      if (stop || busy) return;
      // Home-Assistant-Zugang bei jedem Durchlauf frisch lesen (auch wenn er erst später eingetragen oder per Sync übernommen wird)
      const { url, token } = getHaCredentials();
      if (!token || !url) return;
      // Im versteckten Tab nicht abfragen (spart Akku und Netz)
      if (typeof document !== 'undefined' && document.hidden) return;
      busy = true;
      try {
        await pollOnce();
      } finally {
        busy = false;
      }
    };

    const pollOnce = async () => {
      // Ohne Leser nur selten neu suchen (alle 60 s), sonst alle 5 Minuten
      if ((!Object.keys(entities).length && Date.now() - lastDiscover > 60_000) || Date.now() - lastDiscover > DISCOVER_MS) await discover();
      const slots = Object.keys(entities).map(Number);
      if (!slots.length) {
        setState(s => (Object.keys(s.entities).length ? { entities: {}, tags: {}, unknown: {}, status: {}, lastTag: '' } : s));
        return;
      }
      const tags: Record<number, string> = {};
      let lastTag = '';
      await Promise.all([
        ...slots.map(async slot => {
          const st = await readState(entities[slot]);
          if (st !== null) tags[slot] = st;
        }),
        (async () => {
          if (lastEntity) lastTag = (await readState(lastEntity)) || '';
        })(),
        (async () => {
          if (Date.now() - lastStatus < STATUS_MS) return;
          lastStatus = Date.now();
          const next: Record<number, string> = {};
          await Promise.all(
            Object.entries(statusEntities).map(async ([k, id]) => {
              const st = await readState(id);
              if (st !== null) next[Number(k)] = st;
            })
          );
          status = { ...status, ...next };
        })()
      ]);
      const { spools, amsSlots, handleSetAmsSlot, ams, printerConnected, notify } = latest.current;
      const unknown: Record<number, string> = {};
      const trays = readTrays(ams);
      for (const slot of slots) {
        const uid = tags[slot] || '';
        if (!uid) {
          handled.current[slot] = '';
          // Tag weg: Hinweis für einen unbekannten Tag darf beim nächsten Auflegen wieder kommen
          if (lastUid[slot]) delete warned.current[lastUid[slot]];
          lastUid[slot] = '';
          continue;
        }
        lastUid[slot] = uid;
        const spoolId = findSpoolForUid(uid, spools);
        if (!spoolId) {
          unknown[slot] = uid;
          if (!warned.current[uid]) {
            warned.current[uid] = true;
            notify({ text: `Unbekannter NFC-Tag in ${slot === EXTERNAL_SLOT ? 'Extern' : `Slot ${slot}`}. Wähl dort einmal die Spule aus, dann merke ich mir den Tag.`, ok: false });
          }
          continue;
        }
        const sp = spools.find(s => s.id === spoolId);
        const hw = trays.find(t => t.slot === slot);
        // Drucker-Slot anpassen, wenn Material/Farbe dort nicht passen (nur AMS-Slots 1-4)
        const wantPrinter = settings.amsNfcToPrinter !== false && !!sp && slot <= 4 && printerConnected && !!hw && (hw.empty || mismatch(sp!, hw!));
        if (handled.current[slot] === uid && amsSlots[slot] === spoolId && !wantPrinter) continue;
        handled.current[slot] = uid;
        if (amsSlots[slot] !== spoolId) {
          handleSetAmsSlot(slot, spoolId);
          notify({ text: `NFC: ${sp ? `${sp.brand} ${sp.name}` : 'Spule'} in ${slot === EXTERNAL_SLOT ? 'Extern' : `Slot ${slot}`} erkannt.`, ok: true });
          addSystemLog('drucker', `NFC-Leser: Slot ${slot} → ${sp?.name || spoolId}`, uid, 'info');
        }
        // Gleicher Weg wie beim manuellen Zuweisen (sendToSlot), mit ehrlicher Meldung. Neuer Versuch frühestens nach 60 s.
        if (wantPrinter && sp && Date.now() - (lastSend.current[slot] || 0) > 60000) {
          lastSend.current[slot] = Date.now();
          const key = `${slot}:${uid}`;
          void sendToSlot(slot, paramsFromSpool(sp)).then(r => {
            if (r.confirmed) {
              delete failShown.current[key];
              notify({ text: `Slot ${slot} am Drucker auf ${sp.material} ${sp.colorName} gesetzt.`, ok: true });
              addSystemLog('drucker', `Slot ${slot} am Drucker gesetzt`, `${sp.material} ${sp.colorName}`, 'success');
            } else if (!failShown.current[key]) {
              failShown.current[key] = true;
              notify({ text: `Slot ${slot}: ${r.text}`, ok: false });
              addSystemLog('drucker', `Slot ${slot} nicht am Drucker gesetzt`, r.text, 'error');
            }
          });
        }
      }
      setState({ entities: { ...entities }, tags, unknown, status: { ...status }, lastTag });
    };

    void poll();
    const iv = setInterval(() => void poll(), POLL_MS);
    // Tab wird wieder sichtbar: sofort aktuellen Stand holen
    const vis = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      stop = true;
      clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [settings.amsNfcOn, settings.amsNfcToPrinter]);

  /** Spule für einen unbekannten Tag merken (wenn du im Slot eine Spule auswählst) */
  const learn = (slot: number, spoolId: string) => {
    const uid = state.unknown[slot];
    if (uid && spoolId) {
      mapTagToSpool(uid, spoolId);
      handled.current[slot] = '';
      addSystemLog('spule', `NFC-Tag ${uid} gemerkt`, `Slot ${slot}`, 'success');
    }
  };

  return { ...state, learn };
}
