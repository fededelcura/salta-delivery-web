import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../lib/api';
import {
  connectAdminSocket,
  type CadeteUbicacionEvent,
  type ViajeEstadoEvent,
} from '../lib/socket';
import type { Comprobante, ViajeAdmin } from '../types';
import { Badge, ErrorBox, Loading, Money, PageHeader } from '../components/ui';
import { MapView, type MapMarker } from '../components/MapView';

const ESTADOS = [
  '',
  'buscando_cadete',
  'asignado',
  'en_curso',
  'finalizado',
  'cancelado',
];

const ACTIVOS = new Set(['buscando_cadete', 'asignado', 'en_curso', 'solicitado']);

const TIPO_LABEL: Record<string, string> = {
  delivery: 'Delivery',
  mensajeria: 'Mensajería',
  envio_paquete: 'Paquete',
};

type LivePos = {
  cadete_id: string;
  viaje_id?: string;
  lat: number;
  lng: number;
  ts?: string;
};

function toneEstado(e: string) {
  if (e === 'finalizado') return 'ok' as const;
  if (e === 'cancelado') return 'danger' as const;
  if (e === 'en_curso' || e === 'asignado') return 'brand' as const;
  return 'warn' as const;
}

function getToken(): string | null {
  return localStorage.getItem('sd_token');
}

