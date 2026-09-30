import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { cadetePortalApi, getToken } from '../../lib/api';
import { connectSocket, type ViajeNuevoEvent } from '../../lib/socket';
import {
  activarPush,
  avisarViajeNuevo,
  pedirPermiso,
  permisoNotificaciones,
  type EstadoPush,
} from '../../lib/avisos';
import type { ViajePortal } from '../../types';
import { Badge, ErrorBox, Loading, Money, PageHeader } from '../../components/ui';

const NEXT: Record<string, 'cadete_en_camino' | 'cadete_llego' | 'en_curso' | 'finalizado' | null> =
  {
    asignado: 'cadete_en_camino',
    cadete_en_camino: 'cadete_llego',
    cadete_llego: 'en_curso',
    en_curso: 'finalizado',
    finalizado: null,
  };

const LABEL: Record<string, string> = {
  cadete_en_camino: 'Voy en camino',
  cadete_llego: 'Llegué al origen',
  en_curso: 'Iniciar viaje',
  finalizado: 'Finalizar entrega',
};

const ESTADO_LABEL: Record<string, string> = {
  asignado: 'Asignado',
  cadete_en_camino: 'En camino al origen',
  cadete_llego: 'En el origen',
  en_curso: 'En viaje',
  finalizado: 'Finalizado',
};

const ACTIVOS = new Set(['asignado', 'cadete_en_camino', 'cadete_llego', 'en_curso']);

const PUSH_TEXTO: Record<EstadoPush, string> = {
  activo: 'Te avisamos aunque cierres la app.',
  'ios-sin-instalar':
    'En iPhone, para recibir avisos con la app cerrada, instalala: Compartir → "Agregar a inicio" (iOS 16.4 o superior). Mientras tanto, dejá esta pantalla abierta.',
  'no-soportado':
    'Este navegador no recibe avisos con la app cerrada: dejá esta pantalla abierta.',
  bloqueado:
    'Las notificaciones están bloqueadas: habilitalas en los ajustes del sitio para recibir avisos con la app cerrada.',
  'sin-servidor': 'Los avisos con la app cerrada no están disponibles por ahora: dejá esta pantalla abierta.',
  inactivo: 'Dejá esta pantalla abierta para escuchar los avisos.',
};

