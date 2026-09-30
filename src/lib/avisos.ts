/** Avisos al cadete: sonido, vibración y notificación del navegador (con la pestaña abierta). */

let audioCtx: AudioContext | null = null;

function contexto(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx ??= new Ctor();
  return audioCtx;
}

/** Los navegadores solo permiten audio después de un toque del usuario. */
export function desbloquearAudio(): void {
  void contexto()?.resume();
}

export function sonar(): void {
  const ctx = contexto();
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  for (const [i, freq] of [880, 1175].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const inicio = t0 + i * 0.18;
    gain.gain.setValueAtTime(0.0001, inicio);
    gain.gain.exponentialRampToValueAtTime(0.3, inicio + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + 0.17);
  }
}

export function vibrar(): void {
  navigator.vibrate?.([200, 100, 200]);
}

export function permisoNotificaciones(): NotificationPermission | 'no-soportado' {
  return 'Notification' in window ? Notification.permission : 'no-soportado';
}

export async function pedirPermiso(): Promise<NotificationPermission | 'no-soportado'> {
  desbloquearAudio();
  if (!('Notification' in window)) return 'no-soportado';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function notificar(titulo: string, cuerpo: string, tag = 'viaje-nuevo'): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const opciones: NotificationOptions = { body: cuerpo, tag, icon: 'pwa-192.png' };
  // Android Chrome no permite `new Notification`: hay que pasar por el service worker.
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) void reg.showNotification(titulo, opciones);
      else mostrarDirecto(titulo, opciones);
    });
    return;
  }
  mostrarDirecto(titulo, opciones);
}

function mostrarDirecto(titulo: string, opciones: NotificationOptions): void {
  try {
    new Notification(titulo, opciones);
  } catch {
    /* sin soporte: el sonido y la vibración ya avisaron */
  }
}

/** Mismo tag que el push del servidor: si llegan los dos, el sistema muestra una sola. */
export function avisarViajeNuevo(origen: string, tarifa: number, viajeId?: string): void {
  sonar();
  vibrar();
  notificar(
    'Pedido nuevo cerca',
    `${origen} · $${Math.round(tarifa).toLocaleString('es-AR')}`,
    viajeId ? `viaje-${viajeId}` : undefined,
  );
}

/* ---------- Web Push (app cerrada) ---------- */

export type EstadoPush =
  | 'activo'
  | 'no-soportado'
  | 'ios-sin-instalar'
  | 'bloqueado'
  | 'sin-servidor'
  | 'inactivo';

function esIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function instalada(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function pushSoportado(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function base64UrlABytes(b64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function registroSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return navigator.serviceWorker.ready;
}

/**
 * Suscribe este dispositivo a push y lo registra en la API.
 * Requiere permiso ya concedido (pedirPermiso) y el service worker de la PWA (solo en build).
 */
export async function activarPush(): Promise<EstadoPush> {
  if (esIOS() && !instalada()) return 'ios-sin-instalar';
  if (!pushSoportado()) return 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  if (Notification.permission !== 'granted') return 'inactivo';
  const reg = await registroSW();
  if (!reg) return 'no-soportado';
  const { pushApi } = await import('./api');
  let clave: string;
  try {
    clave = (await pushApi.clavePublica()).clave;
  } catch {
    return 'sin-servidor';
  }
  let sub = await reg.pushManager.getSubscription();
  const claveActual = sub?.options.applicationServerKey;
  const nueva = base64UrlABytes(clave);
  if (sub && claveActual && !mismosBytes(new Uint8Array(claveActual), nueva)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: nueva });
  await pushApi.suscribir(sub.toJSON());
  return 'activo';
}

function mismosBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Al cerrar sesión: que este teléfono deje de recibir avisos de esa cuenta. */
export async function desactivarPush(token: string | null): Promise<void> {
  try {
    const reg = await registroSW();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const { endpoint } = sub;
    await sub.unsubscribe();
    if (token) {
      const { pushApi } = await import('./api');
      await pushApi.desuscribir(endpoint, token);
    }
  } catch {
    /* si falla, el servidor la borra con el próximo 410 */
  }
}
