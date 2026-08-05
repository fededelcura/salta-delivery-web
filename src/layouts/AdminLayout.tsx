import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const groups = [
  {
    title: 'Operación',
    items: [
      { to: '/panel', label: 'Inicio', end: true, icon: 'home' },
      { to: '/panel/viajes', label: 'Viajes', icon: 'trip' },
      { to: '/panel/incidencias', label: 'Incidencias', icon: 'alert' },
      { to: '/panel/zonas', label: 'Zonas', icon: 'map' },
    ],
  },
  {
    title: 'Personas',
    items: [
      { to: '/panel/cadetes', label: 'Cadetes', icon: 'bike' },
      { to: '/panel/actividad-cadetes', label: 'Actividad', icon: 'chart' },
      { to: '/panel/clientes', label: 'Usuarios', icon: 'user' },
      { to: '/panel/negocios', label: 'Negocios', icon: 'plan' },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { to: '/panel/suscripciones', label: 'Planes', icon: 'plan' },
      { to: '/panel/tarifas', label: 'Tarifas', icon: 'tariff' },
      { to: '/panel/comprobantes', label: 'Comprobantes', icon: 'chart' },
      { to: '/panel/liquidaciones', label: 'Liquidaciones', icon: 'tariff' },
      { to: '/panel/reportes', label: 'Reportes', icon: 'chart' },
    ],
  },
];

function NavIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case 'trip':
      return (
        <svg {...common}>
          <circle cx="7" cy="17" r="2.2" />
          <circle cx="17" cy="17" r="2.2" />
          <path d="M9.2 17h5.2M5 17H3.8a1 1 0 0 1-1-1.2l1.2-5.2A2 2 0 0 1 5.9 9h7.4l2.2 4h2.7a1.8 1.8 0 0 1 1.7 1.2L20.5 17H19" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="M12 9v4.5M12 17h.01M10.2 4.8 2.9 18a2 2 0 0 0 1.8 3h14.6a2 2 0 0 0 1.8-3L13.8 4.8a2 2 0 0 0-3.6 0Z" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <path d="M9 4 3 6.5v13L9 17l6 2.5L21 17V4l-6 2.5L9 4Z" />
          <path d="M9 4v13M15 6.5v13" />
        </svg>
      );
    case 'bike':
      return (
        <svg {...common}>
          <circle cx="6.5" cy="16.5" r="3" />
          <circle cx="17.5" cy="16.5" r="3" />
          <path d="M6.5 16.5 10 8h3l2.5 5.5M13 8h3.5l2 3.5" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 19.2a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'plan':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      );
    case 'tariff':
      return (
        <svg {...common}>
          <path d="M12 3v18M16.5 7.5A3.5 3.5 0 0 0 12 6 3.5 3.5 0 0 0 9 12c1.2.8 3.5 1.2 3.5 3.5A3.5 3.5 0 0 1 9 19a3.5 3.5 0 0 1-2.5-1" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 19h16M7 16V10M12 16V7M17 16v-4" />
        </svg>
      );
    default:
      return null;
  }
}

const titles: Record<string, string> = {
  '/panel': 'Inicio',
  '/panel/viajes': 'Viajes',
  '/panel/incidencias': 'Incidencias',
  '/panel/zonas': 'Zonas',
  '/panel/cadetes': 'Cadetes',
  '/panel/actividad-cadetes': 'Actividad',
  '/panel/clientes': 'Usuarios',
  '/panel/negocios': 'Negocios',
  '/panel/suscripciones': 'Planes',
  '/panel/tarifas': 'Tarifas',
  '/panel/comprobantes': 'Comprobantes',
  '/panel/liquidaciones': 'Liquidaciones',
  '/panel/reportes': 'Reportes',
};

export function AdminLayout() {
  const { session, logout } = useAuth();
  const { pathname } = useLocation();
  const pageTitle = titles[pathname] ?? 'Panel';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Salta Delivery</strong>
          <span>Panel operativo</span>
        </div>

        <nav className="nav" aria-label="Panel">
          {groups.map((g) => (
            <div className="nav-group" key={g.title}>
              <div className="nav-group-title">{g.title}</div>
              {g.items.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className="nav-link">
                  <NavIcon name={l.icon} />
                  <span>{l.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" aria-hidden>
              {(session?.usuario.nombre ?? 'A').slice(0, 1).toUpperCase()}
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

      <div className="workspace">
        <header className="topbar">
          <div>
            <div className="topbar-kicker">Salta Capital</div>
            <div className="topbar-title">{pageTitle}</div>
          </div>
          <div className="topbar-actions">
            <span className="live-pill">
              <span className="live-dot" />
              En vivo
            </span>
          </div>
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
