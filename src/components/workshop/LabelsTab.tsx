import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bluetooth, BluetoothSearching, Download, Loader2, Printer as PrinterIcon, RefreshCw, Unplug } from 'lucide-react';
import type { Spool } from '../../types/filament';
import { type ScanDevice } from '../../utils/supvan/links';
import { drawBitmap, renderSpoolLabel, renderTestLabel, type Bitmap } from '../../utils/supvan/render';
import {
  connectPrinter,
  disconnectPrinter,
  forgetPrinter,
  labelOptionsFor,
  printBitmaps,
  printerSupport,
  scanPrinters,
  updateLabelSettings,
  usePrinter
} from '../../utils/supvan/service';
import { Card, Toggle, buttonStyle, inputStyle } from './ui';
import { NumInput } from '../ui/NumInput';

interface Props {
  spools: Spool[];
  preselectId?: string | null;
}

export const LabelsTab: React.FC<Props> = ({ spools, preselectId }) => {
  const st = usePrinter();
  const s = st.settings;
  const support = printerSupport();
  const [selected, setSelected] = useState<string[]>(preselectId ? [preselectId] : []);
  const [devices, setDevices] = useState<ScanDevice[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState('');
  const [showAdv, setShowAdv] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (preselectId) setSelected([preselectId]);
  }, [preselectId]);

  const options = (sp: Spool) => labelOptionsFor(sp);
  const lengthMm = labelOptionsFor(spools[0] || ({ id: '' } as Spool)).lengthMm;

  const first = spools.find(sp => sp.id === selected[0]) || spools[0];
  const preview = useMemo<Bitmap | null>(() => {
    if (!first) return null;
    try {
      return renderSpoolLabel(first, labelOptionsFor(first));
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, s.lengthMm, s.qrAsLink, s.showLocation, s.autoShorten, st.info]);

  // Vorschau zeigt auch die Druckstärke (hell = niedrig, dunkel = hoch)
  useEffect(() => {
    if (preview && canvasRef.current) drawBitmap(canvasRef.current, preview, s.density);
  }, [preview, s.density]);

  const toggle = (id: string) => setSelected(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));
  const busy = st.phase === 'connecting' || st.phase === 'printing';

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 6000);
  };

  const search = async () => {
    setScanning(true);
    setDevices(null);
    try {
      setDevices(await scanPrinters());
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const connect = async (d?: ScanDevice) => {
    try {
      await connectPrinter(d ? { address: d.address, name: d.name } : undefined);
      setDevices(null);
    } catch {
      // Fehler steht im Zustand
    }
  };

  const doPrint = async (bitmaps: Bitmap[]) => {
    try {
      await printBitmaps(bitmaps);
      flash(bitmaps.length === 1 ? 'Etikett gedruckt.' : `${bitmaps.length} Etiketten gedruckt.`);
    } catch {
      // Fehler steht im Zustand
    }
  };

  const printSelected = () => {
    const list = spools.filter(sp => selected.includes(sp.id));
    if (!list.length) return flash('Bitte zuerst Spulen wählen.');
    void doPrint(list.map(sp => renderSpoolLabel(sp, options(sp))));
  };

  const savePng = async () => {
    if (!preview || !first) return;
    // Bild immer in vollem Schwarz speichern (nicht in der Vorschau-Helligkeit)
    const canvas = document.createElement('canvas');
    drawBitmap(canvas, preview);
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `etikett-${first.name.replace(/[^\w-]+/g, '_')}.png`, { type: 'image/png' });
    try {
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'Spulen-Etikett' });
        return;
      }
    } catch {
      // Teilen abgebrochen: Download versuchen
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const mat = st.info?.material;
  const statusText =
    st.phase === 'printing'
      ? `Druckt … ${Math.round(st.progress * 100)} %`
      : st.phase === 'connecting'
        ? 'Verbinde …'
        : st.phase === 'ready'
          ? `Verbunden: ${st.name}`
          : 'Nicht verbunden';

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Bluetooth className="w-4 h-4 text-sky-400" />
          <span>Etiketten-Drucker (Supvan E10)</span>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
          Status: <strong style={{ color: 'var(--app-text)' }}>{statusText}</strong>
          {mat && mat.widthMm > 0 ? ` · Rolle ${mat.widthMm}×${mat.lengthMm || '∞'} mm` : ''}
        </p>
        {st.info?.status?.lowBattery && <p className="text-[11px] text-amber-400">Akku des Druckers ist schwach.</p>}
        {st.error && <p className="text-[11px] font-bold text-rose-400">{st.error}</p>}
        {support === 'none' && (
          <p className="text-[11px] text-amber-400">
            Dieses Gerät kann keinen Bluetooth-Drucker ansprechen. Nutze die Android-App oder Chrome. Du kannst das Etikett aber als Bild teilen.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {st.phase === 'ready' || st.phase === 'printing' ? (
            <button
              disabled={st.phase === 'printing'}
              onClick={() => void disconnectPrinter()}
              className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              style={buttonStyle}
            >
              <Unplug className="w-3.5 h-3.5" />
              <span>Trennen</span>
            </button>
          ) : (
            support !== 'none' && (
              <>
                {(st.saved || support === 'web') && (
                  <button
                    disabled={busy}
                    onClick={() => void connect()}
                    className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--app-accent)', borderColor: 'var(--app-accent)', color: '#fff' }}
                  >
                    {st.phase === 'connecting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bluetooth className="w-3.5 h-3.5" />}
                    <span>{support === 'web' ? 'Drucker wählen' : `Verbinden: ${st.saved?.name}`}</span>
                  </button>
                )}
                {support === 'native' && (
                  <button
                    disabled={busy || scanning}
                    onClick={() => void search()}
                    className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    style={buttonStyle}
                  >
                    {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BluetoothSearching className="w-3.5 h-3.5" />}
                    <span>{scanning ? 'Suche …' : st.saved ? 'Anderen Drucker suchen' : 'Drucker suchen'}</span>
                  </button>
                )}
                {st.saved && support === 'native' && (
                  <button
                    onClick={forgetPrinter}
                    className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer"
                    style={buttonStyle}
                  >
                    Vergessen
                  </button>
                )}
              </>
            )
          )}
        </div>

        {devices && (
          <div className="space-y-1">
            {devices.length === 0 && (
              <p className="text-[11px] text-amber-400">Nichts gefunden. Drucker einschalten, nah ranhalten und erneut suchen.</p>
            )}
            {devices.map(d => (
              <button
                key={d.address}
                onClick={() => void connect(d)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer text-left"
                style={{
                  backgroundColor: 'var(--app-card)',
                  borderColor: d.likely ? 'var(--app-accent)' : 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                <span className="font-bold truncate">
                  {d.name}
                  {d.likely ? ' ✓' : ''}
                </span>
                <span className="font-mono-num text-[10px] shrink-0" style={{ color: 'var(--app-text-muted)' }}>
                  {d.rssi} dBm
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold">QR-Etiketten für Spulen</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setSelected(spools.map(sp => sp.id))}
              className="px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer"
              style={buttonStyle}
            >
              Alle
            </button>
            <button onClick={() => setSelected([])} className="px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer" style={buttonStyle}>
              Keine
            </button>
          </div>
        </div>

        <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
          {spools.length === 0 && <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>Noch keine Spulen.</p>}
          {spools.map(sp => {
            const on = selected.includes(sp.id);
            return (
              <button
                key={sp.id}
                onClick={() => toggle(sp.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer text-left"
                style={{
                  backgroundColor: on ? 'var(--app-accent-sub)' : 'var(--app-card)',
                  borderColor: on ? 'var(--app-accent)' : 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                <span className="w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] shrink-0" style={{ borderColor: 'var(--app-border)' }}>
                  {on ? '✓' : ''}
                </span>
                <span className="w-3 h-3 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: sp.colorHex }} />
                <span className="truncate font-bold flex-1">{sp.name}</span>
                <span className="text-[10px] shrink-0" style={{ color: 'var(--app-text-muted)' }}>
                  {sp.material}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border p-2 overflow-x-auto" style={{ backgroundColor: '#fff', borderColor: 'var(--app-border)' }}>
          <canvas ref={canvasRef} className="block" style={{ imageRendering: 'pixelated', height: 96, minWidth: 'min-content' }} />
        </div>
        <p className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
          Vorschau ({preview ? (preview.width / 8).toFixed(1).replace('.', ',') : lengthMm} mm lang, Druckstärke {s.density}). Der QR-Code öffnet die Spule in der App.
        </p>
        <div className="space-y-1">
          <label className="text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
            Druckstärke: {s.density} (1 hell – 15 dunkel)
          </label>
          <input
            type="range"
            min={1}
            max={15}
            value={s.density}
            onChange={e => updateLabelSettings({ density: parseInt(e.target.value, 10) })}
            className="w-full"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            disabled={st.phase !== 'ready' || selected.length === 0}
            onClick={printSelected}
            className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            style={{ backgroundColor: 'var(--app-accent)', borderColor: 'var(--app-accent)', color: '#fff' }}
          >
            {st.phase === 'printing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PrinterIcon className="w-3.5 h-3.5" />}
            <span>Drucken ({selected.length})</span>
          </button>
          <button
            onClick={() => void savePng()}
            disabled={!first}
            className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            style={buttonStyle}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Als Bild teilen</span>
          </button>
        </div>
        {st.phase === 'printing' && (
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-border)' }}>
            <div className="h-full" style={{ width: `${Math.round(st.progress * 100)}%`, backgroundColor: 'var(--app-accent)' }} />
          </div>
        )}
        {msg && <p className="text-[11px] font-bold text-emerald-400">{msg}</p>}
      </Card>

      <Card>
        <Toggle on={s.qrAsLink} onChange={v => updateLabelSettings({ qrAsLink: v })} label="QR enthält einen Link" hint="Aus: nur die Spulen-ID (kleinerer, besser lesbarer QR)." />
        <Toggle on={s.showLocation} onChange={v => updateLabelSettings({ showLocation: v })} label="Lagerort aufs Etikett" />
        <Toggle
          on={s.autoShorten}
          onChange={v => updateLabelSettings({ autoShorten: v })}
          label="Etikett so kurz wie möglich"
          hint="Spart Band. Gilt nur, wenn die Rolle keine feste Etikettenlänge meldet."
        />

        <button
          onClick={() => setShowAdv(v => !v)}
          className="text-[11px] font-bold cursor-pointer underline"
          style={{ color: 'var(--app-text-muted)' }}
        >
          {showAdv ? 'Weniger' : 'Erweitert (falls das Bild gedreht oder gespiegelt druckt)'}
        </button>
        {showAdv && (
          <div className="space-y-2">
            <Toggle on={s.rotate180} onChange={v => updateLabelSettings({ rotate180: v })} label="Um 180° drehen" />
            <Toggle on={s.mirror} onChange={v => updateLabelSettings({ mirror: v })} label="Spiegeln" />
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                Verschiebung quer (Punkte)
              </label>
              <NumInput
                type="number"
                min={-16}
                max={16}
                value={s.offsetDots}
                onChange={e => updateLabelSettings({ offsetDots: parseInt(e.target.value, 10) || 0 })}
                className="w-20 px-2 py-1 rounded-lg border text-xs font-mono-num outline-none"
                style={inputStyle}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                Etikettenlänge (mm), falls nicht erkannt
              </label>
              <NumInput
                type="number"
                min={15}
                max={100}
                value={s.lengthMm}
                onChange={e => updateLabelSettings({ lengthMm: Math.max(15, Math.min(100, parseInt(e.target.value, 10) || 30)) })}
                className="w-20 px-2 py-1 rounded-lg border text-xs font-mono-num outline-none"
                style={inputStyle}
              />
            </div>
            <button
              disabled={st.phase !== 'ready'}
              onClick={() => void doPrint([renderTestLabel(labelOptionsFor(spools[0] || ({ id: '' } as Spool)).lengthMm)])}
              className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              style={buttonStyle}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Testetikett drucken</span>
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};
