import React, { useRef } from 'react';
import { clampPanel, resetPanelW, savePanelW, setPanelW, type PanelKey } from '../utils/panelWidth';

/** Griff zum Breiter-/Schmaler-Ziehen am Rand eines Seitenteils (1.264). Doppelklick = Standardbreite, Pfeiltasten gehen auch. */
export const PanelResizer: React.FC<{ panel: PanelKey; edge: 'left' | 'right' }> = ({ panel, edge }) => {
  const start = useRef<{ x: number; w: number } | null>(null);
  const widthOf = (el: HTMLElement) => el.parentElement?.getBoundingClientRect().width ?? 320;
  // Teil am rechten Rand wird nach links breiter, Teil am linken Rand nach rechts
  const dir = edge === 'left' ? -1 : 1;

  const end = () => {
    if (!start.current) return;
    start.current = null;
    document.documentElement.removeAttribute('data-fh-resizing');
    savePanelW();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Breite ändern (Doppelklick: Standard)"
      title="Ziehen: Breite ändern · Doppelklick: Standard"
      tabIndex={0}
      className="absolute top-0 bottom-0 z-20 w-3 cursor-col-resize group flex items-center justify-center"
      style={{ [edge]: 0, touchAction: 'none' }}
      onPointerDown={e => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: widthOf(e.currentTarget) };
        document.documentElement.setAttribute('data-fh-resizing', '1');
      }}
      onPointerMove={e => {
        if (!start.current) return;
        setPanelW(panel, start.current.w + (e.clientX - start.current.x) * dir);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={() => resetPanelW(panel)}
      onKeyDown={e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const step = (e.shiftKey ? 80 : 20) * (e.key === 'ArrowRight' ? 1 : -1) * dir;
        setPanelW(panel, clampPanel(widthOf(e.currentTarget) + step));
        savePanelW();
      }}
    >
      <span className="h-12 w-1 rounded-full opacity-40 group-hover:opacity-90 group-focus-visible:opacity-90 transition-opacity" style={{ backgroundColor: 'var(--app-accent)' }} />
    </div>
  );
};
