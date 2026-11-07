import React from 'react';
import { Camera, Tag, Plus } from 'lucide-react';

interface MobileAppBarProps {
  onCamera: () => void;
  onNfc: () => void;
  onNewSpool: () => void;
}

/** Untere Schnellleiste der App: Foto, NFC-Tag, neue Spule (kein Menü, das steckt oben). */
export const MobileAppBar: React.FC<MobileAppBarProps> = ({ onCamera, onNfc, onNewSpool }) => {
  const sub: React.CSSProperties = {
    backgroundColor: 'var(--app-card-sub)',
    borderColor: 'var(--app-border)',
    color: 'var(--app-text)'
  };
  const cls =
    'flex-1 py-2 px-1 rounded-xl border font-bold text-[11px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition cursor-pointer';
  return (
    <nav
      aria-label="Schnellzugriff"
      className="fixed bottom-0 left-0 right-0 z-40 border-t px-3 pt-2 flex items-center gap-2 shadow-2xl backdrop-blur-md transition-colors"
      style={{
        paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
        backgroundColor: 'var(--app-card)',
        borderColor: 'var(--app-border)',
        color: 'var(--app-text)'
      }}
    >
      <button onClick={onCamera} className={cls} style={sub}>
        <Camera className="w-4 h-4 text-sky-400" />
        <span>Foto</span>
      </button>
      <button onClick={onNfc} className={cls} style={sub}>
        <Tag className="w-4 h-4 text-emerald-400" />
        <span>NFC-Tag</span>
      </button>
      <button onClick={onNewSpool} className={`${cls} text-white`} style={{ background: 'var(--app-accent)', borderColor: 'transparent', color: '#fff' }}>
        <Plus className="w-4 h-4" />
        <span>Neue Spule</span>
      </button>
    </nav>
  );
};
