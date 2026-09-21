import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RoleGuard } from './auth/RoleGuard';
import { homeForRole } from './lib/roles';
import { AdminLayout } from './layouts/AdminLayout';
import { ClienteLayout } from './layouts/ClienteLayout';
import { CadeteLayout } from './layouts/CadeteLayout';
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
import { ClienteInicioPage } from './pages/cliente/ClienteInicioPage';
import { ClientePedirPage } from './pages/cliente/ClientePedirPage';
import { ClienteHistorialPage } from './pages/cliente/ClienteHistorialPage';
import { ClientePerfilPage } from './pages/cliente/ClientePerfilPage';
import { CadeteEstadoPage } from './pages/cadete/CadeteEstadoPage';
import { CadeteViajesPage } from './pages/cadete/CadeteViajesPage';
import { CadeteGananciasPage } from './pages/cadete/CadeteGananciasPage';
import { CadetePerfilPage } from './pages/cadete/CadetePerfilPage';

function Protected() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function HomeRedirect() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={homeForRole(session.usuario.rol)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Protected />}>
          <Route path="/home" element={<HomeRedirect />} />

          <Route
            path="/panel"
            element={
              <RoleGuard allow={['administrador']}>
                <AdminLayout />
              </RoleGuard>
            }
          >
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

          <Route
            path="/app"
            element={
              <RoleGuard allow={['cliente']}>
                <ClienteLayout />
              </RoleGuard>
            }
          >
            <Route index element={<ClienteInicioPage />} />
            <Route path="pedir" element={<ClientePedirPage />} />
            <Route path="historial" element={<ClienteHistorialPage />} />
            <Route path="perfil" element={<ClientePerfilPage />} />
          </Route>

          <Route
            path="/cadete"
            element={
              <RoleGuard allow={['cadete']}>
                <CadeteLayout />
              </RoleGuard>
            }
          >
            <Route index element={<CadeteEstadoPage />} />
            <Route path="viajes" element={<CadeteViajesPage />} />
            <Route path="ganancias" element={<CadeteGananciasPage />} />
            <Route path="perfil" element={<CadetePerfilPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
