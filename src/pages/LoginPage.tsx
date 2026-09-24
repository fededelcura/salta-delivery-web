import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiClientError } from '../lib/api';
import { homeForRole } from '../lib/roles';

export function LoginPage() {
  const { session, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const raw =
        err instanceof ApiClientError || err instanceof Error ? err.message : 'Error';
      const msg =
        /failed to fetch|networkerror|load failed/i.test(raw)
          ? 'No se pudo conectar con la API. En Vercel falta VITE_API_URL apuntando a Railway (ver docs/DEPLOY-VERCEL.md).'
          : raw;
      setError(msg);
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
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>
      </form>
    </div>
  );
}
