import { useEffect, useRef, useState } from 'react';
import type { Spool } from '../types/filament';
import { readTrays, colorDistance, baseMaterial, COLOR_TOLERANCE } from '../utils/amsMatch';
import { getTagMappings, mapTagToSpool } from '../utils/nfcManager';
import { addSystemLog } from '../utils/logService';
import { readBambuTrays, type BambuTrayInfo } from '../utils/bambuTray';
import { safeStorage } from '../utils/safeStorage';

// Bambu-Spulen brauchen keinen eigenen NFC-Tag: Das AMS liest ihren RFID-Chip selbst (nur lesen, nichts wird kopiert
// oder beschrieben) und meldet Kennung, Sorte, Farbe, Rest-% und Gewicht an die App.
//  - Kennung bekannt (an der Spule gespeichert oder gemerkt) → Spule automatisch in den Slot
//  - unbekannt, genau EINE passende Bambu-Spule ohne Kennung → automatisch verknüpfen
//  - sonst: Frage „Neue Bambu-Spule erkannt: anlegen / ist schon da / später“
// Die eigenen NFC-Leser (RC522) ignorieren Bambu-Chips (siehe hardware/ams-nfc/filament-ams.yaml).

const key = (rfid: string) => `bambu:${rfid.toLowerCase()}`;
const DISMISS_KEY = 'filamenthub_bambu_dismissed_v1';

function readDismissed(): string[] {
  try {
    const v = JSON.parse(safeStorage.getItem(DISMISS_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

interface Params {
  ams: any;
  connected: boolean;
  spools: Spool[];
  amsSlots: Record<number, string>;
  handleSetAmsSlot: (slot: number, spoolId: string) => void;
  notify: (t: { text: string; ok: boolean }) => void;
}

function bambuSpoolFor(rfid: string, spools: Spool[]): string {
  if (!rfid) return '';
  const n = rfid.toLowerCase();
  const own = spools.find(s => s.bambuRfid && s.bambuRfid.toLowerCase() === n);
  if (own) return own.id;
  const id = getTagMappings()[key(rfid)];
  return id && spools.some(s => s.id === id) ? id : '';
}

/** Bambu-Spulen der App, die schon mit einem Chip verknüpft sind */
function linkedIds(spools: Spool[]): Set<string> {
  const maps = getTagMappings();
  const ids = new Set(spools.filter(s => s.bambuRfid).map(s => s.id));
  Object.entries(maps).forEach(([k, id]) => {
    if (k.startsWith('bambu:')) ids.add(id);
  });
  return ids;
}

export function useBambuRfid(p: Params) {
  const latest = useRef(p);
  latest.current = p;
  const done = useRef<Record<number, string>>({});
  const [unknown, setUnknown] = useState<BambuTrayInfo[]>([]);

  const trays = p.connected ? readTrays(p.ams) : [];
  const sig = trays.map(t => `${t.slot}:${t.rfid || ''}`).join('|');
  const spoolSig = p.spools.map(s => `${s.id}:${s.bambuRfid || ''}`).join('|');

  useEffect(() => {
    if (!p.connected) return;
    const { spools, amsSlots, handleSetAmsSlot, notify } = latest.current;
    const dismissed = readDismissed();
    const open: BambuTrayInfo[] = [];
    for (const b of readBambuTrays(latest.current.ams)) {
      let spoolId = bambuSpoolFor(b.rfid, spools);
      if (!spoolId) {
        const linked = linkedIds(spools);
        const cands = spools.filter(
          s =>
            /bambu/i.test(s.brand || '') &&
            !linked.has(s.id) &&
            baseMaterial(s.material) === baseMaterial(b.type) &&
            colorDistance(s.colorHex || '#888888', b.colorHex) <= COLOR_TOLERANCE
        );
        if (cands.length === 1) {
          spoolId = cands[0].id;
          mapTagToSpool(key(b.rfid), spoolId);
          addSystemLog('spule', `Bambu-Spule erkannt und verknüpft: ${cands[0].name}`, `Slot ${b.slot} · ${b.rfid}`, 'success');
        }
      }
      if (!spoolId) {
        if (!dismissed.includes(b.rfid)) open.push(b);
        done.current[b.slot] = '';
        continue;
      }
      if (done.current[b.slot] === b.rfid && amsSlots[b.slot] === spoolId) continue;
      done.current[b.slot] = b.rfid;
      if (amsSlots[b.slot] !== spoolId) {
        handleSetAmsSlot(b.slot, spoolId);
        const sp = spools.find(s => s.id === spoolId);
        notify({ text: `Bambu-Spule ${sp ? sp.name : ''} in Slot ${b.slot} erkannt.`, ok: true });
      }
    }
    // Slots ohne Bambu-Chip zurücksetzen
    for (const t of readTrays(latest.current.ams)) if (!t.rfid) done.current[t.slot] = '';
    setUnknown(prev => (prev.map(x => x.rfid).join() === open.map(x => x.rfid).join() ? prev : open));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.connected, sig, spoolSig]);

  /** Spule für die Bambu-Kennung in diesem Slot merken (wenn du im Slot eine Spule wählst) */
  const learn = (slot: number, spoolId: string) => {
    const t = readTrays(latest.current.ams).find(x => x.slot === slot);
    if (!t?.rfid || !spoolId) return;
    if (bambuSpoolFor(t.rfid, latest.current.spools) === spoolId) return;
    mapTagToSpool(key(t.rfid), spoolId);
    done.current[slot] = '';
    setUnknown(prev => prev.filter(x => x.rfid !== t.rfid));
    addSystemLog('spule', 'Bambu-Spule verknüpft', `Slot ${slot} · ${t.rfid}`, 'success');
  };

  /** „Später“: für diese Spule nicht mehr fragen (bis sie neu verknüpft wird) */
  const dismiss = (rfid: string) => {
    const list = readDismissed().filter(x => x !== rfid);
    list.push(rfid);
    safeStorage.setItem(DISMISS_KEY, JSON.stringify(list.slice(-50)));
    setUnknown(prev => prev.filter(x => x.rfid !== rfid));
  };

  return { learn, unknown, dismiss };
}
