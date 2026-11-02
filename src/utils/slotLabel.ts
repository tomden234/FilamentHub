/** Anzeigename eines Platzes: 1-4 = AMS, 5 = externe Spule */
export const slotLabel = (slot: number | null | undefined): string => (slot === 5 ? 'Extern' : `AMS ${slot}`);
