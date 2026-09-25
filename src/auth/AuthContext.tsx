import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, setToken } from '../lib/api';
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
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (session.tokens?.accessToken) {
      setToken(session.tokens.accessToken);
      return session;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    const rol = data.usuario.rol;
    if (rol !== 'administrador' && rol !== 'cliente' && rol !== 'cadete') {
      throw new Error('Este rol no tiene acceso al portal web');
    }
    if (data.usuario.estado && data.usuario.estado !== 'activo') {
      throw new Error('Tu cuenta no está activa');
    }
    setToken(data.tokens.accessToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSession(data);
  }, []);

  const completeSession = useCallback((data: AuthSession) => {
    setToken(data.tokens.accessToken);
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
