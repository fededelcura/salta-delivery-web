export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface AuthSession {
  usuario: {
    id: string;
    numero_usuario?: number;
    email: string;
    telefono: string;
    nombre: string;
    rol: string;
    estado: string;
  };
  tokens: {
    accessToken: string;
    expiresIn: string;
    tokenType: 'Bearer';
  };
}

export interface DashboardKpis {
  viajes_hoy: number;
  viajes_activos: number;
  cadetes_online: number;
  clientes_activos: number;
  usuarios_activos?: number;
  negocios_activos?: number;
  restaurantes_activos?: number;
  comercios_activos?: number;
  ingresos_hoy: number;
  comisiones_hoy: number;
  incidencias_abiertas: number;
}

export interface CadeteAdmin {
  usuario_id: string;
  numero_usuario: number;
  dni: string;
  licencia: string;
  patente: string;
  marca_moto?: string | null;
  direccion?: string | null;
  calle?: string | null;
  numero?: string | null;
  piso_dpto?: string | null;
  barrio?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  estado_verificacion: string;
  disponibilidad: string;
  plan_suscripcion: string;
  comision_actual: number;
  total_viajes: number;
  total_ganado: number;
  calificacion_promedio: number;
  email?: string;
  telefono?: string;
  nombre?: string;
  estado?: string;
  ubicacion_actual?: { lat: number; lng: number } | null;
  ubicacion_actualizada_en?: string | null;
  fotos_documentos?: {
    dni_pdf?: string;
    carnet_pdf?: string;
    seguro_pdf?: string;
    afip_pdf?: string;
    rentas_pdf?: string;
    [k: string]: string | undefined;
  };
  cbu?: string | null;
  alias_bancario?: string | null;
  banco?: string | null;
  titular_cuenta?: string | null;
}

export interface ClienteAdmin {
  usuario_id: string;
  numero_usuario: number;
  dni: string;
  direccion?: string | null;
  calle?: string | null;
  numero?: string | null;
  piso_dpto?: string | null;
  barrio?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  zona_h3?: string | null;
  zona_nombre?: string | null;
  plan_suscripcion: string;
  tipo_cuenta?: 'particular' | 'restaurante' | 'comercio';
  tiempo_preparacion_min?: number;
  horario_comercial?: { abre?: string; cierra?: string; dias?: number[] } | null;
  estado_suscripcion: string;
  viajes_realizados: number;
  calificacion_promedio: number;
  puntos_fidelidad: number;
  email: string;
  telefono: string;
  nombre: string;
  estado: string;
  metodo_pago_preferido?: string;
  fotos_documentos?: { dni_pdf?: string; [k: string]: string | undefined };
}

export interface ClienteDetalleAdmin {
  cliente: ClienteAdmin & {
    metodo_pago_preferido: string;
    direccion?: string | null;
    calle?: string | null;
    numero?: string | null;
    piso_dpto?: string | null;
    barrio?: string | null;
    ciudad?: string | null;
    provincia?: string | null;
    zona_h3?: string | null;
    zona_nombre?: string | null;
    direcciones_favoritas?: unknown[];
    fotos_documentos?: { dni_pdf?: string; [k: string]: string | undefined };
  };
  stats: {
    viajes_total: number;
    viajes_finalizados: number;
    viajes_cancelados: number;
    importe_pagado: number;
    ticket_promedio: number;
  };
  por_metodo: Array<{ metodo_pago: string; viajes: number; monto: number }>;
  viajes_recientes: Array<{
    id: string;
    fecha_solicitud: string;
    estado: string;
    tarifa_final: number | null;
    metodo_pago: string;
    tipo_servicio: string;
    destino_direccion: string;
  }>;
}

export interface CadeteDetalleAdmin {
  cadete: CadeteAdmin;
  stats: {
    viajes: number;
    tarifa_bruta: number;
    comision_retenida: number;
    neto_cadete: number;
    liquidaciones_pendientes: number;
    monto_pendiente: number;
    liquidaciones_transferidas: number;
    monto_transferido: number;
  };
}

export interface CadeteActividadStats {
  desde: string;
  hasta: string;
  resumen: {
    trabajando_ahora: number;
    minutos_online: number;
    minutos_en_viaje: number;
    viajes_finalizados: number;
    ganado_total: number;
  };
  trabajando_ahora: Array<{
    usuario_id: string;
    nombre: string;
    disponibilidad: string;
    zona_h3: string | null;
    zona_nombre: string | null;
    ubicacion: { lat: number; lng: number } | null;
    ubicacion_actualizada_en: string | null;
    desde_sesion: string | null;
    plan_suscripcion: string;
    total_viajes: number;
  }>;
  por_cadete: Array<{
    cadete_id: string;
    nombre: string;
    horas_online: number;
    horas_en_viaje: number;
    horas_ocupado: number;
    viajes_finalizados: number;
    km_totales: number;
    ganado: number;
    zonas_distintas: number;
  }>;
  por_zona: Array<{
    zona_h3: string | null;
    zona_nombre: string;
    horas: number;
    cadetes_unicos: number;
  }>;
  por_hora: Array<{
    hora: number;
    sesiones_activas: number;
    viajes: number;
  }>;
}

export interface LiquidacionAdmin {
  id: string;
  viaje_id: string;
  cadete_id: string;
  cliente_id: string;
  tarifa_cliente: number;
  comision_retenida: number;
  comision_pct: number;
  monto_a_transferir: number;
  metodo_pago_cliente: string;
  cbu_destino: string | null;
  alias_destino: string | null;
  banco_destino: string | null;
  titular_destino: string | null;
  plazo_dias: number;
  fecha_limite: string;
  estado: string;
  fecha_transferencia: string | null;
  fecha_creacion: string;
  cadete_nombre?: string;
  cliente_nombre?: string;
}

