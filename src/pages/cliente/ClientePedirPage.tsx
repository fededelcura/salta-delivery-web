import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientePortalApi } from '../../lib/api';
import { ErrorBox, Money, PageHeader } from '../../components/ui';

const LUGARES = [
  {
    id: 'caseros',
    label: 'Caseros 500, Centro',
    direccion: 'Caseros 500, Centro, Salta',
    lat: -24.7895,
    lng: -65.4108,
  },
  {
    id: 'espana',
    label: 'España 200, Centro',
    direccion: 'España 200, Centro, Salta',
    lat: -24.7821,
    lng: -65.4232,
  },
  {
    id: 'belgrano',
    label: 'Belgrano 800',
    direccion: 'Belgrano 800, Salta',
    lat: -24.7882,
    lng: -65.4165,
  },
  {
    id: 'sanmartin',
    label: 'San Martín 1200',
    direccion: 'San Martín 1200, Salta',
    lat: -24.795,
    lng: -65.412,
  },
] as const;

export function ClientePedirPage() {
  const navigate = useNavigate();
  const [origenId, setOrigenId] = useState<string>(LUGARES[0].id);
  const [destinoId, setDestinoId] = useState<string>(LUGARES[1].id);
  const [tipo, setTipo] = useState('delivery');
  const [pago, setPago] = useState('efectivo');
  const [preview, setPreview] = useState<{
    distancia_km: number;
    tiempo_estimado_min: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const origen = useMemo(() => LUGARES.find((l) => l.id === origenId)!, [origenId]);
  const destino = useMemo(() => LUGARES.find((l) => l.id === destinoId)!, [destinoId]);

  async function estimar() {
    setError(null);
    try {
      const r = await clientePortalApi.calcularTarifa(
        { lat: origen.lat, lng: origen.lng },
        { lat: destino.lat, lng: destino.lng },
      );
      const total =
        Number(r.detalle?.total ?? r.detalle?.tarifa_estimada ?? 0) ||
        Math.round(r.distancia_km * 350 + 500);
      setPreview({
        distancia_km: r.distancia_km,
        tiempo_estimado_min: r.tiempo_estimado_min,
        total,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo estimar');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (origenId === destinoId) {
      setError('Origen y destino deben ser distintos');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientePortalApi.solicitar({
        tipo_servicio: tipo,
        origen_direccion: origen.direccion,
        origen: { lat: origen.lat, lng: origen.lng },
        destino_direccion: destino.direccion,
        destino: { lat: destino.lat, lng: destino.lng },
        metodo_pago: pago,
      });
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo solicitar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-enter">
      <PageHeader title="Pedir envío" subtitle="Elegí puntos de Salta (MVP sin mapa)" />
      {error ? <ErrorBox message={error} /> : null}

      <form className="panel panel-pad" onSubmit={onSubmit}>
        <div className="stack" style={{ maxWidth: 480 }}>
          <div className="field">
            <label>Origen</label>
            <select value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
              {LUGARES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Destino</label>
            <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
              {LUGARES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="delivery">Delivery</option>
              <option value="mensajeria">Mensajería</option>
              <option value="envio_paquete">Paquete</option>
            </select>
          </div>
          <div className="field">
            <label>Pago</label>
            <select value={pago} onChange={(e) => setPago(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>

          {preview ? (
            <p className="muted">
              ~{preview.distancia_km.toFixed(1)} km · ~{preview.tiempo_estimado_min} min ·{' '}
              <Money value={preview.total} />
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => void estimar()}>
              Estimar tarifa
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Solicitando…' : 'Confirmar pedido'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
