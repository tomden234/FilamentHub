import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Nfc, Check, Loader2, Search, Minus, Plus, Thermometer } from 'lucide-react';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { getSpoolProfile } from '../../utils/spoolProfile';
import type { Spool } from '../../types/filament';
import { triggerNfcHaptic } from '../../utils/nfcManager';
import { useNfcTags } from '../../utils/nfcRead';
import { sendToSlot } from '../../utils/slotAssign';
import type { HwTray } from '../../utils/amsMatch';
import { NumInput } from '../ui/NumInput';

// Spule → AMS-Slot: Spule per NFC-Tag ans Handy halten ODER per Suche wählen, Slot antippen, übertragen.
// Farbe, Material und Temperatur gehen per Befehl an den Drucker, die Zuweisung merkt sich die App.
// (Der AMS liest keine Fremd-Tags, deshalb setzt die App die Slot-Daten selbst.)

interface Props {
  spools: Spool[];
  onClose: () => void;
  /** Slots laut Drucker (leer, wenn nicht verbunden) */
  trays?: HwTray[];
  /** Zuweisung in der App merken: Slot 1-4 → Spulen-ID */
  onAssign?: (slot: number, spoolId: string) => void;
  /** Spule schon beim Öffnen gewählt (aus dem Tag-Fenster) */
  initialSpoolId?: string;
}

interface Picked {
  spoolId?: string;
  temps?: [number, number];
  material: string;
  colorHex: string;
  label: string;
  sub?: string;
  viaNfc?: boolean;
}

const TEMPS: Record<string, [number, number]> = {
  PLA: [190, 230],
  PETG: [220, 260],
  ABS: [240, 270],
  ASA: [240, 270],
  TPU: [200, 230],
  PA: [260, 290],
  PC: [250, 280],
  PVA: [190, 220]
};

const tempsFor = (material: string): [number, number] => {
  const key = Object.keys(TEMPS).find(k => material.toUpperCase().startsWith(k));
  return key ? TEMPS[key] : [190, 250];
};

