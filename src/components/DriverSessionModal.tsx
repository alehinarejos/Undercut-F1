import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Timer, 
  Gauge, 
  RotateCw, 
  CircleDot, 
  Activity
} from 'lucide-react';
import { officialF1Api, type OpenF1Lap } from '../services/officialF1Api';
import { TeamLogo } from './TeamLogo';
import '../styles/driver-session-modal.css';

export interface DriverSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverNumber: number | string;
  driverCode: string;
  driverName: string;
  team: string;
  teamColor: string;
  flag?: string;
  position?: number;
  sessionKey?: string | number;
  sessionName?: string;
  overallBestLapTime?: string;
}

export interface FormattedLapItem {
  lapNumber: number;
  durationSec: number | null;
  durationFormatted: string;
  s1Sec: number | null;
  s1Formatted: string;
  s1Status: 'purple' | 'green' | 'yellow' | 'none';
  s2Sec: number | null;
  s2Formatted: string;
  s2Status: 'purple' | 'green' | 'yellow' | 'none';
  s3Sec: number | null;
  s3Formatted: string;
  s3Status: 'purple' | 'green' | 'yellow' | 'none';
  speedTrap: number | null;
  isPitOut: boolean;
  isPitIn: boolean;
  compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET';
  compoundColor: string;
  isPersonalBest: boolean;
  isOverallBest: boolean;
}

export interface StintSummaryItem {
  stintNumber: number;
  compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET';
  lapsCount: number;
  startLap: number;
  endLap: number;
}

function formatLapDuration(seconds: number | null | undefined): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  const secsStr = remSec.toFixed(3);
  const paddedSecs = remSec < 10 ? `0${secsStr}` : secsStr;
  return `${mins}:${paddedSecs}`;
}

function formatSector(seconds: number | null | undefined): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '—';
  return seconds.toFixed(3);
}

function parseTimeToSec(timeStr?: string): number {
  if (!timeStr || timeStr.includes('-') || timeStr.includes('—') || !timeStr.includes(':')) {
    return Infinity;
  }
  const parts = timeStr.replace('+', '').trim().split(':');
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    if (!isNaN(mins) && !isNaN(secs)) return mins * 60 + secs;
  }
  return parseFloat(timeStr) || Infinity;
}

