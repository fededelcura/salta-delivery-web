import { useEffect, useRef } from 'react';
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

export function MapView({
  markers = [],
  center = { lat: -24.7821, lng: -65.4232 },
  zoom = 12,
  followId,
  onMapClick,
  onMarkerDragEnd,
}: {
  markers?: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Si cambia de posición, el mapa hace pan suave hacia ese marcador */
  followId?: string;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerDragEnd?: (id: string, lat: number, lng: number) => void;
}) {
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
    mapRef.current = map;

    return () => {
      map.off('click', handleClick);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
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

  return <div className="map-box" ref={ref} />;
}
