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
