import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiClientError } from '../lib/api';
import { homeForRole } from '../lib/roles';

export function LoginPage() {
  const { session, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to={homeForRole(session.usuario.rol)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page login-page-visual">
      <div className="login-visual" aria-hidden="true">
        <img src="/hero-salta.jpg" alt="" />
        <div className="login-visual-copy">
          <p className="login-brand">Salta Delivery</p>
          <p>Admin, clientes y cadetes en un solo portal.</p>
        </div>
      </div>
      <form className="login-card" onSubmit={onSubmit}>
        <Link to="/" className="login-back">
          ← Volver
        </Link>
        <h1>Salta Delivery</h1>
        <p className="sub">Ingresá con tu email (admin, cliente o cadete)</p>
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="stack">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="tu@email.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>
      </form>
    </div>
  );
}
