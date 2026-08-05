import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AdminLayout } from './layouts/AdminLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CadetesPage } from './pages/CadetesPage';
import { ActividadCadetesPage } from './pages/ActividadCadetesPage';
import { ClientesPage } from './pages/ClientesPage';
import { ViajesPage } from './pages/ViajesPage';
import { SuscripcionesPage } from './pages/SuscripcionesPage';
import { TarifasPage } from './pages/TarifasPage';
import { ZonasPage } from './pages/ZonasPage';
import { IncidenciasPage } from './pages/IncidenciasPage';
import { ReportesPage } from './pages/ReportesPage';
import { ComprobantesPage } from './pages/ComprobantesPage';
import { LiquidacionesPage } from './pages/LiquidacionesPage';

function Protected() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Protected />}>
          <Route path="/panel" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="cadetes" element={<CadetesPage />} />
            <Route path="actividad-cadetes" element={<ActividadCadetesPage />} />
            <Route path="clientes" element={<ClientesPage ambito="usuario" />} />
            <Route path="negocios" element={<ClientesPage ambito="negocio" />} />
            <Route path="viajes" element={<ViajesPage />} />
            <Route path="suscripciones" element={<SuscripcionesPage />} />
            <Route path="tarifas" element={<TarifasPage />} />
            <Route path="zonas" element={<ZonasPage />} />
            <Route path="incidencias" element={<IncidenciasPage />} />
            <Route path="reportes" element={<ReportesPage />} />
            <Route path="comprobantes" element={<ComprobantesPage />} />
            <Route path="liquidaciones" element={<LiquidacionesPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
