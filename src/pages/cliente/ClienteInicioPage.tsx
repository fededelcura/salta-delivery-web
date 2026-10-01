import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientePortalApi } from '../../lib/api';
import type { ViajePortal } from '../../types';
import { Badge, ErrorBox, Loading, Money, PageHeader } from '../../components/ui';

const ACTIVOS = new Set([
  'solicitado',
  'buscando_cadete',
  'asignado',
  'cadete_en_camino',
  'cadete_llego',
  'en_curso',
]);

const VENCIDOS_VISIBLES_MS = 12 * 60 * 60 * 1000;

function toneEstado(e: string) {
  if (e === 'finalizado') return 'ok' as const;
  if (e === 'cancelado') return 'danger' as const;
  return 'warn' as const;
}

export function ClienteInicioPage() {
  const [viajes, setViajes] = useState<ViajePortal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    clientePortalApi
      .viajes()
      .then(setViajes)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hayActivos = viajes?.some((v) => ACTIVOS.has(v.estado)) ?? false;
  useEffect(() => {
    if (!hayActivos) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [hayActivos, load]);

  if (error && !viajes) return <ErrorBox message={error} />;
  if (!viajes) return <Loading />;

  const activos = viajes.filter((v) => ACTIVOS.has(v.estado));
  const vencidos = viajes.filter(
    (v) =>
      v.estado === 'cancelado' &&
      v.motivo_cancelacion?.startsWith('Sin cadete disponible') &&
      Date.now() - new Date(v.fecha_solicitud).getTime() < VENCIDOS_VISIBLES_MS,
  );

  return (
    <div className="page-enter">
      <PageHeader
        title="Hola"
        subtitle="Pedí un envío o seguí tus viajes activos"
        actions={
          <Link className="btn btn-primary" to="/app/pedir">
            Pedir envío
          </Link>
        }
      />
      {error ? <ErrorBox message={error} /> : null}

      {vencidos.map((v) => (
        <div key={v.id} className="panel panel-pad avisos-cartel" style={{ marginBottom: '1rem' }}>
          <strong>Tu pedido se canceló: no encontramos cadete en 30 minutos.</strong>
          <div className="muted" style={{ marginTop: 4 }}>
            {v.origen_direccion} → {v.destino_direccion}
          </div>
          <Link className="btn btn-primary" to="/app/pedir" style={{ marginTop: 8 }}>
            Volver a pedir
          </Link>
        </div>
      ))}

      <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Viajes activos</h3>
        {activos.length === 0 ? (
          <p className="muted">No tenés viajes en curso.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Origen → Destino</th>
                  <th>Estado</th>
                  <th>Tarifa</th>
                </tr>
              </thead>
              <tbody>
                {activos.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{v.origen_direccion}</div>
                      <div className="muted">{v.destino_direccion}</div>
                      {v.estado === 'buscando_cadete' || v.estado === 'solicitado' ? (
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                          Buscando cadete… Un operador ya fue notificado.
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={toneEstado(v.estado)}>{v.estado}</Badge>
                    </td>
                    <td>
                      <Money value={v.tarifa_final ?? v.tarifa_estimada ?? 0} />
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
