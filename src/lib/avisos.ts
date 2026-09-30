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

export function notificar(titulo: string, cuerpo: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const opciones: NotificationOptions = { body: cuerpo, tag: 'viaje-nuevo', icon: 'pwa-192.png' };
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

export function avisarViajeNuevo(origen: string, tarifa: number): void {
  sonar();
  vibrar();
  notificar(
    'Pedido nuevo cerca',
    `${origen} · $${Math.round(tarifa).toLocaleString('es-AR')}`,
  );
}
