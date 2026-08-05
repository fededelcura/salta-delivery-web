import { FormEvent, useMemo, useState } from 'react';
import { Badge, PageHeader } from '../components/ui';
import { MapView } from '../components/MapView';
import type { ZonaHex } from '../types';

/** Zonas seed (espejo de 002_seed) — edición local hasta endpoint admin/zonas */
const SEED: ZonaHex[] = [
  {
    id: '1',
    h3_index: '88a8a0a2bffffff',
    tipo: 'centro',
    lat_centro: -24.7821,
    lng_centro: -65.4232,
    tarifa_multiplier: 1.2,
    demanda_actual: 0,
    activa: true,
    nombre: 'Centro Cívico',
  },
  {
    id: '2',
    h3_index: '88a8a0a33ffffff',
    tipo: 'comercial',
    lat_centro: -24.789,
    lng_centro: -65.41,
    tarifa_multiplier: 1.15,
    demanda_actual: 0,
    activa: true,
    nombre: 'Shopping',
  },
  {
    id: '3',
    h3_index: '88a8a0a37ffffff',
    tipo: 'residencial',
    lat_centro: -24.77,
    lng_centro: -65.43,
    tarifa_multiplier: 1.0,
    demanda_actual: 0,
    activa: true,
    nombre: 'Tres Cerritos',
  },
  {
    id: '4',
    h3_index: '88a8a0a23ffffff',
    tipo: 'aeropuerto',
    lat_centro: -24.844,
    lng_centro: -65.48,
    tarifa_multiplier: 1.25,
    demanda_actual: 0,
    activa: true,
    nombre: 'Aeropuerto',
  },
];

export function ZonasPage() {
  const [zonas, setZonas] = useState<ZonaHex[]>(SEED);
  const [edit, setEdit] = useState<ZonaHex | null>(SEED[0] ?? null);

  const markers = useMemo(
    () =>
      zonas.map((z) => ({
        id: z.id,
        lat: z.lat_centro,
        lng: z.lng_centro,
        label: `${z.nombre ?? z.h3_index} ×${z.tarifa_multiplier}`,
        color: z.activa ? '#0c6b6b' : '#5a6b78',
      })),
    [zonas],
  );

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setZonas((prev) => prev.map((z) => (z.id === edit.id ? edit : z)));
  }

  return (
    <div className="page-enter">
      <PageHeader
        title="Zonas"
        subtitle="Hexágonos H3 de Salta y multiplicador tarifario"
      />

      <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <MapView markers={markers} zoom={11} />
      </div>

      <div className="grid-2">
        <div className="panel table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>H3</th>
                <th>× Tarifa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {zonas.map((z) => (
                <tr key={z.id}>
                  <td>
                    <strong>{z.nombre}</strong>
                  </td>
                  <td>
                    <Badge tone="brand">{z.tipo}</Badge>
                  </td>
                  <td className="mono">{z.h3_index}</td>
                  <td>{z.tarifa_multiplier.toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEdit(z)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {edit ? (
          <form className="panel panel-pad stack" onSubmit={onSave}>
            <h3 style={{ margin: 0 }}>Editar zona</h3>
            <div className="field">
              <label>Nombre</label>
              <input
                value={edit.nombre ?? ''}
                onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Multiplicador</label>
              <input
                type="number"
                step="0.05"
                value={edit.tarifa_multiplier}
                onChange={(e) =>
                  setEdit({ ...edit, tarifa_multiplier: Number(e.target.value) })
                }
              />
            </div>
            <div className="field">
              <label>Activa</label>
              <select
                value={edit.activa ? '1' : '0'}
                onChange={(e) => setEdit({ ...edit, activa: e.target.value === '1' })}
              >
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </div>
            <p className="muted">
              Persistencia en API de zonas: pendiente de endpoint admin dedicado. Cambios
              locales en esta sesión.
            </p>
            <button className="btn btn-primary" type="submit">
              Aplicar
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
