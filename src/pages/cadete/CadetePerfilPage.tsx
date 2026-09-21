import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { cadetePortalApi } from '../../lib/api';
import { ErrorBox, PageHeader } from '../../components/ui';

export function CadetePerfilPage() {
  const { session, logout } = useAuth();
  const [cobro, setCobro] = useState<{
    comision_actual: number;
    total_ganado: number;
    banco: string | null;
    alias_bancario: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cadetePortalApi
      .datosCobro()
      .then((d) =>
        setCobro({
          comision_actual: d.comision_actual,
          total_ganado: d.total_ganado,
          banco: d.banco,
          alias_bancario: d.alias_bancario,
        }),
      )
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="page-enter">
      <PageHeader title="Perfil" subtitle="Cuenta cadete" />
      {error ? <ErrorBox message={error} /> : null}
      <div className="panel panel-pad" style={{ maxWidth: 480 }}>
        <p>
          <strong>{session?.usuario.nombre}</strong>
        </p>
        <p className="muted">{session?.usuario.email}</p>
        <p className="muted">{session?.usuario.telefono}</p>
        {cobro ? (
          <>
            <p>
              Comisión actual: <strong>{cobro.comision_actual}%</strong>
            </p>
            <p>
              Banco / alias: <strong>{cobro.banco ?? '—'} / {cobro.alias_bancario ?? '—'}</strong>
            </p>
          </>
        ) : null}
        <button type="button" className="btn btn-ghost" style={{ marginTop: 16 }} onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
