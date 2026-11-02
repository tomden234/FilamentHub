import React, { useState } from 'react';
import { CalendarClock, Droplets, Power, Timer } from 'lucide-react';
import { clockText, nextClockTime } from '../../utils/printPlan';
import { NumInput } from '../ui/NumInput';

// Fenster bei einem neuen Druck: danach trocknen, danach ausschalten, Druck verzögern (pausieren, später fortsetzen).
// Nichts gewählt / Schließen = der Druck läuft ganz normal weiter.
interface Props {
  jobName: string;
  /** Schon gewählt */
  dryArmed: boolean;
  offArmed: boolean;
  /** AMS trocknet gerade */
  drying: boolean;
  /** Vorschlag für die Trocknung (aus den Spulen im AMS) */
  suggestTemp: number;
  suggestHours: number;
  /** Home Assistant mit Steckdose eingerichtet (für „Nach dem Trocknen ausschalten“) */
  canSwitchOff: boolean;
  dryOffArmed: boolean;
  onApply: (o: { dry: boolean; off: boolean; resumeAt: number; dryTemp: number; dryHours: number; dryOff: boolean }) => void;
  onClose: () => void;
}

const PRESETS = [1, 2, 3, 4];
const TEMPS = [45, 50, 55, 60, 65];
const HOURS = [2, 4, 6, 8, 12, 24];

