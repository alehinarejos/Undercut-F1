import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CIRCUIT_GEO_MAP } from '../data/circuitGeoData';
import type { GrandPrixEvent } from '../data/schedule';
import { isGrandPrixCompleted } from '../services/scheduleSyncService';
import { Navigation, Globe, AlertTriangle } from 'lucide-react';

interface ScheduleMapProps {
  schedule: GrandPrixEvent[];
  selectedRound: number;
  onSelectRound: (round: number) => void;
}

// CARTO Dark Matter (Gratuito, sin API keys, alta disponibilidad para dashboards oscuros)
const TILE_LAYER_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const ScheduleMap: React.FC<ScheduleMapProps> = ({
  schedule,
  selectedRound,
  onSelectRound
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const [mapError, setMapError] = useState<boolean>(false);

  const selectedGp = schedule.find(g => g.round === selectedRound) || schedule[0];

  // Helper para crear iconos HTML con estilos F1 (pulsos y colores según estado)
  const createCustomMarkerIcon = useCallback((gp: GrandPrixEvent, isSelected: boolean) => {
    const isCompleted = isGrandPrixCompleted(gp);
    const isCurrent = isSelected;

    const markerClass = isCurrent
      ? 'f1-map-marker selected'
      : isCompleted
      ? 'f1-map-marker completed'
      : 'f1-map-marker upcoming';

    const pulseHtml = isCurrent ? '<div class="marker-pulse"></div>' : '';

    return L.divIcon({
      className: 'f1-custom-leaflet-icon',
      html: `
        <div class="${markerClass}">
          ${pulseHtml}
          <div class="marker-dot"></div>
          <span class="marker-label">R${gp.round}</span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -18],
    });
  }, []);

  // Inicialización de Leaflet y gestión de ciclo de vida
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const geo = CIRCUIT_GEO_MAP[selectedGp.circuitId] || { lat: 26.0325, lng: 50.5106 };

      const map = L.map(mapContainerRef.current, {
        center: [geo.lat, geo.lng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      // Añadir capa de teselas CARTO Dark Matter
      L.tileLayer(TILE_LAYER_URL, {
        attribution: TILE_ATTRIBUTION,
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Controles de zoom abajo a la derecha
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;

      // ResizeObserver para solventar el fallo de contenedor colapsado (0x0px)
      const resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);

      // InvalidateSize tras breve retardo para asegurar que el DOM padre ha flexionado
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);

      return () => {
        resizeObserver.disconnect();
        map.remove();
        mapInstanceRef.current = null;
      };
    } catch (err) {
      console.error('[ScheduleMap] Error al inicializar Leaflet:', err);
      setMapError(true);
    }
  }, []);

  // Renderizar y sincronizar marcadores de los 24 circuitos
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    schedule.forEach(gp => {
      const geo = CIRCUIT_GEO_MAP[gp.circuitId];
      if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') return;

      const isSelected = gp.round === selectedRound;
      const isCompleted = isGrandPrixCompleted(gp);
      const icon = createCustomMarkerIcon(gp, isSelected);

      const marker = L.marker([geo.lat, geo.lng], { icon }).addTo(map);

      // Popup interactivo estilizado
      const popupContent = `
        <div class="f1-popup-content">
          <div class="f1-popup-header">
            <span>${gp.flag}</span>
            <strong>Ronda ${gp.round}: ${gp.name}</strong>
          </div>
          <div class="f1-popup-body">
            <div>${gp.circuitName}</div>
            <div class="f1-popup-dates">${gp.startDate} – ${gp.endDate}</div>
            <div class="f1-popup-status ${isCompleted ? 'status-done' : 'status-next'}">
              ${isCompleted ? 'COMPLETADO' : 'PROGRAMADO'}
            </div>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);

      marker.on('click', () => {
        onSelectRound(gp.round);
      });

      markersRef.current.set(gp.round, marker);
    });
  }, [schedule, selectedRound, createCustomMarkerIcon, onSelectRound]);

  // Centrado suave cuando cambia el GP seleccionado
  const flyToCurrentCircuit = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const geo = CIRCUIT_GEO_MAP[selectedGp.circuitId];
    if (geo) {
      map.flyTo([geo.lat, geo.lng], 13, { duration: 1.4 });
    }
  }, [selectedGp]);

  const flyToWorldOverview = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([25.0, 15.0], 2.8, { duration: 1.2 });
  }, []);

  useEffect(() => {
    flyToCurrentCircuit();
  }, [selectedRound, flyToCurrentCircuit]);

  if (mapError) {
    return (
      <div className="schedule-map-fallback" style={{ padding: '40px', textAlign: 'center' }}>
        <AlertTriangle size={32} color="var(--f1-red)" />
        <h3 style={{ color: '#fff', marginTop: '12px' }}>No se pudo cargar el mapa</h3>
        <p style={{ color: 'var(--text-muted)' }}>Mostrando vista alternativa de circuitos del campeonato.</p>
        <button className="f1-btn" style={{ marginTop: '12px' }} onClick={() => setMapError(false)}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="schedule-map-wrapper-leaflet">
      {/* Contenedor del lienzo Leaflet */}
      <div ref={mapContainerRef} className="schedule-leaflet-container" />

      {/* Controles de cámara flotantes */}
      <div className="map-view-controls">
        <button
          className="map-control-pill"
          onClick={flyToCurrentCircuit}
          title="Centrar en el circuito seleccionado"
        >
          <Navigation size={13} />
          <span>Centrar Circuito</span>
        </button>
        <button
          className="map-control-pill"
          onClick={flyToWorldOverview}
          title="Vista global de todos los Grandes Premios"
        >
          <Globe size={13} />
          <span>Vista Mundial</span>
        </button>
      </div>
    </div>
  );
};
