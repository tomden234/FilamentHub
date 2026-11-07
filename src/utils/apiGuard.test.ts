import { describe, expect, it } from 'vitest';
import { checkMediaToken, decideAccess, hostName, makeMediaToken, isLoopbackAddr, failBlocked, noteFail, clearFailsForTest } from '../../server/apiGuard';
import { okAutomationBody } from '../../server/haRawAllow';
import { isLanIp } from '../../server/netCheck';

const base = { expectedKey: 'geheim123', headerKey: undefined, queryKey: undefined, method: 'GET', path: '/api/recorder/status', host: '192.168.68.10:3000' };

describe('Zugriffsschutz /api (1.229)', () => {
  it('lässt mit richtigem Schlüssel im Header durch', () => {
    expect(decideAccess({ ...base, headerKey: 'geheim123' }).ok).toBe(true);
  });

  it('weist ohne oder mit falschem Schlüssel ab', () => {
    expect(decideAccess(base).ok).toBe(false);
    expect(decideAccess({ ...base, headerKey: 'falsch' }).ok).toBe(false);
    expect(decideAccess({ ...base, headerKey: 'geheim12' }).ok).toBe(false);
  });

  it('erlaubt ?k= nur für Bild- und Stream-Routen per GET', () => {
    expect(decideAccess({ ...base, path: '/api/printer/stream', queryKey: 'geheim123' }).ok).toBe(true);
    expect(decideAccess({ ...base, path: '/api/printer/camera-frame', queryKey: 'geheim123' }).ok).toBe(true);
    expect(decideAccess({ ...base, path: '/api/hub/queue/thumb/0123456789ab', queryKey: 'geheim123' }).ok).toBe(true);
    expect(decideAccess({ ...base, path: '/api/hub/status', queryKey: 'geheim123' }).ok).toBe(false);
    expect(decideAccess({ ...base, method: 'POST', path: '/api/printer/stream', queryKey: 'geheim123' }).ok).toBe(false);
  });

  it('ohne eingerichteten Schlüssel nur localhost (Schutz gegen WLAN und DNS-Rebinding)', () => {
    const open = { ...base, expectedKey: '', remoteAddress: '127.0.0.1' };
    expect(decideAccess({ ...open, host: '127.0.0.1:38517' }).ok).toBe(true);
    expect(decideAccess({ ...open, host: 'localhost:3000' }).ok).toBe(true);
    expect(decideAccess({ ...open, host: '[::1]:3000' }).ok).toBe(true);
    expect(decideAccess({ ...open, host: 'boese-seite.de:38517' }).ok).toBe(false);
    expect(decideAccess({ ...open, host: '192.168.68.10:3000' }).ok).toBe(false);
    expect(decideAccess({ ...open, host: undefined }).ok).toBe(false);
  });

  it('1.231: gefälschter Host-Kopf aus dem WLAN reicht nicht', () => {
    const open = { ...base, expectedKey: '' };
    expect(decideAccess({ ...open, host: 'localhost:3000', remoteAddress: '192.168.68.20' }).ok).toBe(false);
    expect(decideAccess({ ...open, host: 'localhost:3000', remoteAddress: undefined }).ok).toBe(false);
    expect(decideAccess({ ...open, host: 'localhost:3000', remoteAddress: '::ffff:127.0.0.1' }).ok).toBe(true);
    expect(isLoopbackAddr('::1')).toBe(true);
    expect(isLoopbackAddr('::ffff:192.168.1.2')).toBe(false);
  });

  it('1.231: Medien-Token statt Schlüssel in der Adresse', () => {
    const now = 1_800_000_000_000;
    const { token } = makeMediaToken('geheim123', now);
    expect(checkMediaToken(token, 'geheim123', now + 1000)).toBe(true);
    expect(checkMediaToken(token, 'anderer', now + 1000)).toBe(false);
    expect(checkMediaToken(token, 'geheim123', now + 13 * 3600_000)).toBe(false); // abgelaufen
    expect(checkMediaToken(token.replace(/.$/, c => (c === 'A' ? 'B' : 'A')), 'geheim123', now)).toBe(false);
    expect(decideAccess({ ...base, path: '/api/printer/stream', mediaToken: token, now: now + 1000 }).ok).toBe(true);
    expect(decideAccess({ ...base, path: '/api/hub/status', mediaToken: token, now: now + 1000 }).ok).toBe(false);
  });

  it('liest den Host-Namen ohne Port', () => {
    expect(hostName('LOCALHOST:3000')).toBe('localhost');
    expect(hostName('[::1]:80')).toBe('::1');
  });
});

