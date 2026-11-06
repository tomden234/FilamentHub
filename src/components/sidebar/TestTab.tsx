import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleHelp, Cpu, Lightbulb, Loader2, Nfc, RefreshCw, Smartphone, ToggleRight, XCircle } from 'lucide-react';
import { getHaCredentials } from '../../utils/haClient';
import { findAmsDevice, ids, type AmsDevice, judgeReader, judgeTag, setQueueCount, setQueueTest, type EntityState } from '../../utils/amsDevice';
import { useNfcTags } from '../../utils/nfcRead';
import { StatusLedCard } from './StatusLedCard';

// Testmenü: alles am AMS-ESP Schritt für Schritt prüfen (Verbindung, NFC-Leser, Tag, Taster + Warteschlangen-LEDs, Status-LED; Feuchte steckt bei 1). Fünf aufklappbare Punkte, es ist immer nur einer offen.
// Liest live über Home Assistant (alle 2 Sekunden), solange das Menü offen ist.

const WANT_FW = '1.224';

const Section: React.FC<{ id: string; open: string | null; onToggle: (id: string) => void; icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ id, open, onToggle, icon, title, children }) => {
  const isOpen = open === id;
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-card)' }}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2 p-3 text-xs font-extrabold cursor-pointer text-left"
        style={{ color: 'var(--app-text)' }}
      >
        {icon}
        <span className="flex-1">{title}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--app-text-muted)' }} />
      </button>
      {isOpen && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
};

const Mark: React.FC<{ v: 'ok' | 'bad' | 'unknown' }> = ({ v }) =>
  v === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : v === 'bad' ? <XCircle className="w-4 h-4 text-rose-400 shrink-0" /> : <CircleHelp className="w-4 h-4 shrink-0" style={{ color: 'var(--app-text-muted)' }} />;

const muted: React.CSSProperties = { color: 'var(--app-text-muted)' };
const btn = 'px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40';
const btnStyle: React.CSSProperties = { borderColor: 'var(--app-border)', color: 'var(--app-text)' };

