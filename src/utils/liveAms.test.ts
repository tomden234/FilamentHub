import { describe, it, expect } from 'vitest';
import { getLiveAms, publishLiveAms } from './liveAms';

const st = (unit: any, connected = true) => ({ connected, data: { ams: { ams: unit ? [unit] : [] } } });

describe('liveAms', () => {
  it('trocknet nur, wenn der Drucker es meldet', () => {
    publishLiveAms(st({ id: '0', dry_time: 150 }));
    expect(getLiveAms()).toMatchObject({ connected: true, drying: true, dryMinLeft: 150 });
    publishLiveAms(st({ id: '0', dry_time: 0 }));
    expect(getLiveAms().drying).toBe(false);
  });
  it('nicht verbunden: kein Live-Stand', () => {
    publishLiveAms(st({ id: '0', dry_time: 30 }, false));
    expect(getLiveAms().connected).toBe(false);
  });
});