describe('LAN-Test nur ins Heimnetz', () => {
  it('erkennt Heimnetz und Tailscale', () => {
    expect(isLanIp('192.168.68.5')).toBe(true);
    expect(isLanIp('10.0.0.2')).toBe(true);
    expect(isLanIp('100.101.2.3')).toBe(true);
    expect(isLanIp('8.8.8.8')).toBe(false);
    expect(isLanIp('100.200.1.1')).toBe(false);
    expect(isLanIp('drucker.de')).toBe(false);
  });
});

describe('Home Assistant: Token geht nie an fremde Adresse', async () => {
  const { haTarget } = await import('../../server/haConfig');
  it('fremde Adresse ohne eigenen Token wird ignoriert', () => {
    const t = haTarget('https://angreifer.example', '');
    expect(t.url).not.toContain('angreifer');
  });
  it('eigene Adresse mit eigenem Token: Nabu Casa und Heimnetz ok', () => {
    expect(haTarget('https://abc.ui.nabu.casa/', 'tok')).toEqual({ url: 'https://abc.ui.nabu.casa', token: 'tok' });
    expect(haTarget('http://192.168.68.10:8123', 'tok')).toEqual({ url: 'http://192.168.68.10:8123', token: 'tok' });
    expect(haTarget('http://homeassistant.local:8123', 'tok').url).toBe('http://homeassistant.local:8123');
  });
  it('1.231: beliebige Internet-Adresse auch mit eigenem Token nicht (keine offene Weiterleitung)', () => {
    const t = haTarget('https://irgendwo.example', 'tok');
    expect(t.url).not.toContain('irgendwo');
    expect(t.token).not.toBe('tok');
  });
});

describe('1.233 Server-Härtung', () => {
  it('lehnt Cross-Site-Anfragen im Modus ohne Schlüssel ab', () => {
    const r = decideAccess({ expectedKey: '', headerKey: undefined, queryKey: undefined, method: 'POST', path: '/api/hub/queue/start', host: 'localhost:3000', remoteAddress: '127.0.0.1', secFetchSite: 'cross-site' });
    expect(r.ok).toBe(false);
    const same = decideAccess({ expectedKey: '', headerKey: undefined, queryKey: undefined, method: 'POST', path: '/api/hub/queue/start', host: 'localhost:3000', remoteAddress: '127.0.0.1', secFetchSite: 'same-origin' });
    expect(same.ok).toBe(true);
  });
  it('Sicherung geht nicht mehr per Adress-Zusatz', () => {
    const r = decideAccess({ expectedKey: 'k'.repeat(20), headerKey: undefined, queryKey: 'k'.repeat(20), method: 'GET', path: '/api/hub/backup', host: 'pi:3000', remoteAddress: '192.168.1.5' });
    expect(r.ok).toBe(false);
  });
  it('bremst falsche Schlüssel nach 10 Versuchen', () => {
    clearFailsForTest();
    for (let i = 0; i < 10; i++) noteFail('1.2.3.4', 1000);
    expect(failBlocked('1.2.3.4', 2000)).toBe(true);
    expect(failBlocked('1.2.3.4', 1000 + 61_000)).toBe(false);
    expect(failBlocked('9.9.9.9', 2000)).toBe(false);
  });
  it('Automation nur mit bekannten Diensten', () => {
    expect(okAutomationBody({ alias: 'x', trigger: [], action: [{ service: 'switch.turn_off', target: { entity_id: 'switch.a' } }] })).toBe(true);
    expect(okAutomationBody({ alias: 'x', action: [{ service: 'lock.unlock', target: { entity_id: 'lock.tuer' } }] })).toBe(false);
    expect(okAutomationBody({ alias: 'x', action: [{ action: 'shell_command.x' }] })).toBe(false);
    expect(okAutomationBody({ alias: 'x', action: [{ if: [], then: [{ service: 'script.turn_on' }] }] })).toBe(false);
    expect(okAutomationBody('x')).toBe(false);
  });
});
