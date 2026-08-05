export type TipoCuentaCliente = 'particular' | 'restaurante' | 'comercio';

/** Cliente = Usuario | Negocio. Negocio = restaurante | comercio. */
export type CategoriaCliente = 'usuario' | 'negocio';

export function categoriaDe(tipo?: string | null): CategoriaCliente {
  return tipo === 'restaurante' || tipo === 'comercio' ? 'negocio' : 'usuario';
}

export function esNegocio(tipo?: string | null): boolean {
  return categoriaDe(tipo) === 'negocio';
}

export const PERFILES_CUENTA: Record<
  TipoCuentaCliente,
  {
    label: string;
    categoria: CategoriaCliente;
    descripcion: string;
    prep_default_min: number;
    prep_min: number;
    prep_max: number;
    espera_listo: boolean;
  }
> = {
  particular: {
    label: 'Usuario',
    categoria: 'usuario',
    descripcion: 'Persona: envíos y mensajería al momento',
    prep_default_min: 0,
    prep_min: 0,
    prep_max: 30,
    espera_listo: false,
  },
  restaurante: {
    label: 'Restaurante',
    categoria: 'negocio',
    descripcion: 'Negocio gastronómico con tiempo de cocina',
    prep_default_min: 25,
    prep_min: 10,
    prep_max: 90,
    espera_listo: true,
  },
  comercio: {
    label: 'Comercio',
    categoria: 'negocio',
    descripcion: 'Local de ventas con armado y ventana de retiro',
    prep_default_min: 15,
    prep_min: 5,
    prep_max: 120,
    espera_listo: true,
  },
};

export const TIPOS_NEGOCIO: TipoCuentaCliente[] = ['restaurante', 'comercio'];
