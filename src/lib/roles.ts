/** Rutas home por rol del portal multi-usuario. */

export type PortalRol = 'administrador' | 'cliente' | 'cadete';

export function homeForRole(rol: string): string {
  if (rol === 'administrador') return '/panel';
  if (rol === 'cadete') return '/cadete';
  if (rol === 'cliente') return '/app';
  return '/login';
}

/** `?volver=/pedir` solo acepta rutas internas (evita redirigir a otro sitio). */
export function volverParam(params: URLSearchParams): string | null {
  const v = params.get('volver');
  return v && v.startsWith('/') && !v.startsWith('//') ? v : null;
}

/** Solo el cliente vuelve a donde estaba (armando un pedido); el resto va a su inicio. */
export function destinoTrasLogin(rol: string, volver: string | null): string {
  return rol === 'cliente' && volver ? volver : homeForRole(rol);
}

export function isPortalRol(rol: string): rol is PortalRol {
  return rol === 'administrador' || rol === 'cliente' || rol === 'cadete';
}
