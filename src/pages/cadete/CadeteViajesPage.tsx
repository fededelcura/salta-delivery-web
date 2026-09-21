import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { cadetePortalApi } from '../../lib/api';
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

const ACTIVOS = new Set(['asignado', 'cadete_en_camino', 'cadete_llego', 'en_curso']);

export function CadeteViajesPage() {
  const { session } = useAuth();
  const [disponibles, setDisponibles] = useState<ViajePortal[]>([]);
  const [mios, setMios] = useState<ViajePortal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      setDisponibles(disp);
      setMios(Array.isArray(hist) ? hist : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [session?.usuario.id]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(id);
  }, [load]);

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
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Actualizar
          </button>
        }
      />
      {error ? <ErrorBox message={error} /> : null}

      {activo ? (
        <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Viaje activo</h3>
          <p style={{ fontWeight: 600 }}>{activo.origen_direccion}</p>
          <p className="muted">{activo.destino_direccion}</p>
          <p>
            <Badge tone="warn">{activo.estado}</Badge> ·{' '}
            <Money value={activo.tarifa_final ?? activo.tarifa_estimada ?? 0} />
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

      <div className="panel panel-pad">
        <h3 style={{ marginTop: 0 }}>Disponibles</h3>
        {disponibles.length === 0 ? (
          <p className="muted">No hay viajes para tomar. Ponete online desde Estado.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Ruta</th>
                  <th>Tarifa</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {disponibles.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{v.origen_direccion}</div>
                      <div className="muted">{v.destino_direccion}</div>
                    </td>
                    <td>
                      <Money value={v.tarifa_final ?? v.tarifa_estimada ?? 0} />
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
