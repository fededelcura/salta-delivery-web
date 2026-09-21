import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const items = [
  { to: '/cadete', label: 'Estado', short: 'Estado', end: true },
  { to: '/cadete/viajes', label: 'Viajes', short: 'Viajes' },
  { to: '/cadete/ganancias', label: 'Ganancias', short: 'Plata' },
  { to: '/cadete/perfil', label: 'Perfil', short: 'Perfil' },
];

const titles: Record<string, string> = {
  '/cadete': 'Estado',
  '/cadete/viajes': 'Viajes',
  '/cadete/ganancias': 'Ganancias',
  '/cadete/perfil': 'Perfil',
};

export function CadeteLayout() {
  const { session, logout } = useAuth();
  const { pathname } = useLocation();
  const pageTitle = titles[pathname] ?? 'Cadete';

  return (
    <div className="app-shell app-shell-portal">
      <aside className="sidebar sidebar-portal">
        <div className="brand">
          <strong>Salta Delivery</strong>
          <span>Portal cadete</span>
        </div>
        <nav className="nav nav-desktop" aria-label="Cadete">
          <div className="nav-group">
            <div className="nav-group-title">Trabajo</div>
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
            <div className="topbar-kicker">Cadete</div>
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

      <nav className="bottom-nav" aria-label="Navegación cadete">
        {items.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="bottom-nav-link">
            <span>{l.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