export function ViajesPage() {
  const [estado, setEstado] = useState('');
  const [items, setItems] = useState<ViajeAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ViajeAdmin | null>(null);
  const [live, setLive] = useState<Record<string, LivePos>>({});
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'live' | 'off'>('connecting');
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [comps, setComps] = useState<Comprobante[]>([]);
  const [despachoMsg, setDespachoMsg] = useState<string | null>(null);
  const [despachoBusy, setDespachoBusy] = useState(false);

  const TIMEOUT_MS = 5 * 60 * 1000;

  function minutosBuscando(v: ViajeAdmin): number {
    return (Date.now() - new Date(v.fecha_solicitud).getTime()) / 60_000;
  }

  function esUrgente(v: ViajeAdmin): boolean {
    return (
      (v.estado === 'buscando_cadete' || v.estado === 'solicitado') &&
      !v.cadete_id &&
      Date.now() - new Date(v.fecha_solicitud).getTime() >= TIMEOUT_MS
    );
  }

  async function despacharCercano(id: string) {
    setDespachoBusy(true);
    setDespachoMsg(null);
    setError(null);
    try {
      const r = await adminApi.despacharCercano(id);
      setDespachoMsg(r.mensaje);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo despachar');
    } finally {
      setDespachoBusy(false);
    }
  }

  const load = useCallback(() => {
    return adminApi
      .viajes(estado || undefined)
      .then((data) => {
        setItems(data);
        setSelected((prev) => {
          if (!prev) return prev;
          return data.find((v) => v.id === prev.id) ?? prev;
        });
      })
      .catch((e: Error) => setError(e.message));
  }, [estado]);

  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected || selected.estado !== 'finalizado') {
      setComps([]);
      return;
    }
    void adminApi
      .comprobantesViaje(selected.id)
      .then(setComps)
      .catch(() => setComps([]));
  }, [selected]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setSocketStatus('off');
      return;
    }

    const socket = connectAdminSocket(token);
    setSocketStatus('connecting');

    socket.on('connect', () => setSocketStatus('live'));
    socket.on('disconnect', () => setSocketStatus('off'));
    socket.on('connect_error', () => setSocketStatus('off'));

    socket.on('cadete:ubicacion', (payload: CadeteUbicacionEvent) => {
      if (typeof payload?.lat !== 'number' || typeof payload?.lng !== 'number') return;
      const key = payload.viaje_id || payload.cadete_id;
      setLive((prev) => ({
        ...prev,
        [key]: {
          cadete_id: payload.cadete_id,
          viaje_id: payload.viaje_id,
          lat: payload.lat,
          lng: payload.lng,
          ts: payload.ts,
        },
      }));
      setLastPing(payload.ts ?? new Date().toISOString());
    });

    socket.on('viaje:estado', (payload: ViajeEstadoEvent) => {
      if (!payload?.viaje_id) return;
      setItems((prev) =>
        prev
          ? prev.map((v) =>
              v.id === payload.viaje_id ? { ...v, estado: payload.estado } : v,
            )
          : prev,
      );
      setSelected((prev) =>
        prev?.id === payload.viaje_id ? { ...prev, estado: payload.estado } : prev,
      );
      if (['finalizado', 'cancelado'].includes(payload.estado)) {
        setLive((prev) => {
          const next = { ...prev };
          delete next[payload.viaje_id];
          return next;
        });
      }
      void load();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [load]);

  const liveForSelected = useMemo(() => {
    if (!selected) return null;
    if (live[selected.id]) return live[selected.id];
    if (selected.cadete_id) {
      return (
        Object.values(live).find(
          (p) => p.cadete_id === selected.cadete_id || p.viaje_id === selected.id,
        ) ?? null
      );
    }
    return null;
  }, [live, selected]);

  const markers: MapMarker[] = useMemo(() => {
    if (selected) {
      const list: MapMarker[] = [
        {
          id: 'o',
          lat: selected.origen?.lat ?? -24.7821,
          lng: selected.origen?.lng ?? -65.4232,
          color: '#0c6b6b',
          label: 'Origen',
        },
        {
          id: 'd',
          lat: selected.destino?.lat ?? -24.79,
          lng: selected.destino?.lng ?? -65.41,
          color: '#c45c26',
          label: 'Destino',
        },
      ];
      if (liveForSelected) {
        list.push({
          id: 'cadete',
          lat: liveForSelected.lat,
          lng: liveForSelected.lng,
          color: '#1a4f8c',
          label: 'Cadete',
        });
      }
      return list;
    }

    return Object.entries(live).map(([key, p]) => ({
      id: key,
      lat: p.lat,
      lng: p.lng,
      color: '#1a4f8c',
      label: p.viaje_id ? `Viaje ${p.viaje_id.slice(0, 8)}…` : 'Cadete',
    }));
  }, [selected, live, liveForSelected]);

  const activosCount = items?.filter((v) => ACTIVOS.has(v.estado)).length ?? 0;
  const liveCount = Object.keys(live).length;

  if (error) return <ErrorBox message={error} />;
  if (!items) return <Loading />;

  return (
    <div className="page-enter">
      <PageHeader
        title="Viajes"
        subtitle="Monitoreo operativo y tracking en vivo"
        actions={
          <div className="live-status" data-status={socketStatus}>
            <span className="live-dot" aria-hidden />
            {socketStatus === 'live' && 'En vivo'}
            {socketStatus === 'connecting' && 'Conectando…'}
            {socketStatus === 'off' && 'Sin socket'}
            {lastPing && socketStatus === 'live' && (
              <span className="muted mono" style={{ marginLeft: 8, fontSize: 12 }}>
                GPS {new Date(lastPing).toLocaleTimeString('es-AR')}
              </span>
            )}
          </div>
        }
      />

      <div className="toolbar">
        <div className="field">
          <label htmlFor="estado">Estado</label>
          <select id="estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.filter(Boolean).map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="live-pills">
          <span className="muted">{activosCount} activos</span>
          <span className="muted">{liveCount} GPS en mapa</span>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Origen → Destino</th>
                <th>Estado</th>
                <th>Tarifa</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => {
                const hasGps = Boolean(live[v.id] || (v.cadete_id && live[v.cadete_id]));
                const urgente = esUrgente(v);
                const buscando =
                  (v.estado === 'buscando_cadete' || v.estado === 'solicitado') && !v.cadete_id;
                return (
                  <tr
                    key={v.id}
                    className={selected?.id === v.id ? 'row-selected' : undefined}
                    style={{
                      cursor: 'pointer',
                      background: urgente
                        ? 'rgba(196, 92, 38, 0.12)'
                        : buscando
                          ? 'rgba(12, 107, 107, 0.06)'
                          : undefined,
                    }}
                    onClick={() => setSelected(v)}
                  >
                    <td className="mono">
                      {new Date(v.fecha_solicitud).toLocaleString('es-AR')}
                      {hasGps && (
                        <div className="live-mini">
                          <span className="live-dot" /> GPS
                        </div>
                      )}
                      {buscando ? (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {urgente
                            ? `⚠ ${Math.floor(minutosBuscando(v))} min sin cadete`
                            : `Buscando · ${Math.floor(minutosBuscando(v))} min`}
                        </div>
                      ) : null}
                    </td>
                    <td>{TIPO_LABEL[v.tipo_servicio] ?? v.tipo_servicio}</td>
                    <td>
                      <div>{v.origen_direccion}</div>
                      <div className="muted">{v.destino_direccion}</div>
                    </td>
                    <td>
                      <Badge tone={urgente ? 'danger' : toneEstado(v.estado)}>{v.estado}</Badge>
                    </td>
                    <td>{v.tarifa_final != null ? <Money value={v.tarifa_final} /> : '—'}</td>
                    <td>
                      {v.metodo_pago} / {v.estado_pago}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="panel panel-pad">
          <h3 style={{ marginTop: 0 }}>
            {selected ? 'Detalle en mapa' : 'Cadetes en vivo'}
          </h3>
          {selected ? (
            <>
              <p className="mono muted">{selected.id}</p>
              <p>
                <Badge tone={toneEstado(selected.estado)}>{selected.estado}</Badge>{' '}
                <span className="muted">
                  {TIPO_LABEL[selected.tipo_servicio] ?? selected.tipo_servicio}
                </span>
              </p>
              {liveForSelected ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  Cadete en {liveForSelected.lat.toFixed(5)}, {liveForSelected.lng.toFixed(5)}
                </p>
              ) : ACTIVOS.has(selected.estado) ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  Esperando GPS del cadete…
                </p>
              ) : null}
              {(selected.estado === 'buscando_cadete' || selected.estado === 'solicitado') &&
              !selected.cadete_id ? (
                <div style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={despachoBusy}
                    onClick={() => void despacharCercano(selected.id)}
                  >
                    {despachoBusy ? 'Despachando…' : 'Despachar cercano'}
                  </button>
                  {esUrgente(selected) ? (
                    <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                      Más de 5 min sin accept — incidencia escalada al admin.
                    </p>
                  ) : (
                    <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                      Reenvía la oferta a cadetes online cerca del origen.
                    </p>
                  )}
                  {despachoMsg ? (
                    <p style={{ fontSize: 13, marginTop: 6 }}>{despachoMsg}</p>
                  ) : null}
                </div>
              ) : null}
              <MapView markers={markers} followId={liveForSelected ? 'cadete' : undefined} />
              {comps.length > 0 ? (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ marginBottom: 8 }}>Comprobantes</h4>
                  {comps.map((c) => (
                    <div
                      key={c.id}
                      className="mono"
                      style={{
                        fontSize: 13,
                        marginBottom: 8,
                        padding: '8px 10px',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                      }}
                    >
                      <strong>{c.numero}</strong> · {c.rol_destino}
                      <div>
                        Monto <Money value={c.monto_usuario} /> · Comisión {c.comision_pct}% (
                        <Money value={c.comision_monto} />)
                      </div>
                    </div>
                  ))}
                </div>
              ) : selected.estado === 'finalizado' ? (
                <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                  Sin comprobantes (corré la migración 008 si falta, o el viaje no emitió aún).
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="muted">
                {liveCount > 0
                  ? 'Seleccioná un viaje o mirá las posiciones GPS en el mapa.'
                  : 'Seleccioná un viaje. Cuando un cadete emita ubicación, aparece acá.'}
              </p>
              <MapView markers={markers} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
