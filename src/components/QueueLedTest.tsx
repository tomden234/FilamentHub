import React, { useEffect, useRef, useState } from 'react';
import { Lightbulb, Loader2, Square } from 'lucide-react';
import { findAmsDevice, ids, setQueueCount, setQueueMode, setQueueTest } from '../utils/amsDevice';
import { LED_LEGEND, ledTestSteps } from '../utils/queueLedTest';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Knopf „LED-Test“: spielt am Warteschlangen-Streifen alle Zustände mit den echten Farben ab (Stapel, Platte räumen, Start, Fehler).
 * Der ESP merkt sich dafür die echte Zahl und stellt sie danach selbst wieder her. Es startet kein Druck.
 */
export const QueueLedTest: React.FC<{ queueLength?: number }> = ({ queueLength }) => {
  const [running, setRunning] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const stop = useRef(false);
  const alive = useRef(true);
  const used = useRef<{ test: string; mode: string; count: string } | null>(null);
  useEffect(() => () => {
    alive.current = false;
    stop.current = true;
  }, []);

  const run = async () => {
    setErr('');
    setRunning(true);
    stop.current = false;
    setText('Suche den ESP in Home Assistant …');
    try {
      const dev = await findAmsDevice();
      if (!dev) {
        setErr('Kein AMS-ESP in Home Assistant gefunden. Menü → Testmenü → ESP suchen.');
        return;
      }
      const e = ids(dev.base, dev.roles);
      used.current = { test: e.queueTest, mode: e.queueMode, count: e.queue };
      if (!dev.roles.queueTest || !dev.roles.queueMode) {
        setErr('Der ESP hat noch keine Firmware mit Test-Schalter. Bitte neue Firmware aufspielen.');
        return;
      }
      if (!(await setQueueTest(e.queueTest, true))) {
        setErr('Home Assistant hat den Test-Schalter nicht angenommen.');
        return;
      }
      for (const s of ledTestSteps(Math.min(5, Math.max(3, queueLength || 0) || 4))) {
        if (stop.current) break;
        if (alive.current) setText(s.text);
        await setQueueCount(e.queue, s.count);
        await setQueueMode(e.queueMode, s.mode);
        await wait(s.ms);
      }
    } catch (x: any) {
      setErr(`Fehler: ${x?.message || x}`);
    } finally {
      // Immer aufräumen: Modus normal, Test aus (der ESP stellt die echte Warteschlange wieder her)
      const u = used.current;
      if (u) {
        await setQueueMode(u.mode, 0);
        await setQueueTest(u.test, false);
      }
      if (alive.current) {
        setRunning(false);
        setText('');
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={running}
          onClick={() => void run()}
          className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
          style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
          LED-Test der Warteschlange
        </button>
        {running && (
          <button type="button" onClick={() => (stop.current = true)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center gap-1" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }} aria-label="Test stoppen">
            <Square className="w-3 h-3" /> Stopp
          </button>
        )}
      </div>
      {running && text && <p className="text-[11px] font-bold" style={{ color: 'var(--app-accent-text)' }}>{text}</p>}
      {err && <p className="text-[11px] text-amber-400">{err}</p>}
      <ul className="space-y-0.5">
        {LED_LEGEND.map(l => (
          <li key={l.label} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0 border" style={{ backgroundColor: l.color, borderColor: 'var(--app-border)' }} />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
