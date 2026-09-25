import { FormEvent, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { MapView } from '../components/MapView';
import { ErrorBox, Money, PageHeader } from '../components/ui';
import { ApiClientError, clientePortalApi, getToken } from '../lib/api';
import {
  getCurrentPosition,
  isInCoverage,
  OUT_OF_ZONE_MSG,
  reverseGeocode,
  searchPlaces,
  type GeoPlace,
} from '../lib/mapbox';

type Spot = { direccion: string; lat: number; lng: number };

const FAV_ALIASES = ['Casa', 'Trabajo'] as const;
const LOGIN_FAV_MSG = 'Iniciá sesión para guardar Casa/Trabajo en tu cuenta';

function isBearerOrUnauthorized(err: unknown): boolean {
  if (err instanceof ApiClientError) {
    if (err.status === 401) return true;
    return /bearer|no autorizado|unauthorized/i.test(err.message);
  }
  if (err instanceof Error) {
    return /bearer|token.*requerido|unauthorized/i.test(err.message);
  }
  return false;
}

function withPisoDpto(direccion: string, piso: string, dpto: string): string {
  const parts: string[] = [];
  const p = piso.trim();
  const d = dpto.trim();
  if (p) parts.push(`Piso: ${p}`);
  if (d) parts.push(`Dpto: ${d}`);
  if (parts.length === 0) return direccion;
  if (/·\s*Piso:|·\s*Dpto:/i.test(direccion)) return direccion;
  return `${direccion} · ${parts.join(' · ')}`.slice(0, 500);
}

/** Número al final o al inicio del primer segmento (calle). */
function extractStreetNumber(direccion: string): string {
  const first = direccion.split(',')[0]?.trim() ?? '';
  const endMatch = first.match(/\s+(\d+[A-Za-z]?)$/);
  if (endMatch) return endMatch[1];
  const startMatch = first.match(/^(\d+[A-Za-z]?)\s+/);
  if (startMatch) return startMatch[1];
  return '';
}

/** Inserta o reemplaza el número de calle en el texto; no mueve el pin. */
function withStreetNumber(direccion: string, numero: string): string {
  const n = numero.trim();
  if (!n) return direccion;
  const parts = direccion
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return n;
  let street = parts[0];
  if (/\s+\d+[A-Za-z]?$/.test(street)) {
    street = street.replace(/\s+\d+[A-Za-z]?$/, ` ${n}`);
  } else if (/^\d+[A-Za-z]?\s+/.test(street)) {
    street = street.replace(/^\d+[A-Za-z]?\s+/, `${n} `);
  } else {
    street = `${street} ${n}`;
  }
  return [street, ...parts.slice(1)].join(', ');
}

function buildDireccion(
  spot: Spot,
  numero: string,
  piso: string,
  dpto: string,
): string {
  return withPisoDpto(withStreetNumber(spot.direccion, numero), piso, dpto);
}

const suggestListStyle: CSSProperties = {
  listStyle: 'none',
  margin: '6px 0 0',
  padding: 0,
  border: '1px solid var(--border, #d0d7de)',
  borderRadius: 8,
  overflow: 'hidden',
};

const suggestBtnStyle: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '10px 12px',
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

function findFav(
  dirs: Array<{ alias: string; direccion: string; lat: number; lng: number }> | undefined,
  alias: string,
): Spot | null {
  const hit = dirs?.find((d) => d.alias.toLowerCase() === alias.toLowerCase());
  if (!hit) return null;
  return { direccion: hit.direccion, lat: hit.lat, lng: hit.lng };
}

function PlaceSuggestions({
  items,
  onPick,
}: {
  items: GeoPlace[];
  onPick: (place: GeoPlace) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul style={suggestListStyle}>
      {items.map((s) => (
        <li key={s.id}>
          <button type="button" style={suggestBtnStyle} onClick={() => onPick(s)}>
            {s.direccion}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function PedirPage() {
  const { session, completeSession, logout } = useAuth();
  const navigate = useNavigate();
  /** Solo con sd_token real: session.tokens sin getToken() disparaba "Token Bearer requerido". */
  const hasAuth = session?.usuario.rol === 'cliente' && Boolean(getToken());

  const [origen, setOrigen] = useState<Spot | null>(null);
  const [destino, setDestino] = useState<Spot | null>(null);
  const [origenQuery, setOrigenQuery] = useState('');
  const [destinoQuery, setDestinoQuery] = useState('');
  const [origenNumero, setOrigenNumero] = useState('');
  const [destinoNumero, setDestinoNumero] = useState('');
  const [origenPiso, setOrigenPiso] = useState('');
  const [origenDpto, setOrigenDpto] = useState('');
  const [destinoPiso, setDestinoPiso] = useState('');
  const [destinoDpto, setDestinoDpto] = useState('');
  const [origenLocked, setOrigenLocked] = useState(false);
  const [destinoLocked, setDestinoLocked] = useState(false);
  const [sugerenciasOrigen, setSugerenciasOrigen] = useState<GeoPlace[]>([]);
  const [sugerenciasDestino, setSugerenciasDestino] = useState<GeoPlace[]>([]);
  const [favoritos, setFavoritos] = useState<
    Array<{ alias: string; direccion: string; lat: number; lng: number }>
  >([]);
  const [tipo, setTipo] = useState('delivery');
  const [pago, setPago] = useState('efectivo');
  const [preview, setPreview] = useState<{
    distancia_km: number;
    tiempo_estimado_min: number;
    total: number;
  } | null>(null);
  const [nombre, setNombre] = useState(session?.usuario.nombre ?? '');
  const [telefono, setTelefono] = useState(session?.usuario.telefono ?? '');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsHint, setGpsHint] = useState<string | null>(
    'Elegí origen y destino. Si no tenés cuenta, completá nombre y teléfono abajo para confirmar.',
  );
  const [mapTarget, setMapTarget] = useState<'origen' | 'destino'>('origen');
  const origenTimer = useRef<number | null>(null);
  const destinoTimer = useRef<number | null>(null);

  useEffect(() => {
    if (session?.usuario.rol === 'cliente' && !getToken()) {
      logout();
    }
  }, [session, logout]);

  useEffect(() => {
    if (!hasAuth) return;
    clientePortalApi
      .perfil()
      .then((p) => {
        setFavoritos(p.direcciones_favoritas ?? []);
        if (!nombre && p.nombre) setNombre(p.nombre);
        if (!telefono && p.telefono) setTelefono(p.telefono);
      })
      .catch((e) => {
        if (isBearerOrUnauthorized(e)) {
          logout();
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAuth]);

  useEffect(() => {
    if (origenTimer.current) window.clearTimeout(origenTimer.current);
    if (origenLocked || origenQuery.trim().length < 3) {
      setSugerenciasOrigen([]);
      return;
    }
    origenTimer.current = window.setTimeout(() => {
      void searchPlaces(origenQuery).then(setSugerenciasOrigen);
    }, 350);
    return () => {
      if (origenTimer.current) window.clearTimeout(origenTimer.current);
    };
  }, [origenQuery, origenLocked]);

  useEffect(() => {
    if (destinoTimer.current) window.clearTimeout(destinoTimer.current);
    if (destinoLocked || destinoQuery.trim().length < 3) {
      setSugerenciasDestino([]);
      return;
    }
    destinoTimer.current = window.setTimeout(() => {
      void searchPlaces(destinoQuery).then(setSugerenciasDestino);
    }, 350);
    return () => {
      if (destinoTimer.current) window.clearTimeout(destinoTimer.current);
    };
  }, [destinoQuery, destinoLocked]);

  useEffect(() => {
    if (!origen || !destino) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await clientePortalApi.calcularTarifa(
          { lat: origen.lat, lng: origen.lng },
          { lat: destino.lat, lng: destino.lng },
        );
        const total =
          Number(r.detalle?.tarifa ?? r.detalle?.total ?? r.detalle?.tarifa_estimada ?? 0) ||
          Math.round(r.distancia_km * 350 + 500);
        if (!cancelled) {
          setPreview({
            distancia_km: r.distancia_km,
            tiempo_estimado_min: r.tiempo_estimado_min,
            total,
          });
        }
      } catch {
        if (!cancelled) setPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [origen, destino]);

  async function applyPin(target: 'origen' | 'destino', lat: number, lng: number) {
    if (!isInCoverage(lat, lng)) {
      setError(OUT_OF_ZONE_MSG);
      return;
    }
    setError(null);
    const place = await reverseGeocode(lat, lng);
    if (!place && !isInCoverage(lat, lng)) {
      setError(OUT_OF_ZONE_MSG);
      return;
    }
    const direccion = place?.direccion ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const spot = { direccion, lat, lng };
    const num = extractStreetNumber(direccion);
    if (target === 'origen') {
      setOrigen(spot);
      setOrigenQuery(direccion);
      setOrigenNumero(num);
      setOrigenLocked(true);
      setSugerenciasOrigen([]);
    } else {
      setDestino(spot);
      setDestinoQuery(direccion);
      setDestinoNumero(num);
      setDestinoLocked(true);
      setSugerenciasDestino([]);
    }
    setGpsHint(
      'Pin fijado. Arrastralo para afinar. Completá el número de calle si hace falta.',
    );
  }

  async function usarGps() {
    setGpsBusy(true);
    setError(null);
    setMapTarget('origen');
    try {
      const pos = await getCurrentPosition();
      if (!isInCoverage(pos.lat, pos.lng)) {
        setError(OUT_OF_ZONE_MSG);
        return;
      }
      await applyPin('origen', pos.lat, pos.lng);
      setGpsHint(
        'GPS aproximado (en PC suele fallar). Arrastrá el pin o buscá la dirección exacta.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo obtener la ubicación');
    } finally {
      setGpsBusy(false);
    }
  }

  function pickOrigen(place: GeoPlace) {
    setOrigen({ direccion: place.direccion, lat: place.lat, lng: place.lng });
    setOrigenQuery(place.direccion);
    setOrigenNumero(extractStreetNumber(place.direccion));
    setOrigenLocked(true);
    setSugerenciasOrigen([]);
    setMapTarget('origen');
    setGpsHint('Origen fijado. Editá el número si hace falta, o arrastrá el pin.');
    setError(null);
  }

  function pickDestino(place: GeoPlace) {
    setDestino({ direccion: place.direccion, lat: place.lat, lng: place.lng });
    setDestinoQuery(place.direccion);
    setDestinoNumero(extractStreetNumber(place.direccion));
    setDestinoLocked(true);
    setSugerenciasDestino([]);
    setMapTarget('destino');
    setGpsHint('Destino fijado. Editá el número si hace falta, o arrastrá el pin.');
    setError(null);
  }

  function onMapClick(lat: number, lng: number) {
    void applyPin(mapTarget, lat, lng);
  }

  function onMarkerDragEnd(id: string, lat: number, lng: number) {
    void applyPin(id === 'destino' ? 'destino' : 'origen', lat, lng);
  }

  function aplicarFavorito(alias: string, target: 'origen' | 'destino') {
    const spot = findFav(favoritos, alias);
    if (!spot) {
      setError(`Todavía no tenés “${alias}” guardado`);
      return;
    }
    setError(null);
    const num = extractStreetNumber(spot.direccion);
    if (target === 'origen') {
      setOrigen(spot);
      setOrigenQuery(spot.direccion);
      setOrigenNumero(num);
      setOrigenLocked(true);
      setSugerenciasOrigen([]);
      setGpsHint(null);
    } else {
      setDestino(spot);
      setDestinoQuery(spot.direccion);
      setDestinoNumero(num);
      setDestinoLocked(true);
      setSugerenciasDestino([]);
    }
  }

  async function guardarFavorito(
    alias: (typeof FAV_ALIASES)[number],
    spot: Spot | null,
    pisoFuente: 'origen' | 'destino',
  ) {
    if (!spot) {
      setError('Primero elegí una dirección');
      return;
    }
    if (!getToken()) {
      if (session) logout();
      setError(LOGIN_FAV_MSG);
      return;
    }
    setError(null);
    const numero = pisoFuente === 'origen' ? origenNumero : destinoNumero;
    const piso = pisoFuente === 'origen' ? origenPiso : destinoPiso;
    const dpto = pisoFuente === 'origen' ? origenDpto : destinoDpto;
    const direccion = buildDireccion(spot, numero, piso, dpto);
    const next = [
      {
        alias,
        direccion,
        lat: spot.lat,
        lng: spot.lng,
        es_principal: alias === 'Casa',
      },
      ...favoritos.filter((d) => d.alias.toLowerCase() !== alias.toLowerCase()),
    ];
    try {
      const p = await clientePortalApi.actualizarPreferencias({
        direcciones_favoritas: next,
      });
      setFavoritos(p.direcciones_favoritas ?? next);
    } catch (e) {
      if (isBearerOrUnauthorized(e)) {
        logout();
        setError(LOGIN_FAV_MSG);
        return;
      }
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  async function confirmarComoInvitado(payloadBase: {
    tipo_servicio: string;
    origen_direccion: string;
    origen: { lat: number; lng: number };
    destino_direccion: string;
    destino: { lat: number; lng: number };
    metodo_pago: string;
  }) {
    if (!nombre.trim() || telefono.trim().length < 8) {
      setError('Completá tu nombre y teléfono (mín. 8 dígitos) para confirmar el pedido.');
      return false;
    }
    const result = await clientePortalApi.solicitarInvitado({
      ...payloadBase,
      nombre: nombre.trim(),
      telefono: telefono.trim(),
    });
    completeSession(result.session);
    navigate('/app');
    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!origen || !destino) {
      setError('Completá origen y destino (búsqueda, clic en el mapa o arrastrá el pin)');
      return;
    }
    if (
      Math.abs(origen.lat - destino.lat) < 0.0001 &&
      Math.abs(origen.lng - destino.lng) < 0.0001
    ) {
      setError('Origen y destino deben ser distintos');
      return;
    }

    if (
      !isInCoverage(origen.lat, origen.lng) ||
      !isInCoverage(destino.lat, destino.lng)
    ) {
      setError(OUT_OF_ZONE_MSG);
      return;
    }

    const payloadBase = {
      tipo_servicio: tipo,
      origen_direccion: buildDireccion(origen, origenNumero, origenPiso, origenDpto),
      origen: { lat: origen.lat, lng: origen.lng },
      destino_direccion: buildDireccion(destino, destinoNumero, destinoPiso, destinoDpto),
      destino: { lat: destino.lat, lng: destino.lng },
      metodo_pago: pago,
    };

    setBusy(true);
    setError(null);
    try {
      if (hasAuth && getToken()) {
        try {
          await clientePortalApi.solicitar(payloadBase);
          navigate('/app');
          return;
        } catch (err) {
          if (isBearerOrUnauthorized(err)) {
            logout();
            await confirmarComoInvitado(payloadBase);
            return;
          }
          throw err;
        }
      }
      await confirmarComoInvitado(payloadBase);
    } catch (err) {
      if (isBearerOrUnauthorized(err)) {
        logout();
        setError('Completá tu nombre y teléfono (mín. 8 dígitos) para confirmar el pedido.');
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo solicitar');
      }
    } finally {
      setBusy(false);
    }
  }

  const markers = [
    ...(origen
      ? [
          {
            id: 'origen',
            lat: origen.lat,
            lng: origen.lng,
            color: '#1a4f8c',
            label: 'Origen',
            draggable: true,
          },
        ]
      : []),
    ...(destino
      ? [
          {
            id: 'destino',
            lat: destino.lat,
            lng: destino.lng,
            color: '#e86a3c',
            label: 'Destino',
            draggable: true,
          },
        ]
      : []),
  ];

  return (
    <div className="page-enter" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <PageHeader
          title="Pedir envío"
          subtitle="Buscá dirección · clic en mapa · arrastrá el pin · guardá Casa/Trabajo"
        />
        <Link className="btn btn-ghost" to={hasAuth ? '/app' : '/'}>
          {hasAuth ? 'Mi app' : 'Inicio'}
        </Link>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {gpsHint && !error ? <p className="muted">{gpsHint}</p> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          className={`btn ${mapTarget === 'origen' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setMapTarget('origen')}
        >
          Mapa → Origen
        </button>
        <button
          type="button"
          className={`btn ${mapTarget === 'destino' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setMapTarget('destino')}
        >
          Mapa → Destino
        </button>
        <span className="muted" style={{ alignSelf: 'center', fontSize: '0.85rem' }}>
          Tocá el mapa para fijar {mapTarget}
        </span>
      </div>

      <div className="panel panel-pad" style={{ marginBottom: 12, minHeight: 220 }}>
        <MapView
          markers={markers}
          center={origen ?? destino ?? { lat: -24.7821, lng: -65.4232 }}
          zoom={origen || destino ? 14 : 12}
          followId={mapTarget === 'destino' && destino ? 'destino' : origen ? 'origen' : undefined}
          onMapClick={onMapClick}
          onMarkerDragEnd={onMarkerDragEnd}
        />
      </div>

      <form className="panel panel-pad" onSubmit={(e) => void onSubmit(e)}>
        <div className="stack" style={{ maxWidth: 520 }}>
          <div className="field">
            <label>Origen</label>
            <input
              value={origenQuery}
              onChange={(e) => {
                setOrigenQuery(e.target.value);
                setOrigen(null);
                setOrigenLocked(false);
                setGpsHint(null);
              }}
              placeholder="Ej. Poder Judicial, Salta"
              autoComplete="off"
            />
            <PlaceSuggestions items={sugerenciasOrigen} onPick={pickOrigen} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <div className="field" style={{ flex: '1 1 100px', margin: 0 }}>
                <label>Número</label>
                <input
                  value={origenNumero}
                  onChange={(e) => setOrigenNumero(e.target.value)}
                  placeholder="Ej. 326"
                  autoComplete="off"
                  maxLength={12}
                  inputMode="numeric"
                />
              </div>
              <div className="field" style={{ flex: '1 1 100px', margin: 0 }}>
                <label>Piso</label>
                <input
                  value={origenPiso}
                  onChange={(e) => setOrigenPiso(e.target.value)}
                  placeholder="Ej. 3, PB"
                  autoComplete="off"
                  maxLength={20}
                />
              </div>
              <div className="field" style={{ flex: '1 1 100px', margin: 0 }}>
                <label>Dpto</label>
                <input
                  value={origenDpto}
                  onChange={(e) => setOrigenDpto(e.target.value)}
                  placeholder="Ej. B"
                  autoComplete="off"
                  maxLength={20}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={gpsBusy}
                onClick={() => void usarGps()}
              >
                {gpsBusy ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}
              </button>
              {FAV_ALIASES.map((alias) => (
                <button
                  key={`o-${alias}`}
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => aplicarFavorito(alias, 'origen')}
                >
                  {alias}
                </button>
              ))}
              {origen ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!getToken()}
                  onClick={() => void guardarFavorito('Casa', origen, 'origen')}
                  title={
                    getToken()
                      ? 'Guardar este pin de origen como Casa'
                      : 'Requiere cuenta — iniciá sesión'
                  }
                >
                  Guardar Casa{!getToken() ? ' (cuenta)' : ''}
                </button>
              ) : null}
              {origen ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!getToken()}
                  onClick={() => void guardarFavorito('Trabajo', origen, 'origen')}
                  title={
                    getToken()
                      ? 'Guardar este pin de origen como Trabajo'
                      : 'Requiere cuenta — iniciá sesión'
                  }
                >
                  Guardar Trabajo{!getToken() ? ' (cuenta)' : ''}
                </button>
              ) : null}
            </div>
          </div>

          <div className="field">
            <label>Destino</label>
            <input
              value={destinoQuery}
              onChange={(e) => {
                setDestinoQuery(e.target.value);
                setDestino(null);
                setDestinoLocked(false);
              }}
              placeholder="Calle, barrio o lugar en Salta"
              autoComplete="off"
            />
            <PlaceSuggestions items={sugerenciasDestino} onPick={pickDestino} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <div className="field" style={{ flex: '1 1 100px', margin: 0 }}>
                <label>Número</label>
                <input
                  value={destinoNumero}
                  onChange={(e) => setDestinoNumero(e.target.value)}
                  placeholder="Ej. 450"
                  autoComplete="off"
                  maxLength={12}
                  inputMode="numeric"
                />
              </div>
              <div className="field" style={{ flex: '1 1 100px', margin: 0 }}>
                <label>Piso</label>
                <input
                  value={destinoPiso}
                  onChange={(e) => setDestinoPiso(e.target.value)}
                  placeholder="Ej. 2, PB"
                  autoComplete="off"
                  maxLength={20}
                />
              </div>
              <div className="field" style={{ flex: '1 1 100px', margin: 0 }}>
                <label>Dpto</label>
                <input
                  value={destinoDpto}
                  onChange={(e) => setDestinoDpto(e.target.value)}
                  placeholder="Ej. D"
                  autoComplete="off"
                  maxLength={20}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {FAV_ALIASES.map((alias) => (
                <button
                  key={`d-${alias}`}
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => aplicarFavorito(alias, 'destino')}
                >
                  {alias}
                </button>
              ))}
              {destino ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!getToken()}
                  onClick={() => void guardarFavorito('Trabajo', destino, 'destino')}
                  title={
                    getToken()
                      ? 'Guardar destino como Trabajo'
                      : 'Requiere cuenta — iniciá sesión'
                  }
                >
                  Guardar Trabajo{!getToken() ? ' (cuenta)' : ''}
                </button>
              ) : null}
            </div>
          </div>

          <div className="field">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="delivery">Delivery</option>
              <option value="mensajeria">Mensajería</option>
              <option value="envio_paquete">Paquete</option>
            </select>
          </div>
          <div className="field">
            <label>Pago</label>
            <select value={pago} onChange={(e) => setPago(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>

          {preview ? (
            <p className="muted">
              ~{preview.distancia_km.toFixed(1)} km · ~{preview.tiempo_estimado_min} min ·{' '}
              <Money value={preview.total} />
            </p>
          ) : origen && destino ? (
            <p className="muted">Calculando tarifa…</p>
          ) : null}

          {!hasAuth ? (
            <>
              <div className="field">
                <label>Tu nombre</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Cómo te llamás"
                  required
                />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej. 3875123456"
                  inputMode="tel"
                  required
                />
              </div>
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                No hace falta login: con nombre y teléfono confirmás el pedido y seguís el viaje.{' '}
                <Link to="/login">Ya tengo cuenta</Link>
              </p>
            </>
          ) : null}

          <button type="submit" className="btn btn-primary" disabled={busy || !origen || !destino}>
            {busy ? 'Solicitando…' : 'Confirmar pedido'}
          </button>
        </div>
      </form>
    </div>
  );
}
