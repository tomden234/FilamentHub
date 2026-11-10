import { describe, expect, it } from 'vitest';
import { confirmArrival, incomingSteps, testMail } from './incoming';
import { applyOrder, looksLikeFilamentOrder, testOrderFrom, mailProducts, orderPrompt, parseOrderJson, processMail, taraOf, testMailTarget, testMailRecipients, sendTestMail, type MailDeps, type ParsedOrder } from '../../server/hub/orders';

const item = { brand: 'Bambu Lab', material: 'PLA', name: 'PLA Basic Schwarz', colorName: 'Schwarz', colorHex: '#000000', quantity: 2, initialWeight: 1000, pricePerKg: 19.99 };
const order = (kind: ParsedOrder['kind'], eta?: string): ParsedOrder => ({ kind, orderId: '302-1234567-7654321', eta, items: [item] });

describe('Bestell-Mail', () => {
  it('Vorfilter: nur Filament + Bestell-Wörter', () => {
    expect(looksLikeFilamentOrder('Ihre Bestellung', 'Bambu Lab PLA Basic')).toBe(true);
    expect(looksLikeFilamentOrder('Versendet', 'PETG Filament zugestellt')).toBe(true);
    expect(looksLikeFilamentOrder('Ihre Bestellung', 'Kopfhörer')).toBe(false);
    expect(looksLikeFilamentOrder('Hallo', 'Filament Tipps')).toBe(false);
  });
  it('JSON prüfen und säubern', () => {
    const o = parseOrderJson('```json\n{"kind":"ordered","orderId":"302-1","items":[{"brand":"X","material":"UNSINN","name":"A<b>","colorHex":"red","quantity":99,"initialWeight":9,"pricePerKg":-3,"productUrl":"javascript:alert(1)"}]}\n```');
    expect(o?.items[0]).toMatchObject({ material: 'PLA', quantity: 20, initialWeight: 100, pricePerKg: 0, colorHex: '#888888', productUrl: undefined });
    expect(o?.items[0].name).not.toContain('<');
  });
  it('lehnt kaputte oder fremde Antworten ab', () => {
    expect(parseOrderJson('kein json')).toBeNull();
    expect(parseOrderJson('{"kind":"other","orderId":"1","items":[]}')).toBeNull();
    expect(parseOrderJson('{"kind":"ordered","orderId":"","items":[{"name":"a"}]}')).toBeNull();
    expect(parseOrderJson('{"kind":"ordered","orderId":"1","items":[]}')).toBeNull();
  });
  it('Bestellung legt „unterwegs“-Spulen an, nie doppelt', () => {
    const r = applyOrder({ spools: [] }, order('ordered'));
    expect(r.added).toBe(2);
    expect(r.doc.spools[0].incoming).toMatchObject({ status: 'ordered', orderId: '302-1234567-7654321' });
    expect(r.doc.spools[0]).toMatchObject({ remainingWeight: 1000, emptySpoolWeight: 250, sealed: true });
    const again = applyOrder(r.doc, order('ordered'));
    expect(again.changed).toBe(false);
    expect(again.doc.spools).toHaveLength(2);
  });
  it('Versand setzt Status und Datum', () => {
    const a = applyOrder({ spools: [] }, order('ordered'));
    const s = applyOrder(a.doc, order('shipped', '2026-11-12'));
    expect(s.doc.spools[1].incoming).toMatchObject({ status: 'shipped', eta: '2026-11-12' });
    expect(s.added).toBe(0);
  });
  it('Zustellung setzt nur „zugestellt“, Bestätigung macht sie normal, spätere Mails ändern nichts', () => {
    const a = applyOrder({ spools: [] }, order('ordered'));
    const d = applyOrder(a.doc, order('delivered'));
    expect(d.arrived).toHaveLength(2);
    expect(d.doc.spools.every((x: any) => x.incoming?.status === 'delivered')).toBe(true);
    // gleiche Zustellmail noch mal: kein zweiter Push
    const d2 = applyOrder(d.doc, order('delivered'));
    expect(d2.arrived).toHaveLength(0);
    expect(d2.changed).toBe(false);
    // späte Versandmail stuft nicht zurück
    expect(applyOrder(d.doc, order('shipped', '2026-11-12')).doc.spools[0].incoming.status).toBe('delivered');
    // Nutzer bestätigt in der App
    const confirmed = { spools: d.doc.spools.map((x: any) => confirmArrival(x)) };
    expect(confirmed.spools.every((x: any) => !x.incoming)).toBe(true);
    // danach legt keine Mail etwas Neues an
    expect(applyOrder(confirmed, order('ordered')).changed).toBe(false);
    expect(applyOrder(confirmed, order('shipped')).changed).toBe(false);
    expect(applyOrder(confirmed, order('delivered')).changed).toBe(false);
    expect(confirmed.spools).toHaveLength(2);
  });
  it('Zustellung ohne Bestell-Mail legt nichts an (sonst doppelte Spulen)', () => {
    const d = applyOrder({ spools: [{ id: 'x' }] }, order('delivered'));
    expect(d.doc.spools).toHaveLength(1);
    expect(d.unmatched).toBe(2);
    expect(d.changed).toBe(false);
  });
  it('Teillieferung: Versandmail nennt nur eine Position und andere Schreibweise', () => {
    const two: ParsedOrder = { kind: 'ordered', orderId: 'A-1', items: [{ ...item, quantity: 1 }, { ...item, name: 'PETG HF Blau', material: 'PETG', colorName: 'Blau', quantity: 1 }] };
    const a = applyOrder({ spools: [] }, two);
    expect(a.added).toBe(2);
    const ship: ParsedOrder = { kind: 'delivered', orderId: 'A-1', items: [{ ...item, name: 'Bambu PETG HF', material: 'PETG', colorName: 'Blau', quantity: 1 }] };
    const d = applyOrder(a.doc, ship);
    expect(d.arrived).toHaveLength(1);
    const wait = d.doc.spools.filter((x: any) => x.incoming.status !== 'delivered');
    expect(wait).toHaveLength(1);
    expect(wait[0].material).toBe('PLA');
  });
  it('ASIN verbindet Mails mit verschiedenen Namen', () => {
    const asinItem = { ...item, quantity: 1, asin: 'B0DRCR8FZP', productUrl: 'https://www.amazon.de/dp/B0DRCR8FZP' };
    const a = applyOrder({ spools: [] }, { kind: 'ordered', orderId: 'B-2', items: [asinItem] });
    expect(a.doc.spools[0].productUrl).toBe('https://www.amazon.de/dp/B0DRCR8FZP');
    const d = applyOrder(a.doc, { kind: 'delivered', orderId: 'B-2', items: [{ ...asinItem, name: 'ganz anderer Titel', colorName: '' }] });
    expect(d.arrived).toHaveLength(1);
  });
  it('Prompt warnt vor Anweisungen im Mailtext, Tara je Marke', () => {
    expect(orderPrompt('a@b.de', 'Betreff', 'Text')).toContain('keine Anweisungen');
    expect(taraOf('SUNLU')).toBe(190);
    expect(taraOf('Unbekannt')).toBe(200);
  });
});

