import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CIRCUIT_GEO_MAP } from '../data/circuitGeoData';
import { CIRCUITS_GEOJSON } from '../data/circuitsGeoJson';
import type { GrandPrixEvent } from '../data/schedule';
import { isGrandPrixCompleted } from '../services/scheduleSyncService';
import { Navigation, Globe, AlertTriangle, Layers, Satellite } from 'lucide-react';

interface ScheduleMapProps {
  schedule: GrandPrixEvent[];
  selectedRound: number;
  onSelectRound: (round: number) => void;
}

export type MapStyleMode = 'esri_dark' | 'esri_satellite' | 'osm_dark';

// Proveedores 100% Públicos, Sin API Keys y Sin Marcas de Agua (Esri ArcGIS REST & OpenStreetMap)
const ESRI_DARK_BASE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const ESRI_DARK_REF_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const ESRI_SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_SATELLITE_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const OSM_STANDARD_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const ScheduleMap: React.FC<ScheduleMapProps> = ({
  schedule,
  selectedRound,
  onSelectRound,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileGroupRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const trackLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapError, setMapError] = useState<boolean>(false);
  const [mapStyle, setMapStyle] = useState<MapStyleMode>('esri_dark');

  const selectedGp = schedule.find((g) => g.round === selectedRound) || schedule[0];

  // Helper para crear iconos HTML con estilos F1 (pulsos y colores de alto contraste)
  const createCustomMarkerIcon = useCallback((gp: GrandPrixEvent, isSelected: boolean) => {
    const isCompleted = isGrandPrixCompleted(gp);
    const markerClass = isSelected
      ? 'f1-map-marker selected'
      : isCompleted
      ? 'f1-map-marker completed'
      : 'f1-map-marker upcoming';

    const pulseHtml = isSelected ? '<div class="marker-pulse"></div>' : '';

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

  // Aplicar la capa de tiles seleccionada (Esri Dark Gray Canvas, Esri Satélite o OSM Dark CSS)
  const applyBaseTileLayer = useCallback((mode: MapStyleMode) => {
    const map = mapInstanceRef.current;
    const tileGroup = baseTileGroupRef.current;
    if (!map || !tileGroup) return;

    tileGroup.clearLayers();

    if (mode === 'esri_dark') {
      const darkBase = L.tileLayer(ESRI_DARK_BASE_URL, {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16,
        minZoom: 2,
      });
      const darkLabels = L.tileLayer(ESRI_DARK_REF_URL, {
        maxZoom: 16,
        minZoom: 2,
        opacity: 0.85,
      });

      let errCount = 0;
      darkBase.on('tileerror', () => {
        errCount += 1;
        if (errCount >= 4) {
          setMapStyle('osm_dark');
        }
      });

      darkBase.addTo(tileGroup);
      darkLabels.addTo(tileGroup);
    } else if (mode === 'esri_satellite') {
      const satBase = L.tileLayer(ESRI_SATELLITE_URL, {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 18,
        minZoom: 2,
      });
      const satLabels = L.tileLayer(ESRI_SATELLITE_LABELS_URL, {
        maxZoom: 18,
        minZoom: 2,
        opacity: 0.8,
      });
      satBase.addTo(tileGroup);
      satLabels.addTo(tileGroup);
    } else {
      const osmDarkLayer = L.tileLayer(OSM_STANDARD_URL, {
        maxZoom: 19,
        minZoom: 2,
        attribution: '&copy; OpenStreetMap contributors',
        className: 'osm-dark-tiles',
      });
      osmDarkLayer.addTo(tileGroup);
    }
  }, []);

  // Inicialización de Leaflet y ResizeObserver
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const geo = CIRCUIT_GEO_MAP[selectedGp.circuitId] || { lat: 1.2914, lng: 103.864 };

      const map = L.map(mapContainerRef.current, {
        center: [geo.lat, geo.lng],
        zoom: 14,
        maxZoom: 16,
        minZoom: 2,
        zoomControl: false,
        attributionControl: false,
      });

      baseTileGroupRef.current = L.layerGroup().addTo(map);
      trackLayerRef.current = L.layerGroup().addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapInstanceRef.current = map;

      applyBaseTileLayer('esri_dark');

      const resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);

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
  }, [applyBaseTileLayer]);

  // Actualizar la capa de tiles cuando el usuario alterna entre Modo Oscuro (Esri), Satélite o Mapa Oscuro (OSM)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const targetMaxZoom = mapStyle === 'esri_dark' ? 16 : mapStyle === 'esri_satellite' ? 18 : 19;
    map.setMaxZoom(targetMaxZoom);
    if (map.getZoom() > targetMaxZoom) {
      map.setZoom(targetMaxZoom);
    }
    applyBaseTileLayer(mapStyle);
  }, [mapStyle, applyBaseTileLayer]);

  // Renderizar trazado real del circuito (GeoJSON) y marcadores de los 24 Grandes Premios
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Actualizar trazado GeoJSON del circuito seleccionado con alto contraste
    if (trackLayerRef.current) {
      trackLayerRef.current.clearLayers();
      const trackGeoJson = CIRCUITS_GEOJSON[selectedGp.circuitId];
      if (trackGeoJson) {
        // Borde exterior oscuro de alto contraste
        L.geoJSON(trackGeoJson, {
          style: {
            color: '#090d16',
            weight: 10,
            opacity: 0.92,
            lineCap: 'round',
            lineJoin: 'round',
          },
        }).addTo(trackLayerRef.current);

        // Halo rojo intermedio
        L.geoJSON(trackGeoJson, {
          style: {
            color: '#7f0000',
            weight: 7,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          },
        }).addTo(trackLayerRef.current);

        // Línea principal de carrera en rojo F1 oficial (#e10600)
        L.geoJSON(trackGeoJson, {
          style: {
            color: '#e10600',
            weight: 4,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          },
        }).addTo(trackLayerRef.current);
      }
    }

    // 2. Actualizar marcadores de los 24 circuitos
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    schedule.forEach((gp) => {
      const geo = CIRCUIT_GEO_MAP[gp.circuitId];
      if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') return;

      const isSelected = gp.round === selectedRound;
      const isCompleted = isGrandPrixCompleted(gp);
      const icon = createCustomMarkerIcon(gp, isSelected);

      const marker = L.marker([geo.lat, geo.lng], { icon }).addTo(map);

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
  }, [schedule, selectedRound, selectedGp.circuitId, createCustomMarkerIcon, onSelectRound]);

  // Centrado suave cuando cambia el GP seleccionado
  const flyToCurrentCircuit = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const geo = CIRCUIT_GEO_MAP[selectedGp.circuitId];
    if (geo) {
      map.flyTo([geo.lat, geo.lng], 14, { duration: 1.2 });
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
        <button className="f1-btn" style={{ marginTop: '12px' }} onClick={() => setMapError(false)}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="schedule-map-wrapper-leaflet">
      {/* Contenedor del lienzo Leaflet con dimensiones explícitas */}
      <div
        ref={mapContainerRef}
        className="schedule-leaflet-container"
        style={{ minHeight: '480px', height: '100%', width: '100%' }}
      />

      {/* Controles de cámara flotantes y Selector de Mapa Oscuro / Satélite Libre de Marcas de Agua */}
      <div className="map-view-controls">
        <button
          className="map-control-pill"
          onClick={flyToCurrentCircuit}
          title="Centrar en el trazado real del circuito"
        >
          <Navigation size={13} />
          <span>Centrar Circuito</span>
        </button>
        <button
          className="map-control-pill"
          onClick={flyToWorldOverview}
          title="Ver los 24 Grandes Premios en el mapa mundial"
        >
          <Globe size={13} />
          <span>Vista Mundial</span>
        </button>
        <button
          className={`map-control-pill ${mapStyle === 'esri_dark' ? 'active' : ''}`}
          onClick={() => setMapStyle('esri_dark')}
          title="Mapa base oscuro minimalista Esri World Dark Gray Canvas"
        >
          <Layers size={13} />
          <span>MODO OSCURO (ESRI)</span>
        </button>
        <button
          className={`map-control-pill ${mapStyle === 'esri_satellite' ? 'active' : ''}`}
          onClick={() => setMapStyle('esri_satellite')}
          title="Vista aérea de satélite real Esri World Imagery"
        >
          <Satellite size={13} />
          <span>SATÉLITE</span>
        </button>
        <button
          className={`map-control-pill ${mapStyle === 'osm_dark' ? 'active' : ''}`}
          onClick={() => setMapStyle('osm_dark')}
          title="Mapa vectorial detallado OpenStreetMap Dark"
        >
          <Layers size={13} />
          <span>MAPA OSCURO</span>
        </button>
      </div>
    </div>
  );
};
