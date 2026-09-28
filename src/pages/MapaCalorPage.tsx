import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../lib/api';
import { ErrorBox, Loading, PageHeader } from '../components/ui';
import { MapView, type MapHeatmap } from '../components/MapView';
import type { MapaCalor } from '../types';

const COLOR_CADETES = '#1f5fa3';
const COLOR_PEDIDOS = '#e8742c';
const REFRESCO_MS = 30_000;

const PERIODOS = [
  { horas: 1, label: 'Última hora' },
  { horas: 24, label: 'Últimas 24 h' },
  { horas: 24 * 7, label: 'Últimos 7 días' },
];

export function MapaCalorPage() {
  const [horas, setHoras] = useState(24);
  const [data, setData] = useState<MapaCalor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verCadetes, setVerCadetes] = useState(true);
  const [verPedidos, setVerPedidos] = useState(true);
  const [actualizado, setActualizado] = useState<Date | null>(null);

  const load = useCallback(() => {
    adminApi
      .mapaCalor(horas)
      .then((d) => {
        setData(d);
        setError(null);
        setActualizado(new Date());
      })
      .catch((e: Error) => setError(e.message));
  }, [horas]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESCO_MS);
    return () => clearInterval(t);
  }, [load]);

  const heatmaps = useMemo<MapHeatmap[]>(
    () => [
      { id: 'pedidos', points: data?.pedidos ?? [], color: COLOR_PEDIDOS, visible: verPedidos },
      { id: 'cadetes', points: data?.cadetes ?? [], color: COLOR_CADETES, visible: verCadetes },
    ],
    [data, verCadetes, verPedidos],
  );

  const markers = useMemo(
    () =>
      verCadetes
        ? (data?.cadetes ?? []).map((c) => ({
            id: c.usuario_id,
            lat: c.lat,
            lng: c.lng,
            color: COLOR_CADETES,
            label: `${c.nombre} · GPS ${new Date(c.ubicacion_actualizada_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
          }))
        : [],
    [data, verCadetes],
  );

  const anillos = data?.anillos;

  return (
    <div className="page-enter">
      <PageHeader
        title="Mapa de calor"
        subtitle="Dónde están los cadetes conectados y de dónde salen los pedidos"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PERIODOS.map((p) => (
              <button
                key={p.horas}
                type="button"
                className={`btn ${horas === p.horas ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setHoras(p.horas)}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />
      {error ? <ErrorBox message={error} /> : null}
      {!data && !error ? <Loading /> : null}

      <div className="kpi-grid kpi-grid-secondary">
        <div className="kpi">
          <div className="label">Cadetes online con GPS</div>
          <div className="value" style={{ color: COLOR_CADETES }}>
            {data?.cadetes.length ?? 0}
          </div>
          <div className="kpi-hint">Ubicación de los últimos 15 min</div>
        </div>
        <div className="kpi">
          <div className="label">Pedidos en el período</div>
          <div className="value" style={{ color: COLOR_PEDIDOS }}>
            {data?.pedidos.length ?? 0}
          </div>
          <div className="kpi-hint">Punto de retiro de cada pedido</div>
        </div>
        <div className="kpi">
          <div className="label">Anillos de despacho</div>
          <div className="value">
            {anillos ? anillos.radios_km.map((r) => `${r} km`).join(' → ') : '—'}
          </div>
          <div className="kpi-hint">
            {anillos ? `Se amplía cada ${anillos.paso_seg} s sin aceptar` : 'Configurable en Tarifas'}
          </div>
        </div>
      </div>

      <div className="panel panel-pad stack">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={verCadetes} onChange={(e) => setVerCadetes(e.target.checked)} />
            <span style={{ color: COLOR_CADETES, fontWeight: 600 }}>● Cadetes</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={verPedidos} onChange={(e) => setVerPedidos(e.target.checked)} />
            <span style={{ color: COLOR_PEDIDOS, fontWeight: 600 }}>● Pedidos</span>
          </label>
          <span className="muted" style={{ marginLeft: 'auto' }}>
            {actualizado
              ? `Actualizado ${actualizado.toLocaleTimeString('es-AR')} · se refresca cada 30 s`
              : ''}
          </span>
        </div>
        <MapView markers={markers} heatmaps={heatmaps} zoom={12} />
        <p className="muted" style={{ margin: 0 }}>
          Zonas naranjas sin azul = mucha demanda y pocos cadetes cerca. Cada pedido se ofrece
          primero a los cadetes del anillo más chico y se amplía con el tiempo; un cadete sin GPS no
          ve pedidos.
        </p>
      </div>
    </div>
  );
}
