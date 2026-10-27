import React from 'react';
import type { SectorStatus } from '../types/telemetry';

export interface MiniSectorsTrackerProps {
  s1Segments?: SectorStatus[];
  s2Segments?: SectorStatus[];
  s3Segments?: SectorStatus[];
  s1Time?: string;
  s2Time?: string;
  s3Time?: string;
  s1BestTime?: string;
  s2BestTime?: string;
  s3BestTime?: string;
  s1Status?: SectorStatus;
  s2Status?: SectorStatus;
  s3Status?: SectorStatus;
  s1BestStatus?: SectorStatus;
  s2BestStatus?: SectorStatus;
  s3BestStatus?: SectorStatus;
  trackProgress?: number;
  driverStatus?: 'PUSH' | 'ON_TRACK' | 'PIT' | 'OUT';
  inPit?: boolean;
  showTimes?: boolean;
}

export { MiniSectorsBar } from './MiniSectorsBar';

const COLOR_MAP: Record<string, string> = {
  purple: '#A855F7', // Purple-500
  green: '#22C55E',  // Green-500
  yellow: '#FACC15', // Yellow-400
  pit: '#3B82F6',    // Pit Blue
  none: '#2A2E39',   // Neutral gray background
};

/**
 * Single Sector Mini-Bar Group (8 ticks for S1, 8 for S2, 9 for S3 = 25 total)
 */
export const SingleSectorBarGroup: React.FC<{
  sectorIndex: 1 | 2 | 3;
  lastTime?: string;
  bestTime?: string;
  status?: SectorStatus;
  bestStatus?: SectorStatus;
  segments?: SectorStatus[];
  targetCount: number;
  inProgressIndex?: number; // active segment being driven (-1 if not active)
  inProgressStatus?: SectorStatus;
  isFlyingLap?: boolean;
  showTimes?: boolean;
}> = ({
  sectorIndex: _sectorIndex,
  lastTime,
  bestTime,
  status = 'none',
  bestStatus = 'none',
  segments,
  targetCount,
  inProgressIndex = -1,
  inProgressStatus = 'yellow',
  isFlyingLap = false,
  showTimes = true,
}) => {
  const ticks: string[] = [];

  for (let i = 0; i < targetCount; i++) {
    if (isFlyingLap) {
      if (inProgressIndex >= targetCount) {
        // Sector fully completed in this flying lap
        const seg = (segments && i < segments.length && segments[i] && segments[i] !== 'none') 
          ? segments[i] 
          : (status !== 'none' ? status : inProgressStatus);
        ticks.push(COLOR_MAP[seg] || COLOR_MAP.green);
      } else if (inProgressIndex >= 0 && i <= inProgressIndex) {
        // Active segment or completed segment in current sector
        const seg = (segments && i < segments.length && segments[i] && segments[i] !== 'none') 
          ? segments[i] 
          : inProgressStatus;
        ticks.push(COLOR_MAP[seg] || COLOR_MAP[inProgressStatus]);
      } else {
        // Future microsector not yet traversed on current flying lap
        ticks.push(COLOR_MAP.none);
      }
    } else {
      // Completed lap or pit status
      if (segments && i < segments.length && segments[i] && segments[i] !== 'none') {
        ticks.push(COLOR_MAP[segments[i]] || COLOR_MAP.none);
      } else if (status && status !== 'none') {
        ticks.push(COLOR_MAP[status] || COLOR_MAP.none);
      } else {
        ticks.push(COLOR_MAP.none);
      }
    }
  }

  const lastColor =
    status === 'purple'
      ? '#d354ff'
      : status === 'green'
      ? '#00e676'
      : status === 'yellow'
      ? '#ffd60a'
      : status === 'pit'
      ? '#0095ff'
      : '#94a3b8';

  const bestColor =
    bestStatus === 'purple'
      ? '#d354ff'
      : bestStatus === 'green'
      ? '#00e676'
      : '#f8fafc';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* Row of micro-bars */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        {ticks.map((colorHex, idx) => {
          const isPurple = colorHex === '#d354ff';
          const isGreen = colorHex === '#00e676';
          const isYellow = colorHex === '#ffd60a';
          const isLeadingHead = isFlyingLap && inProgressIndex === idx;

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                maxWidth: '10px',
                minWidth: '3px',
                height: '6px',
                borderRadius: '1.5px',
                backgroundColor: colorHex,
                boxShadow: isLeadingHead
                  ? (isPurple
                      ? '0 0 10px 2px rgba(211, 84, 255, 0.95), 0 0 4px #fff'
                      : isGreen
                      ? '0 0 9px 2px rgba(0, 230, 118, 0.9), 0 0 4px #fff'
                      : '0 0 8px 1px rgba(255, 214, 10, 0.85), 0 0 3px #fff')
                  : isPurple
                  ? '0 0 6px rgba(211, 84, 255, 0.85)'
                  : isGreen
                  ? '0 0 5px rgba(0, 230, 118, 0.65)'
                  : isYellow && !isFlyingLap
                  ? 'none'
                  : 'none',
                transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
              }}
            />
          );
        })}
      </div>

      {/* Sector times: Last sector & Best sector side by side (no S1/S2/S3 label) */}
      {showTimes && (() => {
        const cleanLast = lastTime && lastTime.trim() !== '' && !lastTime.includes('-') ? lastTime : '—';
        const cleanBest = bestTime && bestTime.trim() !== '' && !bestTime.includes('-') ? bestTime : (cleanLast !== '—' ? cleanLast : '—');

        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            <span
              style={{
                fontSize: '0.64rem',
                fontFamily: 'var(--font-mono)',
                color: lastColor,
                fontWeight: 700,
              }}
              title={`Último sector: ${cleanLast}`}
            >
              {cleanLast}
            </span>
            <span style={{ fontSize: '0.56rem', color: 'rgba(255, 255, 255, 0.25)', fontFamily: 'var(--font-mono)' }}>
              /
            </span>
            <span
              style={{
                fontSize: '0.64rem',
                fontFamily: 'var(--font-mono)',
                color: bestColor,
                fontWeight: 800,
              }}
              title={`Mejor sector: ${cleanBest}`}
            >
              {cleanBest}
            </span>
          </div>
        );
      })()}
    </div>
  );
};