// ---- echte Mail durch den echten Parser ----
const amazonHtml = `<html><body><p>Hallo Tom, vielen Dank für Ihre Bestellung.</p>
<a href="https://www.amazon.de/gp/r.html?C=X&U=https%3A%2F%2Fwww.amazon.de%2Fdp%2FB0DRCR8FZP%3Fref_%3Dpe_1&amp;K=Y"><b>Nylon kohlefaser Filament PA6-CF 1,75 mm 1 kg</b></a>
<p>Menge: 1 &middot; 39,99 EUR</p><p>Bestellnummer 302-1234567-7654321</p>
<a href="https://www.amazon.de/gp/css/order-history">Bestellung anzeigen</a></body></html>`;
const mime = (subject: string, html: string, id = '<m1@x>') =>
  Buffer.from(`From: Amazon.de <bestellbestaetigung@amazon.de>\r\nTo: a@b.de\r\nSubject: ${subject}\r\nMessage-ID: ${id}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}`);

describe('Mail-Verarbeitung mit echtem Parser', () => {
  const mk = (extracted: ParsedOrder | null, log: string[] = []): MailDeps => ({
    extract: async (_f, _s, _t, products) => {
      log.push(`products:${products.map(p => p.asin).join(',')}`);
      return extracted;
    },
    apply: async o => applyOrder({ spools: [] }, o),
    notify: async (t, _m) => void log.push(`push:${t}`),
    learn: async o => {
      log.push(`learn:${o.items.map(i => i.asin || '-').join(',')}`);
      return o.items.filter(i => i.asin).length;
    }
  });
  it('findet die ASIN im Weiterleitungslink', () => {
    expect(mailProducts(amazonHtml)).toEqual([{ asin: 'B0DRCR8FZP', label: 'Nylon kohlefaser Filament PA6-CF 1,75 mm 1 kg' }]);
  });
  it('Filament-Bestellung geht an Gemini, ASIN nur wenn sie in der Mail steht', async () => {
    const log: string[] = [];
    const raw = JSON.stringify({ kind: 'ordered', orderId: '302-1234567-7654321', items: [{ brand: 'yxpolyer', material: 'PET-CF / PA-CF', name: 'PA6-CF Schwarz', colorName: 'Schwarz', colorHex: '#111111', quantity: 1, initialWeight: 1000, pricePerKg: 39.99, asin: 'B0DRCR8FZP' }, { brand: 'x', material: 'PLA', name: 'Erfunden', asin: 'B0AAAAAAAA' }] });
    const o = parseOrderJson(raw, new Set(['B0DRCR8FZP']));
    expect(o?.items[0].productUrl).toBe('https://www.amazon.de/dp/B0DRCR8FZP');
    expect(o?.items[1].asin).toBeUndefined();
    const r = await processMail(mime('Bestellt: Nylon Filament', amazonHtml), [], mk(o, log));
    expect(r.outcome).toBe('applied');
    expect(r.added).toBe(2);
    expect(log).toContain('products:B0DRCR8FZP');
    expect(log.some(l => l.startsWith('push:'))).toBe(true);
  });
  it('Werbung und bekannte Mails rufen Gemini nicht auf', async () => {
    const log: string[] = [];
    expect((await processMail(mime('Neu: Kopfhörer', '<p>Sale auf Kopfhörer</p>'), [], mk(null, log))).outcome).toBe('skipped');
    expect(log).toHaveLength(0);
    const first = await processMail(mime('Bestellt', amazonHtml, '<dup@x>'), [], mk(null, log));
    expect((await processMail(mime('Bestellt', amazonHtml, '<dup@x>'), [first.id], mk(null, log))).outcome).toBe('duplicate');
  });
  it('Gemini-Fehler wirft (Mail wird später erneut versucht)', async () => {
    const bad: MailDeps = { ...mk(null), extract: async () => { throw new Error('Gemini-Fehler 429'); } };
    await expect(processMail(mime('Bestellt', amazonHtml), [], bad)).rejects.toThrow('429');
  });
});

