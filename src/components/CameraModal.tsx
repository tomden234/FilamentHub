import React, { useState, useRef } from 'react';
import { recognizeApi } from '../api';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Check,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Spool } from '../types/filament';
import { findHexForColorName, getBrandInfo } from '../utils/shopLinks';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpoolRecognized: (spoolData: Partial<Spool>) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onSpoolRecognized
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recognizedData, setRecognizedData] = useState<Partial<Spool> | null>(null);
  const [detectedConfidence, setDetectedConfidence] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Bild komprimieren und als Base64 laden
  const handleFileProcess = (file: File) => {
    setErrorMessage(null);
    setRecognizedData(null);
    setDetectedConfidence(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Skaliere Bild auf max 1400px für schnelle Übertragung & beste OCR
        const maxDim = 1400;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setImagePreview(compressed);
          analyzeImageWithAi(compressed, 'image/jpeg');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const analyzeImageWithAi = async (base64Data: string, mime: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const res = await recognizeApi.recognizeSpool(base64Data, mime);

      if (res.ok) {
        const json = res.data;
        if (json.success && json.spool) {
          const sp = json.spool;
          const brandInfo = getBrandInfo(sp.brand);
          const colorHex = sp.colorHex || findHexForColorName(sp.colorName || 'Standard');

          const finalSpool: Partial<Spool> = {
            brand: sp.brand || 'Bambu Lab',
            material: sp.material || 'PLA',
            name: sp.name || `${sp.brand} ${sp.material} ${sp.colorName || ''}`.trim(),
            colorName: sp.colorName || 'Standard',
            colorHex: colorHex,
            initialWeight: Number(sp.initialWeight) || 1000,
            remainingWeight: Number(sp.initialWeight) || 1000,
            emptySpoolWeight: Number(sp.emptySpoolWeight) || brandInfo.tara || 250,
            pricePerKg: Number(sp.pricePerKg) || brandInfo.defaultPrice || 19.99,
            dryTemp: Number(sp.dryTemp) || 50,
            dryHours: Number(sp.dryHours) || 5,
            dryIntervalDays: Number(sp.dryIntervalDays) || 30,
            storageNote: 'Per Smartphone-Kamera erfasst'
          };

          setRecognizedData(finalSpool);
          setDetectedConfidence(sp.confidence || 90);
          return;
        }
      }
      // 1.231: ehrlich melden statt eine erfundene „Erkennung“ anzuzeigen
      const why = res.data?.error || (res.status === 503 ? 'Foto-Erkennung braucht den Server.' : 'Erkennung nicht möglich.');
      setErrorMessage(`${why} Bitte die Spule von Hand anlegen.`);
    } catch {
      setErrorMessage('Server nicht erreichbar (Pi an? Tailscale/WLAN?). Bitte die Spule von Hand anlegen.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!recognizedData) return;
    onSpoolRecognized(recognizedData);
    onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-[var(--app-card)] text-[var(--app-text)] border border-[var(--app-border)] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl my-6 animate-fadeIn">
        <div className="flex justify-between items-start border-b border-[var(--app-border)] pb-3">
          <div>
            <h3 className="text-base font-bold text-[var(--app-text)] flex items-center gap-2">
              <Camera className="w-5 h-5 text-orange-400" />
              <span>Spule mit Handykamera erfassen</span>
            </h3>
            <p className="text-[11px] text-[var(--app-text-muted)] mt-0.5">
              Etikett oder Spule fotografieren – KI erkennt Marke, Material, Farbe & Tara automatisch!
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Kamera-Trigger Buttons */}
        {!imagePreview && (
          <div className="space-y-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full py-4 rounded-2xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white font-bold flex flex-col items-center justify-center gap-1.5 shadow-lg transition cursor-pointer"
            >
              <Camera className="w-7 h-7" />
              <span className="text-sm">Kamera öffnen & Foto machen</span>
              <span className="text-[10px] text-orange-100 font-normal">
                Smartphone-Rückkamera wird direkt gestartet
              </span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 rounded-xl bg-[var(--app-card-sub)] hover:bg-[var(--app-accent-sub)] text-[var(--app-text)] text-xs font-semibold flex items-center justify-center gap-2 border border-[var(--app-border)] transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-sky-400" />
              <span>Foto aus Galerie / Datei auswählen</span>
            </button>

            {/* Versteckte File-Inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileProcess(f);
              }}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileProcess(f);
              }}
              className="hidden"
            />
          </div>
        )}

        {/* Vorschau & Analyse */}
        {imagePreview && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-[var(--app-input-bg)] border border-[var(--app-border)] max-h-56 flex items-center justify-center">
              <img
                src={imagePreview}
                alt="Fotografierte Spule"
                className="max-h-56 w-full object-contain"
              />
              <button
                onClick={() => {
                  setImagePreview(null);
                  setRecognizedData(null);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-[var(--app-card-sub)]/80 text-[var(--app-text)] hover:text-[var(--app-text)] backdrop-blur-md cursor-pointer"
                title="Anderes Foto aufnehmen"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Ladeanzeige */}
            {isAnalyzing && (
              <div className="p-4 rounded-xl bg-[var(--app-input-bg)] border border-orange-500/30 flex items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 text-orange-400 animate-spin" />
                <div className="text-xs">
                  <p className="font-bold text-[var(--app-text)]">Analysiere Spule mit KI...</p>
                  <p className="text-[11px] text-[var(--app-text-muted)]">Erkenne Hersteller, Material, Farbe & Tara</p>
                </div>
              </div>
            )}

            {/* Erkannte Daten */}
            {recognizedData && !isAnalyzing && (
              <div className="rounded-xl bg-[var(--app-input-bg)] border border-emerald-500/40 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Spulendaten erfolgreich erkannt</span>
                  </span>
                  {detectedConfidence && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                      {detectedConfidence}% Zuversicht
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-[var(--app-card-sub)] border border-[var(--app-border)]">
                    <span className="text-[10px] text-[var(--app-text-muted)] block">Hersteller</span>
                    <span className="font-bold text-[var(--app-text)]">{recognizedData.brand}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--app-card-sub)] border border-[var(--app-border)]">
                    <span className="text-[10px] text-[var(--app-text-muted)] block">Material</span>
                    <span className="font-bold text-orange-400">{recognizedData.material}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--app-card-sub)] border border-[var(--app-border)]">
                    <span className="text-[10px] text-[var(--app-text-muted)] block">Farbe</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: recognizedData.colorHex || '#f97316' }}
                      />
                      <span className="font-semibold text-[var(--app-text)]">{recognizedData.colorName}</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--app-card-sub)] border border-[var(--app-border)]">
                    <span className="text-[10px] text-[var(--app-text-muted)] block">Leerspule (Tara)</span>
                    <span className="font-mono-num font-bold text-emerald-400">
                      {recognizedData.emptySpoolWeight} g
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[var(--app-card-sub)] border border-[var(--app-border)] text-xs">
                  <span className="text-[10px] text-[var(--app-text-muted)] block">Bezeichnung</span>
                  <span className="font-semibold text-[var(--app-text)]">{recognizedData.name}</span>
                </div>

                <button
                  onClick={handleApply}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Spule jetzt in Bestand übernehmen</span>
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
