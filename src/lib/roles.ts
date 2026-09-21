/** Rutas home por rol del portal multi-usuario. */

export type PortalRol = 'administrador' | 'cliente' | 'cadete';

export function homeForRole(rol: string): string {
  if (rol === 'administrador') return '/panel';
  if (rol === 'cadete') return '/cadete';
  if (rol === 'cliente') return '/app';
  return '/login';
}

export function isPortalRol(rol: string): rol is PortalRol {
  return rol === 'administrador' || rol === 'cliente' || rol === 'cadete';
}
