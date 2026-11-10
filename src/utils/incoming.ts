import type { Spool } from '../types/filament';

// 1.277: Bestellte Spulen („unterwegs“): Lieferzeit-Text und Bestätigung, wenn die Spule wirklich da ist.

type Incoming = NonNullable<Spool['incoming']>;
export interface IncomingInfo {
  text: string;
  tone: 'wait' | 'soon' | 'late' | 'here';
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** „kommt in 2 Tagen“, „kommt morgen“, „zugestellt“ … aus Status und Lieferdatum */
export function incomingInfo(inc: Incoming, now = new Date()): IncomingInfo {
  if (inc.status === 'delivered') return { text: 'Zugestellt: bestätigen, wenn du sie hast', tone: 'here' };
  const lead = inc.status === 'shipped' ? 'Unterwegs' : 'Bestellt';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inc.eta || '');
  if (!m) return { text: inc.status === 'shipped' ? 'Unterwegs, Lieferdatum offen' : 'Bestellt, Lieferdatum offen', tone: 'wait' };
  const eta = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = Math.round((dayStart(eta) - dayStart(now)) / 86_400_000);
  const dm = `${m[3]}.${m[2]}.`;
  if (days < 0) return { text: `${lead}, verspätet (war ${dm})`, tone: 'late' };
  if (days === 0) return { text: 'Kommt heute', tone: 'soon' };
  if (days === 1) return { text: 'Kommt morgen', tone: 'soon' };
  return { text: `Kommt in ${days} Tagen (${dm})`, tone: 'wait' };
}

/** Spule ist da: wird zur normalen Spule. Die Marke verhindert, dass spätere Mails sie noch mal anlegen. */
export function confirmArrival(spool: Spool): Spool {
  if (!spool.incoming) return spool;
  const { incoming, ...rest } = spool;
  return { ...rest, deliveredKey: `deliv:${incoming.key}` } as Spool;
}

export const CONFIRM_ARRIVAL_EVENT = 'filamenthub:confirm-arrival';
/** Von jeder Karte aus: „Spule ist angekommen“ (App.tsx führt es aus, speichert und meldet) */
export function requestConfirmArrival(spoolId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(CONFIRM_ARRIVAL_EVENT, { detail: spoolId }));
}

export const REJECT_INCOMING_EVENT = 'filamenthub:reject-incoming';
/** „Falsch erkannt“: die bestellte Spule wird aus der Liste entfernt (App.tsx führt es aus) */
export function requestRejectIncoming(spoolId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(REJECT_INCOMING_EVENT, { detail: spoolId }));
}

export interface IncomingStep {
  label: string;
  when: string;
  done: boolean;
}

const fmt = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

/** Verlauf für das kleine Menü: Bestellt → Versendet → Zugestellt */
export function incomingSteps(inc: Incoming): IncomingStep[] {
  const shipped = inc.status === 'shipped' || inc.status === 'delivered';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inc.eta || '');
  const eta = m ? `${m[3]}.${m[2]}.` : '';
  return [
    { label: 'Bestellt', when: fmt(inc.orderedAt), done: true },
    { label: 'Versendet', when: shipped ? fmt(inc.shippedAt) : '', done: shipped },
    { label: 'Zugestellt', when: inc.status === 'delivered' ? fmt(inc.deliveredAt) : eta ? `erwartet ${eta}` : '', done: inc.status === 'delivered' }
  ];
}