const ago = (t: number) => {
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? `vor ${s} s` : s < 3600 ? `vor ${Math.round(s / 60)} min` : new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

export const TestTab: React.FC = () => {
  const [dev, setDev] = useState<AmsDevice | null>(null);
  const [findErr, setFindErr] = useState('');
  const [searching, setSearching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen(o => (o === id ? null : id));
  const [queueN, setQueueN] = useState(7);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueMsg, setQueueMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [phoneTag, setPhoneTag] = useState<string>('');
  const hasHa = Boolean(getHaCredentials().token);
  const base = dev?.base || null;
  const entities = dev?.entities || [];

  // Gerät suchen (ganze Liste aus Home Assistant: ein Abruf, findet auch Werte mit anderem ID-Anfang)
  const find = useCallback(async () => {
    setSearching(true);
    setFindErr('');
    try {
      const d = await findAmsDevice();
      setDev(d);
      if (!d) setFindErr('Kein AMS-ESP in Home Assistant gefunden (Sensor „Slot 1 Tag“ fehlt). Ist der ESP in Home Assistant eingebunden?');
    } catch (e: any) {
      setFindErr(`Home Assistant nicht erreichbar: ${e?.message || e}`);
    } finally {
      setSearching(false);
    }
  }, []);
  useEffect(() => {
    if (hasHa) void find();
    else setSearching(false);
  }, [hasHa, find]);

  // Live lesen, solange offen (alle 2,5 s die Liste neu holen)
  const hasDev = Boolean(base);
  useEffect(() => {
    if (!hasDev) return;
    let alive = true;
    let busy = false;
    const tick = async () => {
      if (busy || !alive) return;
      busy = true;
      try {
        const d = await findAmsDevice();
        if (alive && d) setDev(d);
      } catch {
        /* kurz nicht erreichbar */
      } finally {
        busy = false;
      }
    };
    const iv = setInterval(() => void tick(), 2500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [hasDev]);

  const st = useMemo(() => {
    const out: Record<string, EntityState> = {};
    for (const x of entities) out[x.id] = { state: x.state, changed: x.changed, available: x.state !== 'unavailable' };
    return out;
  }, [entities]);

  // Tag mit dem Handy lesen (Android-App / Chrome auf Android)
  const nfc = useNfcTags([], r => setPhoneTag(r.serialNumber || ''), true);

  const e = base ? ids(base, dev?.roles) : null;
  const val = (id?: string) => (id ? st[id]?.state : undefined);
  const fw = val(e?.firmware);
  const fwOk = fw && fw !== 'unknown' && fw !== 'unavailable';
  const espOnline = e ? st[e.wifi]?.available !== false && st[e.ip]?.available !== false && entities.length > 0 : false;
  const testOn = val(e?.queueTest) === 'on';
  const hasTestSwitch = Boolean(dev?.roles.queueTest);
  // Der Testschalter gibt es erst ab 1.202: ist er da, ist die Firmware neu genug (auch wenn der Firmware-Sensor in HA anders heißt)
  const fwNew = (fwOk && fw === WANT_FW) || hasTestSwitch;

  const refresh = async () => {
    setRefreshing(true);
    await find();
    setRefreshing(false);
  };
  const RefreshBtn = (
    <button className={btn} style={btnStyle} disabled={refreshing || searching} onClick={() => void refresh()}>
      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> ESP aktualisieren
    </button>
  );

  const startQueueTest = async () => {
    if (!e) return;
    setQueueBusy(true);
    setQueueMsg(null);
    const a = await setQueueTest(e.queueTest, true);
    const b = a && (await setQueueCount(e.queue, queueN));
    setQueueMsg(b ? { ok: true, text: `Test läuft: ${queueN} LEDs. Jetzt den Taster drücken, dann wird es eine weniger. Es startet kein Druck.` } : { ok: false, text: 'Hat nicht geklappt. Ist Firmware 1.202 auf dem ESP?' });
    setQueueBusy(false);
  };
  const stopQueueTest = async () => {
    if (!e) return;
    setQueueBusy(true);
    const ok = await setQueueTest(e.queueTest, false);
    setQueueMsg(ok ? { ok: true, text: 'Test beendet. Die LEDs zeigen wieder die echte Warteschlange.' } : { ok: false, text: 'Beenden hat nicht geklappt.' });
    setQueueBusy(false);
  };
  // Menü zu: Test sicher beenden
  const testEntityRef = useRef<string | null>(null);
  testEntityRef.current = e ? e.queueTest : null;
  const testRef = useRef(testOn);
  testRef.current = testOn;
  useEffect(
    () => () => {
      if (testEntityRef.current && testRef.current) void setQueueTest(testEntityRef.current, false);
    },
    []
  );

  if (!hasHa)
    return (
      <div className="p-3 text-xs" style={muted}>
        Für das Testmenü braucht die App Home Assistant: Menü → Verbindungen → Home Assistant.
      </div>
    );

  const tag = judgeTag(phoneTag);

  return (
    <div className="space-y-3">
      {/* 1. Verbindung */}
      <Section id="s1" open={open} onToggle={toggle} icon={<Cpu className="w-4 h-4 text-sky-400" />} title="1. AMS-ESP und Firmware">
        {searching ? (
          <div className="flex items-center gap-2 text-[11px]" style={muted}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Suche den ESP in Home Assistant …
          </div>
        ) : !base ? (
          <div className="space-y-2">
            <p className="text-[11px] text-rose-400">{findErr}</p>
            <button className={btn} style={btnStyle} onClick={() => void find()}>
              Nochmal suchen
            </button>
          </div>
        ) : (
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center gap-2">
              <Mark v={espOnline ? 'ok' : 'bad'} />
              <span>ESP {espOnline ? 'online' : 'offline'}</span>
              <span style={muted}>
                {val(e!.ip) && val(e!.ip) !== 'unknown' ? `· IP ${val(e!.ip)}` : ''} {val(e!.wifi) && val(e!.wifi) !== 'unknown' ? `· WLAN ${Math.round(Number(val(e!.wifi)))} dBm` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Mark v={fwNew ? 'ok' : 'bad'} />
              <span>Firmware: {fwOk ? fw : hasTestSwitch ? `${WANT_FW} (am Testschalter erkannt)` : 'alt (vor 1.200)'}</span>
            </div>
            {!fwNew && (
              <p className="leading-snug text-amber-300">
                Bitte zuerst Firmware {WANT_FW} aufspielen: Home Assistant → ESPHome → Filament AMS → Bearbeiten → Inhalt von filament-ams.yaml einfügen → Speichern → Installieren → Drahtlos. Ohne sie gibt es keine Leser-Zustände und keinen
                Taster-Test.
              </p>
            )}
          </div>
        )}
        {base && RefreshBtn}
        {base && (
          <div className="space-y-1">
            <div className="text-[11px] font-bold">Temperatur und Feuchte</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                ['Box', e!.boxTemp, e!.boxHum],
                ['Trockner', e!.dryerTemp, e!.dryerHum]
              ].map(([label, tId, hId]) => {
                const num = (id: string) => {
                  const v = val(id);
                  return v && v !== 'unknown' && v !== 'unavailable' && Number.isFinite(Number(v)) ? Number(v) : null;
                };
                const t = num(tId);
                const h = num(hId);
                const ok = t !== null || h !== null;
                return (
                  <div key={label} className="flex items-center gap-2 rounded-xl border p-2" style={{ borderColor: 'var(--app-border)' }}>
                    <Mark v={ok ? 'ok' : 'unknown'} />
                    <span>
                      {label}:{' '}
                      <strong>{ok ? `${t !== null ? `${t.toLocaleString('de-DE', { maximumFractionDigits: 1 })} °C` : '– °C'} · ${h !== null ? `${Math.round(h)} %` : '– %'}` : 'kein Wert'}</strong>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {base && (
          <details className="text-[11px]">
            <summary className="cursor-pointer font-bold" style={muted}>
              Was Home Assistant vom ESP sieht ({entities.length} Werte)
            </summary>
            <ul className="mt-1 space-y-0.5 break-all" style={muted}>
              {entities.map(x => (
                <li key={x.id}>
                  {x.name || x.id} <span className="opacity-60">({x.id})</span>: <strong style={{ color: 'var(--app-text)' }}>{x.state.length > 40 ? `${x.state.slice(0, 40)}…` : x.state}</strong>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      {/* 2. NFC-Leser */}
      {base && (
        <Section id="s2" open={open} onToggle={toggle} icon={<Nfc className="w-4 h-4 text-emerald-400" />} title="2. NFC-Leser (live)">
          <div className="space-y-1 text-[11px]">
            {[1, 2, 3, 4, 5].map(n => {
              const rs = val(e!.reader(n));
              const j = judgeReader(rs);
              const t = val(e!.slot(n));
              return (
                <div key={n} className="flex items-center gap-2">
                  <Mark v={j} />
                  <span className="w-20 font-bold shrink-0">Leser {n}{n === 5 ? ' (Ext.)' : ''}</span>
                  <span className="truncate" style={muted}>
                    {j === 'unknown' ? 'Zustand unbekannt' : rs}
                    {t && t !== 'unknown' && t !== 'unavailable' ? ` · Tag ${t}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="rounded-xl border p-2 text-[11px]" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-card-sub)' }}>
            Zuletzt gelesen:{' '}
            <strong style={{ color: 'var(--app-text)' }}>{val(e!.lastTag) && val(e!.lastTag) !== 'unknown' ? val(e!.lastTag) : '– noch nichts'}</strong>
            <span style={muted}> {st[e!.lastTag]?.changed ? ago(st[e!.lastTag]!.changed) : ''}</span>
          </div>
          <ul className="text-[11px] leading-snug space-y-0.5 list-disc pl-4" style={muted}>
            <li>Tag flach und mittig 1 cm vor die Antenne halten (die Seite mit der Spule, nicht die mit den Pins).</li>
            <li>„Keine Verbindung“: SDA dieses Lesers oder die gemeinsamen Leitungen (SCK D18, MOSI D23, MISO D19, 3V3, GND) prüfen.</li>
            <li>Alle 5 „Keine Verbindung“: erst nur Leser 1 anschließen. Ein kaputter Leser kann MISO für alle stören.</li>
            <li>„OK“, aber nichts gelesen: Tag mit dem Handy prüfen (unten). Zu wenig Strom? 5-V-Netzteil mit 1 A statt PC-USB.</li>
          </ul>
        </Section>
      )}

      {/* 3. Tag mit dem Handy prüfen */}
      <Section id="s3" open={open} onToggle={toggle} icon={<Smartphone className="w-4 h-4 text-violet-400" />} title="3. Tag mit dem Handy prüfen">
        {nfc.supported ? (
          <>
            <p className="text-[11px] leading-snug" style={muted}>
              Tag an die Rückseite des Handys halten. Die Leser im AMS lesen nur die Nummer des Tags (nicht den Inhalt). Jeder NTAG213/215/216 geht, egal was drauf steht. Einen extra Test-Tag braucht es nicht.
            </p>
            {phoneTag ? (
              <div className="flex items-start gap-2 text-[11px]">
                <Mark v={tag.ok ? 'ok' : 'bad'} />
                <div>
                  <div className="font-bold" style={{ color: 'var(--app-text)' }}>
                    {phoneTag.toUpperCase()} ({tag.bytes} Byte)
                  </div>
                  <div style={muted}>{tag.text}</div>
                </div>
              </div>
            ) : (
              <p className="text-[11px]" style={muted}>
                Warte auf einen Tag …
              </p>
            )}
            {nfc.error && <p className="text-[11px] text-amber-300">{nfc.error}</p>}
          </>
        ) : (
          <p className="text-[11px] leading-snug" style={muted}>
            Geht nur in der Handy-App (Android). Dort zeigt das Menü Nummer und Typ des Tags. Wichtig: Die AMS-Leser lesen nur 7-Byte-Tags (NTAG213/215/216).
          </p>
        )}
      </Section>

      {/* 4. Taster + Warteschlange */}
      {base && (
        <Section id="s4" open={open} onToggle={toggle} icon={<ToggleRight className="w-4 h-4 text-orange-400" />} title="4. Taster und Warteschlangen-LEDs">
          {RefreshBtn}
          {!hasTestSwitch ? (
            <p className="text-[11px] text-amber-300">Braucht Firmware {WANT_FW} auf dem ESP (siehe 1.). Schon aufgespielt? Dann oben „ESP aktualisieren“ drücken.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-bold">LEDs:</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={queueN}
                  onChange={ev => setQueueN(Math.max(0, Math.min(10, Number(ev.target.value) || 0)))}
                  className="w-16 px-2 py-1 rounded-lg border text-xs outline-none"
                  style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                />
                <button className={btn} style={btnStyle} disabled={queueBusy} onClick={() => void startQueueTest()}>
                  {queueBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {testOn ? 'Neu setzen' : 'Test starten'}
                </button>
                {testOn && (
                  <button className={btn} style={btnStyle} disabled={queueBusy} onClick={() => void stopQueueTest()}>
                    Beenden
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-xl border p-2" style={{ borderColor: 'var(--app-border)' }}>
                  <div style={muted}>Test</div>
                  <div className="font-extrabold">{testOn ? 'läuft' : 'aus'}</div>
                </div>
                <div className="rounded-xl border p-2" style={{ borderColor: 'var(--app-border)' }}>
                  <div style={muted}>LEDs an</div>
                  <div className="font-extrabold">{val(e!.queue) && val(e!.queue) !== 'unknown' ? Math.round(Number(val(e!.queue))) : '–'}</div>
                </div>
                <div className="rounded-xl border p-2" style={{ borderColor: 'var(--app-border)' }}>
                  <div style={muted}>Taster</div>
                  <div className="font-extrabold">{val(e!.button) === 'on' ? 'gedrückt' : st[e!.button]?.changed ? ago(st[e!.button]!.changed) : '–'}</div>
                </div>
              </div>
              {queueMsg && <p className={`text-[11px] leading-snug ${queueMsg.ok ? 'text-emerald-400' : 'text-amber-300'}`}>{queueMsg.text}</p>}
              <p className="text-[11px] leading-snug" style={muted}>
                Im Test zählt jedes Drücken eine LED runter (kurz grün), es startet kein Druck. Ohne Test startet der Taster den nächsten Druck der Pi-Warteschlange. Zweimal drücken zum Zurückzählen gibt es bewusst nicht (zu leicht aus Versehen).
              </p>
            </>
          )}
        </Section>
      )}

      {/* 6. Status-LED */}
      <Section id="s5" open={open} onToggle={toggle} icon={<Lightbulb className="w-4 h-4 text-yellow-400" />} title="5. Status-LED-Streifen">
        <StatusLedCard />
      </Section>
    </div>
  );
};
