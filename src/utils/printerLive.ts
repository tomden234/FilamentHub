// Aktueller Verbindungsstand des Druckers. Das Drucker-Widget meldet ihn hierher,
// damit das Verbindungen-Menü dasselbe anzeigt wie die Druckerkarte (statt nur „Token gespeichert“).
import { useSyncExternalStore } from 'react';
import { safeStorage } from './safeStorage';

export type PrinterLevel = 'online' | 'connecting' | 'standby' | 'offline' | 'unknown';

interface PrinterLive {
  level: PrinterLevel;
  /** Kurztext, z. B. „Online · Druckt“ */
  text: string;
}

let current: PrinterLive = { level: 'unknown', text: '' };
const listeners = new Set<() => void>();

export function setPrinterLive(next: PrinterLive): void {
  if (next.level === current.level && next.text === current.text) return;
  current = next;
  listeners.forEach(l => l());
}

export function usePrinterLive(): PrinterLive {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current
  );
}

/** Ist ein Drucker eingerichtet? Cloud-Login (Token) ODER Zugang im Heimnetz (IP + Zugangscode) */
export function isPrinterConfigured(): boolean {
  const token = !!safeStorage.getItem('bambu_access_token');
  const lan = safeStorage.getItem('bambu_lan_mode') === '1' && !!safeStorage.getItem('bambu_lan_ip') && !!safeStorage.getItem('bambu_lan_code');
  return token || lan;
}

export function isPrinterLan(): boolean {
  return safeStorage.getItem('bambu_lan_mode') === '1';
}
