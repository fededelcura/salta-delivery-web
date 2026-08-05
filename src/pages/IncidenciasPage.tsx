import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import type { Incidencia } from '../types';
import { useAuth } from '../auth/AuthContext';
import { Badge, ErrorBox, Loading, PageHeader } from '../components/ui';

function toneNivel(n: string) {
  if (n === 'critico' || n === 'alto') return 'danger' as const;
  if (n === 'medio') return 'warn' as const;
  return 'neutral' as const;
}

export function IncidenciasPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<Incidencia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi
      .incidencias()
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolver(id: string) {
    setBusy(id);
    try {
      await adminApi.patchIncidencia(id, {
        estado: 'resuelta',
        asignado_a: session?.usuario.id,
        resolucion: 'Resuelto desde panel admin',
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  async function asignarme(id: string) {
    setBusy(id);
    try {
      await adminApi.patchIncidencia(id, {
        estado: 'en_proceso',
        asignado_a: session?.usuario.id,
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(null);
    }
  }

  if (error && !items) return <ErrorBox message={error} />;
  if (!items) return <Loading />;

  return (
    <div className="page-enter">
      <PageHeader
        title="Incidencias"
        subtitle="Asignar y resolver reportes operativos"
        actions={
          <button type="button" className="btn btn-ghost" onClick={load}>
            Actualizar
          </button>
        }
      />
      {error ? <ErrorBox message={error} /> : null}

      <div className="panel table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Nivel</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Viaje</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.tipo}</td>
                <td>
                  <Badge tone={toneNivel(i.nivel)}>{i.nivel}</Badge>
                </td>
                <td style={{ maxWidth: 320, whiteSpace: 'normal' }}>{i.descripcion}</td>
                <td>
                  <Badge
                    tone={
                      i.estado === 'resuelta' || i.estado === 'cerrada' ? 'ok' : 'warn'
                    }
                  >
                    {i.estado}
                  </Badge>
                </td>
                <td className="mono">{i.viaje_id ? i.viaje_id.slice(0, 8) : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy === i.id}
                      onClick={() => void asignarme(i.id)}
                    >
                      Asignarme
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy === i.id}
                      onClick={() => void resolver(i.id)}
                    >
                      Resolver
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Sin incidencias
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
