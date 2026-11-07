import React, { useEffect, useRef, useState } from 'react';
import { Toggle, buttonStyle, inputStyle } from '../workshop/ui';
import { NumInput } from '../ui/NumInput';
import { useWorkshopSettings } from '../../utils/workshopSettings';
import {
  LED_ORDER_GUIDE,
  DEFAULT_LED_COLORS,
  LED_TEST_MODES,
  endStatusLedPreview,
  getLedInfo,
  getLedJson,
  installStatusLed,
  previewProgress,
  previewStatusLed,
  setStatusLed,
  type LedColors,
  type LedTestMode
} from '../../utils/statusLed';
import { NIGHT_DEFAULT, isNightHour, readNightLed, setNightLed, type NightLed } from '../../utils/amsDevice';

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Nachtmodus: ab einer Uhrzeit leuchten beide Streifen (Status + Warteschlange) gedimmt. Die Werte liegen am ESP (wirkt auch ohne App/Pi). */
const NightLedSection: React.FC = () => {
  const [n, setN] = useState<NightLed | null>(null);
  const [state, setState] = useState<'load' | 'ok' | 'missing' | 'error'>('load');
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = async () => {
    setState('load');
    try {
      const r = await readNightLed();
      setN(r);
      setState(r ? 'ok' : 'missing');
    } catch (e: any) {
      setState('error');
      setMsg(String(e?.message || e));
    }
  };
  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const change = (c: Partial<Pick<NightLed, 'on' | 'from' | 'to' | 'pct'>>) => {
    if (!n) return;
    const next = { ...n, ...c };
    setN(next);
    setMsg('');
    if (timer.current) clearTimeout(timer.current);
    // Kurz bündeln, damit nicht jeder Tastendruck an den ESP geht
    timer.current = setTimeout(async () => {
      const ok = await setNightLed(next, { on: next.on, from: next.from, to: next.to, pct: next.pct });
      setMsg(ok ? 'Am ESP gespeichert.' : 'Konnte nicht an den ESP schicken (Home Assistant erreichbar?).');
    }, c.on !== undefined ? 0 : 500);
  };

  const nowNight = n ? isNightHour(new Date().getHours(), n.from, n.to) : false;
  const hourInput = (value: number, onChange: (v: number) => void, label: string) => (
    <NumInput
      type="number"
      min={0}
      max={23}
      value={value}
      onChange={e => {
        const v = parseInt(e.target.value, 10);
        if (Number.isFinite(v) && v >= 0 && v <= 23) onChange(v);
      }}
      className="w-14 px-2 py-1 rounded-lg border text-xs font-mono-num outline-none text-right"
      style={inputStyle}
      aria-label={label}
    />
  );

  return (
    <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
      <div>
        <p className="text-xs font-bold">Nachtmodus</p>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Ab der Uhrzeit leuchten beide Streifen (Status und Warteschlange) gedimmt. Läuft direkt am ESP, auch wenn App und Pi aus sind.
        </p>
      </div>
      {state === 'load' && <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>Lese Werte vom ESP …</p>}
      {(state === 'missing' || state === 'error') && (
        <div className="space-y-1.5">
          <p className="text-[11px] leading-snug" style={{ color: '#f59e0b' }}>
            {state === 'missing'
              ? `Der ESP hat den Nachtmodus noch nicht. Neue filament-ams.yaml aufspielen (Home Assistant → ESPHome → Filament AMS → Installieren → Drahtlos). Danach gilt ab ${hh(NIGHT_DEFAULT.from)} bis ${hh(NIGHT_DEFAULT.to)} ${NIGHT_DEFAULT.pct} %.`
              : `Home Assistant nicht erreichbar: ${msg}`}
          </p>
          <button onClick={() => void load()} className="px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer" style={buttonStyle}>
            Nochmal lesen
          </button>
        </div>
      )}
      {state === 'ok' && n && (
        <>
          <Toggle on={n.on} onChange={v => change({ on: v })} label="Nachts dimmen" hint={`Gerade: ${n.on && (n.active ?? nowNight) ? `Nacht, ${n.pct} %` : 'Tag, normale Helligkeit'}.`} />
          {n.on && (
            <>
              <div className="flex items-center justify-between gap-2 text-xs font-bold">
                <span>Ab</span>
                <span className="flex items-center gap-1">
                  {hourInput(n.from, v => change({ from: v }), 'Nachtmodus ab Uhrzeit')}
                  <span className="font-normal" style={{ color: 'var(--app-text-muted)' }}>Uhr bis</span>
                  {hourInput(n.to, v => change({ to: v }), 'Nachtmodus bis Uhrzeit')}
                  <span className="font-normal" style={{ color: 'var(--app-text-muted)' }}>Uhr</span>
                </span>
              </div>
              <label className="block text-xs font-bold">
                <span className="flex items-center justify-between">
                  <span>Helligkeit nachts</span>
                  <span className="font-mono-num">{n.pct} %</span>
                </span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={n.pct}
                  onChange={e => change({ pct: parseInt(e.target.value, 10) })}
                  className="w-full mt-1 cursor-pointer"
                  aria-label="Helligkeit im Nachtmodus"
                />
                <span className="block text-[11px] font-normal leading-snug" style={{ color: 'var(--app-text-muted)' }}>
                  {n.from === n.to ? 'Gleiche Uhrzeit bei „ab“ und „bis“ = nie dimmen.' : `Von ${hh(n.from)} bis ${hh(n.to)} Uhr leuchten die Streifen mit ${n.pct} % der normalen Helligkeit.`}
                </span>
              </label>
            </>
          )}
          {msg && <p className="text-[11px]" style={{ color: msg.startsWith('Am ESP') ? 'var(--app-text-muted)' : '#f59e0b' }}>{msg}</p>}
        </>
      )}
    </div>
  );
};

