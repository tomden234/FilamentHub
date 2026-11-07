import { describe, expect, it } from 'vitest';
import { parsePiPair, piPairFragment } from './gistStore';

describe('1.247 Pi-Kopplung per Link', () => {
  it('Adresse und Schlüssel gehen hin und zurück', () => {
    const f = piPairFragment('http://192.168.68.10:3000', 'abc123XYZ_-key9');
    expect(parsePiPair('#' + f)).toEqual({ url: 'http://192.168.68.10:3000', key: 'abc123XYZ_-key9' });
  });
  it('lehnt fremde Adressen mit Pfad oder Müll ab', () => {
    expect(parsePiPair('#pairPi=javascript%3Aalert(1)&k=abcdefgh1234')).toBeNull();
    expect(parsePiPair('#pairPi=http%3A%2F%2Fa.b%2Fx%2Fy&k=abcdefgh1234')).toBeNull();
    expect(parsePiPair('')).toBeNull();
  });
  it('ohne Schlüssel kein Fragment', () => {
    expect(piPairFragment('http://x:3000', '')).toBe('');
  });
});
