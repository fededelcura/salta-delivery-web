import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { adminApi } from '../lib/api';
import { downloadPdfReport, formatMoneyPdf } from '../lib/pdf';
import type { CadeteAdmin, ClienteAdmin, ReporteGuardado, ReportesData } from '../types';
import { ErrorBox, Loading, Money, PageHeader } from '../components/ui';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  BarElement,
  Tooltip,
  Legend,
);

const TIPOS = [
  { id: 'delivery', label: 'Delivery' },
  { id: 'mensajeria', label: 'Mensajería' },
  { id: 'envio_paquete', label: 'Paquete' },
] as const;

const METODOS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'mercadopago', label: 'Mercado Pago' },
  { id: 'billetera', label: 'Billetera' },
] as const;

const METRICAS = [
  { id: 'viajes', label: 'Viajes' },
  { id: 'ingresos', label: 'Ingresos $' },
  { id: 'egresos', label: 'Egresos $' },
  { id: 'comisiones', label: 'Comisión $' },
] as const;

const BLOQUES = [
  { id: 'financiero', label: 'Evolución diaria' },
  { id: 'operativos', label: 'Estados' },
  { id: 'por_tipo', label: 'Por tipo de pedido' },
  { id: 'por_metodo', label: 'Por método de pago' },
  { id: 'por_zona', label: 'Por zona' },
  { id: 'por_franja', label: 'Por franja horaria' },
] as const;

const FRANJAS = [
  { id: 'valle', label: 'Valle' },
  { id: 'pico_manana', label: 'Pico mañana' },
  { id: 'pico_mediodia', label: 'Pico mediodía' },
  { id: 'pico_tarde', label: 'Pico tarde' },
  { id: 'noche', label: 'Noche' },
  { id: 'madrugada', label: 'Madrugada' },
] as const;

type IdOf<T extends readonly { id: string }[]> = T[number]['id'];