export interface ViajeAdmin {
  id: string;
  cliente_id: string;
  cadete_id: string | null;
  tipo_servicio: string;
  origen_direccion: string;
  destino_direccion: string;
  distancia_km: number | null;
  tarifa_final: number | null;
  estado: string;
  fecha_solicitud: string;
  metodo_pago: string;
  estado_pago: string;
  origen?: { lat: number; lng: number };
  destino?: { lat: number; lng: number };
}

export interface Incidencia {
  id: string;
  viaje_id: string | null;
  usuario_reporta: string;
  tipo: string;
  nivel: string;
  descripcion: string;
  estado: string;
  asignado_a: string | null;
  fecha_creacion?: string;
}

export interface ReportesData {
  periodo_dias?: number;
  sujeto?: {
    tipo: 'todos' | 'cadete' | 'cliente';
    id: string | null;
    nombre: string | null;
  };
  catalogo?: {
    zonas: Array<{ h3_index: string; nombre: string }>;
    franjas: string[];
  };
  filtros?: {
    tipos: string[];
    metodos: string[];
    zonas?: string[];
    franjas?: string[];
    cadete_id?: string | null;
    cliente_id?: string | null;
  };
  totales?: {
    viajes: number;
    ingresos: number;
    comisiones: number;
    egresos: number;
  };
  financieros: Array<{
    dia: string;
    viajes?: number;
    ingresos: number;
    comisiones: number;
    egresos?: number;
  }>;
  operativos: Array<{ estado: string; cantidad: number }>;
  por_tipo?: Array<{
    tipo_servicio: string;
    viajes: number;
    ingresos: number;
    comisiones: number;
  }>;
  por_metodo?: Array<{ metodo_pago: string; viajes: number; monto: number }>;
  por_zona?: Array<{ zona: string; viajes: number; ingresos: number }>;
  por_franja?: Array<{ franja: string; viajes: number; ingresos: number }>;
}

export interface ReporteGuardado {
  id: string;
  tipo: string;
  titulo: string;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  resumen: Record<string, unknown>;
  detalle?: Record<string, unknown>;
  fecha_creacion: string;
  generado_nombre?: string | null;
}

export interface PlanesCatalogo {
  cliente: Array<{ plan: string; monto_mensual: number; descuento_pct: number }>;
  cadete: Array<{
    plan: string;
    monto_mensual: number;
    comision_pct: number;
    dias_trial?: number;
  }>;
}

export interface TarifasBase {
  base_fija: number;
  precio_km: number;
  precio_minuto: number;
  moneda?: string;
  ciudad?: string;
  pais?: string;
}

export interface ConfigComision {
  id: string;
  plan_cadete: string;
  tipo_servicio: string;
  comision_pct: number;
}

export interface Comprobante {
  id: string;
  numero: string;
  viaje_id: string;
  usuario_id: string;
  rol_destino: 'cliente' | 'cadete';
  tarifa_total: number;
  comision_pct: number;
  comision_monto: number;
  pago_cadete: number;
  monto_usuario: number;
  metodo_pago: string;
  tipo_servicio: string;
  detalle: Record<string, unknown>;
  fecha_emision: string;
  cliente_nombre?: string;
  cadete_nombre?: string;
  usuario_nombre?: string;
}

export interface ComprobantesListResponse {
  items: Comprobante[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    cantidad: number;
    tarifa_total: number;
    comision_total: number;
    pago_cadetes: number;
  };
}

export interface ZonaHex {
  id: string;
  h3_index: string;
  tipo: string;
  lat_centro: number;
  lng_centro: number;
  tarifa_multiplier: number;
  demanda_actual: number;
  activa: boolean;
  nombre: string | null;
}

/** Tipos portal cliente / cadete (MVP web) */
export interface ViajePortal {
  id: string;
  cliente_id: string;
  cadete_id: string | null;
  tipo_servicio: string;
  origen_direccion: string;
  destino_direccion: string;
  origen?: { lat: number; lng: number };
  destino?: { lat: number; lng: number };
  distancia_km: number | null;
  tiempo_estimado_min?: number | null;
  tarifa_estimada?: number | null;
  tarifa_final: number | null;
  estado: string;
  fecha_solicitud: string;
  metodo_pago: string;
  estado_pago: string;
}

export interface ClientePortalPerfil {
  usuario_id: string;
  dni?: string;
  plan_suscripcion?: string;
  tipo_cuenta?: string;
  metodo_pago_preferido?: string;
  direcciones_favoritas?: Array<{
    alias: string;
    direccion: string;
    lat: number;
    lng: number;
  }>;
  email?: string;
  telefono?: string;
  nombre?: string;
}

export interface CadetePortal {
  usuario_id: string;
  disponibilidad: string;
  estado_verificacion?: string;
  plan_suscripcion?: string;
  comision_actual?: number;
  total_viajes?: number;
  total_ganado?: number;
  ubicacion_actual?: { lat: number; lng: number } | null;
  nombre?: string;
  email?: string;
}

export interface GananciasPortal {
  total_ganado?: number;
  viajes_finalizados?: number;
  comision_actual?: number;
  periodo?: string;
  [key: string]: unknown;
}

export interface CalcularTarifaPortal {
  distancia_km: number;
  tiempo_estimado_min: number;
  detalle?: { total?: number; tarifa_estimada?: number; [key: string]: unknown };
}
