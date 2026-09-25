import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, getToken, setToken } from '../lib/api';
import type { AuthSession } from '../types';

interface AuthState {
  session: AuthSession | null;
  login: (email: string, password: string) => Promise<void>;
  completeSession: (data: AuthSession) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = 'sd_session';

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setToken(null);
      return null;
    }
    const session = JSON.parse(raw) as AuthSession;
    const token = session.tokens?.accessToken?.trim();
    if (token) {
      setToken(token);
      return session;
    }
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());

  /** Mantener sd_token alineado con la sesión; sin token usable → invitado. */
  useEffect(() => {
    if (!session) {
      if (getToken()) setToken(null);
      return;
    }
    const access = session.tokens?.accessToken?.trim();
    if (!access) {
      localStorage.removeItem(STORAGE_KEY);
      setToken(null);
      setSession(null);
      return;
    }
    if (getToken() !== access) {
      setToken(access);
    }
  }, [session]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    const rol = data.usuario.rol;
    if (rol !== 'administrador' && rol !== 'cliente' && rol !== 'cadete') {
      throw new Error('Este rol no tiene acceso al portal web');
    }
    if (data.usuario.estado && data.usuario.estado !== 'activo') {
      throw new Error('Tu cuenta no está activa');
    }
    const token = data.tokens?.accessToken?.trim();
    if (!token) {
      throw new Error('Login sin token. Probá de nuevo.');
    }
    setToken(token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSession(data);
  }, []);

  const completeSession = useCallback((data: AuthSession) => {
    const token = data.tokens?.accessToken?.trim();
    if (!token) {
      setToken(null);
      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      return;
    }
    setToken(token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSession(data);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, login, completeSession, logout }),
    [session, login, completeSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
