import { useCallback, useEffect, useState } from 'react';
import { clientePortalApi } from '../../lib/api';
import type { ViajePortal } from '../../types';
import { Badge, ErrorBox, Loading, Money, PageHeader } from '../../components/ui';

function toneEstado(e: string) {
  if (e === 'finalizado') return 'ok' as const;
  if (e === 'cancelado') return 'danger' as const;
  return 'warn' as const;
}

export function ClienteHistorialPage() {
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

  if (error && !viajes) return <ErrorBox message={error} />;
  if (!viajes) return <Loading />;

  return (
    <div className="page-enter">
      <PageHeader
        title="Historial"
        subtitle="Tus pedidos"
        actions={
          <button type="button" className="btn btn-ghost" onClick={load}>
            Actualizar
          </button>
        }
      />
      {error ? <ErrorBox message={error} /> : null}
      <div className="panel table-wrap">
        {viajes.length === 0 ? (
          <p className="muted panel-pad">Todavía no pediste envíos.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ruta</th>
                <th>Estado</th>
                <th>Tarifa</th>
              </tr>
            </thead>
            <tbody>
              {viajes.map((v) => (
                <tr key={v.id}>
                  <td className="muted">
                    {new Date(v.fecha_solicitud).toLocaleString('es-AR', {
                      timeZone: 'America/Argentina/Salta',
                    })}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.origen_direccion}</div>
                    <div className="muted">{v.destino_direccion}</div>
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
        )}
      </div>
    </div>
  );
}