/**
 * Full Circuit Micro-Sectors Tracker (S1: 8 + S2: 8 + S3: 9 = 25 Microsectors)
 * Provides progressive in-lap tracking when a car is on track.
 */
export const MiniSectorsTracker: React.FC<MiniSectorsTrackerProps> = ({
  s1Segments,
  s2Segments,
  s3Segments,
  s1Time,
  s2Time,
  s3Time,
  s1BestTime,
  s2BestTime,
  s3BestTime,
  s1Status = 'none',
  s2Status = 'none',
  s3Status = 'none',
  s1BestStatus = 'none',
  s2BestStatus = 'none',
  s3BestStatus = 'none',
  trackProgress,
  driverStatus,
  inPit = false,
  showTimes = true,
}) => {
  // Determine in-lap progressive fill indices if car is on track
  const isCarOnFlyingLap =
    !inPit &&
    (driverStatus === 'PUSH' || driverStatus === 'ON_TRACK') &&
    trackProgress !== undefined &&
    trackProgress > 0 &&
    trackProgress < 1;

  let inProgressS1 = -1;
  let inProgressS2 = -1;
  let inProgressS3 = -1;
  const isPurplePace = s1Status === 'purple' || s2Status === 'purple' || s3Status === 'purple';
  const inProgressPace: SectorStatus = driverStatus === 'PUSH' ? (isPurplePace ? 'purple' : 'green') : 'yellow';

  if (isCarOnFlyingLap && trackProgress !== undefined) {
    if (trackProgress < 0.32) {
      // In Sector 1 (8 segments, progress 0.00 to 0.32)
      inProgressS1 = Math.min(7, Math.floor((trackProgress / 0.32) * 8));
      inProgressS2 = -1;
      inProgressS3 = -1;
    } else if (trackProgress < 0.68) {
      // In Sector 2 (8 segments, progress 0.32 to 0.68)
      inProgressS1 = 8; // S1 completed
      inProgressS2 = Math.min(7, Math.floor(((trackProgress - 0.32) / 0.36) * 8));
      inProgressS3 = -1;
    } else {
      // In Sector 3 (9 segments, progress 0.68 to 1.00)
      inProgressS1 = 8;
      inProgressS2 = 8;
      inProgressS3 = Math.min(8, Math.floor(((trackProgress - 0.68) / 0.32) * 9));
    }
  }

  return (
    <div
      className="cell-mini-sectors"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '0 2px',
        minWidth: 0,
        flex: 1,
      }}
    >
      <SingleSectorBarGroup
        sectorIndex={1}
        lastTime={s1Time}
        bestTime={s1BestTime}
        status={s1Status}
        bestStatus={s1BestStatus}
        segments={s1Segments}
        targetCount={8}
        inProgressIndex={inProgressS1}
        inProgressStatus={inProgressPace}
        isFlyingLap={isCarOnFlyingLap}
        showTimes={showTimes}
      />
      <SingleSectorBarGroup
        sectorIndex={2}
        lastTime={s2Time}
        bestTime={s2BestTime}
        status={s2Status}
        bestStatus={s2BestStatus}
        segments={s2Segments}
        targetCount={8}
        inProgressIndex={inProgressS2}
        inProgressStatus={inProgressPace}
        isFlyingLap={isCarOnFlyingLap}
        showTimes={showTimes}
      />
      <SingleSectorBarGroup
        sectorIndex={3}
        lastTime={s3Time}
        bestTime={s3BestTime}
        status={s3Status}
        bestStatus={s3BestStatus}
        segments={s3Segments}
        targetCount={9}
        inProgressIndex={inProgressS3}
        inProgressStatus={inProgressPace}
        isFlyingLap={isCarOnFlyingLap}
        showTimes={showTimes}
      />
    </div>
  );
};

