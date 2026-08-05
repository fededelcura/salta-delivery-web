import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../lib/api';
import { downloadPdfReport, formatMoneyPdf } from '../lib/pdf';
import type { Comprobante, ComprobantesListResponse } from '../types';
import { Badge, ErrorBox, Loading, Money, PageHeader } from '../components/ui';

const TIPOS = [
  { id: '', label: 'Todos' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'mensajeria', label: 'Mensajería' },
  { id: 'envio_paquete', label: 'Paquete' },
];

export function ComprobantesPage() {
  const [rol, setRol] = useState<'cliente' | 'cadete' | ''>('cliente');
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tipo, setTipo] = useState('');
  const [data, setData] = useState<ComprobantesListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPdf, setBusyPdf] = useState(false);

  function load(overrides?: { q?: string }) {
    setLoading(true);
    setError(null);
    void adminApi
      .comprobantes({
        rol: rol || undefined,
        q: (overrides?.q ?? q) || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        tipo_servicio: tipo || undefined,
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, desde, hasta, tipo]);

  async function exportPdf() {
    if (!data) return;
    setBusyPdf(true);
    try {
      downloadPdfReport({
        title: 'Listado de comprobantes',
        subtitle: `Filtros · rol=${rol || 'todos'} · tipo=${tipo || 'todos'} · ${desde || '…'} → ${hasta || '…'}`,
        summary: [
          { label: 'Viajes facturados', value: String(data.stats.cantidad) },
          { label: 'Tarifa', value: formatMoneyPdf(data.stats.tarifa_total) },
          { label: 'Comisión', value: formatMoneyPdf(data.stats.comision_total) },
          { label: 'Pago cadetes', value: formatMoneyPdf(data.stats.pago_cadetes) },
        ],
        columns: [
          { header: 'Nº', dataKey: 'numero' },
          { header: 'Fecha', dataKey: 'fecha' },
          { header: 'Para', dataKey: 'rol' },
          { header: 'Cliente', dataKey: 'cliente' },
          { header: 'Cadete', dataKey: 'cadete' },
          { header: 'Tipo', dataKey: 'tipo' },
          { header: 'Tarifa', dataKey: 'tarifa' },
          { header: 'Comisión', dataKey: 'comision' },
          { header: 'Monto', dataKey: 'monto' },
        ],
        rows: data.items.map((c) => ({
          numero: c.numero,
          fecha: new Date(c.fecha_emision).toLocaleString('es-AR'),
          rol: c.rol_destino,
          cliente: c.cliente_nombre ?? '',
          cadete: c.cadete_nombre ?? '',
          tipo: c.tipo_servicio,
          tarifa: formatMoneyPdf(c.tarifa_total),
          comision: `${c.comision_pct}% ${formatMoneyPdf(c.comision_monto)}`,
          monto: formatMoneyPdf(c.monto_usuario),
        })),
        filename: `salta-comprobantes-${new Date().toISOString().slice(0, 10)}.pdf`,
      });

      await adminApi.guardarReporte({
        tipo: 'comprobantes',
        titulo: `Comprobantes ${new Date().toISOString().slice(0, 10)}`,
        periodo_desde: desde || null,
        periodo_hasta: hasta || null,
        resumen: { ...data.stats, filtro_rol: rol, filtro_tipo: tipo },
        detalle: { items: data.items },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error PDF');
    } finally {
      setBusyPdf(false);
    }
  }

  if (error && !data) return <ErrorBox message={error} />;

  return (
    <div className="page-enter">
      <PageHeader
        title="Comprobantes"
        subtitle="Emitidos al finalizar cada viaje · SD-###### · cliente y cadete"
        actions={
          <button
            className="btn btn-primary"
            type="button"
            disabled={!data || busyPdf}
            onClick={() => void exportPdf()}
          >
            {busyPdf ? 'Generando…' : 'PDF + guardar'}
          </button>
        }
      />

      {error ? <ErrorBox message={error} /> : null}

      <div className="toolbar" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="field">
          <label htmlFor="rol">Destinatario</label>
          <select
            id="rol"
            value={rol}
            onChange={(e) => setRol(e.target.value as '' | 'cliente' | 'cadete')}
          >
            <option value="">Todos</option>
            <option value="cliente">Cliente</option>
            <option value="cadete">Cadete</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t.id || 'all'} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="desde">Desde</label>
          <input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 200 }}>
          <label htmlFor="q">Buscar</label>
          <input
            id="q"
            placeholder="Nº, cliente, cadete…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') load();
            }}
          />
        </div>
        <button className="btn btn-primary" type="button" style={{ alignSelf: 'end' }} onClick={() => load()}>
          Filtrar
        </button>
      </div>

      {data ? (
        <div className="kpi-spotlight" style={{ marginBottom: '1rem' }}>
          <div className="kpi">
            <div className="label">Viajes facturados</div>
            <div className="value">{data.stats.cantidad}</div>
          </div>
          <div className="kpi">
            <div className="label">Tarifa cobrada</div>
            <div className="value">
              <Money value={data.stats.tarifa_total} />
            </div>
          </div>
          <div className="kpi tone-ok">
            <div className="label">Comisión plataforma</div>
            <div className="value">
              <Money value={data.stats.comision_total} />
            </div>
          </div>
          <div className="kpi">
            <div className="label">Pago a cadetes</div>
            <div className="value">
              <Money value={data.stats.pago_cadetes} />
            </div>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <Loading />
      ) : (
        <div className="panel table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Fecha / hora</th>
                <th>Para</th>
                <th>Cliente</th>
                <th>Cadete</th>
                <th>Tipo</th>
                <th>Tarifa</th>
                <th>Comisión</th>
                <th>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((c: Comprobante) => (
                <tr key={c.id}>
                  <td className="mono">{c.numero}</td>
                  <td className="mono">
                    {new Date(c.fecha_emision).toLocaleString('es-AR')}
                  </td>
                  <td>
                    <Badge tone={c.rol_destino === 'cliente' ? 'brand' : 'ok'}>
                      {c.rol_destino}
                    </Badge>
                  </td>
                  <td>{c.cliente_nombre ?? '—'}</td>
                  <td>{c.cadete_nombre ?? '—'}</td>
                  <td>{c.tipo_servicio}</td>
                  <td>
                    <Money value={c.tarifa_total} />
                  </td>
                  <td>
                    {c.comision_pct}% · <Money value={c.comision_monto} />
                  </td>
                  <td>
                    <Money value={c.monto_usuario} />
                  </td>
                  <td>
                    <Link className="text-link" to="/panel/viajes">
                      Viaje
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && (data?.items.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    No hay comprobantes con estos filtros. Se generan al finalizar un viaje.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
