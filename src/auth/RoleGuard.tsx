import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { homeForRole } from '../lib/roles';

export function RoleGuard({
  allow,
  children,
}: {
  allow: string[];
  children: ReactNode;
}) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (!allow.includes(session.usuario.rol)) {
    return <Navigate to={homeForRole(session.usuario.rol)} replace />;
  }
  return <>{children}</>;
}