function toggleIn<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`filter-chip${active ? ' on' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

export function ReportesPage() {
  const [dias, setDias] = useState(30);
  const [tipos, setTipos] = useState<IdOf<typeof TIPOS>[]>([
    'delivery',
    'mensajeria',
    'envio_paquete',
  ]);
  const [metodos, setMetodos] = useState<IdOf<typeof METODOS>[]>([
    'efectivo',
    'tarjeta',
    'mercadopago',
    'billetera',
  ]);
  const [metricas, setMetricas] = useState<IdOf<typeof METRICAS>[]>([
    'viajes',
    'ingresos',
    'egresos',
    'comisiones',
  ]);
  const [bloques, setBloques] = useState<IdOf<typeof BLOQUES>[]>([
    'financiero',
    'operativos',
    'por_tipo',
    'por_metodo',
    'por_zona',
    'por_franja',
  ]);
  const [sujetoTipo, setSujetoTipo] = useState<'todos' | 'cadete' | 'cliente'>('todos');
  const [cadeteId, setCadeteId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [zonas, setZonas] = useState<string[]>([]);
  const [franjas, setFranjas] = useState<IdOf<typeof FRANJAS>[]>(FRANJAS.map((f) => f.id));
  const [cadetes, setCadetes] = useState<CadeteAdmin[]>([]);
  const [clientes, setClientes] = useState<ClienteAdmin[]>([]);
  const [data, setData] = useState<ReportesData | null>(null);
  const [guardados, setGuardados] = useState<ReporteGuardado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function refresh() {
    if (tipos.length === 0 || metodos.length === 0) {
      setError('Seleccioná al menos un tipo de pedido y un método de pago');
      return;
    }
    if (metricas.length === 0 || bloques.length === 0) {
      setError('Seleccioná al menos una métrica y un bloque de estadísticas');
      return;
    }
    if (sujetoTipo === 'cadete' && !cadeteId) {
      setError('Elegí el cadete al que le querés hacer la estadística');
      return;
    }
    if (sujetoTipo === 'cliente' && !clienteId) {
      setError('Elegí el cliente al que le querés hacer la estadística');
      return;
    }
    if (franjas.length === 0) {
      setError('Seleccioná al menos una franja horaria');
      return;
    }
    setError(null);
    void Promise.all([
      adminApi.reportes({
        dias,
        tipos,
        metodos,
        zonas: zonas.length ? zonas : undefined,
        franjas,
        cadete_id: sujetoTipo === 'cadete' ? cadeteId : undefined,
        cliente_id: sujetoTipo === 'cliente' ? clienteId : undefined,
      }),
      adminApi.reportesGuardados(),
      adminApi.cadetes(),
      adminApi.clientes(),
    ])
      .then(([r, g, cad, cli]) => {
        setData(r);
        setGuardados(g);
        setCadetes(cad);
        setClientes(cli);
        if (!zonas.length && r.catalogo?.zonas?.length) {
          /* catalog available for chips; empty = all zones */
        }
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dias,
    tipos.join(','),
    metodos.join(','),
    sujetoTipo,
    cadeteId,
    clienteId,
    zonas.join(','),
    franjas.join(','),
  ]);

  const totales = useMemo(() => {
    if (!data) return { viajes: 0, ingresos: 0, comisiones: 0, egresos: 0 };
    if (data.totales) return data.totales;
    return data.financieros.reduce(
      (a, x) => ({
        viajes: a.viajes + (x.viajes ?? 0),
        ingresos: a.ingresos + x.ingresos,
        comisiones: a.comisiones + x.comisiones,
        egresos: a.egresos + (x.egresos ?? 0),
      }),
      { viajes: 0, ingresos: 0, comisiones: 0, egresos: 0 },
    );
  }, [data]);

  async function exportarYGuardar() {
    if (!data) return;
    setBusy(true);
    setMsg(null);
    try {
      const hasta = new Date().toISOString().slice(0, 10);
      const desdeDate = new Date();
      desdeDate.setDate(desdeDate.getDate() - (data.periodo_dias ?? dias));
      const desde = desdeDate.toISOString().slice(0, 10);

      const resumen = {
        ...totales,
        periodo_dias: data.periodo_dias ?? dias,
        tipos,
        metodos,
        metricas,
        bloques,
        sujeto: data.sujeto,
        zonas,
        franjas,
      };

      const sujetoLabel =
        data.sujeto?.tipo === 'todos'
          ? 'Toda la plataforma'
          : `${data.sujeto?.tipo}: ${data.sujeto?.nombre ?? '—'}`;

      const columns = [
        { header: 'Día', dataKey: 'dia' },
        ...(metricas.includes('viajes') ? [{ header: 'Viajes', dataKey: 'viajes' }] : []),
        ...(metricas.includes('ingresos')
          ? [{ header: 'Ingresos', dataKey: 'ingresos' }]
          : []),
        ...(metricas.includes('egresos') ? [{ header: 'Egresos', dataKey: 'egresos' }] : []),
        ...(metricas.includes('comisiones')
          ? [{ header: 'Comisión', dataKey: 'comisiones' }]
          : []),
      ];

      const sections = [
        {
          title: 'Evolución diaria',
          columns,
          rows: data.financieros.map((x) => ({
            dia: x.dia,
            viajes: x.viajes ?? 0,
            ingresos: formatMoneyPdf(x.ingresos),
            egresos: formatMoneyPdf(x.egresos ?? 0),
            comisiones: formatMoneyPdf(x.comisiones),
          })),
        },
        ...(bloques.includes('por_zona')
          ? [
              {
                title: 'Por zona',
                columns: [
                  { header: 'Zona', dataKey: 'zona' },
                  { header: 'Viajes', dataKey: 'viajes' },
                  { header: 'Ingresos', dataKey: 'ingresos' },
                ],
                rows: (data.por_zona ?? []).map((z) => ({
                  zona: z.zona,
                  viajes: z.viajes,
                  ingresos: formatMoneyPdf(z.ingresos),
                })),
              },
            ]
          : []),
        ...(bloques.includes('por_franja')
          ? [
              {
                title: 'Por franja horaria',
                columns: [
                  { header: 'Franja', dataKey: 'franja' },
                  { header: 'Viajes', dataKey: 'viajes' },
                  { header: 'Ingresos', dataKey: 'ingresos' },
                ],
                rows: (data.por_franja ?? []).map((f) => ({
                  franja: f.franja,
                  viajes: f.viajes,
                  ingresos: formatMoneyPdf(f.ingresos),
                })),
              },
            ]
          : []),
      ];

      downloadPdfReport({
        title: `Estadísticas (${dias} días)`,
        subtitle: `${sujetoLabel} · Tipos: ${tipos.join(', ')} · Métodos: ${metodos.join(', ')} · ${desde} → ${hasta}`,
        summary: [
          { label: 'Sujeto', value: sujetoLabel },
          ...(metricas.includes('viajes')
            ? [{ label: 'Viajes', value: String(totales.viajes) }]
            : []),
          ...(metricas.includes('ingresos')
            ? [{ label: 'Ingresos', value: formatMoneyPdf(totales.ingresos) }]
            : []),
          ...(metricas.includes('egresos')
            ? [{ label: 'Egresos', value: formatMoneyPdf(totales.egresos) }]
            : []),
          ...(metricas.includes('comisiones')
            ? [{ label: 'Comisión', value: formatMoneyPdf(totales.comisiones) }]
            : []),
        ],
        sections,
        filename: `salta-estadisticas-${hasta}.pdf`,
      });

      await adminApi.guardarReporte({
        tipo: 'estadisticas',
        titulo: `Estadísticas ${dias}d · ${sujetoLabel}`,
        periodo_desde: desde,
        periodo_hasta: hasta,
        resumen,
        detalle: {
          financieros: bloques.includes('financiero') ? data.financieros : [],
          operativos: bloques.includes('operativos') ? data.operativos : [],
          por_tipo: bloques.includes('por_tipo') ? (data.por_tipo ?? []) : [],
          por_metodo: bloques.includes('por_metodo') ? (data.por_metodo ?? []) : [],
          por_zona: bloques.includes('por_zona') ? (data.por_zona ?? []) : [],
          por_franja: bloques.includes('por_franja') ? (data.por_franja ?? []) : [],
          filtros: { tipos, metodos, metricas, bloques, zonas, franjas, sujeto: data.sujeto },
        },
      });
      setMsg(`PDF descargado y reporte guardado — ${sujetoLabel}`);
      setGuardados(await adminApi.reportesGuardados());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setBusy(false);
    }
  }

  async function reexportar(id: string) {
    try {
      const full = await adminApi.reporteGuardado(id);
      const fin = (full.detalle?.financieros as ReportesData['financieros']) ?? [];
      const res = full.resumen as {
        viajes?: number;
        ingresos?: number;
        egresos?: number;
        comisiones?: number;
        metricas?: string[];
      };
      const mets = res.metricas ?? ['viajes', 'ingresos', 'egresos', 'comisiones'];
      downloadPdfReport({
        title: full.titulo,
        subtitle: `Archivado ${new Date(full.fecha_creacion).toLocaleString('es-AR')}`,
        summary: [
          ...(mets.includes('viajes') ? [{ label: 'Viajes', value: String(res.viajes ?? '—') }] : []),
          ...(mets.includes('ingresos')
            ? [{ label: 'Ingresos', value: formatMoneyPdf(Number(res.ingresos ?? 0)) }]
            : []),
          ...(mets.includes('egresos')
            ? [{ label: 'Egresos', value: formatMoneyPdf(Number(res.egresos ?? 0)) }]
            : []),
          ...(mets.includes('comisiones')
            ? [{ label: 'Comisión', value: formatMoneyPdf(Number(res.comisiones ?? 0)) }]
            : []),
        ],
        columns: [
          { header: 'Día', dataKey: 'dia' },
          ...(mets.includes('viajes') ? [{ header: 'Viajes', dataKey: 'viajes' }] : []),
          ...(mets.includes('ingresos') ? [{ header: 'Ingresos', dataKey: 'ingresos' }] : []),
          ...(mets.includes('egresos') ? [{ header: 'Egresos', dataKey: 'egresos' }] : []),
          ...(mets.includes('comisiones')
            ? [{ header: 'Comisión', dataKey: 'comisiones' }]
            : []),
        ],
        rows: fin.map((x) => ({
          dia: x.dia,
          viajes: x.viajes ?? 0,
          ingresos: formatMoneyPdf(x.ingresos),
          egresos: formatMoneyPdf(x.egresos ?? 0),
          comisiones: formatMoneyPdf(x.comisiones),
        })),
        filename: `salta-reporte-${full.id.slice(0, 8)}.pdf`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const lineDatasets = [
    metricas.includes('ingresos')
      ? {
          label: 'Ingresos $',
          data: data.financieros.map((x) => x.ingresos),
          borderColor: '#1a4f8c',
          backgroundColor: 'rgba(26,79,140,0.12)',
          tension: 0.3,
          fill: true,
        }
      : null,
    metricas.includes('egresos')
      ? {
          label: 'Egresos $',
          data: data.financieros.map((x) => x.egresos ?? 0),
          borderColor: '#b42318',
          backgroundColor: 'rgba(180,35,24,0.08)',
          tension: 0.3,
          fill: true,
        }
      : null,
    metricas.includes('comisiones')
      ? {
          label: 'Comisión $',
          data: data.financieros.map((x) => x.comisiones),
          borderColor: '#2f7d4f',
          backgroundColor: 'rgba(47,125,79,0.12)',
          tension: 0.3,
          fill: true,
        }
      : null,
    metricas.includes('viajes')
      ? {
          label: 'Viajes',
          data: data.financieros.map((x) => x.viajes ?? 0),
          borderColor: '#c45c26',
          backgroundColor: 'rgba(196,92,38,0.1)',
          tension: 0.3,
          fill: false,
          yAxisID: 'y1',
        }
      : null,
  ].filter(Boolean);

  const line = {
    labels: data.financieros.map((x) => x.dia.slice(5)),
    datasets: lineDatasets as NonNullable<(typeof lineDatasets)[number]>[],
  };

  const bar = {
    labels: data.operativos.map((x) => x.estado),
    datasets: [
      {
        label: 'Cantidad',
        data: data.operativos.map((x) => x.cantidad),
        backgroundColor: '#0c6b6b',
        borderRadius: 6,
      },
    ],
  };

  const barTipo = {
    labels: (data.por_tipo ?? []).map((x) => x.tipo_servicio),
    datasets: [
      {
        label: 'Viajes',
        data: (data.por_tipo ?? []).map((x) => x.viajes),
        backgroundColor: '#1a4f8c',
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="page-enter">
      <PageHeader
        title="Reportes y estadísticas"
        subtitle="Elegí a quién (cadete/cliente), zona, franja horaria y el resto de filtros · el PDF respeta la selección"
        actions={
          <div className="quick-actions">
            <select
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              style={{ minWidth: 120 }}
            >
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
              <option value={365}>1 año</option>
            </select>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy}
              onClick={() => void exportarYGuardar()}
            >
              {busy ? 'Generando…' : 'PDF + guardar'}
            </button>
          </div>
        }
      />

      {error ? <ErrorBox message={error} /> : null}
      {msg ? (
        <div className="error-banner" style={{ background: '#e5f6ec', color: '#1f7a4c' }}>
          {msg}
        </div>
      ) : null}

      <div className="panel panel-pad filters-panel">
        <div className="filter-group">
          <div className="filter-label">¿A quién le hago la estadística?</div>
          <div className="filter-chips">
            <Chip
              label="Toda la plataforma"
              active={sujetoTipo === 'todos'}
              onClick={() => {
                setSujetoTipo('todos');
                setCadeteId('');
                setClienteId('');
              }}
            />
            <Chip
              label="Un cadete"
              active={sujetoTipo === 'cadete'}
              onClick={() => {
                setSujetoTipo('cadete');
                setClienteId('');
              }}
            />
            <Chip
              label="Un cliente"
              active={sujetoTipo === 'cliente'}
              onClick={() => {
                setSujetoTipo('cliente');
                setCadeteId('');
              }}
            />
          </div>
          {sujetoTipo === 'cadete' ? (
            <div className="field" style={{ marginTop: 10, maxWidth: 420 }}>
              <label htmlFor="cadete-sel">Cadete</label>
              <select
                id="cadete-sel"
                value={cadeteId}
                onChange={(e) => setCadeteId(e.target.value)}
              >
                <option value="">Seleccioná un cadete…</option>
                {cadetes.map((c) => (
                  <option key={c.usuario_id} value={c.usuario_id}>
                    {c.nombre ?? c.dni} · {c.disponibilidad}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {sujetoTipo === 'cliente' ? (
            <div className="field" style={{ marginTop: 10, maxWidth: 420 }}>
              <label htmlFor="cliente-sel">Cliente</label>
              <select
                id="cliente-sel"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              >
                <option value="">Seleccioná un cliente…</option>
                {clientes.map((c) => (
                  <option key={c.usuario_id} value={c.usuario_id}>
                    {c.nombre ?? c.email}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="filter-group">
          <div className="filter-label">Tipo de pedido</div>
          <div className="filter-chips">
            {TIPOS.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                active={tipos.includes(t.id)}
                onClick={() => setTipos((prev) => toggleIn(prev, t.id))}
              />
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-label">Método de pago</div>
          <div className="filter-chips">
            {METODOS.map((m) => (
              <Chip
                key={m.id}
                label={m.label}
                active={metodos.includes(m.id)}
                onClick={() => setMetodos((prev) => toggleIn(prev, m.id))}
              />
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-label">Franja horaria (tarifa dinámica)</div>
          <div className="filter-chips">
            {FRANJAS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                active={franjas.includes(f.id)}
                onClick={() => setFranjas((prev) => toggleIn(prev, f.id))}
              />
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-label">Zona (vacío = todas)</div>
          <div className="filter-chips">
            {(data.catalogo?.zonas ?? []).map((z) => (
              <Chip
                key={z.h3_index}
                label={z.nombre}
                active={zonas.includes(z.nombre) || zonas.includes(z.h3_index)}
                onClick={() =>
                  setZonas((prev) => {
                    const key = z.nombre;
                    return toggleIn(prev, key);
                  })
                }
              />
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-label">Métricas</div>
          <div className="filter-chips">
            {METRICAS.map((m) => (
              <Chip
                key={m.id}
                label={m.label}
                active={metricas.includes(m.id)}
                onClick={() => setMetricas((prev) => toggleIn(prev, m.id))}
              />
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-label">Bloques a mostrar / exportar</div>
          <div className="filter-chips">
            {BLOQUES.map((b) => (
              <Chip
                key={b.id}
                label={b.label}
                active={bloques.includes(b.id)}
                onClick={() => setBloques((prev) => toggleIn(prev, b.id))}
              />
            ))}
          </div>
        </div>
      </div>

      {data.sujeto && data.sujeto.tipo !== 'todos' ? (
        <div
          className="error-banner"
          style={{ background: '#e8f4f4', color: '#084f4f', marginBottom: '1rem' }}
        >
          Estadística de: <strong>{data.sujeto.nombre}</strong> ({data.sujeto.tipo})
        </div>
      ) : null}

      <div className="kpi-spotlight">
        {metricas.includes('viajes') ? (
          <div className="kpi">
            <div className="label">Viajes</div>
            <div className="value">{totales.viajes}</div>
          </div>
        ) : null}
        {metricas.includes('ingresos') ? (
          <div className="kpi">
            <div className="label">Ingresos (tarifas)</div>
            <div className="value">
              <Money value={totales.ingresos} />
            </div>
          </div>
        ) : null}
        {metricas.includes('egresos') ? (
          <div className="kpi">
            <div className="label">Egresos (cadetes)</div>
            <div className="value">
              <Money value={totales.egresos} />
            </div>
          </div>
        ) : null}
        {metricas.includes('comisiones') ? (
          <div className="kpi tone-ok">
            <div className="label">Comisión plataforma</div>
            <div className="value">
              <Money value={totales.comisiones} />
            </div>
          </div>
        ) : null}
      </div>

      {bloques.includes('financiero') ? (
        <div className="panel panel-pad" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Evolución diaria</h3>
          {line.datasets.length ? (
            <Line
              data={line}
              options={{
                plugins: { legend: { position: 'bottom' } },
                scales: metricas.includes('viajes')
                  ? {
                      y: { position: 'left' },
                      y1: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                      },
                    }
                  : undefined,
              }}
            />
          ) : (
            <p className="muted">Activá al menos una métrica numérica</p>
          )}
        </div>
      ) : null}

      <div className="grid-2" style={{ marginTop: '1rem' }}>
        {bloques.includes('operativos') ? (
          <div className="panel panel-pad">
            <h3 style={{ marginTop: 0 }}>Estados (período)</h3>
            <Bar data={bar} options={{ plugins: { legend: { display: false } } }} />
          </div>
        ) : null}
        {bloques.includes('por_tipo') ? (
          <div className="panel panel-pad">
            <h3 style={{ marginTop: 0 }}>Por tipo de pedido</h3>
            {(data.por_tipo?.length ?? 0) > 0 ? (
              <Bar data={barTipo} options={{ plugins: { legend: { display: false } } }} />
            ) : (
              <p className="muted">Sin datos con estos filtros</p>
            )}
          </div>
        ) : null}
      </div>

      {bloques.includes('por_metodo') ? (
        <div className="panel panel-pad" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Por método de pago</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Método</th>
                <th>Viajes</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {(data.por_metodo ?? []).map((m) => (
                <tr key={m.metodo_pago}>
                  <td>{m.metodo_pago}</td>
                  <td>{m.viajes}</td>
                  <td>
                    <Money value={m.monto} />
                  </td>
                </tr>
              ))}
              {(data.por_metodo?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    Sin datos
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid-2" style={{ marginTop: '1rem' }}>
        {bloques.includes('por_zona') ? (
          <div className="panel panel-pad">
            <h3 style={{ marginTop: 0 }}>Por zona</h3>
            {(data.por_zona?.length ?? 0) === 0 ? (
              <p className="muted">Sin datos de zona (viajes nuevos guardan zona en la tarifa).</p>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Zona</th>
                    <th>Viajes</th>
                    <th>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.por_zona ?? []).map((z) => (
                    <tr key={z.zona}>
                      <td>{z.zona}</td>
                      <td>{z.viajes}</td>
                      <td>
                        <Money value={z.ingresos} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div />
        )}
        {bloques.includes('por_franja') ? (
          <div className="panel panel-pad">
            <h3 style={{ marginTop: 0 }}>Por franja horaria</h3>
            {(data.por_franja?.length ?? 0) === 0 ? (
              <p className="muted">Sin datos de franja aún.</p>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Franja</th>
                    <th>Viajes</th>
                    <th>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.por_franja ?? []).map((f) => (
                    <tr key={f.franja}>
                      <td>{f.franja}</td>
                      <td>{f.viajes}</td>
                      <td>
                        <Money value={f.ingresos} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </div>

      <div className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Reportes guardados</h3>
        <p className="muted">Incluyen los filtros con los que se generaron.</p>
        <table className="data">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Título</th>
              <th>Período</th>
              <th>Resumen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {guardados.map((g) => (
              <tr key={g.id}>
                <td className="mono">{new Date(g.fecha_creacion).toLocaleString('es-AR')}</td>
                <td>{g.titulo}</td>
                <td className="mono">
                  {g.periodo_desde ?? '—'} → {g.periodo_hasta ?? '—'}
                </td>
                <td className="muted" style={{ fontSize: 13 }}>
                  {g.resumen.viajes != null ? `${String(g.resumen.viajes)} viajes · ` : ''}
                  {g.resumen.ingresos != null ? (
                    <Money value={Number(g.resumen.ingresos)} />
                  ) : null}
                </td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => void reexportar(g.id)}
                  >
                    PDF
                  </button>
                </td>
              </tr>
            ))}
            {guardados.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 16 }}>
                  Todavía no hay reportes archivados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
