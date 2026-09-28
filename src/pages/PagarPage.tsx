import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBox, Money, PageHeader } from '../components/ui';
import { pagoEnvioApi } from '../lib/api';
import type { PagoEnvioResumen } from '../types';

const ESTADO_VIAJE: Record<string, string> = {
  buscando_cadete: 'Buscando cadete',
  asignado: 'Cadete asignado',
  cadete_en_camino: 'Cadete en camino al negocio',
  cadete_llego: 'Cadete en el negocio',
  en_curso: 'Tu pedido está en camino',
  finalizado: 'Entregado',
  cancelado: 'Cancelado',
};

export function PagarPage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PagoEnvioResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pagoEnvioApi
      .resumen(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el pago'));
  }, [token]);

  async function pagar() {
    setBusy(true);
    setError(null);
    try {
      const { init_point } = await pagoEnvioApi.mercadopago(token);
      window.location.href = init_point;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el pago');
    } finally {
      setBusy(false);
    }
  }

  const pagado = data?.estado_pago === 'aprobado';
  const cancelado = data?.estado_viaje === 'cancelado';

  return (
    <div className="page-enter" style={{ maxWidth: 520, margin: '0 auto', padding: '1rem' }}>
      <PageHeader title="Pagar envío" subtitle="Salta Delivery" />
      {error ? <ErrorBox message={error} /> : null}
      {!data && !error ? <p className="muted">Cargando…</p> : null}
      {data ? (
        <div className="panel panel-pad stack">
          <p style={{ margin: 0 }}>
            Pedido de <strong>{data.negocio}</strong>
            {data.destinatario_nombre ? ` para ${data.destinatario_nombre}` : ''}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {data.destino_direccion}
          </p>
          <p style={{ margin: 0 }}>
            Estado: <strong>{ESTADO_VIAJE[data.estado_viaje] ?? data.estado_viaje}</strong>
          </p>
          <p style={{ margin: 0, fontSize: '1.4rem' }}>
            Envío: <strong><Money value={data.monto} /></strong>
          </p>
          {pagado ? (
            <p className="badge ok" style={{ margin: 0 }}>
              Envío pagado ✓
            </p>
          ) : cancelado ? (
            <p className="badge danger" style={{ margin: 0 }}>
              El envío fue cancelado
            </p>
          ) : data.pago_disponible ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void pagar()}
            >
              {busy ? 'Abriendo Mercado Pago…' : 'Pagar con Mercado Pago'}
            </button>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              El pago online todavía no está habilitado. Consultá con el negocio cómo abonar el envío.
            </p>
          )}
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            El cadete no cobra en la puerta: el envío se paga solo por este link.
          </p>
        </div>
      ) : null}
      <p style={{ marginTop: 16 }}>
        <Link to="/">Conocé Salta Delivery</Link>
      </p>
    </div>
  );
}
