import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  scheduleSyncService, 
  formatSessionFull, 
  isGrandPrixCompleted, 
  getNextUpcomingGrandPrix, 
  getRaceTargetTimestamp,
  getTimeRemaining,
  getRaceSession,
} from '../services/scheduleSyncService';
import type { ScheduleSyncState } from '../services/scheduleSyncService';
import type { GrandPrixEvent } from '../data/schedule';
import { useLanguage } from '../context/LanguageContext';
import { RaceResultsModal } from './RaceResultsModal';
import { CIRCUIT_GEO_MAP } from '../data/circuitGeoData';
import { CIRCUITS_GEOJSON } from '../data/circuitsGeoJson';
import { 
  Trophy, Clock, Flag, Calendar, Timer, ChevronRight, ChevronLeft, 
  RotateCw, Navigation, Zap, Map as MapIcon,
  LayoutGrid, Globe, Compass
} from 'lucide-react';
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const MAPBOX_STYLE = import.meta.env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/dark-v11';

export const ScheduleView: React.FC = () => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [selectedRoundForModal, setSelectedRoundForModal] = useState<number | null>(null);
  const [syncState, setSyncState] = useState<ScheduleSyncState>(scheduleSyncService.getState());
  const [mapZoomLevel, setMapZoomLevel] = useState<'circuit' | 'world'>('circuit');

  useEffect(() => {
    const unsubscribe = scheduleSyncService.subscribe((state) => {
      setSyncState({ ...state });
    });
    return () => unsubscribe();
  }, []);

  const schedule = syncState.schedule;
  const nextGp = getNextUpcomingGrandPrix(schedule);
  const [selectedRound, setSelectedRound] = useState<number>(() => nextGp.round);

  // Live ticking state (1000ms) for countdowns
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const completedCount = schedule.filter(gp => isGrandPrixCompleted(gp)).length;
  const upcomingCount = schedule.length - completedCount;

  const filteredGps = schedule.filter(gp => {
    const isDone = isGrandPrixCompleted(gp);
    if (filter === 'upcoming') return !isDone;
    if (filter === 'completed') return isDone;
    return true;
  });

  const nextRaceTarget = getRaceTargetTimestamp(nextGp);
  const nextRaceCd = getTimeRemaining(nextRaceTarget, nowMs);
  const nextRaceSession = getRaceSession(nextGp);
  const nextRaceFormatted = nextRaceSession ? formatSessionFull(nextRaceSession) : null;

  const handleManualCheck = () => {
    scheduleSyncService.fetchOfficialSchedule(true);
  };

  // Selected GP Details
  const selectedGp: GrandPrixEvent = schedule.find(gp => gp.round === selectedRound) || nextGp;
  const selectedGeo = CIRCUIT_GEO_MAP[selectedGp.circuitId] || {
    circuitId: selectedGp.circuitId,
    name: selectedGp.circuitName,
    officialName: selectedGp.circuitName,
    city: selectedGp.country,
    country: selectedGp.country,
    lng: 49.8533,
    lat: 40.3725,
    lengthKm: 5.0,
    laps: 50,
  };
  const isSelectedCompleted = isGrandPrixCompleted(selectedGp);
  const isSelectedNext = selectedGp.round === nextGp.round;
  const selectedTarget = getRaceTargetTimestamp(selectedGp);
  const selectedCd = getTimeRemaining(selectedTarget, nowMs);
  const isSprintWeekend = selectedGp.sessions.some(s => s.type === 'Sprint' || s.name.toLowerCase().includes('sprint'));

  // Mapbox Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const worldMarkersRef = useRef<{ round: number; marker: mapboxgl.Marker; el: HTMLDivElement }[]>([]);
  const activeTrackMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const carouselTrackRef = useRef<HTMLDivElement>(null);

  // Helper to get circuit track coordinates from GeoJSON
  const getCircuitStartCoord = (circuitId: string): [number, number] => {
    const data = CIRCUITS_GEOJSON[circuitId];
    if (data?.features?.[0]?.geometry?.coordinates?.[0]) {
      return data.features[0].geometry.coordinates[0];
    }
    const fallbackGeo = CIRCUIT_GEO_MAP[circuitId];
    return fallbackGeo ? [fallbackGeo.lng, fallbackGeo.lat] : [49.8533, 40.3725];
  };

  // Fly to circuit on Map
  const flyToCircuit = useCallback((circuitId: string, zoom = 13.9) => {
    if (!mapInstanceRef.current) return;
    const geo = CIRCUIT_GEO_MAP[circuitId];
    if (!geo) return;

    setMapZoomLevel('circuit');
    mapInstanceRef.current.flyTo({
      center: [geo.lng, geo.lat],
      zoom,
      pitch: 25,
      bearing: 0,
      speed: 1.2,
      curve: 1.4,
      essential: true,
    });
  }, []);

  // Fly to world view
  const flyToWorldView = useCallback(() => {
    if (!mapInstanceRef.current) return;
    setMapZoomLevel('world');
    mapInstanceRef.current.flyTo({
      center: [20, 30],
      zoom: 3.2,
      pitch: 15,
      bearing: 0,
      speed: 1.0,
      essential: true,
    });
  }, []);

  // Initialize Mapbox Map
  useEffect(() => {
    if (viewMode !== 'map' || !mapContainerRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initialLng = selectedGeo.lng || 49.8533;
    const initialLat = selectedGeo.lat || 40.3725;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAPBOX_STYLE,
      center: [initialLng, initialLat],
      zoom: 13.9,
      pitch: 25,
      bearing: 0,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => {
      // 1. Add GeoJSON Circuit Track Layer (LineString on Map)
      const initialGeoJson = CIRCUITS_GEOJSON[selectedGp.circuitId] || {
        type: 'FeatureCollection',
        features: []
      };

      if (!map.getSource('circuit-track-source')) {
        map.addSource('circuit-track-source', {
          type: 'geojson',
          data: initialGeoJson,
        });

        // Layer 1: Outer Neon Red Glow
        map.addLayer({
          id: 'circuit-track-glow',
          type: 'line',
          source: 'circuit-track-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#ff1a1a',
            'line-width': 10,
            'line-opacity': 0.45,
            'line-blur': 4,
          },
        });

        // Layer 2: Darker Contrast Casing
        map.addLayer({
          id: 'circuit-track-casing',
          type: 'line',
          source: 'circuit-track-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#600000',
            'line-width': 6,
            'line-opacity': 0.85,
          },
        });

        // Layer 3: Main High-Definition Racing Line
        map.addLayer({
          id: 'circuit-track-main',
          type: 'line',
          source: 'circuit-track-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#e10600',
            'line-width': 3.8,
            'line-opacity': 1.0,
          },
        });
      }

      // 2. Add Active Circuit Pulse Pin at Start/Finish Line
      const startCoord = getCircuitStartCoord(selectedGp.circuitId);
      const activePinEl = document.createElement('div');
      activePinEl.className = 'circuit-active-pin';
      activePinEl.title = `${selectedGp.flag} ${selectedGp.circuitName} (Línea de Salida / Meta)`;
      const pulseRing = document.createElement('div');
      pulseRing.className = 'marker-pulse-ring';
      activePinEl.appendChild(pulseRing);

      activeTrackMarkerRef.current = new mapboxgl.Marker({ element: activePinEl, anchor: 'center' })
        .setLngLat(startCoord)
        .addTo(map);

      // 3. Add World Overview Markers for all 24 Grand Prix
      worldMarkersRef.current.forEach(({ marker }) => marker.remove());
      worldMarkersRef.current = [];

      schedule.forEach((gp) => {
        const geo = CIRCUIT_GEO_MAP[gp.circuitId];
        if (!geo || typeof geo.lng !== 'number' || typeof geo.lat !== 'number') return;

        const isDone = isGrandPrixCompleted(gp);
        const isNext = gp.round === nextGp.round;
        const isCurSelected = gp.round === selectedRound;

        const el = document.createElement('div');
        el.className = `mapbox-world-marker ${isDone ? 'marker-completed' : isNext ? 'marker-next' : 'marker-future'} ${isCurSelected ? 'marker-selected' : ''}`;
        el.setAttribute('data-round', String(gp.round));
        el.title = `${gp.flag} R${gp.round}: ${gp.name} (${gp.circuitName})`;

        if (isNext) {
          const mPulse = document.createElement('div');
          mPulse.className = 'marker-pulse-ring';
          el.appendChild(mPulse);
        }

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedRound(gp.round);
          flyToCircuit(gp.circuitId, 13.9);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([geo.lng, geo.lat])
          .addTo(map);

        worldMarkersRef.current.push({ round: gp.round, marker, el });
      });
    });

    return () => {
      worldMarkersRef.current.forEach(({ marker }) => marker.remove());
      worldMarkersRef.current = [];
      if (activeTrackMarkerRef.current) {
        activeTrackMarkerRef.current.remove();
        activeTrackMarkerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [viewMode]);

  // Update Track Layer & Active Pin when selectedRound changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // 1. Update GeoJSON on Map
    const trackSource = mapInstanceRef.current.getSource('circuit-track-source') as mapboxgl.GeoJSONSource | undefined;
    const newTrackData = CIRCUITS_GEOJSON[selectedGp.circuitId];
    if (trackSource && newTrackData) {
      trackSource.setData(newTrackData);
    }

    // 2. Update Active Pin position on track
    const startCoord = getCircuitStartCoord(selectedGp.circuitId);
    if (activeTrackMarkerRef.current) {
      activeTrackMarkerRef.current.setLngLat(startCoord);
    }

    // 3. Update world marker selection class
    worldMarkersRef.current.forEach(({ round, el }) => {
      if (round === selectedRound) {
        el.classList.add('marker-selected');
      } else {
        el.classList.remove('marker-selected');
      }
    });

    // 4. Scroll bottom carousel card into view smoothly
    if (carouselTrackRef.current) {
      const cardEl = carouselTrackRef.current.querySelector(`[data-carousel-round="${selectedRound}"]`) as HTMLElement;
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedRound, selectedGp.circuitId]);

  // Handle select round and fly map
  const handleSelectGrandPrix = (gp: GrandPrixEvent) => {
    setSelectedRound(gp.round);
    flyToCircuit(gp.circuitId, 13.9);
  };

  const handleCarouselScroll = (direction: 'left' | 'right') => {
    if (carouselTrackRef.current) {
      const offset = direction === 'left' ? -340 : 340;
      carouselTrackRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handlePrevRound = () => {
    const prev = selectedRound > 1 ? selectedRound - 1 : schedule.length;
    const gp = schedule.find(g => g.round === prev);
    if (gp) handleSelectGrandPrix(gp);
  };

  const handleNextRound = () => {
    const next = selectedRound < schedule.length ? selectedRound + 1 : 1;
    const gp = schedule.find(g => g.round === next);
    if (gp) handleSelectGrandPrix(gp);
  };

  return (
    <div className="schedule-page">
      {/* Top Toolbar: View Switcher, FIA Hours Status & Filters */}
      <div className="schedule-toolbar">
        <div className="schedule-view-switcher">
          <button 
            className={`schedule-switch-btn ${viewMode === 'map' ? 'active' : ''}`}
            onClick={() => setViewMode('map')}
          >
            <MapIcon size={14} />
            <span>{t('filter_map_view')}</span>
          </button>
          <button 
            className={`schedule-switch-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid size={14} />
            <span>{t('filter_grid_view')}</span>
          </button>
        </div>

        {/* Sync Status Badge */}
        <div className="schedule-sync-pill">
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: '#00D7B6',
            boxShadow: '0 0 8px #00D7B6',
            display: 'inline-block'
          }} />
          <span>{t('official_hours')}: <strong style={{ color: '#00D7B6' }}>{t('confirmed_by_fia')}</strong></span>
          <button
            onClick={handleManualCheck}
            disabled={syncState.isChecking}
            className="f1-btn"
            style={{ padding: '3px 8px', fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title={t('check_hours')}
          >
            <RotateCw 
              size={11} 
              style={{ animation: syncState.isChecking ? 'spin 1s linear infinite' : 'none' }}
            />
            <span>{syncState.isChecking ? t('checking') : t('sync_now')}</span>
          </button>
        </div>

        {/* Quick Filter Counts */}
        <div className="schedule-filter-btn-group">
          <button 
            className={`f1-btn ${filter === 'all' ? 'f1-btn-active' : ''}`}
            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
            onClick={() => setFilter('all')}
          >
            {t('filter_all', { count: schedule.length })}
          </button>
          <button 
            className={`f1-btn ${filter === 'completed' ? 'f1-btn-active' : ''}`}
            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
            onClick={() => setFilter('completed')}
          >
            {t('filter_completed', { count: completedCount })}
          </button>
          <button 
            className={`f1-btn ${filter === 'upcoming' ? 'f1-btn-active' : ''}`}
            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
            onClick={() => setFilter('upcoming')}
          >
            {t('filter_upcoming', { count: upcomingCount })}
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: INTERACTIVE MAPBOX WORLD MAP WITH REAL TRACK OVERLAYS */}
      {viewMode === 'map' ? (
        <div className="schedule-map-wrapper">
          {/* Mapbox Canvas Container */}
          <div ref={mapContainerRef} className="schedule-map-container" />

          {/* Map View Toggle: Circuit View vs World View */}
          <div className="map-view-controls">
            <button 
              className={`map-control-pill ${mapZoomLevel === 'circuit' ? 'active' : ''}`}
              onClick={() => flyToCircuit(selectedGp.circuitId, 13.9)}
              title="Centrar en el trazado real del circuito"
            >
              <Compass size={13} />
              <span>{t('zoom_circuit')}</span>
            </button>
            <button 
              className={`map-control-pill ${mapZoomLevel === 'world' ? 'active' : ''}`}
              onClick={flyToWorldView}
              title="Vista global de todos los grandes premios"
            >
              <Globe size={13} />
              <span>{t('zoom_world')}</span>
            </button>
          </div>

          {/* Floating Left Aside: Selected Weekend Schedule & Real Track Overview */}
          <div className="schedule-aside-panel">
            {/* Top Accent Line */}
            <div className={`schedule-aside-accent ${isSelectedCompleted ? 'accent-completed' : isSelectedNext ? 'accent-next' : 'accent-future'}`} />

            <div className="schedule-aside-content">
              {/* Header Badges */}
              <div className="aside-header-tags">
                <span className="aside-round-badge">ROUND {selectedGp.round} / {schedule.length}</span>
                {isSprintWeekend && (
                  <span className="aside-sprint-badge">
                    <Zap size={10} />
                    <span>SPRINT</span>
                  </span>
                )}
                <span className={`aside-status-badge ${isSelectedCompleted ? 'status-completed' : isSelectedNext ? 'status-next' : 'status-future'}`}>
                  {isSelectedCompleted ? 'COMPLETADO' : isSelectedNext ? 'PRÓXIMO GP' : `EN ${selectedCd.days > 0 ? `${selectedCd.days}D ` : ''}${selectedCd.hours}H`}
                </span>
              </div>

              {/* Title & Dates */}
              <div className="aside-title-block">
                <h3 className="aside-gp-title">
                  <span>{selectedGp.flag}</span>
                  <span>{selectedGp.name}</span>
                </h3>
                <span className="aside-circuit-name">{selectedGp.circuitName}</span>
                <span className="aside-dates">
                  <Calendar size={12} color="var(--f1-red)" />
                  <span>{selectedGp.startDate} al {selectedGp.endDate}</span>
                </span>
              </div>

              {/* Countdown or Results Info */}
              {!isSelectedCompleted ? (
                <div className="aside-countdown-box">
                  <div className="aside-countdown-title">
                    <Timer size={12} color="#ff6666" />
                    <span>{t('next_event_in').toUpperCase()}</span>
                  </div>
                  <div className="aside-timer-digits">
                    <div className="aside-timer-col">
                      <span className="aside-timer-num">{selectedCd.days}</span>
                      <span className="aside-timer-lbl">{t('days_short')}</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 800 }}>:</span>
                    <div className="aside-timer-col">
                      <span className="aside-timer-num">{String(selectedCd.hours).padStart(2, '0')}</span>
                      <span className="aside-timer-lbl">{t('hours_short')}</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 800 }}>:</span>
                    <div className="aside-timer-col">
                      <span className="aside-timer-num">{String(selectedCd.minutes).padStart(2, '0')}</span>
                      <span className="aside-timer-lbl">{t('mins_short')}</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 800 }}>:</span>
                    <div className="aside-timer-col">
                      <span className="aside-timer-num" style={{ color: 'var(--f1-red)' }}>{String(selectedCd.seconds).padStart(2, '0')}</span>
                      <span className="aside-timer-lbl">{t('secs_short')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aside-results-box">
                  {selectedGp.winner && (
                    <div className="aside-winner-row">
                      <Trophy size={15} color="#ffd700" />
                      <span>{t('winner')}: <strong style={{ color: '#fff' }}>{selectedGp.winner}</strong></span>
                    </div>
                  )}
                  {selectedGp.polePosition && (
                    <div className="aside-pole-row">
                      <Timer size={13} color="var(--f1-red)" />
                      <span>{t('pole')}: <strong style={{ color: '#fff' }}>{selectedGp.polePosition}</strong></span>
                    </div>
                  )}
                  <button 
                    className="aside-results-btn"
                    onClick={() => setSelectedRoundForModal(selectedGp.round)}
                  >
                    <Trophy size={13} />
                    <span>{t('view_full_classification')}</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}

              {/* Weekend Sessions Timetable */}
              <div className="aside-sessions-section">
                <div className="aside-section-title">
                  <Clock size={12} color="var(--f1-red)" />
                  <span>{t('weekend_timetable')}</span>
                </div>
                <div className="aside-sessions-list">
                  {selectedGp.sessions.map((sess, idx) => {
                    const isRace = sess.type === 'Race';
                    const { dateStr, timeStr } = formatSessionFull(sess);
                    return (
                      <div key={idx} className={`aside-session-row ${isRace ? 'is-race' : ''}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isRace ? <Flag size={12} color="var(--f1-red)" /> : <Clock size={11} color="var(--text-muted)" />}
                          <span>{sess.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{dateStr}</span>
                          <span className={`aside-session-time ${isRace ? 'race-time' : ''}`}>{timeStr}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Circuit Technical Specs & Official FIA Track Image */}
              <div className="aside-circuit-specs">
                <div className="aside-section-title">
                  <Navigation size={12} color="var(--f1-red)" />
                  <span>{t('circuit_layout_data')}</span>
                </div>

                <div className="aside-track-img-container">
                  <img 
                    src={`/circuits/${selectedGp.circuitId}.png`} 
                    alt={selectedGp.circuitName} 
                    className="aside-track-real-img"
                    onError={(e) => {
                      // Fallback if image load error
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                <div className="aside-specs-grid">
                  <div className="aside-spec-card">
                    <span className="aside-spec-label">{t('circuit_length')}</span>
                    <span className="aside-spec-val">{selectedGeo.lengthKm} km</span>
                  </div>
                  <div className="aside-spec-card">
                    <span className="aside-spec-label">{t('circuit_laps')}</span>
                    <span className="aside-spec-val">{selectedGeo.laps} {t('laps').toLowerCase()}</span>
                  </div>
                  <div className="aside-spec-card">
                    <span className="aside-spec-label">{t('circuit_distance')}</span>
                    <span className="aside-spec-val">{(selectedGeo.lengthKm * selectedGeo.laps).toFixed(2)} km</span>
                  </div>
                  <div className="aside-spec-card">
                    <span className="aside-spec-label">{t('circuit_city')}</span>
                    <span className="aside-spec-val">{selectedGeo.city}</span>
                  </div>
                </div>

                {selectedGeo.lapRecord && (
                  <div className="aside-lap-record">
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.60rem', textTransform: 'uppercase' }}>{t('circuit_lap_record')}</span>
                    <span><strong>{selectedGeo.lapRecord.time}</strong> • {selectedGeo.lapRecord.driver} ({selectedGeo.lapRecord.year})</span>
                  </div>
                )}
              </div>

              {/* Navigation Actions */}
              <div className="aside-bottom-actions">
                <button 
                  className="aside-action-btn"
                  onClick={handlePrevRound}
                  title={t('prev_gp')}
                >
                  <ChevronLeft size={14} />
                  <span>R{selectedRound > 1 ? selectedRound - 1 : schedule.length}</span>
                </button>
                <button 
                  className="aside-action-btn"
                  style={{ background: 'rgba(225, 6, 0, 0.2)', borderColor: 'rgba(225, 6, 0, 0.4)' }}
                  onClick={() => flyToCircuit(selectedGp.circuitId, 13.9)}
                >
                  <Navigation size={12} color="var(--f1-red)" />
                  <span>{t('center_circuit')}</span>
                </button>
                <button 
                  className="aside-action-btn"
                  onClick={handleNextRound}
                  title={t('next_gp_btn')}
                >
                  <span>R{selectedRound < schedule.length ? selectedRound + 1 : 1}</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Snap-Scroll Horizontal Carousel (Matching formula1dashboard) */}
          <div className="schedule-carousel-wrapper">
            <button 
              className="carousel-nav-btn" 
              onClick={() => handleCarouselScroll('left')}
              title="Desplazar a la izquierda"
            >
              <ChevronLeft size={18} />
            </button>

            <div ref={carouselTrackRef} className="schedule-carousel-track">
              {filteredGps.map((gp) => {
                const isCompleted = isGrandPrixCompleted(gp);
                const isNext = gp.round === nextGp.round;
                const isSelected = gp.round === selectedRound;
                const isSprint = gp.sessions.some(s => s.type === 'Sprint' || s.name.toLowerCase().includes('sprint'));

                return (
                  <div 
                    key={gp.round}
                    data-carousel-round={gp.round}
                    className={`carousel-gp-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectGrandPrix(gp)}
                  >
                    {/* Left Column: Info, Round, Status, Country, Dates */}
                    <div className="carousel-card-info">
                      <div className="carousel-card-top">
                        <span className="carousel-round-pill">R{gp.round}</span>
                        {isSprint && <span className="sprint-tag">SPRINT</span>}
                        <span className={`carousel-status-pill ${isCompleted ? 'completed' : isNext ? 'next' : 'future'}`}>
                          {isCompleted ? 'FINALIZADO' : isNext ? 'PRÓXIMO' : 'PROGRAMADO'}
                        </span>
                      </div>

                      <span className="carousel-gp-title">
                        <span>{gp.flag}</span>
                        <span>{gp.country}</span>
                      </span>
                      <span className="carousel-gp-date">
                        {gp.startDate.slice(5)} al {gp.endDate.slice(5)}
                      </span>
                    </div>

                    {/* Right Column: Real Circuit Track Outline PNG */}
                    <div className="carousel-card-track-col">
                      <img 
                        src={`/circuits/${gp.circuitId}.png`} 
                        alt={gp.circuitName}
                        className="carousel-track-real-img"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              className="carousel-nav-btn" 
              onClick={() => handleCarouselScroll('right')}
              title="Desplazar a la derecha"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: ORIGINAL CLEAN GRID WITH DETAILED CARDS & COUNTDOWNS */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Hero Banner to Next Race */}
          <div className="countdown-banner">
            <div className="countdown-info">
              <span className="countdown-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Timer size={14} color="var(--f1-red)" />
                <span>PRÓXIMA CARRERA EN DIRECTO • ROUND {nextGp.round}</span>
              </span>
              <h2 className="countdown-gp-name">
                {nextGp.flag} {nextGp.name} 2026
              </h2>
              <span className="countdown-track">
                {nextGp.circuitName} • Carrera: {nextRaceFormatted ? `${nextRaceFormatted.dateStr} a las ${nextRaceFormatted.timeStr}` : `${nextGp.startDate} al ${nextGp.endDate}`}
              </span>
            </div>

            <div className="countdown-timer-group">
              {nextRaceCd.days > 0 && (
                <div className="timer-unit-box">
                  <span className="timer-number">{nextRaceCd.days}</span>
                  <span className="timer-label">{t('days')}</span>
                </div>
              )}
              <div className="timer-unit-box">
                <span className="timer-number">{String(nextRaceCd.hours).padStart(2, '0')}</span>
                <span className="timer-label">{t('hours')}</span>
              </div>
              <div className="timer-unit-box">
                <span className="timer-number">{String(nextRaceCd.minutes).padStart(2, '0')}</span>
                <span className="timer-label">{t('min')}</span>
              </div>
              <div className="timer-unit-box">
                <span className="timer-number" style={{ color: 'var(--f1-red)' }}>
                  {String(nextRaceCd.seconds).padStart(2, '0')}
                </span>
                <span className="timer-label">{t('sec')}</span>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="calendar-grid">
            {filteredGps.map((gp) => {
              const isCompleted = isGrandPrixCompleted(gp);
              const isNext = gp.round === nextGp.round;
              const raceTarget = getRaceTargetTimestamp(gp);
              const raceCd = getTimeRemaining(raceTarget, nowMs);

              return (
                <div 
                  key={gp.round} 
                  className={`gp-card ${isNext ? 'next-up' : ''}`}
                  onClick={() => {
                    if (isCompleted) {
                      setSelectedRoundForModal(gp.round);
                    }
                  }}
                  style={{ cursor: isCompleted ? 'pointer' : 'default' }}
                >
                  <div className="gp-card-header">
                    <span className="gp-round">{t('round').toUpperCase()} {gp.round}</span>
                    {isCompleted ? (
                      <span className="f1-badge badge-green">{t('completed')}</span>
                    ) : isNext ? (
                      <span className="f1-badge badge-live">🔴 {t('session_next')}</span>
                    ) : (
                      <span className="f1-badge" style={{ color: '#00D7B6', borderColor: 'rgba(0, 215, 182, 0.35)', background: 'rgba(0, 215, 182, 0.08)' }}>
                        ⏱️ EN {raceCd.days > 0 ? `${raceCd.days}d ` : ''}{raceCd.hours}h
                      </span>
                    )}
                  </div>

                  <div className="gp-title-area">
                    <span className="gp-flag">{gp.flag}</span>
                    <div className="gp-names">
                      <span className="gp-main-title">{gp.name}</span>
                      <span className="gp-circuit-name">{gp.circuitName}</span>
                    </div>
                  </div>

                  {/* Sessions timetable */}
                  <div className="gp-sessions-list">
                    {gp.sessions.map((sess, idx) => {
                      const isRace = sess.type === 'Race';
                      const { dateStr, timeStr } = formatSessionFull(sess);
                      return (
                        <div key={idx} className={`session-schedule-row ${isRace ? 'race' : ''}`}>
                          <div className="session-name-tag">
                            {isRace ? <Flag size={13} color="var(--f1-red)" /> : <Clock size={12} />}
                            <span style={{ fontWeight: isRace ? 700 : 500 }}>{sess.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{dateStr}</span>
                            <span style={{
                              background: isRace ? 'rgba(225, 6, 0, 0.15)' : 'rgba(0, 215, 182, 0.12)',
                              color: isRace ? '#ff4d4d' : '#00D7B6',
                              border: isRace ? '1px solid rgba(225, 6, 0, 0.3)' : '1px solid rgba(0, 215, 182, 0.25)',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontWeight: 700,
                            }}>
                              {timeStr}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Countdown for Upcoming */}
                  {!isCompleted && (
                    <div className={`gp-card-race-countdown ${isNext ? 'is-next-race' : ''}`}>
                      <div className="gp-countdown-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Timer size={13} color={isNext ? 'var(--f1-red)' : '#00D7B6'} />
                          <span className="gp-countdown-label">
                            {isNext ? 'PRÓXIMA CARRERA EN' : 'TIEMPO HASTA LA CARRERA'}
                          </span>
                        </div>
                        {isNext && <span className="gp-next-pill">PRÓXIMO GP</span>}
                      </div>

                      <div className="gp-countdown-grid">
                        <div className="gp-cd-box">
                          <span className="gp-cd-num">{raceCd.days}</span>
                          <span className="gp-cd-txt">DÍAS</span>
                        </div>
                        <span className="gp-cd-colon">:</span>
                        <div className="gp-cd-box">
                          <span className="gp-cd-num">{String(raceCd.hours).padStart(2, '0')}</span>
                          <span className="gp-cd-txt">HRS</span>
                        </div>
                        <span className="gp-cd-colon">:</span>
                        <div className="gp-cd-box">
                          <span className="gp-cd-num">{String(raceCd.minutes).padStart(2, '0')}</span>
                          <span className="gp-cd-txt">MIN</span>
                        </div>
                        <span className="gp-cd-colon">:</span>
                        <div className="gp-cd-box gp-cd-seconds">
                          <span className="gp-cd-num">{String(raceCd.seconds).padStart(2, '0')}</span>
                          <span className="gp-cd-txt">SEG</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Completed Winner & Results */}
                  {isCompleted && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {gp.winner && (
                        <div className="gp-winner-box">
                          <Trophy size={15} color="#ffd700" />
                          <span>{t('winner')}: <strong>{gp.winner}</strong></span>
                        </div>
                      )}
                      <div className="gp-card-view-results-btn">
                        <Trophy size={13} />
                        <span>{t('view_results_22')}</span>
                        <ChevronRight size={13} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Driver Results Modal */}
      {selectedRoundForModal !== null && (
        <RaceResultsModal
          round={selectedRoundForModal}
          onClose={() => setSelectedRoundForModal(null)}
          onSelectRound={(newRound) => setSelectedRoundForModal(newRound)}
        />
      )}
    </div>
  );
};
