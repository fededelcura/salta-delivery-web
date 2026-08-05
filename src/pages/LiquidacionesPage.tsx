import { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import type { LiquidacionAdmin } from '../types';
import { Badge, ErrorBox, Loading, Money, PageHeader } from '../components/ui';

export function LiquidacionesPage() {
  const [estado, setEstado] = useState('pendiente');
  const [items, setItems] = useState<LiquidacionAdmin[] | null>(null);
  const [plazo, setPlazo] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    setError(null);
    void Promise.all([
      adminApi.liquidaciones(estado || undefined),
      adminApi.plazoLiquidacion(),
    ])
      .then(([list, p]) => {
        setItems(list);
        setPlazo(p.dias);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  async function transferir(id: string) {
    setBusy(id);
    try {
      await adminApi.transferirLiquidacion(id, 'Transferencia marcada desde panel');
      setMsg('Liquidación marcada como transferida');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function guardarPlazo() {
    try {
      const p = await adminApi.setPlazoLiquidacion(plazo);
      setPlazo(p.dias);
      setMsg(`Plazo actualizado a ${p.dias} días`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  if (error && !items) return <ErrorBox message={error} />;
  if (!items) return <Loading />;

  const pendientesMonto = items
    .filter((i) => i.estado === 'pendiente')
    .reduce((a, i) => a + i.monto_a_transferir, 0);
  const retenido = items.reduce((a, i) => a + i.comision_retenida, 0);

  return (
    <div className="page-enter">
      <PageHeader
        title="Liquidaciones a cadetes"
        subtitle="Cliente paga · plataforma retiene comisión · se transfiere al CBU del cadete"
      />

      {error ? <ErrorBox message={error} /> : null}
      {msg ? (
        <div className="error-banner" style={{ background: '#e5f6ec', color: '#1f7a4c' }}>
          {msg}
        </div>
      ) : null}

      <div className="toolbar">
        <div className="field">
          <label>Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="transferida">Transferida</option>
            <option value="retenida">Retenida</option>
          </select>
        </div>
        <div className="field">
          <label>Plazo (días)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              min={1}
              max={60}
              value={plazo}
              onChange={(e) => setPlazo(Number(e.target.value))}
              style={{ width: 80 }}
            />
            <button type="button" className="btn btn-ghost" onClick={() => void guardarPlazo()}>
              Guardar plazo
            </button>
          </div>
        </div>
      </div>

      <div className="kpi-spotlight" style={{ marginBottom: '1rem' }}>
        <div className="kpi">
          <div className="label">A transferir (lista)</div>
          <div className="value">
            <Money value={pendientesMonto} />
          </div>
        </div>
        <div className="kpi tone-ok">
          <div className="label">Comisión retenida (lista)</div>
          <div className="value">
            <Money value={retenido} />
          </div>
        </div>
      </div>

      <div className="panel table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Límite</th>
              <th>Cadete</th>
              <th>Cliente pagó</th>
              <th>Retenido</th>
              <th>A transferir</th>
              <th>Destino CBU</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id}>
                <td className="mono">{new Date(l.fecha_limite).toLocaleDateString('es-AR')}</td>
                <td>
                  <strong>{l.cadete_nombre}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Plazo {l.plazo_dias}d
                  </div>
                </td>
                <td>
                  <Money value={l.tarifa_cliente} />
                  <div className="muted" style={{ fontSize: 12 }}>
                    {l.metodo_pago_cliente} · {l.cliente_nombre}
                  </div>
                </td>
                <td>
                  <Money value={l.comision_retenida} />
                  <div className="muted" style={{ fontSize: 12 }}>
                    {l.comision_pct}%
                  </div>
                </td>
                <td>
                  <Money value={l.monto_a_transferir} />
                </td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {l.cbu_destino ? (
                    <>
                      <div>{l.banco_destino ?? '—'}</div>
                      <div>{l.cbu_destino}</div>
                      <div className="muted">{l.alias_destino ?? l.titular_destino}</div>
                    </>
                  ) : (
                    <span className="muted">Cadete sin CBU</span>
                  )}
                </td>
                <td>
                  <Badge
                    tone={
                      l.estado === 'transferida' ? 'ok' : l.estado === 'pendiente' ? 'warn' : 'neutral'
                    }
                  >
                    {l.estado}
                  </Badge>
                </td>
                <td>
                  {l.estado === 'pendiente' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy === l.id}
                      onClick={() => void transferir(l.id)}
                    >
                      Marcar transferida
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                  Sin liquidaciones. Se crean al finalizar un viaje (después de la migración 010).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
