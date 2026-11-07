import React from 'react';
import { FileCode, X, UploadCloud, RefreshCw, Upload } from 'lucide-react';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import type { Spool } from '../../types/filament';
import { SpoolFitList } from '../workshop/SpoolFitList';

interface GcodeUploadModalProps {
  setShowGcodeModal: any;
  fileInputRef: React.RefObject<any>;
  handleGcodeFileSelect: (...args: any[]) => any;
  selectedGcodeFile: any;
  gcodeFileInfo: any;
  setSelectedGcodeFile: any;
  setGcodeFileInfo: any;
  handleUploadGcode: (...args: any[]) => any;
  isUploadingGcode: any;
  spools?: Spool[];
  amsSlots?: Record<number, string>;
  gcodeGrams?: number | null;
}

export const GcodeUploadModal: React.FC<GcodeUploadModalProps> = ({
  setShowGcodeModal,
  fileInputRef,
  handleGcodeFileSelect,
  selectedGcodeFile,
  gcodeFileInfo,
  setSelectedGcodeFile,
  setGcodeFileInfo,
  handleUploadGcode,
  isUploadingGcode,
  spools = [],
  amsSlots = {},
  gcodeGrams = null
}) => {
  useEscapeClose(() => setShowGcodeModal(false));
  return (
<div
          onClick={() => setShowGcodeModal(false)}
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
                <FileCode className="w-4 h-4 text-sky-400" />
                <h4 className="font-extrabold text-sm">G-Code / .3MF Datei an X2D übertragen</h4>
              </div>
              <button onClick={() => setShowGcodeModal(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Lade deine geslicete G-Code oder Bambu Studio .3MF Datei direkt auf den Bambu Lab X2D hoch.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".gcode,.3mf,.gcode.3mf"
              onChange={handleGcodeFileSelect}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-5 rounded-2xl border-2 border-dashed border-sky-500/40 hover:border-sky-400 bg-sky-500/5 hover:bg-sky-500/10 transition cursor-pointer flex flex-col items-center justify-center gap-2 text-center"
            >
              <UploadCloud className="w-8 h-8 text-sky-400" />
              <span className="font-extrabold text-xs text-[var(--app-text)]">
                {selectedGcodeFile ? selectedGcodeFile.name : 'G-Code oder .3MF Datei auswählen'}
              </span>
              <span className="text-[11px] text-[var(--app-text-muted)]">
                Klicke hier zum Durchsuchen (.gcode, .3mf)
              </span>
            </div>

            {selectedGcodeFile && gcodeFileInfo && (
              <div className="p-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-sub)] space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--app-text-muted)]">Dateiname:</span>
                  <span className="font-mono font-bold text-[var(--app-text)] truncate max-w-[200px]">{gcodeFileInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--app-text-muted)]">Dateigröße:</span>
                  <span className="font-mono-num text-[var(--app-text)]">{gcodeFileInfo.sizeKb} KB</span>
                </div>
                {gcodeFileInfo.layerCount && (
                  <div className="flex justify-between">
                    <span className="text-[var(--app-text-muted)]">Schichten (Layers):</span>
                    <span className="font-mono-num text-sky-400 font-bold">{gcodeFileInfo.layerCount}</span>
                  </div>
                )}
                {gcodeFileInfo.estTimeMin && (
                  <div className="flex justify-between">
                    <span className="text-[var(--app-text-muted)]">Geschätzte Druckzeit:</span>
                    <span className="font-mono-num text-[#00AE42] font-bold">{gcodeFileInfo.estTimeMin} Min.</span>
                  </div>
                )}
              </div>
            )}

            {/* Reicht die Spule? Nur wenn das Gewicht in der Datei steht */}
            {selectedGcodeFile && gcodeGrams ? (
              <SpoolFitList
                spools={spools}
                grams={gcodeGrams}
                amsSlots={amsSlots}
                onlyIds={Object.values(amsSlots).filter(Boolean)}
                title={`Reicht das AMS? (${gcodeGrams} g)`}
                maxRows={4}
              />
            ) : selectedGcodeFile ? (
              <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                Gewicht nicht lesbar (bei .3mf nicht möglich). Der Spulen-Check ist nur mit .gcode-Dateien aktiv.
              </p>
            ) : null}

            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <button
                onClick={() => {
                  setSelectedGcodeFile(null);
                  setGcodeFileInfo(null);
                  setShowGcodeModal(false);
                }}
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
                onClick={() => handleUploadGcode(true)}
                disabled={!selectedGcodeFile || isUploadingGcode}
                className="flex-1 py-2 px-3 rounded-xl bg-[#00AE42] hover:bg-[#009237] text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {isUploadingGcode ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Auf Drucker laden</span>
              </button>
            </div>
          </div>
        </div>
  );
};
