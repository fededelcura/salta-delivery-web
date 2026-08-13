import { FormEvent, useCallback, useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import type { PlanesCatalogo } from '../types';
import { ErrorBox, Loading, PageHeader } from '../components/ui';

export function SuscripcionesPage() {
  const [planes, setPlanes] = useState<PlanesCatalogo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    adminApi
      .getPlanes()
      .then(setPlanes)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!planes) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const data = await adminApi.setPlanes(planes);
      setPlanes(data);
      setOk('Planes guardados correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los planes');
    } finally {
      setSaving(false);
    }
  }

  if (error && !planes) return <ErrorBox message={error} />;
  if (!planes) return <Loading />;

  return (
    <div className="page-enter">
      <PageHeader
        title="Suscripciones"
        subtitle="Planes cliente y cadete vigentes en la plataforma"
      />
      {error ? <ErrorBox message={error} /> : null}
      {ok ? (
        <div className="error-banner" style={{ background: '#e5f6ec', color: '#1f7a4c' }}>
          {ok}
        </div>
      ) : null}

      <form onSubmit={(e) => void onSave(e)}>
        <div className="grid-2">
          <div className="panel panel-pad">
            <h3 style={{ marginTop: 0 }}>Clientes</h3>
            <table className="data">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Mensual (ARS)</th>
                  <th>Descuento (%)</th>
                </tr>
              </thead>
              <tbody>
                {planes.cliente.map((p, i) => (
                  <tr key={p.plan}>
                    <td>
                      <strong>{p.plan}</strong>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        style={{ width: 120 }}
                        value={p.monto_mensual}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setPlanes((prev) => {
                            if (!prev) return prev;
                            const cliente = [...prev.cliente];
                            cliente[i] = { ...cliente[i], monto_mensual: v };
                            return { ...prev, cliente };
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        style={{ width: 88 }}
                        value={p.descuento_pct}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setPlanes((prev) => {
                            if (!prev) return prev;
                            const cliente = [...prev.cliente];
                            cliente[i] = { ...cliente[i], descuento_pct: v };
                            return { ...prev, cliente };
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel panel-pad">
            <h3 style={{ marginTop: 0 }}>Cadetes</h3>
            <table className="data">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Mensual (ARS)</th>
                  <th>Comisión (%)</th>
                </tr>
              </thead>
              <tbody>
                {planes.cadete.map((p, i) => (
                  <tr key={p.plan}>
                    <td>
                      <strong>{p.plan}</strong>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        style={{ width: 120 }}
                        value={p.monto_mensual}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setPlanes((prev) => {
                            if (!prev) return prev;
                            const cadete = [...prev.cadete];
                            cadete[i] = { ...cadete[i], monto_mensual: v };
                            return { ...prev, cadete };
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        style={{ width: 88 }}
                        value={p.comision_pct}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setPlanes((prev) => {
                            if (!prev) return prev;
                            const cadete = [...prev.cadete];
                            cadete[i] = { ...cadete[i], comision_pct: v };
                            return { ...prev, cadete };
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar planes'}
          </button>
        </div>
      </form>
    </div>
  );
}
