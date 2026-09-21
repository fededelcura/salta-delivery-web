import { useEffect, useState } from 'react';
import { cadetePortalApi } from '../../lib/api';
import type { GananciasPortal } from '../../types';
import { ErrorBox, Loading, Money, PageHeader } from '../../components/ui';

export function CadeteGananciasPage() {
  const [data, setData] = useState<GananciasPortal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cadetePortalApi
      .ganancias()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const ganado = Number(data.total_ganado ?? data.ganado ?? 0);
  const viajes = Number(data.viajes_finalizados ?? data.viajes ?? 0);

  return (
    <div className="page-enter">
      <PageHeader title="Ganancias" subtitle="Resumen de tu actividad" />
      {error ? <ErrorBox message={error} /> : null}
      <div className="grid-2">
        <div className="panel panel-pad">
          <div className="muted">Total ganado</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>
            <Money value={ganado} />
          </div>
        </div>
        <div className="panel panel-pad">
          <div className="muted">Viajes finalizados</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{viajes}</div>
        </div>
      </div>
    </div>
  );
}
