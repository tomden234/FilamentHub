// Spule → AMS-Slot: Werte an den Drucker senden und ehrlich melden, was der Drucker daraus gemacht hat.
import { printerApi } from '../api/printerApi';
import { amsMaterial, type SlotParams } from './spoolProfile';
import { safeStorage } from './safeStorage';
import { connectFromStored } from './deviceSync';



export interface SlotSendResult {
  /** Drucker hat den Slot wirklich gesetzt */
  confirmed: boolean;
  /** Bambu hat den Befehl abgelehnt (Fremd-Befehle über die Cloud) */
  blocked: boolean;
  text: string;
}

const post = (slot: number, p: SlotParams) =>
  printerApi.amsFilament({
    slotIdx: slot === 5 ? 254 : slot - 1,
    external: slot === 5,
    colorHex: p.colorHex.replace('#', ''),
    material: amsMaterial(p.material),
    minTemp: p.minTemp,
    maxTemp: p.maxTemp
  });

/** slot = 1-4, 5 = externe Spule */
export async function sendToSlot(slot: number, p: SlotParams): Promise<SlotSendResult> {
  try {
    let res = await post(slot, p);
    // Eingestellt ist LAN, die laufende Verbindung ist aber die Cloud (z. B. nach Geräte-Sync oder Neustart):
    // Cloud darf keine Slot-Daten schreiben. Dann einmal auf LAN umschalten und noch einmal senden.
    if (res.data?.blocked && res.data?.lan === false && safeStorage.getItem('bambu_lan_mode') === '1') {
      await connectFromStored();
      res = await post(slot, p);
    }
    const d = res.data || {};
    if (res.ok && d.success !== false) {
      return { confirmed: d.confirmed !== false, blocked: false, text: d.message || `${slot === 5 ? 'Extern' : `Slot ${slot}`} ist am Drucker gesetzt.` };
    }
    return {
      confirmed: false,
      blocked: Boolean(d.blocked),
      text: d.error || d.message || 'Der Drucker hat den Slot nicht übernommen.'
    };
  } catch {
    return { confirmed: false, blocked: false, text: 'Keine Verbindung zum Drucker.' };
  }
}
