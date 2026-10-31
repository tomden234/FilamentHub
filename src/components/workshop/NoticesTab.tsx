import React, { useEffect, useState } from 'react';
import { Bell, BellRing, CheckCircle2, PackageMinus, Send, Waves } from 'lucide-react';
import { useHumidity } from '../../utils/humidity';
import { IS_NATIVE } from '../../utils/env';
import { testAlert, TEST_KINDS } from '../../utils/alerts';
import type { InboxKind } from '../../utils/inbox';
import { notifyPermission, localNotify, requestNotifyPermission, refreshNotifyPermission, openNotifySettings, notifyNeedsNewApk, type NotifyPermission } from '../../utils/notify';
import { useWorkshopSettings } from '../../utils/workshopSettings';
import { Card, Toggle, buttonStyle, inputStyle } from './ui';

const PRESETS = [50, 100, 150, 200];

const PERMISSION_TEXT: Record<NotifyPermission, string> = {
  granted: 'Erlaubt',
  denied: 'Blockiert (im Browser oder in den Android-Einstellungen freigeben)',
  default: 'Noch nicht gefragt',
  unsupported: 'Nicht verfügbar (die Mitteilungen erscheinen dann nur in der App)'
};

/** Einstellungen: welche Mitteilungen kommen, und ob sie zusätzlich als Benachrichtigung aufs Gerät gehen. */
export const NoticesTab: React.FC = () => {
  const [s, update] = useWorkshopSettings();
  const hum = useHumidity();
  const [perm, setPerm] = useState<NotifyPermission>(notifyPermission());
  const [testInfo, setTestInfo] = useState('');
  const [testKind, setTestKind] = useState<InboxKind>('dry-done');
  useEffect(() => {
    const refresh = () => void refreshNotifyPermission().then(setPerm);
    refresh();
    // Zurück aus den Android-Einstellungen: Stand neu lesen
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const sendTest = async () => {
    const r = await testAlert(testKind);
    setTestInfo(r.pushed ? 'Gesendet. Tipp auf die Benachrichtigung öffnet sie hier im Postfach.' : 'Im Postfach angelegt. Als Benachrichtigung ging sie nicht raus: erst erlauben (siehe Status).');
    setTimeout(() => setTestInfo(''), 7000);
  };

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <BellRing className="w-4 h-4 text-orange-400" />
          <span>Welche Mitteilungen willst du?</span>
        </div>
        <div className="space-y-3">
          <Toggle on={s.alertPrintStart} onChange={v => update({ alertPrintStart: v })} label="Druck gestartet" hint="Auch wenn du über Bambu Studio, Handy oder Display startest." />
          <Toggle on={s.alertPrintCheck} onChange={v => update({ alertPrintCheck: v })} label="Spulen-Check beim Start" hint="Warnt, wenn das Filament nicht reicht, das Material fehlt oder nicht zur Spule passt." />
          <Toggle on={s.alertErrors} onChange={v => update({ alertErrors: v })} label="Druckerfehler" hint="Alle Fehler und Hinweise des Druckers als Klartext (Düse verstopft, Spaghetti, AMS …)." />
          <Toggle on={s.alertPrintDone} onChange={v => update({ alertPrintDone: v })} label="Druck fertig" hint="Sobald der Drucker das Ende meldet. War die App zu, kommt die Meldung beim nächsten Öffnen." />
          <Toggle on={s.alertPrintFail} onChange={v => update({ alertPrintFail: v })} label="Druck fehlgeschlagen oder abgebrochen" />
          <Toggle on={s.alertDryDone} onChange={v => update({ alertDryDone: v })} label="Trocknung fertig" hint="Mit Dauer, Temperatur und den getrockneten Spulen." />
          <Toggle on={s.alertDryStop} onChange={v => update({ alertDryStop: v })} label="Trocknung gestoppt" hint="Wenn die Trocknung vor dem Ende angehalten wird." />
          <Toggle on={s.alertDryDue} onChange={v => update({ alertDryDue: v })} label="Trocknen fällig" hint="Einmal pro Tag und Spule, mit Temperatur und Zeit." />
          <Toggle on={s.drySuggest} onChange={v => update({ drySuggest: v })} label="Trocknen-Vorschlag beim Einlegen" hint="Kommt eine Spule ins AMS, die trocknen sollte: Mitteilung und Frage „Nach dem Druck trocknen“." />
          <Toggle on={s.alertLow} onChange={v => update({ alertLow: v })} label="Spule fast leer" hint="Kommt, wenn der Rest unter die Grenze fällt." />
        </div>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Mitteilungen kommen, solange die App läuft oder im Hintergrund offen ist und mit dem Drucker verbunden bleibt. Alle landen im Postfach (Reiter „Mitteilungen“).
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Waves className="w-4 h-4 text-sky-400" />
          <span>Luftfeuchte</span>
        </div>
        <Toggle on={s.alertHumidity} onChange={v => update({ alertHumidity: v })} label="Melden, wenn die Feuchte zu hoch ist" hint="AMS-Messwert und der Sensor in der Lagerbox. Erst nach 5 Minuten über der Grenze." />
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-lg border p-2" style={{ borderColor: 'var(--app-border)' }}>
            <div style={{ color: 'var(--app-text-muted)' }}>AMS</div>
            <div className="text-sm font-extrabold font-mono-num">{hum.ams?.value != null ? `${Math.round(hum.ams.value)} %` : '–'}</div>
            {hum.ams?.temp != null && <div style={{ color: 'var(--app-text-muted)' }}>{Math.round(hum.ams.temp)} °C</div>}
          </div>
          <div className="rounded-lg border p-2" style={{ borderColor: 'var(--app-border)' }}>
            <div style={{ color: 'var(--app-text-muted)' }}>Box</div>
            <div className="text-sm font-extrabold font-mono-num">{hum.external?.value != null ? `${Math.round(hum.external.value)} %` : '–'}</div>
            {hum.external?.temp != null && <div style={{ color: 'var(--app-text-muted)' }}>{Math.round(hum.external.temp)} °C</div>}
            {hum.external?.error && <div className="text-amber-400 leading-snug">{hum.external.error}</div>}
          </div>
          <div className="rounded-lg border p-2" style={{ borderColor: 'var(--app-border)' }}>
            <div style={{ color: 'var(--app-text-muted)' }}>Ext. Trockner</div>
            <div className="text-sm font-extrabold font-mono-num">{hum.room?.value != null ? `${Math.round(hum.room.value)} %` : '–'}</div>
            {hum.room?.temp != null && <div style={{ color: 'var(--app-text-muted)' }}>{Math.round(hum.room.temp)} °C</div>}
            {hum.room?.error && <div className="text-amber-400 leading-snug">{hum.room.error}</div>}
          </div>
        </div>
        <label className="flex items-center justify-between gap-2 text-xs font-bold">
          <span>Melden ab</span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={10}
              max={90}
              value={s.humidityMax}
              onChange={e => update({ humidityMax: parseInt(e.target.value, 10) || 25 })}
              className="w-16 px-2 py-1 rounded-lg border text-xs font-mono-num outline-none text-right"
              style={inputStyle}
              aria-label="Grenze Luftfeuchte in Prozent"
            />
            <span>%</span>
          </span>
        </label>
        <Toggle
          on={s.autoDryOn}
          onChange={v => update({ autoDryOn: v })}
          label="AMS automatisch trocknen"
          hint="Liegt die AMS-Feuchte 10 Minuten auf oder über der Grenze, startet die Trocknung (läuft ein Druck: danach). Höchstens einmal am Tag."
        />
        {s.autoDryOn && (
          <label className="flex items-center justify-between gap-2 text-xs font-bold">
            <span>Trocknen ab</span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={10}
                max={90}
                value={s.autoDryAt}
                onChange={e => update({ autoDryAt: parseInt(e.target.value, 10) || 30 })}
                className="w-16 px-2 py-1 rounded-lg border text-xs font-mono-num outline-none text-right"
                style={inputStyle}
                aria-label="Automatisch trocknen ab Prozent"
              />
              <span>%</span>
            </span>
          </label>
        )}
        <label className="block text-xs font-bold space-y-1">
          <span>Externer Sensor (Home Assistant)</span>
          <input
            type="text"
            value={s.humidityEntity}
            onChange={e => update({ humidityEntity: e.target.value })}
            placeholder="sensor.filament_ams_box_feuchte"
            className="w-full px-2 py-1.5 rounded-lg border text-xs font-mono outline-none"
            style={inputStyle}
          />
          <span className="block text-[11px] font-normal leading-snug" style={{ color: 'var(--app-text-muted)' }}>
            Der SHT31 am ESP32 des NFC-Lesers heißt so von selbst. Leer lassen = kein externer Sensor.
          </span>
        </label>
        <label className="block text-xs font-bold space-y-1">
          <span>Sensor im externen Spulentrockner (optional)</span>
          <input
            type="text"
            value={s.humidityRoomEntity}
            onChange={e => update({ humidityRoomEntity: e.target.value })}
            placeholder="sensor.filament_ams_trockner_feuchte"
            className="w-full px-2 py-1.5 rounded-lg border text-xs font-mono outline-none"
            style={inputStyle}
          />
          <span className="block text-[11px] font-normal leading-snug" style={{ color: 'var(--app-text-muted)' }}>
            Zweiter SHT31 im externen Spulentrockner (5. Spule). Die App zeigt Temperatur und Feuchte unter dem AMS (kein Alarm).
          </span>
        </label>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <PackageMinus className="w-4 h-4 text-rose-400" />
          <span>Grenze für „fast leer“</span>
        </div>
        <Toggle on={s.lowWarning} onChange={v => update({ lowWarning: v })} label="Fast leere Spulen markieren" hint="Banner oben und Abzeichen auf der Karte." />
        {s.lowWarning && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => update({ lowWeightG: p })}
                className="px-2.5 py-1 rounded-lg border text-[11px] font-mono-num font-bold cursor-pointer"
                style={{
                  backgroundColor: s.lowWeightG === p ? 'var(--app-accent)' : 'var(--app-card)',
                  borderColor: s.lowWeightG === p ? 'var(--app-accent)' : 'var(--app-border)',
                  color: s.lowWeightG === p ? '#fff' : 'var(--app-text)'
                }}
              >
                {p} g
              </button>
            ))}
            <input
              type="number"
              min={0}
              max={1000}
              value={s.lowWeightG}
              onChange={e => update({ lowWeightG: parseInt(e.target.value, 10) || 0 })}
              className="w-20 px-2 py-1 rounded-lg border text-xs font-mono-num outline-none"
              style={inputStyle}
              aria-label="Grenze in Gramm"
            />
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Bell className="w-4 h-4 text-orange-400" />
          <span>Benachrichtigung aufs Gerät</span>
        </div>
        <Toggle
          on={s.systemPush}
          onChange={v => update({ systemPush: v })}
          label="Zusätzlich als Benachrichtigung anzeigen"
          hint="Ein Tipp darauf öffnet die App direkt bei der Mitteilung."
        />
        {IS_NATIVE && (
          <Toggle
            on={s.keepAlive}
            onChange={v => update({ keepAlive: v })}
            label="Im Hintergrund aktiv bleiben"
            hint="Zeigt eine kleine dauerhafte Anzeige. So bleibt die Verbindung zum Drucker offen und Meldungen kommen auch, wenn die App zu ist."
          />
        )}
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Status: <strong style={{ color: 'var(--app-text)' }}>{PERMISSION_TEXT[perm]}</strong>
        </p>
        {notifyNeedsNewApk() && (
          <p className="text-[11px] leading-snug text-amber-400">Deine installierte App ist zu alt für Benachrichtigungen. Bitte die neueste APK installieren.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button
              onClick={async () => setPerm(await requestNotifyPermission())}
              className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5"
              style={buttonStyle}
            >
              <BellRing className="w-3.5 h-3.5 text-orange-400" />
              <span>Erlauben</span>
            </button>
          )}
          {perm !== 'granted' && notifyPermission() !== 'unsupported' && (
            <button onClick={() => void openNotifySettings()} className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer" style={buttonStyle}>
              Android-Einstellungen öffnen
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Send className="w-4 h-4 text-sky-400" />
          <span>Test-Mitteilung</span>
        </div>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>
          Wähle aus, welche Mitteilung geschickt wird. Sie sieht aus wie die echte und landet auch im Postfach.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={testKind}
            onChange={e => setTestKind(e.target.value as InboxKind)}
            className="flex-1 min-w-[10rem] px-2.5 py-2 rounded-lg border text-xs font-semibold outline-none cursor-pointer"
            style={inputStyle}
            aria-label="Welche Test-Mitteilung"
          >
            {TEST_KINDS.map(t => (
              <option key={t.kind} value={t.kind}>
                {t.label}
              </option>
            ))}
          </select>
          <button onClick={sendTest} className="px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5" style={buttonStyle}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Senden
          </button>
        </div>
        {testInfo && <p className="text-[11px] leading-snug text-emerald-400">{testInfo}</p>}
      </Card>
    </div>
  );
};
