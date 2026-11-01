// Kleine Fenster-Ereignisse, damit Menü, Benachrichtigungen und Hauptfenster sich ohne viele Props verständigen.
export type WorkshopTabId = 'inbox' | 'notices' | 'labels' | 'prints' | 'stats' | 'queue';

export const OPEN_WORKSHOP_EVENT = 'filamenthub:open-workshop';

export interface OpenWorkshopDetail {
  tab: WorkshopTabId;
  /** Mitteilung, die aufgeklappt gezeigt werden soll */
  focusId?: string;
}

export const OPEN_SLOT_ASSIGN_EVENT = 'filamenthub:open-slot-assign';

/** Öffnet das Fenster „Spule → AMS-Slot“ (optional mit schon gewählter Spule) */
export function openSlotAssign(spoolId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<{ spoolId?: string }>(OPEN_SLOT_ASSIGN_EVENT, { detail: { spoolId } }));
}

/** Öffnet die Werkstatt (Mitteilungen, Einstellungen, Etiketten) von überall aus */
export function openWorkshop(tab: WorkshopTabId, focusId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenWorkshopDetail>(OPEN_WORKSHOP_EVENT, { detail: { tab, focusId } }));
}