/**
 * Test & Simulation helper: Simulates progressive microsector lighting along a lap
 * @param progress Lap progress 0.0 to 1.0
 * @param pace Target pace ('overall_fastest' | 'personal_best' | 'normal' | 'pit')
 */
export function simulateMicrosectorLap(
  progress: number,
  pace: 'overall_fastest' | 'personal_best' | 'normal' | 'pit' = 'personal_best'
): {
  s1Segments: SectorStatus[];
  s2Segments: SectorStatus[];
  s3Segments: SectorStatus[];
} {
  const statusColor: SectorStatus =
    pace === 'overall_fastest'
      ? 'purple'
      : pace === 'personal_best'
      ? 'green'
      : pace === 'pit'
      ? 'pit'
      : 'yellow';

  const s1: SectorStatus[] = Array(8).fill('none');
  const s2: SectorStatus[] = Array(8).fill('none');
  const s3: SectorStatus[] = Array(9).fill('none');

  if (progress <= 0) {
    return { s1Segments: s1, s2Segments: s2, s3Segments: s3 };
  }

  if (progress < 0.32) {
    const activeIdx = Math.min(7, Math.floor((progress / 0.32) * 8));
    for (let i = 0; i <= activeIdx; i++) s1[i] = statusColor;
  } else if (progress < 0.68) {
    s1.fill(statusColor);
    const activeIdx = Math.min(7, Math.floor(((progress - 0.32) / 0.36) * 8));
    for (let i = 0; i <= activeIdx; i++) s2[i] = statusColor;
  } else {
    s1.fill(statusColor);
    s2.fill(statusColor);
    const activeIdx = Math.min(8, Math.floor(((progress - 0.68) / 0.32) * 9));
    for (let i = 0; i <= activeIdx; i++) s3[i] = statusColor;
  }

  return { s1Segments: s1, s2Segments: s2, s3Segments: s3 };
}
