import type { ApiResponse } from '../types';

const PROD_API = 'https://salta-delivery-api.onrender.com/api';

/** En DEV siempre usamos el proxy de Vite (/api → :3000). Evita Failed to fetch por localhost/IPv6/CORS. */
function resolveApiUrl(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

  if (import.meta.env.DEV) {
    if (
      !raw ||
      raw === '/api' ||
      raw.startsWith('/') ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/api)?\/?$/i.test(raw)
    ) {
      return '/api';
    }
    return raw.replace(/\/$/, '');
  }

  if (raw?.startsWith('http')) return raw.replace(/\/$/, '');
  return PROD_API;
}

const API_URL = resolveApiUrl();

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  return localStorage.getItem('sd_token');
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem('sd_token', token);
  else localStorage.removeItem('sd_token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const urls = [API_URL];
  if (import.meta.env.DEV && API_URL !== '/api') {
    urls.push('/api');
  }

  let res: Response | null = null;
  for (const base of urls) {
    try {
      res = await fetch(`${base}${path}`, {
        ...options,
        headers,
      });
      break;
    } catch {
      /* probar siguiente base */
    }
  }

  if (!res) {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'No se pudo conectar con la API. Abrí http://127.0.0.1:5174 (no otro host) y asegurate que la API esté en el puerto 3000 (cd api && npm run dev).',
    );
  }

  const raw = await res.text();
  let body: ApiResponse<T> | null = null;
  try {
    body = JSON.parse(raw) as ApiResponse<T>;
  } catch {
    const hint =
      res.status === 500 || res.status === 502 || res.status === 504
        ? 'La API no responde. Corré: cd api && npm.cmd run dev (puerto 3000).'
        : 'Respuesta inválida del servidor';
    throw new ApiClientError(res.status, 'PARSE_ERROR', hint);
  }

  if (!body.success) {
    throw new ApiClientError(
      res.status,
      body.error.code,
      body.error.message,
      body.error.details,
    );
  }

  return body.data;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<import('../types').AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: {
    email: string;
    telefono: string;
    nombre: string;
    password: string;
    rol: 'cliente' | 'cadete';
    dni?: string;
  }) =>
    api<{ email: string; requiresEmailVerification: true }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  verifyEmail: (email: string, codigo: string) =>
    api<import('../types').AuthSession>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, codigo }),
    }),
  resendVerification: (email: string) =>
    api<{ email: string; sent: boolean }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};

