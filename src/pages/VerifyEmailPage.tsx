import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiClientError, authApi } from '../lib/api';
import { homeForRole } from '../lib/roles';

export function VerifyEmailPage() {
  const { session, completeSession } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  if (session) return <Navigate to={homeForRole(session.usuario.rol)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const data = await authApi.verifyEmail(email.trim(), codigo.trim());
      completeSession(data);
      navigate(homeForRole(data.usuario.rol), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar');
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await authApi.resendVerification(email.trim());
      setInfo('Te enviamos un nuevo código. Revisá tu casilla (y spam).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <Link to="/login" className="login-back">
          ← Volver al login
        </Link>
        <h1>Verificá tu email</h1>
        <p className="sub">Ingresá el código de 6 dígitos que te enviamos</p>
        {error ? <div className="error-banner">{error}</div> : null}
        {info ? <div className="success-banner">{info}</div> : null}
        <div className="stack">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="codigo">Código</label>
            <input
              id="codigo"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              placeholder="123456"
              autoComplete="one-time-code"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading || codigo.length !== 6}>
            {loading ? 'Verificando…' : 'Confirmar'}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={resending || !email}
            onClick={() => void onResend()}
          >
            {resending ? 'Enviando…' : 'Reenviar código'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function RegisterPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [dni, setDni] = useState('');
  const [rol, setRol] = useState<'cliente' | 'cadete'>('cliente');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to={homeForRole(session.usuario.rol)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authApi.register({
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        password,
        rol,
        dni: rol === 'cliente' ? dni.trim() : undefined,
      });
      navigate(`/verificar-email?email=${encodeURIComponent(result.email)}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <Link to="/login" className="login-back">
          ← Ya tengo cuenta
        </Link>
        <h1>Crear cuenta</h1>
        <p className="sub">Te enviaremos un código a tu email para activarla</p>
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="stack">
          <div className="field">
            <label htmlFor="rol">Soy</label>
            <select id="rol" value={rol} onChange={(e) => setRol(e.target.value as 'cliente' | 'cadete')}>
              <option value="cliente">Cliente</option>
              <option value="cadete">Cadete</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="telefono">Teléfono</label>
            <input
              id="telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              placeholder="+549387..."
            />
          </div>
          {rol === 'cliente' ? (
            <div className="field">
              <label htmlFor="dni">DNI</label>
              <input id="dni" value={dni} onChange={(e) => setDni(e.target.value)} required />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="reg-password">Contraseña</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creando…' : 'Registrarme'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Re-export for LoginPage redirect helper */
export function isEmailNotVerified(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError && err.code === 'EMAIL_NOT_VERIFIED';
}
