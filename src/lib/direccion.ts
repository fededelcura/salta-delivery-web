/** Campos de domicilio estructurado (cliente / cadete) */

export type DireccionParts = {
  calle: string;
  numero: string;
  piso_dpto: string;
  barrio: string;
  ciudad: string;
  provincia: string;
};

export const emptyDireccionParts = (): DireccionParts => ({
  calle: '',
  numero: '',
  piso_dpto: '',
  barrio: '',
  ciudad: 'Salta',
  provincia: 'Salta',
});

export function formatDireccionParts(p: {
  calle?: string | null;
  numero?: string | null;
  piso_dpto?: string | null;
  barrio?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  direccion?: string | null;
}): string {
  if (p.calle || p.numero || p.barrio) {
    const linea = [p.calle, p.numero].filter(Boolean).join(' ');
    return [linea, p.piso_dpto, p.barrio, p.ciudad, p.provincia].filter(Boolean).join(', ');
  }
  return p.direccion ?? '—';
}