export function CadeteViajesPage() {
  const { session } = useAuth();
  const [disponibles, setDisponibles] = useState<ViajePortal[]>([]);
  const [mios, setMios] = useState<ViajePortal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avisosActivos, setAvisosActivos] = useState(false);
  const [estadoPush, setEstadoPush] = useState<EstadoPush>('inactivo');
  /** Ids ya avisados (socket o polling) para no sonar dos veces por el mismo pedido. */
  const avisadosRef = useRef<Set<string>>(new Set());
  const primeraCargaRef = useRef(true);

  const avisar = useCallback((id: string, origen: string, tarifa: number) => {
    if (avisadosRef.current.has(id)) return;
    avisadosRef.current.add(id);
    avisarViajeNuevo(origen, tarifa, id);
  }, []);

  const suscribirPush = useCallback(async () => {
    try {
      setEstadoPush(await activarPush());
    } catch {
      setEstadoPush('sin-servidor');
    }
  }, []);

  useEffect(() => {
    if (permisoNotificaciones() === 'granted') void suscribirPush();
  }, [session?.usuario.id, suscribirPush]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [disp, hist] = await Promise.all([
        cadetePortalApi.viajesDisponibles(),
        session?.usuario.id
          ? cadetePortalApi.misViajes(session.usuario.id)
          : Promise.resolve([] as ViajePortal[]),
      ]);
      if (primeraCargaRef.current) {
        disp.forEach((v) => avisadosRef.current.add(v.id));
        primeraCargaRef.current = false;
      } else {
        disp.forEach((v) =>
          avisar(v.id, v.origen_direccion, v.tarifa_final ?? v.tarifa_estimada ?? 0),
        );
      }
      setDisponibles(disp);
      setMios(Array.isArray(hist) ? hist : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [session?.usuario.id, avisar]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const socket = connectSocket(token);
    socket.on('viaje:nuevo', (ev: ViajeNuevoEvent) => {
      avisar(ev.viaje_id, ev.origen_direccion, ev.tarifa);
      void loadRef.current();
    });
    return () => {
      socket.disconnect();
    };
  }, [session?.usuario.id, avisar]);

  async function activarAvisos() {
    await pedirPermiso();
    setAvisosActivos(true);
    await suscribirPush();
  }

  const activo = mios.find((v) => ACTIVOS.has(v.estado));

  async function aceptar(id: string) {
    setBusy(id);
    try {
      await cadetePortalApi.aceptar(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aceptar');
    } finally {
      setBusy(null);
    }
  }

  async function rechazar(id: string) {
    setBusy(id);
    try {
      await cadetePortalApi.rechazar(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo rechazar');
    } finally {
      setBusy(null);
    }
  }

  async function avanzar(v: ViajePortal) {
    const next = NEXT[v.estado];
    if (!next) return;
    setBusy(v.id);
    try {
      await cadetePortalApi.estadoViaje(v.id, next);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setBusy(null);
    }
  }

  if (loading && !mios.length && !disponibles.length) {
    return error ? <ErrorBox message={error} /> : <Loading />;
  }

  return (
    <div className="page-enter">
      <PageHeader
        title="Viajes"
        subtitle="Disponibles y viaje activo"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!avisosActivos && estadoPush !== 'activo' ? (
              <button type="button" className="btn btn-primary" onClick={() => void activarAvisos()}>
                Activar avisos
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => void load()}>
              Actualizar
            </button>
          </div>
        }
      />
      {error ? <ErrorBox message={error} /> : null}
      {avisosActivos || estadoPush === 'activo' ? (
        <p className="muted" style={{ margin: '0 0 12px' }}>
          Avisos activos: suena y vibra cuando entra un pedido cerca. {PUSH_TEXTO[estadoPush]}
        </p>
      ) : null}

      {activo ? (
        <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Viaje activo</h3>
          <p style={{ fontWeight: 600 }}>{activo.origen_direccion}</p>
          <p className="muted">{activo.destino_direccion}</p>
          <p>
            <Badge tone="warn">{ESTADO_LABEL[activo.estado] ?? activo.estado}</Badge> ·{' '}
            <Money value={activo.tarifa_final ?? activo.tarifa_estimada ?? 0} />
          </p>
          {activo.destinatario_nombre ? (
            <p style={{ margin: '0 0 8px' }}>
              Entregar a <strong>{activo.destinatario_nombre}</strong>
              {activo.destinatario_telefono ? (
                <>
                  {' · '}
                  <a href={`tel:${activo.destinatario_telefono}`}>{activo.destinatario_telefono}</a>
                </>
              ) : null}
            </p>
          ) : null}
          <p style={{ margin: '0 0 12px' }}>
            {activo.metodo_pago === 'efectivo' ? (
              <Badge tone="warn">Cobrar en efectivo</Badge>
            ) : (
              <Badge tone="ok">No cobrar: pagado por la app</Badge>
            )}
          </p>
          {NEXT[activo.estado] ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy === activo.id}
              onClick={() => void avanzar(activo)}
            >
              {LABEL[NEXT[activo.estado]!] ?? 'Avanzar'}
            </button>
          ) : null}
        </div>
      ) : null}

      <h3 style={{ margin: '0 0 8px' }}>Disponibles</h3>
      {disponibles.length === 0 ? (
        <div className="panel panel-pad">
          <p className="muted" style={{ margin: 0 }}>
            No hay viajes cerca tuyo. Ponete online desde Estado y activá la ubicación: solo ves
            pedidos dentro de tu zona.
          </p>
        </div>
      ) : (
        <div className="oferta-lista">
          {disponibles.map((v) => (
            <div key={v.id} className="panel panel-pad oferta-card">
              <div className="oferta-top">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{v.origen_direccion}</div>
                  <div className="muted">→ {v.destino_direccion}</div>
                </div>
                <div className="oferta-tarifa">
                  <Money value={v.tarifa_final ?? v.tarifa_estimada ?? 0} />
                </div>
              </div>
              <div className="oferta-meta">
                {v.distancia_al_origen_km != null ? (
                  <span>A {v.distancia_al_origen_km.toFixed(1)} km de vos</span>
                ) : null}
                {v.metodo_pago === 'efectivo' ? (
                  <Badge tone="warn">Cobrar en efectivo</Badge>
                ) : (
                  <Badge tone="ok">Pagado por la app</Badge>
                )}
              </div>
              <div className="oferta-acciones">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy === v.id}
                  onClick={() => void aceptar(v.id)}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy === v.id}
                  onClick={() => void rechazar(v.id)}
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
