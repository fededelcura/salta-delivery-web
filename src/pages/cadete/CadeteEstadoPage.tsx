import { useCallback, useEffect, useRef, useState } from 'react';
import { cadetePortalApi } from '../../lib/api';
import type { CadetePortal } from '../../types';
import { Badge, ErrorBox, PageHeader } from '../../components/ui';

export function CadeteEstadoPage() {
  const [cadete, setCadete] = useState<CadetePortal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState<string>('Sin GPS aún');
  const watchRef = useRef<number | null>(null);

  const pushGps = useCallback(async (lat: number, lng: number) => {
    try {
      const updated = await cadetePortalApi.actualizarUbicacion(lat, lng);
      setCadete(updated);
      setGps(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  useEffect(() => {
    const online = cadete?.disponibilidad === 'online' || cadete?.disponibilidad === 'en_viaje';
    if (!online) {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return;
    }
    if (!navigator.geolocation) {
      setGps('Geolocalización no disponible en este navegador');
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        void pushGps(pos.coords.latitude, pos.coords.longitude);
      },
      () => setGps('Permiso GPS denegado o error'),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [cadete?.disponibilidad, pushGps]);

  async function toggle(online: boolean) {
    setBusy(true);
    setError(null);
    try {
      const updated = await cadetePortalApi.setEstado(online ? 'online' : 'offline');
      setCadete(updated);
      if (online && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => void pushGps(pos.coords.latitude, pos.coords.longitude),
          () => undefined,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar estado');
    } finally {
      setBusy(false);
    }
  }

  const disp = cadete?.disponibilidad ?? 'offline';

  return (
    <div className="page-enter">
      <PageHeader
        title="Estado"
        subtitle="Ponete online para recibir viajes (GPS del navegador)"
      />
      {error ? <ErrorBox message={error} /> : null}

      <div className="panel panel-pad" style={{ maxWidth: 480 }}>
        <p>
          Disponibilidad:{' '}
          <Badge tone={disp === 'online' || disp === 'en_viaje' ? 'ok' : 'neutral'}>{disp}</Badge>
        </p>
        <p className="muted">GPS: {gps}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || disp === 'online'}
            onClick={() => void toggle(true)}
          >
            Online
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || disp === 'offline'}
            onClick={() => void toggle(false)}
          >
            Offline
          </button>
        </div>
      </div>
    </div>
  );
}
