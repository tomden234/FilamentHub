// Feuchte-Hinweise pro Material: wie schnell zieht es Wasser und wie oft sollte man trocknen.
import { normMaterial } from './spoolCheck';

interface HumidityInfo {
  /** 1 = niedrig, 4 = sehr hoch */
  level: 1 | 2 | 3 | 4;
  short: string;
  tip: string;
}

const INFO: Record<string, HumidityInfo> = {
  PLA: {
    level: 1,
    short: 'Feuchte niedrig',
    tip: 'PLA zieht nur langsam Wasser. Trocknen reicht, wenn es knistert oder Fäden zieht.'
  },
  PETG: {
    level: 2,
    short: 'Feuchte mittel',
    tip: 'PETG fädelt und wird matt, wenn es feucht ist. Regelmäßig trocknen.'
  },
  ABS: {
    level: 2,
    short: 'Feuchte mittel',
    tip: 'ABS und ASA zeigen Feuchte durch Blasen und raue Wände. Vor langen Drucken trocknen.'
  },
  ASA: {
    level: 2,
    short: 'Feuchte mittel',
    tip: 'ABS und ASA zeigen Feuchte durch Blasen und raue Wände. Vor langen Drucken trocknen.'
  },
  TPU: {
    level: 3,
    short: 'Feuchte hoch',
    tip: 'TPU zieht viel Wasser. Vor jedem Druck trocknen, sonst gibt es Blasen und schwache Teile.'
  },
  PC: {
    level: 3,
    short: 'Feuchte hoch',
    tip: 'PC saugt Wasser und wird dann spröde. Trocken lagern und vor dem Druck heiß trocknen.'
  },
  PA: {
    level: 4,
    short: 'Feuchte sehr hoch',
    tip: 'Nylon saugt in wenigen Stunden Wasser. Direkt aus dem Trockner drucken.'
  },
  CF: {
    level: 4,
    short: 'Feuchte sehr hoch',
    tip: 'Carbon-Nylon und PET-CF saugen stark Wasser. Direkt aus dem Trockner drucken.'
  }
};

const FALLBACK: HumidityInfo = {
  level: 2,
  short: 'Feuchte mittel',
  tip: 'Trocken lagern und bei Fäden oder Knistern trocknen.'
};

export function getHumidityInfo(material?: string): HumidityInfo {
  return INFO[normMaterial(material)] || FALLBACK;
}
