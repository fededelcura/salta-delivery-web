/** Helpers GPS / flota en vivo (panel admin). */

const STALE_MS = 5 * 60_000;

export function formatGpsAge(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'sin GPS';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'sin GPS';
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)} h`;
}

export function isGpsStale(iso: string | null | undefined, now = Date.now()): boolean {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return true;
  return now - t > STALE_MS;
}

/** Color de marcador según disponibilidad y antigüedad del fix. */
export function fleetMarkerColor(
  disponibilidad: string | undefined,
  updatedAt: string | null | undefined,
  now = Date.now(),
): string {
  if (isGpsStale(updatedAt, now)) return '#5a6b78';
  if (disponibilidad === 'en_viaje') return '#c45c26';
  if (disponibilidad === 'online') return '#1f7a4c';
  if (disponibilidad === 'ocupado') return '#b8860b';
  return '#5a6b78';
}

export function fleetMarkerLabel(
  nombre: string,
  disponibilidad: string | undefined,
  updatedAt: string | null | undefined,
  now = Date.now(),
): string {
  const estado = disponibilidad ?? '—';
  const age = formatGpsAge(updatedAt, now);
  const stale = isGpsStale(updatedAt, now) ? ' · stale' : '';
  return `${nombre} · ${estado} · ${age}${stale}`;
}
