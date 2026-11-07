// Material-Profil pro Spule: beste Temperaturen, die beim Einlegen vorgeschlagen werden.
import type { Spool } from '../types/filament';
import { getBambuProfile } from '../data/bambuParameters';
import { normMaterial } from './spoolCheck';

/** Typischer AMS-Düsenbereich pro Materialfamilie (min, max) */
const RANGE: Record<string, [number, number]> = {
  PLA: [190, 230],
  PETG: [220, 260],
  ABS: [240, 270],
  ASA: [240, 270],
  TPU: [200, 230],
  PA: [260, 290],
  PC: [250, 280],
  CF: [260, 290]
};

function tempRangeFor(material: string): [number, number] {
  return RANGE[normMaterial(material)] || [190, 250];
}

interface SpoolProfile {
  material: string;
  colorHex: string;
  /** Beste Düsentemperatur (gespeichert oder Standard) */
  nozzleTemp: number;
  bedTemp: number;
  /** Bereich, der an den AMS-Slot geschickt wird */
  minTemp: number;
  maxTemp: number;
  /** true, wenn die Werte an der Spule gespeichert sind */
  custom: boolean;
}

export function getSpoolProfile(spool: Spool): SpoolProfile {
  const base = getBambuProfile(spool.brand, spool.material);
  const custom = Boolean(spool.nozzleTemp || spool.bedTemp);
  const nozzleTemp = Number(spool.nozzleTemp) || base.nozzleTempOtherLayers;
  const bedTemp = Number(spool.bedTemp) || base.bedTempTexturedPEI;
  let minTemp: number;
  let maxTemp: number;
  if (spool.nozzleTemp) {
    // Eigene Temperatur: Bereich um den Wert, begrenzt auf sinnvolle Grenzen
    minTemp = Math.max(150, nozzleTemp - 15);
    maxTemp = Math.min(320, nozzleTemp + 15);
  } else {
    [minTemp, maxTemp] = tempRangeFor(spool.material);
  }
  return {
    material: spool.material,
    colorHex: spool.colorHex || '#888888',
    nozzleTemp,
    bedTemp,
    minTemp,
    maxTemp,
    custom
  };
}
