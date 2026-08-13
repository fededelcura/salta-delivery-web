import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../lib/api';
import { Badge, ErrorBox, Loading, PageHeader } from '../components/ui';
import { MapView } from '../components/MapView';
import type { ZonaHex } from '../types';

const TIPOS_ZONA = ['centro', 'comercial', 'residencial', 'aeropuerto', 'periferia'] as const;

const emptyNueva = {
  h3_index: '',
  nombre: '',
  tipo: 'residencial' as string,
  lat_centro: -24.7821,
  lng_centro: -65.4232,
  tarifa_multiplier: 1.0,
  activa: true,
};

export function ZonasPage() {
  const [zonas, setZonas] = useState<ZonaHex[] | null>(null);
  const [edit, setEdit] = useState<ZonaHex | null>(null);
  const [nueva, setNueva] = useState(emptyNueva);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showNueva, setShowNueva] = useState(false);

  const load = useCallback(() => {
    setError(null);
    adminApi
      .zonas()
      .then((rows) => {
        setZonas(rows);
        setEdit((prev) => {
          if (prev) return rows.find((z) => z.id === prev.id) ?? rows[0] ?? null;
          return rows[0] ?? null;
        });
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markers = useMemo(
    () =>
      (zonas ?? []).map((z) => ({
        id: z.id,
        lat: z.lat_centro,
        lng: z.lng_centro,
        label: `${z.nombre ?? z.h3_index} ×${z.tarifa_multiplier}`,
        color: z.activa ? '#0c6b6b' : '#5a6b78',
      })),
    [zonas],
  );

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await adminApi.actualizarZona(edit.id, {
        nombre: edit.nombre,
        tipo: edit.tipo,
        lat_centro: edit.lat_centro,
        lng_centro: edit.lng_centro,
        tarifa_multiplier: edit.tarifa_multiplier,
        activa: edit.activa,
      });
      setZonas((prev) => (prev ?? []).map((z) => (z.id === updated.id ? updated : z)));
      setEdit(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la zona');
    } finally {
      setSaving(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!nueva.h3_index.trim()) {
      setError('El índice H3 es obligatorio');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await adminApi.crearZona({
        h3_index: nueva.h3_index.trim(),
        nombre: nueva.nombre.trim() || null,
        tipo: nueva.tipo,
        lat_centro: nueva.lat_centro,
        lng_centro: nueva.lng_centro,
        tarifa_multiplier: nueva.tarifa_multiplier,
        activa: nueva.activa,
      });
      setZonas((prev) => [...(prev ?? []), created]);
      setEdit(created);
      setNueva(emptyNueva);
      setShowNueva(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la zona');
    } finally {
      setCreating(false);
    }
  }

  async function desactivarZona(z: ZonaHex) {
    if (!window.confirm(`¿Dar de baja la zona "${z.nombre ?? z.h3_index}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await adminApi.bajaZona(z.id);
      setZonas((prev) => (prev ?? []).map((row) => (row.id === updated.id ? updated : row)));
      if (edit?.id === updated.id) setEdit(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dar de baja la zona');
    } finally {
      setSaving(false);
    }
  }

  if (error && !zonas) return <ErrorBox message={error} />;
  if (!zonas) return <Loading />;

  return (
    <div className="page-enter">
      <PageHeader
        title="Zonas"
        subtitle="Hexágonos H3 de Salta y multiplicador tarifario"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setShowNueva(true)}>
            Nueva zona
          </button>
        }
      />
      {error ? <ErrorBox message={error} /> : null}

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
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {zonas.map((z) => (
                <tr key={z.id}>
                  <td>
                    <strong>{z.nombre ?? '—'}</strong>
                  </td>
                  <td>
                    <Badge tone="brand">{z.tipo}</Badge>
                  </td>
                  <td className="mono">{z.h3_index}</td>
                  <td>{z.tarifa_multiplier.toFixed(2)}</td>
                  <td>
                    <Badge tone={z.activa ? 'ok' : 'danger'}>
                      {z.activa ? 'activa' : 'inactiva'}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEdit(z)}
                      >
                        Editar
                      </button>
                      {z.activa ? (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={saving}
                          onClick={() => void desactivarZona(z)}
                        >
                          Dar de baja
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {zonas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Sin zonas — usá “Nueva zona”
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {edit ? (
          <form className="panel panel-pad stack" onSubmit={(e) => void onSave(e)}>
            <h3 style={{ margin: 0 }}>Editar zona</h3>
            <div className="field">
              <label>Nombre</label>
              <input
                value={edit.nombre ?? ''}
                onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Tipo</label>
              <select
                value={edit.tipo}
                onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}
              >
                {TIPOS_ZONA.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>H3 index</label>
              <input className="mono" value={edit.h3_index} readOnly />
            </div>
            <div className="field">
              <label>Latitud centro</label>
              <input
                type="number"
                step="0.0001"
                value={edit.lat_centro}
                onChange={(e) => setEdit({ ...edit, lat_centro: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Longitud centro</label>
              <input
                type="number"
                step="0.0001"
                value={edit.lng_centro}
                onChange={(e) => setEdit({ ...edit, lng_centro: Number(e.target.value) })}
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
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        ) : null}
      </div>

      {showNueva ? (
        <div className="modal-backdrop" onClick={() => !creating && setShowNueva(false)}>
          <form
            className="modal"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void onCreate(e)}
          >
            <h2>Nueva zona</h2>
            <div className="form-grid">
              <div className="field full">
                <label>H3 index</label>
                <input
                  required
                  className="mono"
                  placeholder="88a8a0a2bffffff"
                  value={nueva.h3_index}
                  onChange={(e) => setNueva({ ...nueva, h3_index: e.target.value })}
                />
              </div>
              <div className="field full">
                <label>Nombre</label>
                <input
                  value={nueva.nombre}
                  onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Tipo</label>
                <select
                  value={nueva.tipo}
                  onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })}
                >
                  {TIPOS_ZONA.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Multiplicador</label>
                <input
                  type="number"
                  step="0.05"
                  value={nueva.tarifa_multiplier}
                  onChange={(e) =>
                    setNueva({ ...nueva, tarifa_multiplier: Number(e.target.value) })
                  }
                />
              </div>
              <div className="field">
                <label>Latitud</label>
                <input
                  type="number"
                  step="0.0001"
                  value={nueva.lat_centro}
                  onChange={(e) => setNueva({ ...nueva, lat_centro: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Longitud</label>
                <input
                  type="number"
                  step="0.0001"
                  value={nueva.lng_centro}
                  onChange={(e) => setNueva({ ...nueva, lng_centro: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Activa</label>
                <select
                  value={nueva.activa ? '1' : '0'}
                  onChange={(e) => setNueva({ ...nueva, activa: e.target.value === '1' })}
                >
                  <option value="1">Sí</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={creating}
                onClick={() => setShowNueva(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creando…' : 'Crear zona'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
