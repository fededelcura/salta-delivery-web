import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import mapboxgl from 'mapbox-gl';

const SALTA: [number, number] = [-65.4232, -24.7821]; // lng, lat

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  draggable?: boolean;
}

export interface MapHeatmap {
  id: string;
  points: { lat: number; lng: number }[];
  /** Color del punto más denso; el degradado va de transparente a este color. */
  color: string;
  visible?: boolean;
}

const HEAT_PREFIX = 'heat-';

function heatmapData(points: MapHeatmap['points']): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  };
}

function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function MapView({
  markers = [],
  heatmaps = [],
  center = { lat: -24.7821, lng: -65.4232 },
  zoom = 12,
  followId,
  onMapClick,
  onMarkerDragEnd,
  getCenterRef,
}: {
  markers?: MapMarker[];
  heatmaps?: MapHeatmap[];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Si cambia de posición, el mapa hace pan suave hacia ese marcador */
  followId?: string;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerDragEnd?: (id: string, lat: number, lng: number) => void;
  /** Se llena con una función que devuelve el centro actual del mapa */
  getCenterRef?: MutableRefObject<(() => { lat: number; lng: number } | null) | null>;
}) {
  const [mapError, setMapError] = useState<string | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const onMapClickRef = useRef(onMapClick);
  const onMarkerDragEndRef = useRef(onMarkerDragEnd);
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

  onMapClickRef.current = onMapClick;
  onMarkerDragEndRef.current = onMarkerDragEnd;

  const markersKey = markers
    .map(
      (m) =>
        `${m.id}:${m.lat}:${m.lng}:${m.color ?? ''}:${m.label ?? ''}:${m.draggable ? 1 : 0}`,
    )
    .join('|');

  useEffect(() => {
    if (!ref.current || !token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: ref.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [center.lng, center.lat],
      zoom,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.getCanvas().style.cursor = 'crosshair';

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      onMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    };
    map.on('click', handleClick);
    map.on('load', () => {
      setMapError(null);
      setStyleLoaded(true);
      map.resize();
    });
    map.on('error', (e) => {
      const status = (e.error as { status?: number } | undefined)?.status;
      if (status === 401 || status === 403) {
        setMapError('Mapbox rechazó el token. Revisá VITE_MAPBOX_TOKEN.');
      } else if (!map.isStyleLoaded()) {
        setMapError('No se pudo cargar el mapa. Revisá tu conexión.');
      }
    });
    mapRef.current = map;
    if (getCenterRef) {
      getCenterRef.current = () => {
        const c = mapRef.current?.getCenter();
        return c ? { lat: c.lat, lng: c.lng } : null;
      };
    }

    return () => {
      map.off('click', handleClick);
      if (getCenterRef) getCenterRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setStyleLoaded(false);
    };
    // Solo recrear al montar / token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;

    const nextIds = new Set(markers.map((m) => m.id));

    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    for (const m of markers) {
      const existing = markersRef.current.get(m.id);
      if (existing) {
        const wantDrag = Boolean(m.draggable);
        if (existing.isDraggable() !== wantDrag) {
          existing.remove();
          markersRef.current.delete(m.id);
        } else {
          existing.setLngLat([m.lng, m.lat]);
          if (m.label) {
            const popup = existing.getPopup();
            if (popup) popup.setText(m.label);
            else existing.setPopup(new mapboxgl.Popup().setText(m.label));
          }
          continue;
        }
      }

      if (markersRef.current.has(m.id)) continue;

      const marker = new mapboxgl.Marker({
        color: m.color ?? '#0c6b6b',
        draggable: Boolean(m.draggable),
      })
        .setLngLat([m.lng, m.lat])
        .setPopup(m.label ? new mapboxgl.Popup().setText(m.label) : undefined)
        .addTo(map);

      if (m.draggable) {
        marker.on('dragend', () => {
          const { lng, lat } = marker.getLngLat();
          onMarkerDragEndRef.current?.(m.id, lat, lng);
        });
      }

      markersRef.current.set(m.id, marker);
    }

    if (followId) {
      const follow = markers.find((m) => m.id === followId);
      if (follow) {
        map.easeTo({ center: [follow.lng, follow.lat], duration: 600 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey, followId, token]);

  const heatmapsKey = heatmaps
    .map(
      (h) =>
        `${h.id}:${h.color}:${h.visible === false ? 0 : 1}:${h.points.length}:${h.points
          .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
          .join(';')}`,
    )
    .join('|');

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    const wanted = new Set(heatmaps.map((h) => HEAT_PREFIX + h.id));
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.id.startsWith(HEAT_PREFIX) && !wanted.has(layer.id)) {
        map.removeLayer(layer.id);
        if (map.getSource(layer.id)) map.removeSource(layer.id);
      }
    }

    for (const h of heatmaps) {
      const id = HEAT_PREFIX + h.id;
      const data = heatmapData(h.points);
      const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else map.addSource(id, { type: 'geojson', data });

      if (!map.getLayer(id)) {
        map.addLayer({
          id,
          type: 'heatmap',
          source: id,
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 3],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 15, 40],
            'heatmap-opacity': 0.75,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              hexToRgba(h.color, 0),
              0.2,
              hexToRgba(h.color, 0.25),
              0.6,
              hexToRgba(h.color, 0.6),
              1,
              hexToRgba(h.color, 0.95),
            ],
          },
        });
      }
      map.setLayoutProperty(id, 'visibility', h.visible === false ? 'none' : 'visible');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmapsKey, styleLoaded]);

  if (!token) {
    return (
      <div className="map-box">
        <div className="map-fallback">
          <div>
            <strong>Mapa Mapbox</strong>
            <p>
              Agregá <code className="mono">VITE_MAPBOX_TOKEN</code> en{' '}
              <code className="mono">web/.env</code>
            </p>
            <p className="muted">
              Centro Salta: {SALTA[1]}, {SALTA[0]} · {markers.length} marcadores listos
            </p>
            {markers.length > 0 && (
              <ul className="muted" style={{ textAlign: 'left', marginTop: 8 }}>
                {markers.map((m) => (
                  <li key={m.id}>
                    {m.label ?? m.id}: {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="map-box" ref={ref} />
      {mapError && (
        <div
          className="error-banner"
          style={{ position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 2 }}
        >
          {mapError}
        </div>
      )}
    </div>
  );
}
