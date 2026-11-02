import React, { useState } from 'react';
import { Toggle, buttonStyle, inputStyle } from '../workshop/ui';
import { NumInput } from '../ui/NumInput';
import { useWorkshopSettings } from '../../utils/workshopSettings';
import { getLedInfo, getLedJson, installStatusLed, setStatusLed } from '../../utils/statusLed';

/** Status-LED (LED-Streifen am Drucker, ESPHome oder WLED): an/aus, Helligkeit, Prüfen. Steht unter Verbindungen, weil es ein Gerät ist. */
export const StatusLedCard: React.FC = () => {
  const [s, update] = useWorkshopSettings();
  const [ledInfo, setLedInfo] = useState(getLedInfo());
  const [ledBusy, setLedBusy] = useState(false);
  return (
    <div className="space-y-2.5">
        <Toggle
          on={s.statusLed}
          onChange={v => update({ statusLed: v })}
          label="LED-Streifen zeigt den Druckerstatus"
          hint="Blau mit Fortschrittsbalken beim Druck, Gelb bei Pause, Grün wenn fertig, Rot blinkend bei Fehler, Orange atmend beim Trocknen, sonst aus. Braucht den LED-Streifen am ESP32 (ESPHome, gleicher ESP wie die NFC-Leser) oder WLED, in Home Assistant (Aufbau: hardware/status-led). Die App legt die Automation selbst an."
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
    </div>
  );
};
