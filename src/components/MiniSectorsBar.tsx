import React from 'react';
import { 
  type SegmentStatusType, 
  MICROSECTOR_COLORS, 
  parseSegmentStatus 
} from '../utils/microsectorParser';

export interface MiniSectorsBarProps {
  s1Segments?: Array<SegmentStatusType | string | number>;
  s2Segments?: Array<SegmentStatusType | string | number>;
  s3Segments?: Array<SegmentStatusType | string | number>;
  s1Time?: string;
  s2Time?: string;
  s3Time?: string;
  s1BestTime?: string;
  s2BestTime?: string;
  s3BestTime?: string;
  s1Status?: string;
  s2Status?: string;
  s3Status?: string;
  s1BestStatus?: string;
  s2BestStatus?: string;
  s3BestStatus?: string;
  showTimes?: boolean;
  blockHeight?: number; // 4px to 6px, default 5px
}

interface SectorBlockRowProps {
  segments?: Array<SegmentStatusType | string | number>;
  targetCount: number;
  lastTime?: string;
  bestTime?: string;
  status?: string;
  bestStatus?: string;
  showTimes?: boolean;
  blockHeight?: number;
}

const SectorBlockRow: React.FC<SectorBlockRowProps> = React.memo(({
  segments,
  targetCount,
  lastTime,
  bestTime,
  status,
  bestStatus,
  showTimes = true,
  blockHeight = 5,
}) => {
  // Normalize segments to exact target count
  const blocks: SegmentStatusType[] = [];
  for (let i = 0; i < targetCount; i++) {
    if (segments && i < segments.length && segments[i] !== undefined) {
      const raw = segments[i];
      if (typeof raw === 'number') {
        blocks.push(parseSegmentStatus(raw));
      } else if (raw === 'purple' || raw === 'green' || raw === 'yellow' || raw === 'pending') {
        blocks.push(raw);
      } else {
        blocks.push('pending');
      }
    } else {
      blocks.push('pending');
    }
  }

  // Label colors for sector times
  const lastColor =
    status === 'purple'
      ? MICROSECTOR_COLORS.purple
      : status === 'green'
      ? MICROSECTOR_COLORS.green
      : status === 'yellow'
      ? MICROSECTOR_COLORS.yellow
      : '#94a3b8';

  const bestColor =
    bestStatus === 'purple'
      ? MICROSECTOR_COLORS.purple
      : bestStatus === 'green'
      ? MICROSECTOR_COLORS.green
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
      {/* Grid of rectangular mini-blocks */}
      <div
        style={{
          display: 'flex',
          gap: '1.5px',
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {blocks.map((type, idx) => {
          const colorHex = MICROSECTOR_COLORS[type] || MICROSECTOR_COLORS.pending;
          const isPurple = type === 'purple';
          const isGreen = type === 'green';
          const isYellow = type === 'yellow';

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                maxWidth: '12px',
                minWidth: '3px',
                height: `${blockHeight}px`, // 4px to 6px (F1 standard specification)
                borderRadius: '1.5px',
                backgroundColor: colorHex,
                boxShadow: isPurple
                  ? '0 0 6px rgba(168, 85, 247, 0.85)'
                  : isGreen
                  ? '0 0 5px rgba(34, 197, 94, 0.75)'
                  : isYellow
                  ? '0 0 3px rgba(250, 204, 21, 0.45)'
                  : 'none',
                transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
              }}
            />
          );
        })}
      </div>

      {/* Sector Times: LAST & BEST */}
      {showTimes && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            marginTop: '2px',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Last time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span
              style={{
                fontSize: '0.52rem',
                fontFamily: 'var(--font-mono)',
                color: '#64748b',
                fontWeight: 800,
              }}
            >
              LAST
            </span>
            <span
              style={{
                fontSize: '0.66rem',
                fontFamily: 'var(--font-mono)',
                color: lastColor,
                fontWeight: 800,
              }}
            >
              {lastTime && lastTime.trim() !== '' && !lastTime.includes('-')
                ? lastTime
                : '—'}
            </span>
          </div>

          <span style={{ fontSize: '0.55rem', color: 'rgba(255, 255, 255, 0.2)' }}>
            •
          </span>

          {/* Best time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span
              style={{
                fontSize: '0.52rem',
                fontFamily: 'var(--font-mono)',
                color: '#64748b',
                fontWeight: 800,
              }}
            >
              BEST
            </span>
            <span
              style={{
                fontSize: '0.66rem',
                fontFamily: 'var(--font-mono)',
                color: bestColor,
                fontWeight: 800,
              }}
            >
              {bestTime && bestTime.trim() !== '' && !bestTime.includes('-')
                ? bestTime
                : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

SectorBlockRow.displayName = 'SectorBlockRow';

/**
 * Responsive 3-Sector Microsectors Bar (S1, S2, S3)
 * Implements F1 SignalR TimingData visual specification.
 */
export const MiniSectorsBar: React.FC<MiniSectorsBarProps> = React.memo(({
  s1Segments,
  s2Segments,
  s3Segments,
  s1Time,
  s2Time,
  s3Time,
  s1BestTime,
  s2BestTime,
  s3BestTime,
  s1Status,
  s2Status,
  s3Status,
  s1BestStatus,
  s2BestStatus,
  s3BestStatus,
  showTimes = true,
  blockHeight = 5,
}) => {
  return (
    <div
      className="cell-mini-sectors"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 4px',
        minWidth: 0,
        flex: 1,
      }}
    >
      {/* Sector 1 (8 segments) */}
      <SectorBlockRow
        targetCount={8}
        segments={s1Segments}
        lastTime={s1Time}
        bestTime={s1BestTime}
        status={s1Status}
        bestStatus={s1BestStatus}
        showTimes={showTimes}
        blockHeight={blockHeight}
      />

      {/* Sector 2 (8 segments) */}
      <SectorBlockRow
        targetCount={8}
        segments={s2Segments}
        lastTime={s2Time}
        bestTime={s2BestTime}
        status={s2Status}
        bestStatus={s2BestStatus}
        showTimes={showTimes}
        blockHeight={blockHeight}
      />

      {/* Sector 3 (9 segments) */}
      <SectorBlockRow
        targetCount={9}
        segments={s3Segments}
        lastTime={s3Time}
        bestTime={s3BestTime}
        status={s3Status}
        bestStatus={s3BestStatus}
        showTimes={showTimes}
        blockHeight={blockHeight}
      />
    </div>
  );
});

MiniSectorsBar.displayName = 'MiniSectorsBar';