/** Zahl mit − / + Knöpfen */
const Stepper: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="rounded-2xl border p-2" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-card)' }}>
    <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--app-text-muted)' }}>
      {label}
    </div>
    <div className="flex items-center justify-between gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 5))}
        className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer active:scale-95"
        style={{ borderColor: 'var(--app-border)' }}
        aria-label={`${label} weniger`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <NumInput
        type="number"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="w-14 text-center bg-transparent outline-none font-mono-num font-extrabold text-base"
        style={{ color: 'var(--app-text)' }}
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(350, value + 5))}
        className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer active:scale-95"
        style={{ borderColor: 'var(--app-border)' }}
        aria-label={`${label} mehr`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

export const NfcSlotModal: React.FC<Props> = ({ spools, onClose, trays = [], onAssign, initialSpoolId }) => {
  useEscapeClose(onClose);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState(0);
  const [minT, setMinT] = useState(190);
  const [maxT, setMaxT] = useState(230);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; confirmed?: boolean } | null>(null);

  const choose = useCallback((p: Picked) => {
    setPicked(p);
    const [a, b] = p.temps || tempsFor(p.material);
    setMinT(a);
    setMaxT(b);
    setResult(null);
  }, []);

  const fromSpool = useCallback(
    (s: Spool, viaNfc = false) => {
      // Gespeichertes Profil der Spule (eigene Temperaturen) hat Vorrang vor dem Standard
      const prof = getSpoolProfile(s);
      choose({
        spoolId: s.id,
        material: s.material,
        colorHex: s.colorHex || '#888888',
        label: `${s.brand} ${s.name}`,
        sub: `${s.material} · ${s.colorName || ''} · ${Math.round(Number(s.remainingWeight) || 0)}\u00a0g`,
        temps: [prof.minTemp, prof.maxTemp],
        viaNfc
      });
    },
    [choose]
  );

  useEffect(() => {
    const sp = initialSpoolId ? spools.find(s => s.id === initialSpoolId) : undefined;
    if (sp) fromSpool(sp, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpoolId]);

  // NFC lauscht die ganze Zeit, solange das Fenster offen ist (ein Scan, nicht bei jeder Änderung neu)
  const { supported, error: nfcError } = useNfcTags(spools, parsed => {
    const spool = parsed.matchedSpool;
    if (spool) {
      fromSpool(spool, true);
      setScanError(null);
    } else if (parsed.payload?.material) {
      choose({
        material: parsed.payload.material,
        colorHex: parsed.payload.colorHex || '#888888',
        label: `${parsed.payload.brand || ''} ${parsed.payload.name || parsed.payload.material}`.trim(),
        sub: 'Vom Tag (nicht in deiner Liste)',
        viaNfc: true
      });
      setScanError(null);
    } else {
      setScanError('Dieser Tag ist leer oder unbekannt. Such die Spule einfach unten.');
    }
  });

  // Suche: Marke, Name, Material, Farbe, Lagerort
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = spools.filter(s => (s.remainingWeight ?? 1) > 0 || !q);
    if (!q) return list.slice(0, 8);
    const words = q.split(/\s+/);
    return list
      .filter(s => {
        const hay = `${s.brand} ${s.name} ${s.material} ${s.colorName} ${s.location || ''}`.toLowerCase();
        return words.every(w => hay.includes(w));
      })
      .slice(0, 12);
  }, [spools, query]);

  const send = async () => {
    if (!picked) return;
    setSending(true);
    setResult(null);
    // Die App merkt sich die Zuweisung immer, egal was der Drucker daraus macht
    if (picked.spoolId) onAssign?.(slot + 1, picked.spoolId);
    const r = await sendToSlot(slot + 1, { colorHex: picked.colorHex, material: picked.material, minTemp: minT, maxTemp: maxT });
    setResult({ ok: r.confirmed, confirmed: r.confirmed, text: r.text });
    if (r.confirmed) triggerNfcHaptic();
    setSending(false);
  };

  const card = { backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
        style={{ backgroundColor: 'var(--app-card)', color: 'var(--app-text)' }}
      >
        {/* Kopf in Akzentfarbe */}
        <div
          className="sticky top-0 z-10 px-4 pt-4 pb-3 text-white"
          style={{ background: 'var(--app-accent-gradient, var(--app-accent))' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <Nfc className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base leading-tight">Spule → AMS-Slot</h3>
                <p className="text-[11px] text-white/85">Tag ans Handy halten oder Spule suchen</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Schließen" className="p-2 rounded-xl bg-white/15 hover:bg-white/25 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Schritte */}
          <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold">
            {['Spule', 'Slot', 'Senden'].map((t, i) => {
              const done = i === 0 ? Boolean(picked) : i === 1 ? Boolean(picked) : Boolean(result?.ok);
              return (
                <React.Fragment key={t}>
                  <span className={`px-2 py-0.5 rounded-full ${done ? 'bg-white text-black/80' : 'bg-white/20'}`}>
                    {i + 1}. {t}
                  </span>
                  {i < 2 && <span className="w-3 h-px bg-white/50" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 1. SPULE */}
          {picked ? (
            <div
              className="flex items-center gap-3 rounded-2xl border-2 p-3"
              style={{ borderColor: picked.colorHex, background: `linear-gradient(135deg, ${picked.colorHex}30, transparent 70%)` }}
            >
              <span className="w-11 h-11 rounded-full border-4 border-white/70 shadow-md shrink-0" style={{ backgroundColor: picked.colorHex }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold break-words leading-tight">{picked.label}</div>
                <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  {picked.viaNfc ? '📲 per NFC · ' : ''}
                  {picked.sub || picked.material}
                </div>
              </div>
              <button
                onClick={() => {
                  setPicked(null);
                  setResult(null);
                }}
                className="px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer shrink-0"
                style={card}
              >
                Ändern
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {supported ? (
                <div className="rounded-2xl border p-3 flex items-center gap-3" style={card}>
                  <div className="relative w-10 h-10 shrink-0">
                    <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ backgroundColor: 'var(--app-accent)' }} />
                    <span
                      className="relative w-10 h-10 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: 'var(--app-accent)' }}
                    >
                      <Nfc className="w-5 h-5" />
                    </span>
                  </div>
                  <div className="text-xs">
                    <div className="font-extrabold">Spule ans Handy halten</div>
                    <div style={{ color: 'var(--app-text-muted)' }}>NFC-Tag auf die Rückseite, oben beim Kamera-Bereich</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
                  NFC ist hier nicht verfügbar. Such die Spule unten.
                </div>
              )}
              {(scanError || nfcError) && <div className="text-[11px] font-bold text-rose-400">{scanError || nfcError}</div>}

              {/* Suche */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Spule suchen: Marke, Farbe, Material …"
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl border text-sm outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--app-input-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                />
              </div>

              <div className="grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto pr-0.5">
                {results.length === 0 && (
                  <div className="text-xs text-center py-4" style={{ color: 'var(--app-text-muted)' }}>
                    Keine Spule gefunden.
                  </div>
                )}
                {results.map(s => (
                  <button
                    key={s.id}
                    onClick={() => fromSpool(s)}
                    className="flex items-center gap-2.5 p-2 rounded-2xl border text-left cursor-pointer active:scale-[0.99] transition hover:opacity-90"
                    style={card}
                  >
                    <span className="w-8 h-8 rounded-full border-2 border-white/60 shadow-sm shrink-0" style={{ backgroundColor: s.colorHex }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-extrabold truncate">
                        {s.brand} {s.name}
                      </span>
                      <span className="block text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                        {s.colorName} · {Math.round(Number(s.remainingWeight) || 0)} g{s.location ? ` · ${s.location}` : ''}
                      </span>
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: 'var(--app-accent-sub)', color: 'var(--app-accent-text)' }}
                    >
                      {s.material}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. SLOT + 3. SENDEN */}
          {picked && (
            <>
              <div>
                <div className="text-xs font-extrabold mb-2">In welchen Slot?</div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map(i => {
                    const hw = trays.find(t => t.slot === i + 1);
                    const active = slot === i;
                    return (
                      <button
                        key={i}
                        onClick={() => setSlot(i)}
                        className="rounded-2xl border-2 p-2 flex flex-col items-center gap-1 cursor-pointer transition active:scale-95"
                        style={{
                          borderColor: active ? 'var(--app-accent)' : 'var(--app-border)',
                          backgroundColor: active ? 'var(--app-accent-sub)' : 'var(--app-card-sub)'
                        }}
                      >
                        <span className="text-sm font-extrabold" style={{ color: active ? 'var(--app-accent-text)' : 'var(--app-text)' }}>
                          {i + 1}
                        </span>
                        <span
                          className={`w-6 h-6 rounded-full border-2 ${hw && !hw.empty ? 'border-white/60' : 'border-dashed'}`}
                          style={{
                            backgroundColor: hw?.colorHex || 'transparent',
                            borderColor: hw && !hw.empty ? undefined : 'var(--app-border)'
                          }}
                        />
                        <span className="text-[9px] font-bold truncate max-w-full" style={{ color: 'var(--app-text-muted)' }}>
                          {hw ? (hw.empty ? 'leer' : hw.type) : '–'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-extrabold mb-2 flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5" style={{ color: 'var(--app-accent-text)' }} />
                  Düsentemperatur
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Stepper label="Min °C" value={minT} onChange={setMinT} />
                  <Stepper label="Max °C" value={maxT} onChange={setMaxT} />
                </div>
              </div>

              <button
                onClick={send}
                disabled={sending}
                className="w-full py-3.5 rounded-2xl text-sm font-extrabold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-lg active:scale-[0.99]"
                style={{ background: 'var(--app-accent-gradient, var(--app-accent))' }}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                In Slot {slot + 1} übertragen
              </button>
            </>
          )}

          {result && (
            <div
              className={`rounded-2xl border p-3 text-xs font-bold ${
                result.confirmed ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/40 bg-amber-500/10 text-amber-500'
              }`}
            >
              {result.confirmed
                ? `✓ ${result.text}`
                : `${picked?.spoolId ? `In der App gemerkt: Slot ${slot + 1}. ` : ''}${result.text}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
