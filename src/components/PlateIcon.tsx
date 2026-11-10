import React from 'react';

// 1.289: kleines Bild der Druckplatte statt blauem Quadrat. Texturierte PEI: goldfarben mit feiner Körnung (wie die Bambu Textured PEI Plate).
type Kind = 'textured' | 'smooth' | 'supertack' | 'engineering' | 'hightemp' | 'cool';

export const plateKind = (label: string): Kind => {
  const t = label.toLowerCase();
  if (/super\s?tack/.test(t)) return 'supertack';
  if (/textur/.test(t)) return 'textured';
  if (/glatt|smooth/.test(t)) return 'smooth';
  if (/engineering/.test(t)) return 'engineering';
  if (/hochtemp|high temp/.test(t)) return 'hightemp';
  return 'cool';
};

const FILL: Record<Kind, string> = { textured: '#c9a45e', smooth: '#e6d3a3', supertack: '#7fb6dc', engineering: '#8a8f98', hightemp: '#5b6b7a', cool: '#a9d2ee' };

export const PlateIcon: React.FC<{ label: string; size?: number }> = ({ label, size = 14 }) => {
  const kind = plateKind(label);
  const id = `plate-grain-${kind}`;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="inline-block shrink-0 align-[-2px]">
      <defs>
        <pattern id={id} width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="0.75" cy="0.75" r="0.45" fill="#ffffff" fillOpacity="0.5" />
          <circle cx="2.25" cy="2.25" r="0.4" fill="#7a5a1e" fillOpacity="0.45" />
        </pattern>
      </defs>
      <rect x="1" y="3" width="14" height="10" rx="1.6" fill={FILL[kind]} stroke="rgba(0,0,0,.35)" strokeWidth="0.8" />
      {kind === 'textured' && <rect x="1" y="3" width="14" height="10" rx="1.6" fill={`url(#${id})`} />}
      {kind === 'smooth' && <path d="M2.5 4.2 L8 4.2 L4 11.8 L2.5 11.8 Z" fill="#fff" fillOpacity="0.35" />}
      {kind === 'textured' && <path d="M5 3 L5 1.8 L11 1.8 L11 3" fill={FILL[kind]} stroke="rgba(0,0,0,.35)" strokeWidth="0.6" />}
      <rect x="1" y="3" width="14" height="2" rx="1" fill="#000" fillOpacity="0.1" />
    </svg>
  );
};