import { incomingInfo } from './incoming';
describe('Lieferzeit-Text', () => {
  const now = new Date(2026, 10, 9, 18, 0);
  const inc = (status: 'ordered' | 'shipped' | 'delivered', eta?: string) => ({ key: 'k', orderId: 'o', status, eta });
  it('Tage bis Lieferung', () => {
    expect(incomingInfo(inc('shipped', '2026-11-09'), now).text).toBe('Kommt heute');
    expect(incomingInfo(inc('shipped', '2026-11-10'), now).text).toBe('Kommt morgen');
    expect(incomingInfo(inc('ordered', '2026-11-12'), now).text).toBe('Kommt in 3 Tagen (12.11.)');
    expect(incomingInfo(inc('shipped', '2026-11-07'), now)).toMatchObject({ tone: 'late' });
  });
  it('ohne Datum und zugestellt', () => {
    expect(incomingInfo(inc('ordered'), now).text).toContain('Lieferdatum offen');
    expect(incomingInfo(inc('delivered'), now)).toMatchObject({ tone: 'here' });
  });
});

describe('Alte Bestellungen als Anhang weitergeleitet', () => {
  const inner = (id: string) => `From: Amazon.de <bestellbestaetigung@amazon.de>\r\nSubject: Ihre Bestellung: Filament\r\nMessage-ID: <${id}@amazon>\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${amazonHtml}`;
  const fwd = Buffer.from(
    `From: Tom <t@x.de>\r\nTo: filamenthub@x.de\r\nSubject: Weitergeleitete Nachrichten\r\nMessage-ID: <fwd1@x>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="B"\r\n\r\n--B\r\nContent-Type: text/plain\r\n\r\nHier meine Bestellungen\r\n--B\r\nContent-Type: message/rfc822; name="a.eml"\r\nContent-Disposition: attachment; filename="a.eml"\r\n\r\n${inner('a1')}\r\n--B\r\nContent-Type: message/rfc822; name="b.eml"\r\nContent-Disposition: attachment; filename="b.eml"\r\n\r\n${inner('b2')}\r\n--B--\r\n`
  );
  const o: ParsedOrder = { kind: 'ordered', orderId: '302-1', items: [{ ...item, quantity: 1, asin: 'B0DRCR8FZP' }] };
  it('lernt nur, legt keine Spulen an, merkt erledigte Anhänge', async () => {
    const log: string[] = [];
    const deps: MailDeps = {
      extract: async () => o,
      apply: async () => {
        log.push('apply');
        return applyOrder({ spools: [] }, o);
      },
      notify: async t => void log.push(`push:${t}`),
      learn: async x => (log.push('learn'), x.items.length)
    };
    const r = await processMail(fwd, [], deps);
    expect(r.outcome).toBe('learned');
    expect(r.learned).toBe(2);
    expect(r.done).toHaveLength(2);
    expect(log).not.toContain('apply');
    expect(log.filter(l => l === 'learn')).toHaveLength(2);
    // zweiter Lauf: bekannte Anhänge werden übersprungen
    const log2: string[] = [];
    const r2 = await processMail(fwd, r.done!, { ...deps, learn: async () => (log2.push('learn'), 1) });
    expect(log2).toHaveLength(0);
    expect(r2.learned).toBe(0);
  });
});

