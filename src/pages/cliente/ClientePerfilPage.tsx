import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { clientePortalApi } from '../../lib/api';
import type { ClientePortalPerfil } from '../../types';
import { ErrorBox, Loading, PageHeader } from '../../components/ui';

export function ClientePerfilPage() {
  const { session, logout } = useAuth();
  const [perfil, setPerfil] = useState<ClientePortalPerfil | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientePortalApi
      .perfil()
      .then(setPerfil)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error && !perfil) return <ErrorBox message={error} />;
  if (!perfil && !error) return <Loading />;

  const favs = perfil?.direcciones_favoritas ?? [];

  return (
    <div className="page-enter">
      <PageHeader title="Perfil" subtitle="Datos de tu cuenta cliente" />
      {error ? <ErrorBox message={error} /> : null}
      <div className="panel panel-pad" style={{ maxWidth: 480 }}>
        <p>
          <strong>{session?.usuario.nombre}</strong>
        </p>
        <p className="muted">{session?.usuario.email}</p>
        <p className="muted">{session?.usuario.telefono}</p>
        {perfil ? (
          <>
            <p>
              Plan: <strong>{perfil.plan_suscripcion ?? '—'}</strong>
            </p>
            <p>
              Tipo: <strong>{perfil.tipo_cuenta ?? 'particular'}</strong>
            </p>
            <p>
              Pago preferido: <strong>{perfil.metodo_pago_preferido ?? '—'}</strong>
            </p>
          </>
        ) : null}

        <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: '1rem' }}>Lugares guardados</h3>
        {favs.length === 0 ? (
          <p className="muted">
            Todavía no tenés Casa/Trabajo. Guardalos desde <Link to="/pedir">Pedir</Link>.
          </p>
        ) : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {favs.map((d) => (
              <li key={`${d.alias}-${d.lat}-${d.lng}`} style={{ marginBottom: 6 }}>
                <strong>{d.alias}</strong>
                <div className="muted" style={{ fontSize: '0.9rem' }}>
                  {d.direccion}
                </div>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="btn btn-ghost" style={{ marginTop: 16 }} onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
