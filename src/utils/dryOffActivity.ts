// Du machst am Drucker etwas (Achsen verfahren, Düse aufheizen, Druck-Befehl ...): Läuft gerade der 3-Minuten-Zähler
// von „Danach Drucker ausschalten“, wird das Ausschalten dieses Mal abgebrochen (in der App und in Home Assistant).
import { getDryOff, skipDryOffRun } from './dryAutoOff';
import { cancelHaDryOffRun } from './haDryOff';
import { addSystemLog } from './logService';

export function noteDryOffActivity(what: string): void {
  const s = getDryOff();
  if (!s.armed || !s.endedAt) return;
  skipDryOffRun();
  void cancelHaDryOffRun();
  addSystemLog('steckdose', 'Drucker bleibt an', `Ausschalten abgebrochen: ${what}`, 'info');
}