describe('Bestell-Verlauf (1.290)', () => {
  it('Zeitstempel: bestellt, versendet, zugestellt', () => {
    const t1 = '2026-11-01T10:00:00.000Z';
    const t2 = '2026-11-02T10:00:00.000Z';
    const t3 = '2026-11-03T10:00:00.000Z';
    let doc = applyOrder({ spools: [] }, order('ordered'), t1).doc;
    expect(doc.spools[0].incoming.orderedAt).toBe(t1);
    doc = applyOrder(doc, order('shipped', '2026-11-04'), t2).doc;
    expect(doc.spools[0].incoming.shippedAt).toBe(t2);
    doc = applyOrder(doc, order('delivered'), t3).doc;
    expect(doc.spools[0].incoming.deliveredAt).toBe(t3);
    expect(incomingSteps(doc.spools[0].incoming).every(st => st.done)).toBe(true);
  });
  it('Verlauf bei bestellter Spule: nur „Bestellt“ erledigt', () => {
    const steps = incomingSteps({ key: 'k', orderId: 'o', status: 'ordered', eta: '2026-11-12' });
    expect(steps.map(st => st.done)).toEqual([true, false, false]);
    expect(steps[2].when).toBe('erwartet 12.11.');
  });
});

describe('Test-Mail (1.291)', () => {
  it('Marker aus der vorgefertigten Mail wird erkannt', () => {
    for (const kind of ['ordered', 'shipped', 'delivered'] as const) {
      const m = testMail(kind, 'abc123');
      const o = testOrderFrom(m.subject, m.body);
      expect(o?.kind).toBe(kind);
      expect(o?.orderId).toBe('TEST-abc123');
      expect(o?.test).toBe(true);
    }
  });
  it('normale Mail ist keine Test-Mail', () => {
    expect(testOrderFrom('Ihre Bestellung', 'Bambu Lab PLA')).toBeNull();
  });
  it('Testspule: markiert, nicht doppelt, nach Bestätigung ohne Bestell-Rest', () => {
    const o = testOrderFrom('x', 'FILAMENTHUB-TESTSPULE-abc123-ordered')!;
    let doc = applyOrder({ spools: [] }, o).doc;
    expect(doc.spools).toHaveLength(1);
    expect(doc.spools[0].isTest).toBe(true);
    expect(doc.spools[0].name).toBe('Testspule');
    expect(doc.spools[0].incoming.orderId).toBe('TEST-abc123');
    expect(applyOrder(doc, o).changed).toBe(false);
    doc = applyOrder(doc, testOrderFrom('x', 'FILAMENTHUB-TESTSPULE-abc123-delivered')!).doc;
    expect(doc.spools[0].incoming.status).toBe('delivered');
    const normal = confirmArrival(doc.spools[0]);
    expect(normal.incoming).toBeUndefined();
    expect(normal.isTest).toBe(true);
  });
});