/** Status-LED (LED-Streifen am Drucker, ESPHome oder WLED): an/aus, Helligkeit, Prüfen. Steht in der Werkstatt als eigener Tab „Status-LED“. */
export const StatusLedCard: React.FC = () => {
  const [s, update] = useWorkshopSettings();
  const [ledInfo, setLedInfo] = useState(getLedInfo());
  const [ledBusy, setLedBusy] = useState(false);
  // Test der Modi: welcher Modus gerade leuchtet, Druckfortschritt-Slider, Rückmeldung
  const [testMode, setTestMode] = useState<LedTestMode | null>(null);
  const [testPct, setTestPct] = useState(50);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [seenOrder, setSeenOrder] = useState('');
  const testModeRef = useRef<LedTestMode | null>(null);
  const sliderTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  testModeRef.current = testMode;

  // Fenster zu: Test beenden, LED zurück auf den echten Stand
  useEffect(
    () => () => {
      if (sliderTimer.current) clearTimeout(sliderTimer.current);
      if (colorTimer.current) clearTimeout(colorTimer.current);
      if (testModeRef.current) void endStatusLedPreview();
    },
    []
  );

  const colors: LedColors = { ...DEFAULT_LED_COLORS, ...(s.statusLedColors || {}) };
  const colorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Farbe ändern: sofort fest gespeichert, an der LED live (kurz gebündelt)
  const setColor = (mode: keyof LedColors, hex: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const next = { ...colors, [mode]: hex.toLowerCase() };
    update({ statusLedColors: next });
    if (colorTimer.current) clearTimeout(colorTimer.current);
    colorTimer.current = setTimeout(async () => {
      const r = await previewStatusLed(mode, testPct, next);
      setTestMsg(r);
      setTestMode(r.ok ? mode : null);
    }, 200);
  };

  const runTest = async (mode: LedTestMode, pct = testPct) => {
    setTestBusy(true);
    const r = await previewStatusLed(mode, pct, colors);
    setTestBusy(false);
    setTestMsg(r);
    setTestMode(r.ok ? (mode === 'off' ? null : mode) : null);
    if (r.ok && mode === 'off') void endStatusLedPreview();
  };

  const onSlide = (pct: number) => {
    setTestPct(pct);
    if (sliderTimer.current) clearTimeout(sliderTimer.current);
    // Kurz warten, damit nicht jeder Zwischenwert an Home Assistant geht
    sliderTimer.current = setTimeout(async () => {
      if (testModeRef.current === 'print') {
        const r = await previewProgress(pct);
        if (!r.ok) setTestMsg(r);
      } else {
        await runTest('print', pct);
      }
    }, 250);
  };

  return (
    <div className="space-y-2.5">
        <Toggle
          on={s.statusLed}
          onChange={v => update({ statusLed: v })}
          label="LED-Streifen zeigt den Druckerstatus"
          hint="Blau mit Fortschrittsbalken beim Druck, Gelb bei Pause, Grün wenn fertig, Rot blinkend bei Fehler, sonst aus. Braucht den LED-Streifen am ESP32 (ESPHome, gleicher ESP wie die NFC-Leser) oder WLED, in Home Assistant (Aufbau: hardware/status-led). Die App legt die Automation selbst an."
        />
        {s.statusLed && (
          <>
            <label className="flex items-center justify-between gap-2 text-xs font-bold">
              <span>Helligkeit</span>
              <span className="flex items-center gap-1">
                <NumInput
                  type="number"
                  min={5}
                  max={100}
                  value={s.statusLedBrightness}
                  onChange={e => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isFinite(n)) update({ statusLedBrightness: n });
                  }}
                  className="w-16 px-2 py-1 rounded-lg border text-xs font-mono-num outline-none text-right"
                  style={inputStyle}
                  aria-label="Helligkeit der Status-LED"
                />
                <span className="w-6 font-normal" style={{ color: 'var(--app-text-muted)' }}>%</span>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={ledBusy}
                onClick={async () => {
                  setLedBusy(true);
                  try {
                    await installStatusLed();
                    await setStatusLed(true);
                  } finally {
                    setLedInfo(getLedInfo());
                    setLedBusy(false);
                  }
                }}
                className="px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer disabled:opacity-60"
                style={buttonStyle}
              >
                {ledBusy ? 'Prüfe …' : 'Nochmal prüfen'}
              </button>
              {ledInfo && !ledInfo.ok && getLedJson() && (
                <button
                  onClick={() => void navigator.clipboard?.writeText(getLedJson())}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer"
                  style={buttonStyle}
                >
                  Automation kopieren
                </button>
              )}
            </div>
            {ledInfo && (
              <p className="text-[11px] leading-snug" style={{ color: ledInfo.ok ? 'var(--app-text-muted)' : '#f59e0b' }}>
                {ledInfo.text}
              </p>
            )}
          </>
        )}

        <NightLedSection />

        <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
          <div>
            <p className="text-xs font-bold">Farben einstellen</p>
            <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
              Farbe wählen: die LED zeigt sie sofort live. Wird automatisch fest gespeichert und für den echten Druck übernommen.
            </p>
          </div>
          {([
            ['print', 'Druck läuft (mit Balken)'],
            ['pause', 'Pause'],
            ['finish', 'Fertig'],
            ['failed', 'Fehler (blinkt)']
          ] as const).map(([k, label]) => (
            <div key={k} className="flex items-center gap-2 text-xs font-bold">
              <span className="flex-1 min-w-0 truncate">{label}</span>
              <input
                type="color"
                value={colors[k]}
                onChange={e => setColor(k, e.target.value)}
                className="w-9 h-7 p-0 border rounded cursor-pointer bg-transparent"
                style={{ borderColor: 'var(--app-border)' }}
                aria-label={`Farbe für ${label}`}
              />
              <input
                type="text"
                key={colors[k]}
                defaultValue={colors[k]}
                maxLength={7}
                onChange={e => setColor(k, e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)}
                className="w-20 px-2 py-1 rounded-lg border text-xs font-mono-num outline-none"
                style={inputStyle}
                aria-label={`Hex-Farbe für ${label}`}
              />
              <button
                onClick={() => setColor(k, DEFAULT_LED_COLORS[k])}
                className="px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer"
                style={buttonStyle}
                title="Standardfarbe"
              >
                ↺
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
          <div>
            <p className="text-xs font-bold">LED testen</p>
            <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
              Zeigt jeden Modus an der echten LED. Während des Tests ist die automatische Anzeige kurz aus.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {LED_TEST_MODES.map(m => {
              const active = testMode === m.mode;
              return (
                <button
                  key={m.mode}
                  disabled={testBusy}
                  onClick={() => void runTest(m.mode)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer disabled:opacity-60 text-left"
                  style={{ ...buttonStyle, ...(active ? { outline: '2px solid var(--app-accent, #3b82f6)' } : {}) }}
                  title={m.hint}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border"
                    style={{ background: m.mode === 'print' || m.mode === 'pause' || m.mode === 'finish' || m.mode === 'failed' ? colors[m.mode] : m.rgb ? `rgb(${m.rgb[0]},${m.rgb[1]},${m.rgb[2]})` : 'transparent', borderColor: 'var(--app-border)' }}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">{m.label}</span>
                </button>
              );
            })}
          </div>
          <label className="block text-xs font-bold">
            <span className="flex items-center justify-between">
              <span>Druckfortschritt simulieren</span>
              <span className="font-mono-num">{testPct} %</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={testPct}
              onChange={e => onSlide(parseInt(e.target.value, 10))}
              className="w-full mt-1 cursor-pointer"
              aria-label="Druckfortschritt simulieren"
            />
            <span className="block text-[11px] font-normal leading-snug" style={{ color: 'var(--app-text-muted)' }}>
              Schieben zeigt blau den Balken wie beim echten Druck.
            </span>
          </label>
          {testMode === 'colortest' && (
            <label className="block text-xs font-bold space-y-1">
              <span>Welche Farben siehst du nacheinander?</span>
              <select
                value={seenOrder}
                onChange={e => setSeenOrder(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border text-xs outline-none"
                style={inputStyle}
                aria-label="Farben die der Streifen beim Farbtest zeigt"
              >
                <option value="">Bitte wählen …</option>
                {LED_ORDER_GUIDE.map(g => (
                  <option key={g.order} value={g.order}>
                    {g.seen}
                  </option>
                ))}
              </select>
              {seenOrder && (
                <span className="block text-[11px] font-normal leading-snug" style={{ color: 'var(--app-text-muted)' }}>
                  {seenOrder === 'GRB'
                    ? 'Die Farben stimmen. Nichts zu ändern.'
                    : `In der filament-ams.yaml oben die Zeile led_order auf "${seenOrder}" ändern (led_order: "${seenOrder}") und neu aufspielen (Installieren, Wireless).`}
                </span>
              )}
            </label>
          )}
          {(testMode || testMsg) && (
            <div className="flex flex-wrap items-center gap-2">
              {testMode && (
                <button
                  onClick={() => {
                    setTestMode(null);
                    setTestMsg(null);
                    void endStatusLedPreview();
                  }}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer"
                  style={buttonStyle}
                >
                  Test beenden
                </button>
              )}
              {testMsg && (
                <p className="text-[11px] leading-snug" style={{ color: testMsg.ok ? 'var(--app-text-muted)' : '#f59e0b' }}>
                  {testMsg.text}
                </p>
              )}
            </div>
          )}
        </div>
    </div>
  );
};
