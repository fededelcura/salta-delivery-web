import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../lib/api';
import { formatGpsAge, fleetMarkerColor, fleetMarkerLabel } from '../lib/gps';
import { downloadPdfReport, formatMoneyPdf } from '../lib/pdf';
import {
  connectAdminSocket,
  type CadeteUbicacionEvent,
} from '../lib/socket';
import type { CadeteActividadStats, CadeteAdmin, ReporteGuardado } from '../types';
import { Badge, ErrorBox, Loading, Money, PageHeader } from '../components/ui';
import { MapView } from '../components/MapView';

function getToken(): string | null {
  return localStorage.getItem('sd_token');
}

const BLOQUES = [
  { id: 'en_vivo', label: 'Flota en vivo' },
  { id: 'por_cadete', label: 'Por cadete' },
  { id: 'por_zona', label: 'Por zona' },
  { id: 'por_hora', label: 'Por hora' },
] as const;

const COLUMNAS = [
  { id: 'horas_online', label: 'Horas online' },
  { id: 'horas_en_viaje', label: 'Horas en viaje' },
  { id: 'viajes', label: 'Viajes' },
  { id: 'km', label: 'Km' },
  { id: 'ganado', label: 'Ganado $' },
  { id: 'zonas', label: 'Zonas' },
] as const;