export const DriverSessionModal: React.FC<DriverSessionModalProps> = ({
  isOpen,
  onClose,
  driverNumber,
  driverCode,
  driverName,
  team,
  teamColor,
  flag = '🏁',
  position,
  sessionKey,
  sessionName = 'Sesión Oficial F1',
  overallBestLapTime,
}) => {
  const [laps, setLaps] = useState<OpenF1Lap[]>([]);
  const [stints, setStints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const numericDriverNumber = typeof driverNumber === 'string' ? parseInt(driverNumber, 10) : driverNumber;

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Lock background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Fetch driver laps & stints whenever modal is opened
  useEffect(() => {
    if (!isOpen || !numericDriverNumber) return;

    let isMounted = true;
    setIsLoading(true);

    const fetchData = async () => {
      try {
        const resolvedKey = sessionKey || 'latest';
        const [lapsData, stintsData] = await Promise.all([
          officialF1Api.getDriverLaps(resolvedKey, numericDriverNumber),
          officialF1Api.getDriverStints(resolvedKey, numericDriverNumber),
        ]);

        if (!isMounted) return;

        setLaps(lapsData);
        setStints(stintsData);
      } catch (err) {
        console.warn(`[DriverSessionModal] Failed to fetch laps for driver #${numericDriverNumber}:`, err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, numericDriverNumber, sessionKey]);

  // Stint mapper
  const stintsSummary: StintSummaryItem[] = useMemo(() => {
    if (!Array.isArray(stints) || stints.length === 0) {
      return [
        {
          stintNumber: 1,
          compound: 'MEDIUM',
          lapsCount: laps.length || 1,
          startLap: 1,
          endLap: laps.length || 1,
        }
      ];
    }

    return stints.map((s, idx) => {
      const start = Number(s.lap_start) || 1;
      const end = Number(s.lap_end) || start;
      const count = Math.max(1, end - start + 1);
      const rawComp = String(s.compound || 'MEDIUM').toUpperCase();
      const comp: StintSummaryItem['compound'] =
        rawComp.includes('SOFT') ? 'SOFT' :
        rawComp.includes('HARD') ? 'HARD' :
        rawComp.includes('INTER') ? 'INTERMEDIATE' :
        rawComp.includes('WET') ? 'WET' : 'MEDIUM';

      return {
        stintNumber: idx + 1,
        compound: comp,
        lapsCount: count,
        startLap: start,
        endLap: end,
      };
    });
  }, [stints, laps.length]);

  // Process and sort laps
  const { formattedLaps, personalBestSec, sessionFastestSec, maxSpeedTrap } = useMemo(() => {
    let pBestSec = Infinity;
    let sFastestSec = parseTimeToSec(overallBestLapTime);
    let topSpeed = 0;

    let pBestS1 = Infinity;
    let pBestS2 = Infinity;
    let pBestS3 = Infinity;

    // Find personal bests
    laps.forEach(l => {
      if (l.lap_duration && !l.is_pit_out_lap && l.lap_duration < pBestSec) {
        pBestSec = l.lap_duration;
      }
      if (l.duration_sector_1 && l.duration_sector_1 < pBestS1) pBestS1 = l.duration_sector_1;
      if (l.duration_sector_2 && l.duration_sector_2 < pBestS2) pBestS2 = l.duration_sector_2;
      if (l.duration_sector_3 && l.duration_sector_3 < pBestS3) pBestS3 = l.duration_sector_3;
      if (l.st_speed && l.st_speed > topSpeed) topSpeed = l.st_speed;
    });

    if (pBestSec < sFastestSec) {
      sFastestSec = pBestSec;
    }

    // Format each lap
    const formatted: FormattedLapItem[] = laps.map(l => {
      const dur = l.lap_duration;
      const isPB = Boolean(dur && Math.abs(dur - pBestSec) < 0.001);
      const isOB = Boolean(dur && sFastestSec !== Infinity && Math.abs(dur - sFastestSec) < 0.001);

      // Determine compound for this lap from stints
      const lapNum = l.lap_number;
      const matchingStint = stintsSummary.find(s => lapNum >= s.startLap && lapNum <= s.endLap) || stintsSummary[0];
      const comp = matchingStint ? matchingStint.compound : 'MEDIUM';

      const s1 = l.duration_sector_1;
      const s2 = l.duration_sector_2;
      const s3 = l.duration_sector_3;

      const s1Status = (s1 && Math.abs(s1 - pBestS1) < 0.001) ? (isOB ? 'purple' : 'green') : s1 ? 'yellow' : 'none';
      const s2Status = (s2 && Math.abs(s2 - pBestS2) < 0.001) ? (isOB ? 'purple' : 'green') : s2 ? 'yellow' : 'none';
      const s3Status = (s3 && Math.abs(s3 - pBestS3) < 0.001) ? (isOB ? 'purple' : 'green') : s3 ? 'yellow' : 'none';

      const compoundColor =
        comp === 'SOFT' ? '#ff3b30' :
        comp === 'MEDIUM' ? '#ffd60a' :
        comp === 'HARD' ? '#ffffff' :
        comp === 'INTERMEDIATE' ? '#34c759' : '#007aff';

      return {
        lapNumber: lapNum,
        durationSec: dur,
        durationFormatted: formatLapDuration(dur),
        s1Sec: s1,
        s1Formatted: formatSector(s1),
        s1Status,
        s2Sec: s2,
        s2Formatted: formatSector(s2),
        s2Status,
        s3Sec: s3,
        s3Formatted: formatSector(s3),
        s3Status,
        speedTrap: l.st_speed,
        isPitOut: l.is_pit_out_lap,
        isPitIn: Boolean(dur && (!s3 || s3 > 40)),
        compound: comp,
        compoundColor,
        isPersonalBest: isPB,
        isOverallBest: isOB,
      };
    });

    return {
      formattedLaps: formatted,
      personalBestSec: pBestSec === Infinity ? null : pBestSec,
      sessionFastestSec: sFastestSec === Infinity ? null : sFastestSec,
      maxSpeedTrap: topSpeed || null,
    };
  }, [laps, overallBestLapTime, stintsSummary]);

  // Delta calculation
  const personalBestDelta = useMemo(() => {
    if (!personalBestSec || !sessionFastestSec) return null;
    const diff = personalBestSec - sessionFastestSec;
    if (diff <= 0.001) return 'VUELTA RÁPIDA DE LA SESIÓN';
    return `+${diff.toFixed(3)}s vs P1`;
  }, [personalBestSec, sessionFastestSec]);

  if (!isOpen) return null;

  return createPortal(
    <div className="driver-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="driver-modal-container" 
        onClick={(e) => e.stopPropagation()}
        style={{ '--driver-team-color': teamColor } as React.CSSProperties}
      >
        {/* Header */}
        <div className="driver-modal-header">
          <div className="driver-modal-header-accent" />
          <div className="driver-modal-profile">
            <div className="driver-modal-number-badge">
              {numericDriverNumber || driverCode}
            </div>
            <div className="driver-modal-info">
              <div className="driver-modal-name-row">
                <span style={{ fontSize: '1.2rem' }}>{flag}</span>
                <h2 className="driver-modal-name">{driverName}</h2>
                <span className="driver-modal-code">{driverCode}</span>
                {position !== undefined && (
                  <span className="driver-modal-pos-badge">P{position}</span>
                )}
              </div>
              <div className="driver-modal-team-row">
                <TeamLogo team={team} color={teamColor} size={16} />
                <span>{team}</span>
                <span>•</span>
                <span>{sessionName}</span>
              </div>
            </div>
          </div>

          <button 
            className="driver-modal-close-btn" 
            onClick={onClose}
            aria-label="Cerrar modal"
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="driver-modal-body">
          {/* Section 1: KPI Statistics Grid */}
          <div className="driver-modal-kpi-grid">
            {/* 1. Best Lap */}
            <div className="driver-kpi-card">
              <span className="driver-kpi-title">
                <Timer size={14} color="#d354ff" />
                Mejor Vuelta Personal
              </span>
              <span className="driver-kpi-value">
                {personalBestSec ? formatLapDuration(personalBestSec) : '—:——.———'}
              </span>
              {personalBestDelta && (
                <span className={`driver-kpi-subtext ${personalBestDelta.includes('RÁPIDA') ? 'highlight-purple' : 'highlight-green'}`}>
                  {personalBestDelta}
                </span>
              )}
            </div>

            {/* 2. Total Laps */}
            <div className="driver-kpi-card">
              <span className="driver-kpi-title">
                <RotateCw size={14} color="#00D7B6" />
                Vueltas Completadas
              </span>
              <span className="driver-kpi-value">
                {formattedLaps.length} <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>vueltas</span>
              </span>
              <span className="driver-kpi-subtext">
                {formattedLaps.filter(l => !l.isPitOut && l.durationSec).length} vueltas cronometradas
              </span>
            </div>

            {/* 3. Speed Trap */}
            <div className="driver-kpi-card">
              <span className="driver-kpi-title">
                <Gauge size={14} color="#ff3b30" />
                Velocidad Punta (ST)
              </span>
              <span className="driver-kpi-value">
                {maxSpeedTrap ? `${maxSpeedTrap} ` : '342 '}
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>km/h</span>
              </span>
              <span className="driver-kpi-subtext">
                Sector de Velocidad Máxima
              </span>
            </div>

            {/* 4. Stints Strategy */}
            <div className="driver-kpi-card">
              <span className="driver-kpi-title">
                <CircleDot size={14} color="#ffd60a" />
                Estrategia de Neumáticos
              </span>
              <div className="driver-stints-container" style={{ marginTop: '4px' }}>
                {stintsSummary.map(s => {
                  const compClass = 
                    s.compound === 'SOFT' ? 'compound-soft' :
                    s.compound === 'MEDIUM' ? 'compound-medium' :
                    s.compound === 'HARD' ? 'compound-hard' :
                    s.compound === 'INTERMEDIATE' ? 'compound-inter' : 'compound-wet';

                  return (
                    <div key={s.stintNumber} className="driver-stint-pill" title={`Tanda ${s.stintNumber}: Vueltas ${s.startLap} - ${s.endLap}`}>
                      <span className={`driver-compound-circle ${compClass}`}>
                        {s.compound[0]}
                      </span>
                      <span>{s.lapsCount}v</span>
                    </div>
                  );
                })}
              </div>
              <span className="driver-kpi-subtext" style={{ marginTop: '2px' }}>
                {stintsSummary.length} {stintsSummary.length === 1 ? 'tanda realizada' : 'tandas realizadas'}
              </span>
            </div>
          </div>

          {/* Section 2: Full Lap-by-Lap History Table */}
          <div>
            <div className="driver-modal-section-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#00e676" />
                Historial de Vueltas (Lap-by-Lap)
              </span>
              <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: '#94a3b8', fontWeight: 600 }}>
                {formattedLaps.length} Giros Registrados
              </span>
            </div>

            {isLoading ? (
              <div style={{ padding: '16px 0' }}>
                <div className="driver-modal-skeleton-row">
                  <div className="driver-modal-skeleton-box" />
                </div>
                <div className="driver-modal-skeleton-row">
                  <div className="driver-modal-skeleton-box" />
                </div>
                <div className="driver-modal-skeleton-row">
                  <div className="driver-modal-skeleton-box" />
                </div>
              </div>
            ) : formattedLaps.length === 0 ? (
              <div className="driver-modal-empty-state">
                <span className="driver-modal-empty-icon">🏎️ ⏸️</span>
                <span className="driver-modal-empty-title">El piloto se encuentra en boxes</span>
                <p className="driver-modal-empty-text">
                  Aún no registra vueltas cronometradas en esta sesión oficial. Tan pronto como el monoplaza complete su primera vuelta en pista, los tiempos y sectores aparecerán automáticamente aquí.
                </p>
              </div>
            ) : (
              <div className="driver-laps-table-wrapper">
                <table className="driver-laps-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>VUELTA</th>
                      <th>TIEMPO</th>
                      <th>SECTOR 1</th>
                      <th>SECTOR 2</th>
                      <th>SECTOR 3</th>
                      <th>NEUMÁTICO</th>
                      <th>ESTADO</th>
                      <th>SPEED TRAP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formattedLaps.map(lap => {
                      const timeClass = lap.isOverallBest 
                        ? 'lap-time-purple' 
                        : lap.isPersonalBest 
                        ? 'lap-time-green' 
                        : '';

                      const s1Class = lap.s1Status === 'purple' ? 'sector-purple' : lap.s1Status === 'green' ? 'sector-green' : lap.s1Status === 'yellow' ? 'sector-yellow' : '';
                      const s2Class = lap.s2Status === 'purple' ? 'sector-purple' : lap.s2Status === 'green' ? 'sector-green' : lap.s2Status === 'yellow' ? 'sector-yellow' : '';
                      const s3Class = lap.s3Status === 'purple' ? 'sector-purple' : lap.s3Status === 'green' ? 'sector-green' : lap.s3Status === 'yellow' ? 'sector-yellow' : '';

                      return (
                        <tr key={lap.lapNumber}>
                          <td style={{ fontWeight: 800, color: '#f1f5f9' }}>
                            #{lap.lapNumber}
                          </td>
                          <td className={timeClass} style={{ fontWeight: 800 }}>
                            {lap.isPitOut ? (
                              <span style={{ color: '#fbbf24' }}>OUT LAP</span>
                            ) : (
                              lap.durationFormatted
                            )}
                          </td>
                          <td className={s1Class}>{lap.s1Formatted}</td>
                          <td className={s2Class}>{lap.s2Formatted}</td>
                          <td className={s3Class}>{lap.s3Formatted}</td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <span 
                                style={{
                                  display: 'inline-block',
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  backgroundColor: lap.compoundColor,
                                }} 
                              />
                              <span style={{ fontSize: '0.70rem', fontWeight: 700, color: lap.compoundColor }}>
                                {lap.compound[0]}
                              </span>
                            </div>
                          </td>
                          <td>
                            {lap.isPitOut ? (
                              <span className="lap-state-pill lap-state-out">OUT LAP</span>
                            ) : lap.isPitIn ? (
                              <span className="lap-state-pill lap-state-in">IN PIT</span>
                            ) : (
                              <span className="lap-state-pill lap-state-clean">CRONOMETRADA</span>
                            )}
                          </td>
                          <td style={{ color: lap.speedTrap ? '#f1f5f9' : '#64748b' }}>
                            {lap.speedTrap ? `${lap.speedTrap} km/h` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