export const PrintPlanSheet: React.FC<Props> = ({ jobName, dryArmed, offArmed, drying, suggestTemp, suggestHours, canSwitchOff, dryOffArmed, onApply, onClose }) => {
  const [dry, setDry] = useState(dryArmed);
  const [off, setOff] = useState(offArmed);
  const [dryTemp, setDryTemp] = useState(Math.max(45, Math.min(65, Math.round(suggestTemp / 5) * 5)));
  const [dryHours, setDryHours] = useState(Math.max(1, Math.min(24, Math.round(suggestHours))));
  const [customHours, setCustomHours] = useState(false);
  const [dryOff, setDryOff] = useState(dryOffArmed);
  const [delayMode, setDelayMode] = useState<'none' | 'preset' | 'in' | 'at'>('none');
  const [presetH, setPresetH] = useState(2);
  const [inH, setInH] = useState('1');
  const [inM, setInM] = useState('30');
  const [atTime, setAtTime] = useState('');

  const chip = (active: boolean, disabled = false): React.CSSProperties => ({
    backgroundColor: active ? 'var(--app-accent)' : 'var(--app-card-sub)',
    borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
    color: active ? '#fff' : 'var(--app-text)',
    opacity: disabled ? 0.45 : 1
  });

  const resumeAt = (() => {
    const now = Date.now();
    if (delayMode === 'preset') return now + presetH * 3600_000;
    if (delayMode === 'in') {
      const ms = ((Number(inH) || 0) * 60 + (Number(inM) || 0)) * 60_000;
      return ms > 0 ? now + ms : 0;
    }
    if (delayMode === 'at') return atTime ? nextClockTime(atTime, now) : 0;
    return 0;
  })();
  const delayInvalid = delayMode !== 'none' && !resumeAt;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border p-4 space-y-3 max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-sm font-extrabold">Neuer Druck</div>
        {jobName && (
          <div className="text-[11px] font-bold truncate" style={{ color: 'var(--app-text-muted)' }}>
            {jobName}
          </div>
        )}
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Nichts wählen = der Druck läuft ganz normal weiter.
        </p>

        <div className="space-y-1.5">
          <button
            onClick={() => {
              setOff(v => !v);
              if (!off) setDry(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer text-left"
            style={chip(off)}
          >
            <Power className="w-4 h-4 shrink-0" />
            <span>{off ? 'Danach ausschalten ✓' : 'Danach ausschalten'}</span>
          </button>
          <button
            onClick={() => !off && setDry(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer text-left"
            style={chip(dry, off)}
          >
            <Droplets className="w-4 h-4 shrink-0" />
            <span>{dry ? 'Danach trocknen ✓' : 'Danach trocknen'}</span>
          </button>
          {off && (
            <p className="text-[10px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
              „Danach ausschalten“ ist stärker: es wird nicht getrocknet.
            </p>
          )}
        </div>

        {dry && !off && (
          <div className="space-y-2 rounded-xl border p-2.5" style={{ backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' }}>
            <div className="text-xs font-extrabold">Trocknen: Einstellungen</div>
            <div>
              <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--app-text-muted)' }}>Temperatur (AMS 2 Pro: 45–65 °C)</div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPS.map(t => (
                  <button key={t} onClick={() => setDryTemp(t)} className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer" style={chip(dryTemp === t)}>
                    {t} °C
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--app-text-muted)' }}>Dauer</div>
              <div className="flex flex-wrap gap-1.5">
                {HOURS.map(h => (
                  <button
                    key={h}
                    onClick={() => {
                      setDryHours(h);
                      setCustomHours(false);
                    }}
                    className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer"
                    style={chip(!customHours && dryHours === h)}
                  >
                    {h} h
                  </button>
                ))}
                <button onClick={() => setCustomHours(true)} className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer" style={chip(customHours)}>
                  Eigene …
                </button>
              </div>
              {customHours && (
                <div className="flex items-center gap-1.5 text-xs mt-1.5">
                  <NumInput type="number" min={1} max={24} value={String(dryHours)} onChange={e => setDryHours(Math.max(1, Math.min(24, Math.round(Number(e.target.value) || 1))))} className="w-16 px-2 py-1 rounded-lg border text-center bg-transparent" style={{ borderColor: 'var(--app-border)' }} />
                  <span>Stunden (1–24)</span>
                </div>
              )}
            </div>
            <button
              onClick={() => canSwitchOff && setDryOff(v => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer text-left"
              style={chip(dryOff && canSwitchOff, !canSwitchOff)}
            >
              <Power className="w-4 h-4 shrink-0" />
              <span>{dryOff && canSwitchOff ? 'Nach dem Trocknen ausschalten ✓' : 'Nach dem Trocknen ausschalten'}</span>
            </button>
            {!canSwitchOff && (
              <p className="text-[10px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
                Dafür braucht die App Home Assistant mit Steckdose (Verbindungen).
              </p>
            )}
            <div className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
              Vorschlag aus deinen Spulen: {Math.max(45, Math.min(65, Math.round(suggestTemp / 5) * 5))} °C, {Math.round(suggestHours)} h
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-extrabold">
            <Timer className="w-4 h-4 text-amber-400" />
            <span>Druck verzögern</span>
          </div>
          <p className="text-[10px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
            Der Druck wird pausiert und später fortgesetzt. {drying ? 'Die Trocknung läuft bis dahin weiter, beim Fortsetzen wird sie beendet und danach mit der Restzeit wieder gestartet.' : ''} Die App muss dafür laufen (Android: Hintergrund-Dienst).
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(h => (
              <button
                key={h}
                onClick={() => {
                  setDelayMode('preset');
                  setPresetH(h);
                }}
                className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer"
                style={chip(delayMode === 'preset' && presetH === h)}
              >
                in {h} h
              </button>
            ))}
            <button onClick={() => setDelayMode('in')} className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer" style={chip(delayMode === 'in')}>
              In … eingeben
            </button>
            <button onClick={() => setDelayMode('at')} className="px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer inline-flex items-center gap-1" style={chip(delayMode === 'at')}>
              <CalendarClock className="w-3 h-3" /> Um Uhrzeit
            </button>
          </div>
          {delayMode === 'in' && (
            <div className="flex items-center gap-1.5 text-xs">
              <span>in</span>
              <NumInput type="number" min={0} max={48} value={inH} onChange={e => setInH(e.target.value)} className="w-14 px-2 py-1 rounded-lg border text-center bg-transparent" style={{ borderColor: 'var(--app-border)' }} />
              <span>h</span>
              <NumInput type="number" min={0} max={59} value={inM} onChange={e => setInM(e.target.value)} className="w-14 px-2 py-1 rounded-lg border text-center bg-transparent" style={{ borderColor: 'var(--app-border)' }} />
              <span>min</span>
            </div>
          )}
          {delayMode === 'at' && (
            <div className="flex items-center gap-1.5 text-xs">
              <span>Fortsetzen um</span>
              <input type="time" value={atTime} onChange={e => setAtTime(e.target.value)} className="px-2 py-1 rounded-lg border bg-transparent" style={{ borderColor: 'var(--app-border)' }} />
            </div>
          )}
          {delayMode !== 'none' && (
            <div className="text-[11px] font-bold text-amber-400">{resumeAt ? `Fortsetzen: ${clockText(resumeAt)}` : 'Bitte eine Zeit angeben.'}</div>
          )}
          {delayMode !== 'none' && (
            <button onClick={() => setDelayMode('none')} className="text-[10px] underline cursor-pointer" style={{ color: 'var(--app-text-muted)' }}>
              Nicht verzögern
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            disabled={delayInvalid}
            onClick={() => onApply({ dry: dry && !off, off, resumeAt: delayMode === 'none' ? 0 : resumeAt, dryTemp, dryHours, dryOff: dry && !off && canSwitchOff && dryOff })}
            className="w-full py-2 rounded-xl text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
            style={{ backgroundImage: 'var(--app-accent-gradient)' }}
          >
            Übernehmen
          </button>
          <button onClick={onClose} className="w-full py-2 rounded-xl border text-xs font-bold cursor-pointer" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
            Ignorieren, normal drucken
          </button>
        </div>
      </div>
    </div>
  );
};