const ESTADOS_VIVO = [
  { id: 'online', label: 'Online' },
  { id: 'en_viaje', label: 'En viaje' },
  { id: 'ocupado', label: 'Ocupado' },
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

function todayLocal() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoLocal(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function toneDisp(d: string) {
  if (d === 'online') return 'ok' as const;
  if (d === 'en_viaje') return 'warn' as const;
  return 'neutral' as const;
}

function fmtDesde(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Salta',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActividadCadetesPage() {
  const [desde, setDesde] = useState(daysAgoLocal(7));
  const [hasta, setHasta] = useState(todayLocal());
  const [bloques, setBloques] = useState<IdOf<typeof BLOQUES>[]>([
    'en_vivo',
    'por_cadete',
    'por_zona',
    'por_hora',
  ]);
  const [columnas, setColumnas] = useState<IdOf<typeof COLUMNAS>[]>([
    'horas_online',
    'horas_en_viaje',
    'viajes',
    'km',
    'ganado',
    'zonas',
  ]);
  const [estadosVivo, setEstadosVivo] = useState<IdOf<typeof ESTADOS_VIVO>[]>([
    'online',
    'en_viaje',
    'ocupado',
  ]);
  const [soloConViajes, setSoloConViajes] = useState(false);
  const [zonaFiltro, setZonaFiltro] = useState<string[]>([]);
  const [qCadete, setQCadete] = useState('');
  const [cadeteId, setCadeteId] = useState('');
  const [cadetes, setCadetes] = useState<CadeteAdmin[]>([]);
  const [data, setData] = useState<CadeteActividadStats | null>(null);
  const [guardados, setGuardados] = useState<ReporteGuardado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'live' | 'off'>('connecting');
  const [now, setNow] = useState(() => Date.now());

  function load() {
    if (bloques.length === 0) {
      setError('Seleccioná al menos un bloque para mostrar');
      return;
    }
    if (columnas.length === 0) {
      setError('Seleccioná al menos una columna / métrica');
      return;
    }
    setError(null);
    const d0 = `${desde}T00:00:00.000-03:00`;
    const d1 = `${hasta}T23:59:59.999-03:00`;
    void Promise.all([
      adminApi.actividadCadetes({
        desde: d0,
        hasta: d1,
        cadete_id: cadeteId || undefined,
      }),
      adminApi.reportesGuardados(),
      adminApi.cadetes(),
    ])
      .then(([r, g, cad]) => {
        setData(r);
        setGuardados(g.filter((x: import('../types').ReporteGuardado) => x.tipo === 'actividad_cadetes'));
        setCadetes(cad);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setSocketStatus('off');
      return;
    }

    const socket = connectAdminSocket(token);
    setSocketStatus('connecting');

    socket.on('connect', () => setSocketStatus('live'));
    socket.on('disconnect', () => setSocketStatus('off'));
    socket.on('connect_error', () => setSocketStatus('off'));

    socket.on('cadete:ubicacion', (payload: CadeteUbicacionEvent) => {
      if (typeof payload?.lat !== 'number' || typeof payload?.lng !== 'number') return;
      if (!payload.cadete_id) return;
      const ts = payload.ts ?? new Date().toISOString();
      setData((prev) => {
        if (!prev) return prev;
        const idx = prev.trabajando_ahora.findIndex((c) => c.usuario_id === payload.cadete_id);
        if (idx === -1) {
          const disp = payload.disponibilidad;
          if (disp !== 'online' && disp !== 'en_viaje' && disp !== 'ocupado') return prev;
          return {
            ...prev,
            trabajando_ahora: [
              ...prev.trabajando_ahora,
              {
                usuario_id: payload.cadete_id,
                nombre: payload.cadete_id.slice(0, 8),
                disponibilidad: disp,
                zona_h3: null,
                zona_nombre: null,
                ubicacion: { lat: payload.lat, lng: payload.lng },
                ubicacion_actualizada_en: ts,
                desde_sesion: ts,
                plan_suscripcion: '—',
                total_viajes: 0,
              },
            ],
            resumen: {
              ...prev.resumen,
              trabajando_ahora: prev.resumen.trabajando_ahora + 1,
            },
          };
        }
        const next = [...prev.trabajando_ahora];
        next[idx] = {
          ...next[idx],
          ubicacion: { lat: payload.lat, lng: payload.lng },
          ubicacion_actualizada_en: ts,
          disponibilidad: payload.disponibilidad ?? next[idx].disponibilidad,
        };
        return { ...prev, trabajando_ahora: next };
      });
      setNow(Date.now());
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const zonasDisponibles = useMemo(() => {
    if (!data) return [] as Array<{ id: string; label: string }>;
    return data.por_zona.map((z) => ({
      id: z.zona_h3 ?? z.zona_nombre,
      label: z.zona_nombre,
    }));
  }, [data]);

  const trabajandoFiltrado = useMemo(() => {
    if (!data) return [];
    const q = qCadete.trim().toLowerCase();
    return data.trabajando_ahora.filter((c) => {
      if (!estadosVivo.includes(c.disponibilidad as IdOf<typeof ESTADOS_VIVO>)) return false;
      if (zonaFiltro.length) {
        const zid = c.zona_h3 ?? c.zona_nombre ?? '';
        if (!zonaFiltro.includes(zid)) return false;
      }
      if (q && !c.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, estadosVivo, zonaFiltro, qCadete]);

  const porCadeteFiltrado = useMemo(() => {
    if (!data) return [];
    const q = qCadete.trim().toLowerCase();
    return data.por_cadete.filter((c) => {
      if (soloConViajes && c.viajes_finalizados <= 0) return false;
      if (q && !c.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, soloConViajes, qCadete]);

  const porZonaFiltrado = useMemo(() => {
    if (!data) return [];
    if (!zonaFiltro.length) return data.por_zona;
    return data.por_zona.filter((z) => zonaFiltro.includes(z.zona_h3 ?? z.zona_nombre));
  }, [data, zonaFiltro]);

  const maxHora = useMemo(() => {
    if (!data?.por_hora.length) return 1;
    return Math.max(1, ...data.por_hora.map((h) => h.sesiones_activas + h.viajes));
  }, [data]);

  const resumenFiltrado = useMemo(() => {
    if (!data) {
      return {
        trabajando_ahora: 0,
        horas_online: 0,
        horas_en_viaje: 0,
        viajes: 0,
        ganado: 0,
      };
    }
    return {
      trabajando_ahora: trabajandoFiltrado.length,
      horas_online: porCadeteFiltrado.reduce((a, c) => a + c.horas_online, 0),
      horas_en_viaje: porCadeteFiltrado.reduce((a, c) => a + c.horas_en_viaje, 0),
      viajes: porCadeteFiltrado.reduce((a, c) => a + c.viajes_finalizados, 0),
      ganado: porCadeteFiltrado.reduce((a, c) => a + c.ganado, 0),
    };
  }, [data, trabajandoFiltrado, porCadeteFiltrado]);

  async function exportarYGuardar() {
    if (!data) return;
    if (bloques.length === 0 || columnas.length === 0) {
      setError('Seleccioná bloques y columnas antes de exportar');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const sections: Array<{
        title?: string;
        columns: Array<{ header: string; dataKey: string }>;
        rows: Array<Record<string, string | number>>;
      }> = [];

      if (bloques.includes('por_cadete')) {
        sections.push({
          title: 'Por cadete',
          columns: [
            { header: 'Cadete', dataKey: 'nombre' },
            ...(columnas.includes('horas_online')
              ? [{ header: 'Online (h)', dataKey: 'horas_online' }]
              : []),
            ...(columnas.includes('horas_en_viaje')
              ? [{ header: 'En viaje (h)', dataKey: 'horas_en_viaje' }]
              : []),
            ...(columnas.includes('viajes')
              ? [{ header: 'Viajes', dataKey: 'viajes' }]
              : []),
            ...(columnas.includes('km') ? [{ header: 'Km', dataKey: 'km' }] : []),
            ...(columnas.includes('ganado')
              ? [{ header: 'Ganado', dataKey: 'ganado' }]
              : []),
            ...(columnas.includes('zonas')
              ? [{ header: 'Zonas', dataKey: 'zonas' }]
              : []),
          ],
          rows: porCadeteFiltrado.map((c) => ({
            nombre: c.nombre,
            horas_online: c.horas_online,
            horas_en_viaje: c.horas_en_viaje,
            viajes: c.viajes_finalizados,
            km: c.km_totales,
            ganado: formatMoneyPdf(c.ganado),
            zonas: c.zonas_distintas,
          })),
        });
      }

      if (bloques.includes('por_zona')) {
        sections.push({
          title: 'Por zona',
          columns: [
            { header: 'Zona', dataKey: 'zona' },
            { header: 'Horas', dataKey: 'horas' },
            { header: 'Cadetes', dataKey: 'cadetes' },
          ],
          rows: porZonaFiltrado.map((z) => ({
            zona: z.zona_nombre,
            horas: z.horas,
            cadetes: z.cadetes_unicos,
          })),
        });
      }

      if (bloques.includes('por_hora')) {
        sections.push({
          title: 'Por hora (Salta)',
          columns: [
            { header: 'Hora', dataKey: 'hora' },
            { header: 'Sesiones', dataKey: 'sesiones' },
            { header: 'Viajes', dataKey: 'viajes' },
          ],
          rows: data.por_hora.map((h) => ({
            hora: `${String(h.hora).padStart(2, '0')}:00`,
            sesiones: h.sesiones_activas,
            viajes: h.viajes,
          })),
        });
      }

      if (bloques.includes('en_vivo')) {
        sections.push({
          title: 'Flota en vivo (snapshot al exportar)',
          columns: [
            { header: 'Cadete', dataKey: 'nombre' },
            { header: 'Estado', dataKey: 'estado' },
            { header: 'Zona', dataKey: 'zona' },
            { header: 'Desde', dataKey: 'desde' },
          ],
          rows: trabajandoFiltrado.map((c) => ({
            nombre: c.nombre,
            estado: c.disponibilidad,
            zona: c.zona_nombre ?? c.zona_h3 ?? '—',
            desde: fmtDesde(c.desde_sesion),
          })),
        });
      }

      if (!sections.length) {
        setError('No hay bloques con datos para exportar');
        return;
      }

      const filtros = {
        desde,
        hasta,
        bloques,
        columnas,
        estados_vivo: estadosVivo,
        solo_con_viajes: soloConViajes,
        zonas: zonaFiltro,
        q: qCadete || null,
      };

      const sujetoAct =
        cadeteId
          ? `cadete: ${cadetes.find((c) => c.usuario_id === cadeteId)?.nombre ?? cadeteId}`
          : 'todos los cadetes';

      downloadPdfReport({
        title: `Actividad cadetes ${desde} → ${hasta}`,
        subtitle: `${sujetoAct} · Bloques: ${bloques.join(', ')} · Columnas: ${columnas.join(', ')}`,
        summary: [
          { label: 'Sujeto', value: sujetoAct },
          { label: 'Trabajando ahora (filtro)', value: String(resumenFiltrado.trabajando_ahora) },
          { label: 'Horas online', value: `${resumenFiltrado.horas_online.toFixed(1)} h` },
          { label: 'Horas en viaje', value: `${resumenFiltrado.horas_en_viaje.toFixed(1)} h` },
          { label: 'Viajes', value: String(resumenFiltrado.viajes) },
          { label: 'Ganado', value: formatMoneyPdf(resumenFiltrado.ganado) },
        ],
        sections,
        filename: `salta-actividad-cadetes-${hasta}.pdf`,
      });

      await adminApi.guardarReporte({
        tipo: 'actividad_cadetes',
        titulo: `Actividad ${desde} → ${hasta} · ${sujetoAct}`,
        periodo_desde: desde,
        periodo_hasta: hasta,
        resumen: {
          ...resumenFiltrado,
          filtros,
        },
        detalle: {
          filtros,
          trabajando_ahora: bloques.includes('en_vivo') ? trabajandoFiltrado : [],
          por_cadete: bloques.includes('por_cadete') ? porCadeteFiltrado : [],
          por_zona: bloques.includes('por_zona') ? porZonaFiltrado : [],
          por_hora: bloques.includes('por_hora') ? data.por_hora : [],
        },
      });

      setMsg('PDF descargado y reporte guardado con los filtros elegidos');
      const g = await adminApi.reportesGuardados();
      setGuardados(g.filter((x) => x.tipo === 'actividad_cadetes'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setBusy(false);
    }
  }

  async function reexportar(id: string) {
    try {
      const full = await adminApi.reporteGuardado(id);
      const det = full.detalle as {
        por_cadete?: CadeteActividadStats['por_cadete'];
        por_zona?: CadeteActividadStats['por_zona'];
        por_hora?: CadeteActividadStats['por_hora'];
        trabajando_ahora?: CadeteActividadStats['trabajando_ahora'];
        filtros?: { columnas?: string[]; bloques?: string[] };
      };
      const cols = (det.filtros?.columnas ?? columnas) as IdOf<typeof COLUMNAS>[];
      const bl = (det.filtros?.bloques ?? bloques) as IdOf<typeof BLOQUES>[];
      const sections = [];

      if (bl.includes('por_cadete') && det.por_cadete?.length) {
        sections.push({
          title: 'Por cadete',
          columns: [
            { header: 'Cadete', dataKey: 'nombre' },
            ...(cols.includes('horas_online')
              ? [{ header: 'Online (h)', dataKey: 'horas_online' }]
              : []),
            ...(cols.includes('horas_en_viaje')
              ? [{ header: 'En viaje (h)', dataKey: 'horas_en_viaje' }]
              : []),
            ...(cols.includes('viajes') ? [{ header: 'Viajes', dataKey: 'viajes' }] : []),
            ...(cols.includes('km') ? [{ header: 'Km', dataKey: 'km' }] : []),
            ...(cols.includes('ganado') ? [{ header: 'Ganado', dataKey: 'ganado' }] : []),
            ...(cols.includes('zonas') ? [{ header: 'Zonas', dataKey: 'zonas' }] : []),
          ],
          rows: det.por_cadete.map((c) => ({
            nombre: c.nombre,
            horas_online: c.horas_online,
            horas_en_viaje: c.horas_en_viaje,
            viajes: c.viajes_finalizados,
            km: c.km_totales,
            ganado: formatMoneyPdf(c.ganado),
            zonas: c.zonas_distintas,
          })),
        });
      }
      if (bl.includes('por_zona') && det.por_zona?.length) {
        sections.push({
          title: 'Por zona',
          columns: [
            { header: 'Zona', dataKey: 'zona' },
            { header: 'Horas', dataKey: 'horas' },
            { header: 'Cadetes', dataKey: 'cadetes' },
          ],
          rows: det.por_zona.map((z) => ({
            zona: z.zona_nombre,
            horas: z.horas,
            cadetes: z.cadetes_unicos,
          })),
        });
      }
      if (bl.includes('por_hora') && det.por_hora?.length) {
        sections.push({
          title: 'Por hora',
          columns: [
            { header: 'Hora', dataKey: 'hora' },
            { header: 'Sesiones', dataKey: 'sesiones' },
            { header: 'Viajes', dataKey: 'viajes' },
          ],
          rows: det.por_hora.map((h) => ({
            hora: `${String(h.hora).padStart(2, '0')}:00`,
            sesiones: h.sesiones_activas,
            viajes: h.viajes,
          })),
        });
      }

      downloadPdfReport({
        title: full.titulo,
        subtitle: `Archivado ${new Date(full.fecha_creacion).toLocaleString('es-AR')}`,
        sections,
        filename: `salta-actividad-${full.id.slice(0, 8)}.pdf`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const markers = trabajandoFiltrado
    .filter((c) => c.ubicacion)
    .map((c) => ({
      id: c.usuario_id,
      lat: c.ubicacion!.lat,
      lng: c.ubicacion!.lng,
      label: fleetMarkerLabel(c.nombre, c.disponibilidad, c.ubicacion_actualizada_en, now),
      color: fleetMarkerColor(c.disponibilidad, c.ubicacion_actualizada_en, now),
    }));

  const liveHint =
    socketStatus === 'live'
      ? 'flota en vivo'
      : socketStatus === 'connecting'
        ? 'conectando…'
        : 'sin socket';

  return (
    <div className="page-enter">
      <PageHeader
        title="Actividad de cadetes"
        subtitle={`Filtros + PDF + guardar reporte · mapa ${liveHint}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={load}>
              Actualizar
            </button>
            <button
              type="button"
              className="btn btn-primary"
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

      <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="field">
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="field">
            <label>¿A quién?</label>
            <select value={cadeteId} onChange={(e) => setCadeteId(e.target.value)}>
              <option value="">Todos los cadetes</option>
              {cadetes.map((c) => (
                <option key={c.usuario_id} value={c.usuario_id}>
                  {c.nombre ?? c.dni}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Buscar nombre</label>
            <input
              value={qCadete}
              onChange={(e) => setQCadete(e.target.value)}
              placeholder="Filtro rápido…"
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={load}>
            Aplicar período
          </button>
        </div>

        {cadeteId ? (
          <div
            className="error-banner"
            style={{ background: '#e8f4f4', color: '#084f4f', marginBottom: 12 }}
          >
            Estadística de:{' '}
            <strong>{cadetes.find((c) => c.usuario_id === cadeteId)?.nombre ?? 'cadete'}</strong>
          </div>
        ) : null}

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

        <div className="filter-group">
          <div className="filter-label">Columnas (por cadete)</div>
          <div className="filter-chips">
            {COLUMNAS.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                active={columnas.includes(c.id)}
                onClick={() => setColumnas((prev) => toggleIn(prev, c.id))}
              />
            ))}
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-label">Estado flota en vivo</div>
          <div className="filter-chips">
            {ESTADOS_VIVO.map((e) => (
              <Chip
                key={e.id}
                label={e.label}
                active={estadosVivo.includes(e.id)}
                onClick={() => setEstadosVivo((prev) => toggleIn(prev, e.id))}
              />
            ))}
            <Chip
              label="Solo con viajes en el período"
              active={soloConViajes}
              onClick={() => setSoloConViajes((v) => !v)}
            />
          </div>
        </div>

        {zonasDisponibles.length > 0 ? (
          <div className="filter-group">
            <div className="filter-label">Zonas (vacío = todas)</div>
            <div className="filter-chips">
              {zonasDisponibles.map((z) => (
                <Chip
                  key={z.id}
                  label={z.label}
                  active={zonaFiltro.includes(z.id)}
                  onClick={() => setZonaFiltro((prev) => toggleIn(prev, z.id))}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
        <div className="panel panel-pad">
          <div className="muted">Trabajando (filtro)</div>
          <div className="value" style={{ fontSize: '1.8rem', fontWeight: 800 }}>
            {resumenFiltrado.trabajando_ahora}
          </div>
        </div>
        <div className="panel panel-pad">
          <div className="muted">Horas online</div>
          <div className="value" style={{ fontSize: '1.8rem', fontWeight: 800 }}>
            {resumenFiltrado.horas_online.toFixed(1)} h
          </div>
        </div>
        <div className="panel panel-pad">
          <div className="muted">Horas en viaje</div>
          <div className="value" style={{ fontSize: '1.8rem', fontWeight: 800 }}>
            {resumenFiltrado.horas_en_viaje.toFixed(1)} h
          </div>
        </div>
        <div className="panel panel-pad">
          <div className="muted">Viajes</div>
          <div className="value" style={{ fontSize: '1.8rem', fontWeight: 800 }}>
            {resumenFiltrado.viajes}
          </div>
        </div>
        <div className="panel panel-pad">
          <div className="muted">Ganado</div>
          <div className="value" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
            <Money value={resumenFiltrado.ganado} />
          </div>
        </div>
      </div>

      {bloques.includes('en_vivo') ? (
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <div className="panel panel-pad">
            <h3 style={{ marginTop: 0 }}>En línea / en viaje ahora</h3>
            {trabajandoFiltrado.length === 0 ? (
              <p className="muted">Ningún cadete con los filtros actuales.</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Cadete</th>
                      <th>Estado</th>
                      <th>GPS</th>
                      <th>Zona</th>
                      <th>Desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trabajandoFiltrado.map((c) => (
                      <tr key={c.usuario_id}>
                        <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                        <td>
                          <Badge tone={toneDisp(c.disponibilidad)}>{c.disponibilidad}</Badge>
                        </td>
                        <td className="muted">
                          {formatGpsAge(c.ubicacion_actualizada_en, now)}
                        </td>
                        <td>{c.zona_nombre ?? c.zona_h3 ?? '—'}</td>
                        <td className="muted">{fmtDesde(c.desde_sesion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="panel panel-pad">
            <h3 style={{ marginTop: 0 }}>Mapa flota activa</h3>
            {markers.length ? (
              <>
                <MapView markers={markers} />
                <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
                  Verde online · naranja en viaje · dorado ocupado · gris GPS &gt;5 min
                </p>
              </>
            ) : (
              <p className="muted">Sin ubicación GPS reciente.</p>
            )}
          </div>
        </div>
      ) : null}

      {bloques.includes('por_cadete') ? (
        <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Por cadete (período)</h3>
          {porCadeteFiltrado.length === 0 ? (
            <p className="muted">
              Sin datos con estos filtros. Las horas se registran cuando el cadete se pone online.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Cadete</th>
                    {columnas.includes('horas_online') ? <th>Online</th> : null}
                    {columnas.includes('horas_en_viaje') ? <th>En viaje</th> : null}
                    {columnas.includes('viajes') ? <th>Viajes</th> : null}
                    {columnas.includes('km') ? <th>Km</th> : null}
                    {columnas.includes('ganado') ? <th>Ganado</th> : null}
                    {columnas.includes('zonas') ? <th>Zonas</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {porCadeteFiltrado.map((c) => (
                    <tr key={c.cadete_id}>
                      <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                      {columnas.includes('horas_online') ? <td>{c.horas_online} h</td> : null}
                      {columnas.includes('horas_en_viaje') ? (
                        <td>{c.horas_en_viaje} h</td>
                      ) : null}
                      {columnas.includes('viajes') ? <td>{c.viajes_finalizados}</td> : null}
                      {columnas.includes('km') ? <td>{c.km_totales}</td> : null}
                      {columnas.includes('ganado') ? (
                        <td>
                          <Money value={c.ganado} />
                        </td>
                      ) : null}
                      {columnas.includes('zonas') ? <td>{c.zonas_distintas}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {(bloques.includes('por_zona') || bloques.includes('por_hora')) && (
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          {bloques.includes('por_zona') ? (
            <div className="panel panel-pad">
              <h3 style={{ marginTop: 0 }}>Tiempo por zona</h3>
              {porZonaFiltrado.length === 0 ? (
                <p className="muted">Sin datos de zona aún.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Zona</th>
                        <th>Horas</th>
                        <th>Cadetes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porZonaFiltrado.map((z) => (
                        <tr key={z.zona_h3 ?? z.zona_nombre}>
                          <td>{z.zona_nombre}</td>
                          <td>{z.horas} h</td>
                          <td>{z.cadetes_unicos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div />
          )}

          {bloques.includes('por_hora') ? (
            <div className="panel panel-pad">
              <h3 style={{ marginTop: 0 }}>Actividad por hora (Salta)</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Barras = sesiones activas · color = hubo viajes
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
                {data.por_hora.map((h) => {
                  const hgt = Math.max(
                    4,
                    Math.round(((h.sesiones_activas + h.viajes) / maxHora) * 120),
                  );
                  return (
                    <div
                      key={h.hora}
                      title={`${String(h.hora).padStart(2, '0')}:00 — ${h.sesiones_activas} sesiones, ${h.viajes} viajes`}
                      style={{ flex: 1, textAlign: 'center' }}
                    >
                      <div
                        style={{
                          height: hgt,
                          background: h.viajes > 0 ? '#0c6b6b' : '#9bb8c0',
                          borderRadius: 4,
                          marginBottom: 4,
                        }}
                      />
                      <div style={{ fontSize: 10, color: '#5a6b78' }}>{h.hora}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="panel panel-pad">
        <h3 style={{ marginTop: 0 }}>Reportes guardados (actividad)</h3>
        {guardados.length === 0 ? (
          <p className="muted">Todavía no hay reportes archivados de esta pantalla.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Período</th>
                  <th>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {guardados.map((g) => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.titulo}</td>
                    <td className="muted">
                      {g.periodo_desde ?? '—'} → {g.periodo_hasta ?? '—'}
                    </td>
                    <td className="muted">
                      {new Date(g.fecha_creacion).toLocaleString('es-AR')}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void reexportar(g.id)}
                      >
                        Re-exportar PDF
                      </button>
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