export const adminApi = {
  dashboard: () => api<import('../types').DashboardKpis>('/admin/dashboard'),
  cadetes: () => api<import('../types').CadeteAdmin[]>('/admin/cadetes'),
  crearCadete: (body: {
    email: string;
    telefono: string;
    nombre: string;
    password: string;
    dni: string;
    licencia: string;
    fecha_nacimiento: string;
    marca_moto?: string;
    patente: string;
    direccion_parts: {
      calle: string;
      numero: string;
      piso_dpto?: string | null;
      barrio: string;
      ciudad?: string;
      provincia?: string;
    };
    aprobar?: boolean;
    documentos?: {
      dni?: string;
      carnet?: string;
      seguro?: string;
      afip?: string;
      rentas?: string;
    };
  }) =>
    api<import('../types').CadeteAdmin>('/admin/cadetes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  subirDocumentosCadete: (
    id: string,
    body: {
      direccion?: string;
      documentos?: {
        dni?: string;
        carnet?: string;
        seguro?: string;
        afip?: string;
        rentas?: string;
      };
    },
  ) =>
    api<import('../types').CadeteAdmin>(`/admin/cadetes/${id}/documentos`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchCadete: (id: string, estado: string) =>
    api<import('../types').CadeteAdmin>(`/admin/cadetes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    }),
  actualizarCadete: (
    id: string,
    body: {
      nombre?: string;
      email?: string;
      telefono?: string;
      dni?: string;
      licencia?: string;
      patente?: string;
      marca_moto?: string | null;
      direccion_parts?: {
        calle: string;
        numero: string;
        piso_dpto?: string | null;
        barrio: string;
        ciudad?: string;
        provincia?: string;
      };
      cbu?: string | null;
      alias_bancario?: string | null;
      banco?: string | null;
      titular_cuenta?: string | null;
      plan_suscripcion?: string;
      estado?: string;
    },
  ) =>
    api<import('../types').CadeteAdmin>(`/admin/cadetes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  bajaCadete: (id: string) =>
    api<import('../types').CadeteAdmin>(`/admin/cadetes/${id}/baja`, { method: 'POST' }),
  reactivarCadete: (id: string) =>
    api<import('../types').CadeteAdmin>(`/admin/cadetes/${id}/reactivar`, { method: 'POST' }),
  clientes: () => api<import('../types').ClienteAdmin[]>('/admin/clientes'),
  crearCliente: (body: {
    email: string;
    telefono: string;
    nombre: string;
    password: string;
    dni: string;
    direccion_parts: {
      calle: string;
      numero: string;
      piso_dpto?: string | null;
      barrio: string;
      ciudad?: string;
      provincia?: string;
    };
    plan_suscripcion?: string;
    tipo_cuenta?: 'particular' | 'restaurante' | 'comercio';
    tiempo_preparacion_min?: number;
    horario_comercial?: { abre?: string; cierra?: string; dias?: number[] } | null;
    documento_dni: string;
  }) =>
    api<import('../types').ClienteAdmin>('/admin/clientes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  actualizarCliente: (
    id: string,
    body: {
      nombre?: string;
      email?: string;
      telefono?: string;
      dni?: string;
      plan_suscripcion?: string;
      tipo_cuenta?: 'particular' | 'restaurante' | 'comercio';
      tiempo_preparacion_min?: number;
      horario_comercial?: { abre?: string; cierra?: string; dias?: number[] } | null;
      direccion_parts?: {
        calle: string;
        numero: string;
        piso_dpto?: string | null;
        barrio: string;
        ciudad?: string;
        provincia?: string;
      };
      estado?: string;
    },
  ) =>
    api<import('../types').ClienteAdmin>(`/admin/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  bajaCliente: (id: string) =>
    api<import('../types').ClienteAdmin>(`/admin/clientes/${id}/baja`, { method: 'POST' }),
  reactivarCliente: (id: string) =>
    api<import('../types').ClienteAdmin>(`/admin/clientes/${id}/reactivar`, {
      method: 'POST',
    }),
  zonas: () => api<import('../types').ZonaHex[]>('/admin/zonas'),
  crearZona: (body: {
    h3_index: string;
    nombre?: string | null;
    tipo?: string;
    lat_centro: number;
    lng_centro: number;
    tarifa_multiplier?: number;
    activa?: boolean;
  }) =>
    api<import('../types').ZonaHex>('/admin/zonas', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  actualizarZona: (id: string, body: Partial<import('../types').ZonaHex>) =>
    api<import('../types').ZonaHex>(`/admin/zonas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  bajaZona: (id: string) =>
    api<import('../types').ZonaHex>(`/admin/zonas/${id}/baja`, { method: 'POST' }),
  getTarifas: () => api<import('../types').TarifasBase>('/admin/configurar-tarifas'),
  getPlanes: () => api<import('../types').PlanesCatalogo>('/admin/planes'),
  setPlanes: (body: import('../types').PlanesCatalogo) =>
    api<import('../types').PlanesCatalogo>('/admin/planes', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  viajes: (estado?: string) =>
    api<import('../types').ViajeAdmin[]>(
      `/admin/viajes${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`,
    ),
  despacharCercano: (id: string) =>
    api<{
      viaje_id: string;
      candidatos: number;
      top: { cadete_id: string; score: number; distancia_km: number } | null;
      mensaje: string;
    }>(`/admin/viajes/${id}/despachar-cercano`, { method: 'POST' }),
  reportes: (params?: {
    dias?: number;
    tipos?: string[];
    metodos?: string[];
    zonas?: string[];
    franjas?: string[];
    cadete_id?: string;
    cliente_id?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.dias) qs.set('dias', String(params.dias));
    if (params?.tipos?.length) qs.set('tipos', params.tipos.join(','));
    if (params?.metodos?.length) qs.set('metodos', params.metodos.join(','));
    if (params?.zonas?.length) qs.set('zonas', params.zonas.join(','));
    if (params?.franjas?.length) qs.set('franjas', params.franjas.join(','));
    if (params?.cadete_id) qs.set('cadete_id', params.cadete_id);
    if (params?.cliente_id) qs.set('cliente_id', params.cliente_id);
    const s = qs.toString();
    return api<import('../types').ReportesData>(`/admin/reportes${s ? `?${s}` : ''}`);
  },
  guardarReporte: (body: {
    tipo:
      | 'estadisticas'
      | 'comprobantes'
      | 'viajes'
      | 'financiero'
      | 'operativo'
      | 'actividad_cadetes';
    titulo: string;
    periodo_desde?: string | null;
    periodo_hasta?: string | null;
    resumen: Record<string, unknown>;
    detalle: Record<string, unknown>;
  }) =>
    api<import('../types').ReporteGuardado>('/admin/reportes/guardar', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reportesGuardados: () =>
    api<import('../types').ReporteGuardado[]>('/admin/reportes/guardados'),
  reporteGuardado: (id: string) =>
    api<import('../types').ReporteGuardado>(`/admin/reportes/guardados/${id}`),
  incidencias: () => api<import('../types').Incidencia[]>('/admin/incidencias'),
  patchIncidencia: (
    id: string,
    body: { estado?: string; asignado_a?: string; resolucion?: string },
  ) =>
    api(`/admin/incidencias/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  configurarTarifas: (body: Partial<import('../types').TarifasBase>) =>
    api<import('../types').TarifasBase>('/admin/configurar-tarifas', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  comisiones: () => api<import('../types').ConfigComision[]>('/admin/comisiones'),
  guardarComisiones: (
    items: Array<{ plan_cadete: string; tipo_servicio: string; comision_pct: number }>,
  ) =>
    api<import('../types').ConfigComision[]>('/admin/comisiones', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),
  comprobantesViaje: (viajeId: string) =>
    api<import('../types').Comprobante[]>(`/admin/viajes/${viajeId}/comprobantes`),
  comprobantes: (params?: {
    rol?: string;
    q?: string;
    desde?: string;
    hasta?: string;
    tipo_servicio?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.rol) qs.set('rol', params.rol);
    if (params?.q) qs.set('q', params.q);
    if (params?.desde) qs.set('desde', params.desde);
    if (params?.hasta) qs.set('hasta', params.hasta);
    if (params?.tipo_servicio) qs.set('tipo_servicio', params.tipo_servicio);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const s = qs.toString();
    return api<import('../types').ComprobantesListResponse>(
      `/admin/comprobantes${s ? `?${s}` : ''}`,
    );
  },
  detalleCliente: (id: string) =>
    api<import('../types').ClienteDetalleAdmin>(`/admin/clientes/${id}/detalle`),
  detalleCadete: (id: string) =>
    api<import('../types').CadeteDetalleAdmin>(`/admin/cadetes/${id}/detalle`),
  actividadCadetes: (params?: { desde?: string; hasta?: string; cadete_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.desde) qs.set('desde', params.desde);
    if (params?.hasta) qs.set('hasta', params.hasta);
    if (params?.cadete_id) qs.set('cadete_id', params.cadete_id);
    const s = qs.toString();
    return api<import('../types').CadeteActividadStats>(
      `/admin/cadetes/actividad${s ? `?${s}` : ''}`,
    );
  },
  liquidaciones: (estado?: string) =>
    api<import('../types').LiquidacionAdmin[]>(
      `/admin/liquidaciones${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`,
    ),
  transferirLiquidacion: (id: string, nota?: string) =>
    api<import('../types').LiquidacionAdmin>(`/admin/liquidaciones/${id}/transferir`, {
      method: 'POST',
      body: JSON.stringify({ nota }),
    }),
  plazoLiquidacion: () => api<{ dias: number }>('/admin/liquidaciones/plazo'),
  setPlazoLiquidacion: (dias: number) =>
    api<{ dias: number }>('/admin/liquidaciones/plazo', {
      method: 'PUT',
      body: JSON.stringify({ dias }),
    }),
};

export const suscripcionesApi = {
  planes: () => api<import('../types').PlanesCatalogo>('/suscripciones/planes'),
};

/** Portal cliente (mismo contrato que mobile-cliente) */
export const clientePortalApi = {
  perfil: () => api<import('../types').ClientePortalPerfil>('/clientes/perfil'),
  actualizarPreferencias: (payload: {
    metodo_pago_preferido?: string;
    direcciones_favoritas?: Array<{
      alias: string;
      direccion: string;
      lat: number;
      lng: number;
      es_principal?: boolean;
    }>;
  }) =>
    api<import('../types').ClientePortalPerfil>('/clientes/perfil', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  viajes: () => api<import('../types').ViajePortal[]>('/clientes/viajes'),
  solicitar: (payload: {
    tipo_servicio: string;
    origen_direccion: string;
    origen: { lat: number; lng: number };
    destino_direccion: string;
    destino: { lat: number; lng: number };
    metodo_pago: string;
    tiempo_preparacion_min?: number;
  }) =>
    api<import('../types').ViajePortal>('/clientes/solicitar-viaje', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  solicitarInvitado: (payload: {
    telefono: string;
    nombre: string;
    email?: string;
    tipo_servicio: string;
    origen_direccion: string;
    origen: { lat: number; lng: number };
    destino_direccion: string;
    destino: { lat: number; lng: number };
    metodo_pago: string;
    tiempo_preparacion_min?: number;
  }) =>
    api<{
      viaje: import('../types').ViajePortal;
      session: import('../types').AuthSession;
    }>('/clientes/solicitar-invitado', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancelar: (id: string, motivo?: string) =>
    api<import('../types').ViajePortal>(`/clientes/cancelar-viaje/${id}`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }),
  calcularTarifa: (origen: { lat: number; lng: number }, destino: { lat: number; lng: number }) =>
    api<import('../types').CalcularTarifaPortal>('/viajes/calcular-tarifa', {
      method: 'POST',
      body: JSON.stringify({ origen, destino }),
    }),
};

/** Portal cadete (mismo contrato que mobile-cadete) */
export const cadetePortalApi = {
  setEstado: (disponibilidad: 'online' | 'offline' | 'ocupado') =>
    api<import('../types').CadetePortal>('/cadetes/estado', {
      method: 'PATCH',
      body: JSON.stringify({ disponibilidad }),
    }),
  actualizarUbicacion: (lat: number, lng: number) =>
    api<import('../types').CadetePortal>('/cadetes/actualizar-ubicacion', {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
    }),
  viajesDisponibles: () => api<import('../types').ViajePortal[]>('/cadetes/viajes-disponibles'),
  aceptar: (id: string) =>
    api<import('../types').ViajePortal>(`/cadetes/aceptar-viaje/${id}`, {
      method: 'POST',
      body: '{}',
    }),
  rechazar: (id: string) =>
    api<{ viaje_id: string; rechazado: boolean }>(`/cadetes/rechazar-viaje/${id}`, {
      method: 'POST',
      body: '{}',
    }),
  estadoViaje: (
    id: string,
    estado: 'cadete_en_camino' | 'cadete_llego' | 'en_curso' | 'finalizado',
  ) =>
    api<import('../types').ViajePortal>(`/cadetes/estado-viaje/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    }),
  ganancias: () => api<import('../types').GananciasPortal>('/cadetes/ganancias'),
  datosCobro: () =>
    api<{
      cbu: string | null;
      alias_bancario: string | null;
      banco: string | null;
      titular_cuenta: string | null;
      comision_actual: number;
      total_ganado: number;
    }>('/cadetes/datos-cobro'),
  misViajes: (cadeteId: string) =>
    api<import('../types').ViajePortal[]>(
      `/viajes?cadete_id=${encodeURIComponent(cadeteId)}&pageSize=50`,
    ),
};
