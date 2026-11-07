import React from 'react';
import { Palette, X, RefreshCw, Check } from 'lucide-react';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { NumInput } from '../ui/NumInput';

const BAMBU_PRESET_COLORS = [
  { name: 'Grau', hex: '898989' },
  { name: 'Grün', hex: '057748' },
  { name: 'Dunkelgrün', hex: '166534' },
  { name: 'Lila / Flieder', hex: 'D4B1DD' },
  { name: 'Schwarz', hex: '111111' },
  { name: 'Weiß', hex: 'FFFFFF' },
  { name: 'Rot', hex: 'C8102E' },
  { name: 'Blau', hex: '00629B' },
  { name: 'Gelb', hex: 'F1BE48' },
  { name: 'Orange', hex: 'FF6A13' },
  { name: 'Braun', hex: '8A5A36' },
  { name: 'Cyan', hex: '00A3E0' },
  { name: 'Silber / Seide', hex: 'B4B5B8' },
  { name: 'Gold', hex: 'D4AF37' }
];

interface AmsSlotEditModalProps {
  setEditingAmsSlot: any;
  editingAmsSlot: any;
  setAmsEditColor: any;
  amsEditColor: any;
  setAmsEditMaterial: any;
  setAmsEditMinTemp: any;
  setAmsEditMaxTemp: any;
  amsEditMaterial: any;
  amsEditMinTemp: any;
  amsEditMaxTemp: any;
  handleSaveAmsSlotToPrinter: (...args: any[]) => any;
  actionLoading: any;
}

export const AmsSlotEditModal: React.FC<AmsSlotEditModalProps> = ({
  setEditingAmsSlot,
  editingAmsSlot,
  setAmsEditColor,
  amsEditColor,
  setAmsEditMaterial,
  setAmsEditMinTemp,
  setAmsEditMaxTemp,
  amsEditMaterial,
  amsEditMinTemp,
  amsEditMaxTemp,
  handleSaveAmsSlotToPrinter,
  actionLoading
}) => {
  useEscapeClose(() => setEditingAmsSlot(null));
  return (
<div
          onClick={() => setEditingAmsSlot(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border p-5 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#00AE42]" />
                <h4 className="font-extrabold text-sm">
                  AMS Slot {editingAmsSlot + 1} am Drucker ändern
                </h4>
              </div>
              <button onClick={() => setEditingAmsSlot(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Stelle Farbe und Material für <strong>Slot {editingAmsSlot + 1}</strong> ein. Der Befehl wird sofort per MQTTS an deinen echten Bambu Lab X2D übertragen.
            </p>

            {/* Farbauswahl Palette */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                Farbe auswählen:
              </label>
              <div className="grid grid-cols-5 gap-2">
                {BAMBU_PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setAmsEditColor(c.hex)}
                    className={`p-1 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                      amsEditColor.toUpperCase() === c.hex.toUpperCase()
                        ? 'ring-2 ring-[#00AE42] border-[#00AE42]'
                        : 'border-[var(--app-border)] hover:border-orange-500/50'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full border border-black/40 shadow-xs"
                      style={{ backgroundColor: `#${c.hex}` }}
                    />
                    <span className="text-[10px] font-semibold truncate w-full text-center text-[var(--app-text)]">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Benutzerdefinierter Hex-Code */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-[var(--app-text-muted)]">HEX Code:</span>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs font-mono text-[var(--app-text-muted)]">#</span>
                  <input
                    type="text"
                    maxLength={6}
                    value={amsEditColor}
                    onChange={e => setAmsEditColor(e.target.value.replace('#', ''))}
                    className="w-24 px-2 py-1 rounded-lg border font-mono text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--app-input-bg)',
                      borderColor: 'var(--app-border)',
                      color: 'var(--app-text)'
                    }}
                  />
                  <span
                    className="w-5 h-5 rounded-full border border-black/40 ml-2"
                    style={{ backgroundColor: `#${amsEditColor}` }}
                  />
                </div>
              </div>
            </div>

            {/* Materialauswahl */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                Material auswählen:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PC', 'PA', 'PA-CF'].map(mat => (
                  <button
                    key={mat}
                    onClick={() => {
                      setAmsEditMaterial(mat);
                      if (mat === 'PLA') {
                        setAmsEditMinTemp(190);
                        setAmsEditMaxTemp(240);
                      } else if (mat === 'PETG') {
                        setAmsEditMinTemp(220);
                        setAmsEditMaxTemp(260);
                      } else {
                        setAmsEditMinTemp(240);
                        setAmsEditMaxTemp(280);
                      }
                    }}
                    className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition cursor-pointer text-center ${
                      amsEditMaterial === mat
                        ? 'bg-[#00AE42]/20 border-[#00AE42] text-[#00AE42]'
                        : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-accent-sub)]'
                    }`}
                  >
                    {mat}
                  </button>
                ))}
              </div>
            </div>

            {/* Temperaturbereich */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-[var(--app-text-muted)] block">Min. Düsentemperatur:</label>
                <NumInput
                  type="number"
                  value={amsEditMinTemp}
                  onChange={e => setAmsEditMinTemp(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded-lg border font-mono-num text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--app-text-muted)] block">Max. Düsentemperatur:</label>
                <NumInput
                  type="number"
                  value={amsEditMaxTemp}
                  onChange={e => setAmsEditMaxTemp(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded-lg border font-mono-num text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button
                onClick={() => setEditingAmsSlot(null)}
                className="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveAmsSlotToPrinter}
                disabled={Boolean(actionLoading)}
                className="flex-1 py-2 px-3 rounded-xl bg-[#00AE42] hover:bg-[#009237] text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Auf X2D übertragen</span>
              </button>
            </div>
          </div>
        </div>
  );
};
