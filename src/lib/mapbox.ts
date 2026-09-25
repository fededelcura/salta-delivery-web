/** Mapbox Geocoding helpers (browser GPS + reverse/forward). */

/** Centro Salta Capital */
const SALTA_PROXIMITY = '-65.4232,-24.7821';

/**
 * Cobertura: Salta Capital + San Lorenzo + San Luis y alrededores.
 * bbox = minLng,minLat,maxLng,maxLat
 */
export const COVERAGE_BBOX = {
  minLng: -65.55,
  minLat: -24.92,
  maxLng: -65.28,
  maxLat: -24.62,
} as const;

const BBOX_PARAM = `${COVERAGE_BBOX.minLng},${COVERAGE_BBOX.minLat},${COVERAGE_BBOX.maxLng},${COVERAGE_BBOX.maxLat}`;

export const OUT_OF_ZONE_MSG =
  'Solo operamos en Salta Capital, San Lorenzo y San Luis (alrededores).';

export function isInCoverage(lat: number, lng: number): boolean {
  return (
    lng >= COVERAGE_BBOX.minLng &&
    lng <= COVERAGE_BBOX.maxLng &&
    lat >= COVERAGE_BBOX.minLat &&
    lat <= COVERAGE_BBOX.maxLat
  );
}

function token(): string | undefined {
  return import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
}

export interface GeoPlace {
  id: string;
  direccion: string;
  lat: number;
  lng: number;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoPlace | null> {
  if (!isInCoverage(lat, lng)) return null;
  const t = token();
  if (!t) return null;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?access_token=${encodeURIComponent(t)}&language=es&limit=1` +
    `&bbox=${BBOX_PARAM}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: Array<{ id: string; place_name: string; center: [number, number] }>;
  };
  const f = data.features?.[0];
  if (!f) return null;
  const placeLat = f.center[1];
  const placeLng = f.center[0];
  if (!isInCoverage(placeLat, placeLng) && !isInCoverage(lat, lng)) return null;
  return {
    id: f.id,
    direccion: f.place_name,
    lat: placeLat,
    lng: placeLng,
  };
}

export async function searchPlaces(query: string): Promise<GeoPlace[]> {
  const t = token();
  const q = query.trim();
  if (!t || q.length < 3) return [];
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?access_token=${encodeURIComponent(t)}&language=es&country=AR` +
    `&proximity=${SALTA_PROXIMITY}&bbox=${BBOX_PARAM}` +
    `&limit=8&types=address,poi,place,neighborhood,locality`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    features?: Array<{ id: string; place_name: string; center: [number, number] }>;
  };
  return (data.features ?? [])
    .map((f) => ({
      id: f.id,
      direccion: f.place_name,
      lat: f.center[1],
      lng: f.center[0],
    }))
    .filter((p) => isInCoverage(p.lat, p.lng))
    .slice(0, 5);
}

function geolocationErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    return 'Activá el permiso de ubicación en el navegador, o buscá el origen a mano.';
  }
  if (err.code === err.TIMEOUT) {
    return 'La ubicación tardó demasiado. Probá de nuevo o buscá la dirección a mano.';
  }
  return 'No se pudo obtener la ubicación. Buscá el origen a mano (ej. Poder Judicial, Salta).';
}

/** Opciones estilo plataforma deportiva: más estables en PC (Wi‑Fi/IP). */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no soporta geolocalización'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        reject(new Error(geolocationErrorMessage(err)));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 0 },
    );
  });
}
