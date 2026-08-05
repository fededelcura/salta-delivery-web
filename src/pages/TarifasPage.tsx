import { FormEvent, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../lib/api';
import type { ConfigComision, TarifasBase } from '../types';
import { ErrorBox, PageHeader } from '../components/ui';

const DEFAULTS: TarifasBase = {
  base_fija: 500,
  precio_km: 350,
  precio_minuto: 100,
  moneda: 'ARS',
  ciudad: 'Salta',
};

const PLANES = ['trial', 'silver', 'gold', 'premium'] as const;
const TIPOS = [
  { id: 'delivery', label: 'Delivery' },
  { id: 'mensajeria', label: 'Mensajería' },
  { id: 'envio_paquete', label: 'Paquete' },
] as const;

type Matrix = Record<string, Record<string, number>>;

function toMatrix(rows: ConfigComision[]): Matrix {
  const m: Matrix = {};
  for (const plan of PLANES) {
    m[plan] = {};
    for (const t of TIPOS) m[plan][t.id] = 15;
  }
  for (const r of rows) {
    if (!m[r.plan_cadete]) m[r.plan_cadete] = {};
    m[r.plan_cadete][r.tipo_servicio] = r.comision_pct;
  }
  return m;
}

export function TarifasPage() {
  const [form, setForm] = useState<TarifasBase>(DEFAULTS);
  const [saved, setSaved] = useState<TarifasBase | null>(null);
  const [matrix, setMatrix] = useState<Matrix>(() => toMatrix([]));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCom, setLoadingCom] = useState(false);

  useEffect(() => {
    void adminApi
      .comisiones()
      .then((rows) => setMatrix(toMatrix(rows)))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const data = await adminApi.configurarTarifas({
        base_fija: form.base_fija,
        precio_km: form.precio_km,
        precio_minuto: form.precio_minuto,
      });
      setSaved(data);
      setOk('Tarifas actualizadas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function saveComisiones() {
    setLoadingCom(true);
    setError(null);
    setOk(null);
    try {
      const items = PLANES.flatMap((plan) =>
        TIPOS.map((t) => ({
          plan_cadete: plan,
          tipo_servicio: t.id,
          comision_pct: Number(matrix[plan]?.[t.id] ?? 15),
        })),
      );
      const rows = await adminApi.guardarComisiones(items);
      setMatrix(toMatrix(rows));
      setOk('Comisiones guardadas — se aplican al cerrar cada viaje');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoadingCom(false);
    }
  }

  const ejemplo = useMemo(
    () => form.base_fija + 5 * form.precio_km + 15 * form.precio_minuto,
    [form],
  );

  return (
    <div className="page-enter">
      <PageHeader
        title="Tarifas y comisiones"
        subtitle="Base de precio + % de comisión por plan cadete y tipo de pedido"
      />
      {error ? <ErrorBox message={error} /> : null}
      {ok ? (
        <div className="error-banner" style={{ background: '#e5f6ec', color: '#1f7a4c' }}>
          {ok}
        </div>
      ) : null}

      <div className="grid-2">
        <form className="panel panel-pad stack" onSubmit={onSubmit}>
          <h3 style={{ marginTop: 0 }}>Tarifa base</h3>
          <div className="field">
            <label htmlFor="base">Base fija (ARS)</label>
            <input
              id="base"
              type="number"
              value={form.base_fija}
              onChange={(e) => setForm({ ...form, base_fija: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="km">Precio por km</label>
            <input
              id="km"
              type="number"
              value={form.precio_km}
              onChange={(e) => setForm({ ...form, precio_km: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="min">Precio por minuto</label>
            <input
              id="min"
              type="number"
              value={form.precio_minuto}
              onChange={(e) => setForm({ ...form, precio_minuto: Number(e.target.value) })}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar tarifas'}
          </button>
        </form>

        <div className="panel panel-pad">
          <h3 style={{ marginTop: 0 }}>Simulación rápida</h3>
          <p className="muted">Ejemplo: 5 km · 15 min · sin multiplicadores</p>
          <p className="value" style={{ fontSize: '2rem', fontWeight: 800 }}>
            ${ejemplo.toLocaleString('es-AR')}
          </p>
          {saved ? (
            <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(saved, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>

      <div className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Tarifa dinámica (automática)</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Al calcular o solicitar un viaje, la API aplica multiplicadores según el momento y el
          origen (timezone America/Argentina/Salta). Config en{' '}
          <code>tarifas.multiplicadores.*</code>.
        </p>
        <ul className="muted" style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.6 }}>
          <li>
            <strong>Hora:</strong> valle ×1 · pico mañana ×1.2 · mediodía ×1.15 · tarde ×1.25 ·
            noche ×1.35 · madrugada ×1.5
          </li>
          <li>
            <strong>Zona:</strong> hexágono H3 más cercano al origen (
            <code>zonas_hexagonos.tarifa_multiplier</code>)
          </li>
          <li>
            <strong>Demanda:</strong> viajes activos cerca + cadetes online (baja ×1 → muy alta
            ×1.4). Cada solicitud suma presión en la zona.
          </li>
        </ul>
      </div>

      <div className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <div className="panel-head">
          <h3>Comisión plataforma (%)</h3>
          <button
            className="btn btn-primary"
            type="button"
            disabled={loadingCom}
            onClick={() => void saveComisiones()}
          >
            {loadingCom ? 'Guardando…' : 'Guardar comisiones'}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Al finalizar un viaje se emiten comprobantes SD-###### y se cobra este % según plan del
          cadete y tipo de pedido.
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Plan cadete</th>
                {TIPOS.map((t) => (
                  <th key={t.id}>{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANES.map((plan) => (
                <tr key={plan}>
                  <td style={{ textTransform: 'capitalize', fontWeight: 700 }}>{plan}</td>
                  {TIPOS.map((t) => (
                    <td key={t.id}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        style={{ width: 88 }}
                        value={matrix[plan]?.[t.id] ?? 15}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMatrix((prev) => ({
                            ...prev,
                            [plan]: { ...prev[plan], [t.id]: v },
                          }));
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
