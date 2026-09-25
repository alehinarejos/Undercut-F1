import React from 'react';
import { ChevronLeft, ChevronRight, Navigation, Timer, Flag } from 'lucide-react';
import { TeamLogo } from './TeamLogo';
import type { LeaderboardEntry } from '../types/telemetry';

interface DriverLapTrackerProps {
  entry: LeaderboardEntry | undefined;
  allEntries: LeaderboardEntry[];
  onSelectDriver: (driverId: string) => void;
}

export const DriverLapTracker: React.FC<DriverLapTrackerProps> = ({
  entry,
  allEntries,
  onSelectDriver,
}) => {
  if (!entry) {
    return null;
  }

  const driver = entry.driver;
  const isLeader = entry.position === 1;

  // Driver cycling
  const currentIndex = allEntries.findIndex(e => e.driver.id === driver.id);
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allEntries.length === 0) return;
    const prevIdx = (currentIndex - 1 + allEntries.length) % allEntries.length;
    onSelectDriver(allEntries[prevIdx].driver.id);
  };
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allEntries.length === 0) return;
    const nextIdx = (currentIndex + 1) % allEntries.length;
    onSelectDriver(allEntries[nextIdx].driver.id);
  };

  // Status computation
  const isPit = Boolean(entry.inPit && !entry.isPitOut);
  const isPitOut = Boolean(entry.isPitOut && !entry.inPit);
  const trackProgress = Math.max(0, Math.min(1, entry.trackProgress ?? 0));
  const progressPercent = Math.round(trackProgress * 100);

  // Active sector detection based on progress (S1: 0-33.3%, S2: 33.3-66.6%, S3: 66.6-100%)
  const currentSector = isPit 
    ? 'PIT' 
    : trackProgress < 0.3333 
    ? 1 
    : trackProgress < 0.6666 
    ? 2 
    : 3;

  // Compound styling
  const comp = entry.tyre?.compound || 'MEDIUM';
  const compColor =
    comp === 'SOFT' ? '#ff3b30' :
    comp === 'MEDIUM' ? '#ffd60a' :
    comp === 'HARD' ? '#ffffff' :
    comp === 'INTERMEDIATE' ? '#34c759' : '#007aff';

  // Sector status colors
  const getSectorColor = (status?: string, time?: string) => {
    if (status === 'purple') return '#d354ff';
    if (status === 'green') return '#00e676';
    if (status === 'yellow') return '#ffd60a';
    if (status === 'pit') return '#0095ff';
    return time && time.trim() !== '' ? '#cbd5e1' : 'rgba(255, 255, 255, 0.25)';
  };

  // Microsectors rendering helper
  const microColorMap: Record<string, string> = {
    purple: '#d354ff',
    green: '#00e676',
    yellow: '#ffd60a',
    pit: '#0095ff',
    none: 'rgba(255, 255, 255, 0.12)',
  };

  const renderMicrosectors = (segments?: string[], count = 8) => {
    const arr: string[] = [];
    for (let i = 0; i < count; i++) {
      const val = segments && segments[i];
      arr.push(val && microColorMap[val] ? microColorMap[val] : microColorMap.none);
    }
    return (
      <div style={{ display: 'flex', gap: '2px', flex: 1, minWidth: 0 }}>
        {arr.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '6px',
              borderRadius: '1.5px',
              backgroundColor: c,
              boxShadow: c === '#d354ff' 
                ? '0 0 5px rgba(211, 84, 255, 0.8)' 
                : c === '#00e676'
                ? '0 0 4px rgba(0, 230, 118, 0.6)'
                : 'none',
              transition: 'background-color 0.18s ease',
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      className="f1-card driver-lap-tracker-card"
      style={{
        background: 'linear-gradient(180deg, rgba(14, 16, 22, 0.98) 0%, rgba(9, 10, 14, 0.96) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderTop: `3px solid ${driver.teamColor || 'var(--f1-red)'}`,
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxSizing: 'border-box',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header: Driver Info, Position, Selector Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          <TeamLogo team={driver.team} color={driver.teamColor} size={32} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: '0.98rem',
                color: '#fff',
                letterSpacing: '0.03em',
                lineHeight: 1.1,
              }}>
                #{driver.number} {driver.lastName || driver.code}
              </span>
              <span style={{ fontSize: '0.80rem' }}>{driver.flag || '🏁'}</span>
            </div>
            <span style={{
              fontSize: '0.66rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {driver.team}
            </span>
          </div>
        </div>

        {/* Position & Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div style={{
            background: isLeader ? 'rgba(255, 215, 0, 0.18)' : 'rgba(255, 255, 255, 0.08)',
            border: `1px solid ${isLeader ? '#ffd700' : 'rgba(255, 255, 255, 0.16)'}`,
            padding: '2px 8px',
            borderRadius: '5px',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '0.82rem',
            color: isLeader ? '#ffd700' : '#fff',
          }}>
            P{entry.position}
          </div>

          <div style={{ display: 'flex', gap: '2px' }}>
            <button
              onClick={handlePrev}
              title="Piloto anterior"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                borderRadius: '4px',
                width: '22px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={handleNext}
              title="Piloto siguiente"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                borderRadius: '4px',
                width: '22px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Live Track Progress Bar (Vuelta en directo S1 -> S2 -> S3) */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '7px',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        {/* Header row: Status + Sector + Gap */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isPit ? (
              <span style={{
                background: 'rgba(0, 149, 255, 0.22)',
                border: '1px solid #0095ff',
                color: '#0095ff',
                padding: '1px 6px',
                borderRadius: '3px',
                fontSize: '0.62rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
              }}>
                IN PIT
              </span>
            ) : isPitOut ? (
              <span style={{
                background: 'rgba(255, 214, 10, 0.22)',
                border: '1px solid #ffd60a',
                color: '#ffd60a',
                padding: '1px 6px',
                borderRadius: '3px',
                fontSize: '0.62rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
              }}>
                OUT LAP
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#00e676',
                  boxShadow: '0 0 8px #00e676',
                }} />
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  color: '#00e676',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                }}>
                  SECTOR {currentSector} ({progressPercent}%)
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: '#94a3b8' }}>
              GAP: <strong style={{ color: isLeader ? '#ffd700' : '#fff' }}>{isLeader ? 'LEADER' : (entry.gapToLeader || '—')}</strong>
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
            <span style={{ color: '#94a3b8' }}>
              INT: <strong style={{ color: isLeader ? '#ffd700' : '#fff' }}>{isLeader ? '—' : (entry.gapToAhead || '—')}</strong>
            </span>
          </div>
        </div>

        {/* Visual Progress Track */}
        <div style={{ position: 'relative', width: '100%', height: '14px', display: 'flex', alignItems: 'center' }}>
          {/* Track background with 3 sector divisions */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '6px',
            borderRadius: '3px',
            background: 'rgba(255, 255, 255, 0.08)',
            display: 'flex',
            overflow: 'hidden',
          }}>
            <div style={{
              flex: '1 1 33.33%',
              borderRight: '1.5px solid rgba(0, 0, 0, 0.6)',
              background: currentSector === 1 ? 'rgba(0, 230, 118, 0.35)' : 'transparent',
            }} />
            <div style={{
              flex: '1 1 33.33%',
              borderRight: '1.5px solid rgba(0, 0, 0, 0.6)',
              background: currentSector === 2 ? 'rgba(0, 230, 118, 0.35)' : 'transparent',
            }} />
            <div style={{
              flex: '1 1 33.34%',
              background: currentSector === 3 ? 'rgba(0, 230, 118, 0.35)' : 'transparent',
            }} />
          </div>

          {/* Progress fill */}
          <div style={{
            position: 'absolute',
            left: 0,
            width: `${progressPercent}%`,
            height: '6px',
            borderRadius: '3px',
            background: isPit ? '#0095ff' : driver.teamColor || '#00e676',
            boxShadow: `0 0 10px ${isPit ? '#0095ff' : driver.teamColor || '#00e676'}`,
            transition: 'width 0.2s linear',
          }} />

          {/* Car dot indicator */}
          <div style={{
            position: 'absolute',
            left: `calc(${progressPercent}% - 6px)`,
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#fff',
            border: `2px solid ${driver.teamColor || '#00e676'}`,
            boxShadow: `0 0 8px ${driver.teamColor || '#00e676'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'left 0.2s linear',
            zIndex: 2,
          }}>
            <Navigation size={7} color="#000" style={{ transform: 'rotate(90deg)' }} />
          </div>
        </div>

        {/* Sector labels under track */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
          <span style={{ color: currentSector === 1 ? '#00e676' : '#64748b', fontWeight: currentSector === 1 ? 800 : 600 }}>S1 (33%)</span>
          <span style={{ color: currentSector === 2 ? '#00e676' : '#64748b', fontWeight: currentSector === 2 ? 800 : 600 }}>S2 (66%)</span>
          <span style={{ color: currentSector === 3 ? '#00e676' : '#64748b', fontWeight: currentSector === 3 ? 800 : 600 }}>S3 (META)</span>
        </div>

        {/* 25 Microsectors Row live */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
          <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: '#64748b', fontWeight: 800, width: '16px' }}>
            MINI
          </span>
          <div style={{ display: 'flex', gap: '4px', flex: 1, minWidth: 0, alignItems: 'center' }}>
            {renderMicrosectors(entry.s1Segments, 8)}
            <span style={{ width: '1px', height: '8px', background: 'rgba(255, 255, 255, 0.2)' }} />
            {renderMicrosectors(entry.s2Segments, 8)}
            <span style={{ width: '1px', height: '8px', background: 'rgba(255, 255, 255, 0.2)' }} />
            {renderMicrosectors(entry.s3Segments, 9)}
          </div>
        </div>
      </div>

      {/* 3. Sectors Time Breakdown Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
        {/* S1 Box */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '6px',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
        }}>
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#94a3b8', fontWeight: 700 }}>
            SECTOR 1
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.86rem',
            fontWeight: 800,
            color: getSectorColor(entry.s1Status, entry.s1Time),
            letterSpacing: '0.02em',
          }}>
            {entry.s1Time && entry.s1Time.trim() !== '' ? entry.s1Time : '—'}
          </span>
          <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            PB: {entry.s1BestTime || '—'}
          </span>
        </div>

        {/* S2 Box */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '6px',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
        }}>
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#94a3b8', fontWeight: 700 }}>
            SECTOR 2
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.86rem',
            fontWeight: 800,
            color: getSectorColor(entry.s2Status, entry.s2Time),
            letterSpacing: '0.02em',
          }}>
            {entry.s2Time && entry.s2Time.trim() !== '' ? entry.s2Time : '—'}
          </span>
          <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            PB: {entry.s2BestTime || '—'}
          </span>
        </div>

        {/* S3 Box */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '6px',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
        }}>
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#94a3b8', fontWeight: 700 }}>
            SECTOR 3
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.86rem',
            fontWeight: 800,
            color: getSectorColor(entry.s3Status, entry.s3Time),
            letterSpacing: '0.02em',
          }}>
            {entry.s3Time && entry.s3Time.trim() !== '' ? entry.s3Time : '—'}
          </span>
          <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
            PB: {entry.s3BestTime || '—'}
          </span>
        </div>
      </div>

      {/* 4. Lap Times Summary Box: LAST LAP vs BEST LAP */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '7px',
        padding: '8px 12px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
      }}>
        {/* Last Lap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Timer size={11} color="#64748b" />
            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: '#94a3b8', fontWeight: 800 }}>
              ÚLTIMA VUELTA
            </span>
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.94rem',
            fontWeight: 900,
            color: entry.lastLapTime && !isPit ? '#00e676' : '#cbd5e1',
            letterSpacing: '0.01em',
          }}>
            {entry.lastLapTime || entry.currentLapTime || '—'}
          </span>
        </div>

        {/* Best Lap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Flag size={11} color="#c084fc" />
            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: '#c084fc', fontWeight: 800 }}>
              MEJOR VUELTA
            </span>
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.94rem',
            fontWeight: 900,
            color: entry.bestLapTime ? '#f8fafc' : '#64748b',
            letterSpacing: '0.01em',
          }}>
            {entry.bestLapTime || '—'}
          </span>
        </div>
      </div>

      {/* 5. Tyre Info & Stint Stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 2px',
        fontSize: '0.68rem',
        fontFamily: 'var(--font-mono)',
        color: '#94a3b8',
      }}>
        {/* Tyre Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            border: `1.5px solid ${compColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.62rem',
            fontWeight: 900,
            color: compColor,
          }}>
            {comp[0]}
          </div>
          <span style={{ color: '#fff', fontWeight: 700 }}>{comp}</span>
          <span>({entry.tyre?.age || 0} v)</span>
        </div>

        {/* Laps & Pit Stops */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>VUELTAS: <strong style={{ color: '#fff' }}>{entry.lapsCompleted || 0}</strong></span>
          <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
          <span>PITS: <strong style={{ color: '#fff' }}>{entry.pitStops || 0}</strong></span>
        </div>
      </div>
    </div>
  );
};