describe('Test-Mail durch den echten Parser (1.291)', () => {
  it('weitergeleitete Test-Mail: kein Gemini, kein Lernen, Testspule wird angelegt', async () => {
    const log: string[] = [];
    let doc: any = { spools: [] };
    const deps: MailDeps = {
      extract: async () => (log.push('gemini'), null),
      apply: async o => {
        const r = applyOrder(doc, o);
        doc = r.doc;
        return r;
      },
      notify: async t => void log.push(`push:${t}`),
      learn: async () => (log.push('learn'), 0)
    };
    const m = testMail('delivered', 'abc123');
    const raw = Buffer.from(`From: Tom <haupt@example.de>\r\nTo: bestell@example.de\r\nSubject: Fwd: ${m.subject}\r\nMessage-ID: <t1@x>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n---------- Weitergeleitete Nachricht ----------\r\n> ${m.body.replace(/\n/g, '\r\n> ')}`);
    const r = await processMail(raw, [], deps);
    expect(r.outcome).toBe('applied');
    expect(log).not.toContain('gemini');
    expect(log).not.toContain('learn');
    expect(doc.spools).toHaveLength(1);
    expect(doc.spools[0].isTest).toBe(true);
    expect(doc.spools[0].incoming.status).toBe('delivered');
    expect(log.some(l => l.startsWith('push:'))).toBe(true);
  });
});

describe('Test-Mail verschicken (1.292)', () => {
  it('Ziel nur Haupt-Adresse oder Postfach selbst', () => {
    expect(testMailTarget('main', 'box@gmail.com')).toBe('tomden233@gmail.com');
    expect(testMailTarget('self', 'box@gmail.com')).toBe('box@gmail.com');
    expect(testMailTarget('fremd@x.de', 'box@gmail.com')).toBe('tomden233@gmail.com');
  });
  it('ungültige Angaben und fehlendes Postfach werden abgelehnt', async () => {
    expect((await sendTestMail('boese', 'abc123', 'main')).ok).toBe(false);
    expect((await sendTestMail('ordered', '../x', 'main')).ok).toBe(false);
    expect((await sendTestMail('ordered', 'abc123', 'main')).text).toMatch(/Postfach fehlt/);
  });
});

describe('Test-Mail Kopie ins Postfach (1.295)', () => {
  it('An mein Konto: Haupt-Adresse plus Bcc ans Bestell-Postfach', () => {
    expect(testMailRecipients('main', 'box@gmail.com')).toEqual({ to: 'tomden233@gmail.com', bcc: 'box@gmail.com' });
  });
  it('Direkt: nur das Postfach, keine Doppel-Kopie', () => {
    expect(testMailRecipients('self', 'box@gmail.com')).toEqual({ to: 'box@gmail.com' });
  });
});
