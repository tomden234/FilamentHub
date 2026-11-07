// Echter Stand des AMS vom Drucker (Trocknung), für die Spulen-Liste. Kommt aus dem Live-Status, nicht aus einer lokalen Merkliste.
// Vorher blieb "Trocknet" stehen, obwohl der Drucker längst nicht mehr trocknete.

interface LiveAms {
  connected: boolean;
  drying: boolean;
  /** Restminuten laut Drucker (dry_time), sonst null */
  dryMinLeft: number | null;
  dryTemp: number | null;
}

let live: LiveAms = { connected: false, drying: false, dryMinLeft: null, dryTemp: null };

export function getLiveAms(): LiveAms {
  return live;
}

/** Live-Status des Druckers übernehmen. Meldet Änderungen per Ereignis (wie die alte Trocknungs-Meldung). */
export function publishLiveAms(state: any): void {
  const connected = Boolean(state?.connected);
  const unit = Array.isArray(state?.data?.ams?.ams) ? state.data.ams.ams[0] : null;
  let next: LiveAms;
  if (!connected || !unit) {
    next = { connected: false, drying: false, dryMinLeft: null, dryTemp: null };
  } else {
    const ds = unit.dry_setting;
    const min = Number(unit.dry_time) || 0;
    const drying = min > 0 || (Number(ds?.dry_duration) > 0 && Number(ds?.dry_temperature) > 0);
    next = { connected: true, drying, dryMinLeft: min > 0 ? min : null, dryTemp: Number(ds?.dry_temperature) > 0 ? Number(ds.dry_temperature) : null };
  }
  if (next.connected === live.connected && next.drying === live.drying && next.dryMinLeft === live.dryMinLeft && next.dryTemp === live.dryTemp) return;
  live = next;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('filamenthub_drying_update', { detail: { live: true } }));
}
