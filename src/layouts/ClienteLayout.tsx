import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const items = [
  { to: '/app', label: 'Inicio', short: 'Inicio', end: true },
  { to: '/app/pedir', label: 'Pedir envío', short: 'Pedir' },
  { to: '/app/historial', label: 'Historial', short: 'Historial' },
  { to: '/app/perfil', label: 'Perfil', short: 'Perfil' },
];

const titles: Record<string, string> = {
  '/app': 'Inicio',
  '/app/pedir': 'Pedir envío',
  '/app/historial': 'Historial',
  '/app/perfil': 'Perfil',
};

export function ClienteLayout() {
  const { session, logout } = useAuth();
  const { pathname } = useLocation();
  const pageTitle = titles[pathname] ?? 'Cliente';

  return (
    <div className="app-shell app-shell-portal">
      <aside className="sidebar sidebar-portal">
        <div className="brand">
          <strong>Salta Delivery</strong>
          <span>Portal cliente</span>
        </div>
        <nav className="nav nav-desktop" aria-label="Cliente">
          <div className="nav-group">
            <div className="nav-group-title">Mi cuenta</div>
            {items.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="nav-link">
                <span>{l.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="sidebar-footer sidebar-footer-desktop">
          <div className="sidebar-user">
            <div className="sidebar-avatar" aria-hidden>
              {(session?.usuario.nombre ?? 'C').slice(0, 1).toUpperCase()}
            </div>
            <div className="sidebar-user-meta">
              <div className="sidebar-user-name">{session?.usuario.nombre}</div>
              <div className="sidebar-user-email">{session?.usuario.email}</div>
            </div>
          </div>
          <button type="button" className="btn-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="workspace workspace-portal">
        <header className="topbar">
          <div>
            <div className="topbar-kicker">Cliente</div>
            <div className="topbar-title">{pageTitle}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-logout-mobile" onClick={logout}>
            Salir
          </button>
        </header>
        <main className="main main-portal">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Navegación cliente">
        {items.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="bottom-nav-link">
            <span>{l.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
