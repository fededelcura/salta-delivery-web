import { useEffect, useState } from 'react';
import { suscripcionesApi } from '../lib/api';
import type { PlanesCatalogo } from '../types';
import { ErrorBox, Loading, Money, PageHeader } from '../components/ui';

export function SuscripcionesPage() {
  const [planes, setPlanes] = useState<PlanesCatalogo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    suscripcionesApi
      .planes()
      .then(setPlanes)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!planes) return <Loading />;

  return (
    <div className="page-enter">
      <PageHeader
        title="Suscripciones"
        subtitle="Planes cliente y cadete vigentes en la plataforma"
      />
      <div className="grid-2">
        <div className="panel panel-pad">
          <h3 style={{ marginTop: 0 }}>Clientes</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Mensual</th>
                <th>Descuento</th>
              </tr>
            </thead>
            <tbody>
              {planes.cliente.map((p) => (
                <tr key={p.plan}>
                  <td>
                    <strong>{p.plan}</strong>
                  </td>
                  <td>
                    <Money value={p.monto_mensual} />
                  </td>
                  <td>{p.descuento_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel panel-pad">
          <h3 style={{ marginTop: 0 }}>Cadetes</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Mensual</th>
                <th>Comisión</th>
              </tr>
            </thead>
            <tbody>
              {planes.cadete.map((p) => (
                <tr key={p.plan}>
                  <td>
                    <strong>{p.plan}</strong>
                  </td>
                  <td>
                    <Money value={p.monto_mensual} />
                  </td>
                  <td>{p.comision_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
