import { useEffect } from 'react';
import { useAutoOff } from '../utils/autoPowerOff';
import { useDryOff } from '../utils/dryAutoOff';
import { getServerUrl, pushHubConfig, pushHubPower } from '../utils/recorderServer';
import { markHubPowerSent, powerSig } from '../utils/serverDeducts';

// Brücke zum Pi-Server (Hub): „Aus nach Druck“, „Aus nach Trocknen“ und die Einstellungen (Cloud, Slots, Steckdose) melden,
// damit der Pi auch ohne offene App ausschaltet, abzieht und warnt. Erst wenn der Pi den Stand bestätigt hat, schaltet die App nicht mehr selbst.
export function useHubBridge() {
  const auto = useAutoOff();
  const dry = useDryOff();

  useEffect(() => {
    if (!getServerUrl()) return;
    const sig = powerSig('auto', auto.armed, auto.armedAt);
    let tries = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    const send = async () => {
      const ok = await pushHubPower({ autoOff: { armed: auto.armed, jobName: auto.jobName, armedAt: auto.armedAt } });
      if (ok) markHubPowerSent(sig);
      else if (++tries < 5) t = setTimeout(() => void send(), 30_000);
    };
    void send();
    return () => {
      if (t) clearTimeout(t);
    };
  }, [auto.armed, auto.armedAt, auto.jobName]);

  useEffect(() => {
    if (!getServerUrl()) return;
    const sig = powerSig('dry', dry.armed, dry.armedAt);
    let tries = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    const send = async () => {
      const ok = await pushHubPower({ dryOff: { armed: dry.armed, armedAt: dry.armedAt } });
      if (ok) markHubPowerSent(sig);
      else if (++tries < 5) t = setTimeout(() => void send(), 30_000);
    };
    void send();
    return () => {
      if (t) clearTimeout(t);
    };
  }, [dry.armed, dry.armedAt]);

  // Einstellungen (Slots, Cloud, Steckdose …) kurz nach dem Start und dann alle 5 Minuten, nur wenn sich etwas geändert hat
  useEffect(() => {
    const run = () => {
      if (getServerUrl()) void pushHubConfig().catch(() => undefined);
    };
    const t = setTimeout(run, 5000);
    const iv = setInterval(run, 5 * 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);
}
