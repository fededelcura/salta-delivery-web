import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { adminApi } from '../lib/api';
import type { DashboardKpis, ReportesData } from '../types';
import { ErrorBox, Loading, Money, PageHeader } from '../components/ui';
import { MapView } from '../components/MapView';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [reportes, setReportes] = useState<ReportesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([adminApi.dashboard(), adminApi.reportes()])
      .then(([k, r]) => {
        if (!alive) return;
        setKpis(k);
        setReportes(r);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!kpis || !reportes) return <Loading />;

  const barData = {
    labels: reportes.financieros.slice(-14).map((x) => x.dia.slice(5)),
    datasets: [
      {
        label: 'Ingresos',
        data: reportes.financieros.slice(-14).map((x) => x.ingresos),
        backgroundColor: '#1a4f8c',
        borderRadius: 8,
      },
      {
        label: 'Comisiones',
        data: reportes.financieros.slice(-14).map((x) => x.comisiones),
        backgroundColor: '#e86a3c',
        borderRadius: 8,
      },
    ],
  };

  const doughData = {
    labels: reportes.operativos.map((x) => x.estado),
    datasets: [
      {
        data: reportes.operativos.map((x) => x.cantidad),
        backgroundColor: ['#1a4f8c', '#2f7d4f', '#e86a3c', '#6b7c8a', '#b42318', '#c5d7eb'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="page-enter">
      <PageHeader
        title="Operación de hoy"
        subtitle="Resumen en vivo de flota, viajes e ingresos"
        actions={
          <div className="quick-actions">
            <Link className="btn btn-primary" to="/panel/cadetes">
              Nuevo cadete
            </Link>
            <Link className="btn btn-ghost" to="/panel/clientes">
              Nuevo usuario
            </Link>
            <Link className="btn btn-ghost" to="/panel/negocios">
              Nuevo negocio
            </Link>
            <Link className="btn btn-ghost" to="/panel/viajes">
              Ver viajes
            </Link>
          </div>
        }
      />

      <div className="kpi-spotlight">
        <div className="kpi kpi-hero">
          <div className="label">Viajes activos</div>
          <div className="value">{kpis.viajes_activos}</div>
          <div className="kpi-hint">En curso ahora</div>
        </div>
        <div className="kpi kpi-hero tone-ok">
          <div className="label">Cadetes online</div>
          <div className="value">{kpis.cadetes_online}</div>
          <div className="kpi-hint">Listos para matching</div>
        </div>
        <div className="kpi kpi-hero tone-warn">
          <div className="label">Incidencias</div>
          <div className="value">{kpis.incidencias_abiertas}</div>
          <div className="kpi-hint">Requieren atención</div>
        </div>
        <div className="kpi kpi-hero tone-money">
          <div className="label">Ingresos hoy</div>
          <div className="value">
            <Money value={kpis.ingresos_hoy} />
          </div>
          <div className="kpi-hint">
            Comisiones <Money value={kpis.comisiones_hoy} />
          </div>
        </div>
      </div>

      <div className="kpi-grid kpi-grid-secondary">
        <div className="kpi">
          <div className="label">Viajes hoy</div>
          <div className="value">{kpis.viajes_hoy}</div>
        </div>
        <div className="kpi">
          <div className="label">Usuarios</div>
          <div className="value">{kpis.usuarios_activos ?? 0}</div>
          <div className="kpi-hint">Personas</div>
        </div>
        <div className="kpi">
          <div className="label">Negocios</div>
          <div className="value">{kpis.negocios_activos ?? 0}</div>
          <div className="kpi-hint">
            {kpis.restaurantes_activos ?? 0} resto · {kpis.comercios_activos ?? 0} comercios
          </div>
        </div>
        <div className="kpi">
          <div className="label">Comisiones hoy</div>
          <div className="value">
            <Money value={kpis.comisiones_hoy} />
          </div>
        </div>
      </div>

      <div className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <div className="panel-head">
          <h3>Clientes</h3>
          <span className="muted">Usuario o negocio</span>
        </div>
        <div className="quick-actions" style={{ marginTop: 8 }}>
          <Link className="btn btn-ghost" to="/panel/clientes">
            Usuarios ({kpis.usuarios_activos ?? 0})
          </Link>
          <Link className="btn btn-primary" to="/panel/negocios">
            Negocios ({kpis.negocios_activos ?? 0})
          </Link>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel panel-pad">
          <div className="panel-head">
            <h3>Ingresos · 14 días</h3>
            <span className="muted">ARS</span>
          </div>
          <Bar
            data={barData}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: 'rgba(20,33,43,0.06)' } },
              },
            }}
          />
        </div>
        <div className="panel panel-pad">
          <div className="panel-head">
            <h3>Viajes por estado</h3>
            <span className="muted">Distribución</span>
          </div>
          <div className="chart-doughnut">
            <Doughnut
              data={doughData}
              options={{
                cutout: '62%',
                plugins: { legend: { position: 'bottom' } },
              }}
            />
          </div>
        </div>
      </div>

      <div className="panel panel-pad panel-map">
        <div className="panel-head">
          <h3>Mapa operativo</h3>
          <Link className="text-link" to="/panel/cadetes">
            Ver flota →
          </Link>
        </div>
        <MapView />
      </div>
    </div>
  );
}
