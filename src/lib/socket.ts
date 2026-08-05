import { io, type Socket } from 'socket.io-client';

export function getSocketUrl(): string {
  const explicit = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, '');

  const api = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
  if (api.startsWith('http')) {
    return api.replace(/\/api\/?$/, '');
  }

  // En dev, Vite proxyea /socket.io → API
  return window.location.origin;
}

export function connectAdminSocket(token: string): Socket {
  return io(getSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
}

export type CadeteUbicacionEvent = {
  cadete_id: string;
  viaje_id?: string;
  lat: number;
  lng: number;
  ts?: string;
};

export type ViajeEstadoEvent = {
  viaje_id: string;
  estado: string;
  by?: string;
  ts?: string;
};
