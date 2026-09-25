import React, { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import type { LeaderboardEntry } from '../types/telemetry';
import { TeamLogo } from './TeamLogo';

// Helper to parse lap time to seconds for finding fastest lap
const parseLapTimeToSec = (t?: string): number => {
  if (!t || t.includes('-') || t.includes('DNF') || t.trim() === '') return Infinity;
  const clean = t.replace('+', '').trim();
  const parts = clean.split(':');
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(clean) || Infinity;
};

// Mini Sector Group (8 mini-bars for S1, 8 for S2, 9 for S3 = 25 total)
function MiniSectorGroup({
  lastTime,
  bestTime,
  status,
  bestStatus,
  segments,
  count,
}: {
  lastTime?: string;
  bestTime?: string;
  status: string;
  bestStatus?: string;
  segments?: Array<string>;
  count: number;
}) {
  const colorMap: Record<string, string> = {
    purple: '#d354ff',
    green: '#00e676',
    yellow: '#ffd60a',
    pit: '#0095ff',
    none: 'rgba(255, 255, 255, 0.12)',
  };

  // Each sector always renders all 8 (or 9) microsectors exactly like formula1dashboard!
  const totalTicks = count || 8;

  const ticks: string[] = [];
  const hasCompletedTime = Boolean(lastTime && lastTime.trim() !== '' && !lastTime.includes('-'));
  const allSegsActive = Boolean(segments && segments.length > 0 && segments.every(s => s && s !== 'none'));

  for (let i = 0; i < totalTicks; i++) {
    if (segments && segments.length > 0) {
      if (i < segments.length) {
        const segVal = segments[i];
        ticks.push((segVal && colorMap[segVal]) ? colorMap[segVal] : colorMap.none);
      } else if (hasCompletedTime && allSegsActive) {
        // Only stretch if the entire sector has finished with legacy short segment array
        const mappedIdx = Math.floor((i / totalTicks) * segments.length);
        const segVal = segments[mappedIdx];
        ticks.push((segVal && colorMap[segVal]) ? colorMap[segVal] : colorMap.none);
      } else {
        ticks.push(colorMap.none);
      }
    } else if (hasCompletedTime && status && status !== 'none') {
      ticks.push(colorMap[status] || colorMap.none);
    } else {
      ticks.push(colorMap.none);
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      flex: 1,
      minWidth: 0,
    }}>
      {/* Row of micro-bars (larger, vivid, clearly visible) */}
      <div style={{ display: 'flex', gap: '2px', width: '100%', justifyContent: 'center' }}>
        {ticks.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              maxWidth: '12px',
              minWidth: '4px',
              height: '8px',
              borderRadius: '2px',
              backgroundColor: c,
              boxShadow: c === '#d354ff' 
                ? '0 0 6px rgba(211, 84, 255, 0.85)' 
                : c === '#00e676'
                ? '0 0 5px rgba(0, 230, 118, 0.65)'
                : 'none',
              transition: 'background-color 0.2s ease',
            }}
          />
        ))}
      </div>

      {/* Sector times: Último & Mejor uno al lado del otro */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        marginTop: '2px',
        whiteSpace: 'nowrap',
      }}>
        {/* Last sector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#64748b', fontWeight: 800 }}>
            LAST
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: lastColor,
            letterSpacing: '0.01em',
          }}>
            {lastTime && lastTime.trim() !== '' ? lastTime : '—'}
          </span>
        </div>

        <span style={{ color: 'rgba(255, 255, 255, 0.25)', fontSize: '0.70rem' }}>·</span>

        {/* Best sector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: '#c084fc', fontWeight: 800 }}>
            BEST
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            fontWeight: 800,
            color: bestColor,
            letterSpacing: '0.01em',
          }}>
            {bestTime && bestTime.trim() !== '' ? bestTime : (lastTime || '—')}
          </span>
        </div>
      </div>
    </div>
  );
}

function getContrastTextColor(hexColor?: string): string {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';
  // ITU-R BT.709 perceived luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0a0d14' : '#ffffff';
}

const VERIFIED_TEAM_COLORS: Record<string, string> = {
  // Ferrari -> Rosso Corsa (Bright scarlet red)
  LEC: '#E8002D',
  HAM: '#E8002D',
  // Audi -> Audi Sport Crimson (Deep dark crimson red)
  HUL: '#A6051A',
  BOR: '#A6051A',
  // McLaren -> Papaya Orange
  NOR: '#FF8000',
  PIA: '#FF8000',
  // Mercedes -> Petronas Teal
  RUS: '#00D2BE',
  ANT: '#00D2BE',
  // Aston Martin -> British Racing Green
  ALO: '#229971',
  STR: '#229971',
  // Red Bull Racing -> Oracle Deep Navy Blue (Dark midnight navy)
  VER: '#17356D',
  HAD: '#17356D',
  // Alpine -> Bleu Alpine (Vibrant French racing blue)
  GAS: '#0085CA',
  COL: '#0085CA',
  // Williams -> Williams Cyan (Bright light sky cyan)
  SAI: '#38B6FF',
  ALB: '#38B6FF',
  // Racing Bulls -> VCARB Cobalt (Electric royal/iris blue)
  LAW: '#6692FF',
  LIN: '#6692FF',
  // Haas -> Haas Silver Metal
  OCO: '#B6BABD',
  BEA: '#B6BABD',
  // Cadillac -> Cadillac Gold V-Series
  PER: '#C8A84E',
  BOT: '#C8A84E',
};

const VERIFIED_TEAM_NAME_COLORS: Record<string, string> = {
  ferrari: '#E8002D',
  audi: '#A6051A',
  sauber: '#A6051A',
  mclaren: '#FF8000',
  mercedes: '#00D2BE',
  'aston martin': '#229971',
  'red bull': '#17356D',
  alpine: '#0085CA',
  williams: '#38B6FF',
  'racing bulls': '#6692FF',
  rb: '#6692FF',
  vcarb: '#6692FF',
  haas: '#B6BABD',
  cadillac: '#C8A84E',
};

function getOfficialTeamColor(code?: string, teamName?: string, rawColor?: string): string {
  if (code && VERIFIED_TEAM_COLORS[code.toUpperCase()]) {
    return VERIFIED_TEAM_COLORS[code.toUpperCase()];
  }
  if (teamName) {
    const norm = teamName.toLowerCase();
    for (const [k, v] of Object.entries(VERIFIED_TEAM_NAME_COLORS)) {
      if (norm.includes(k)) return v;
    }
  }
  if (rawColor && rawColor !== '#' && rawColor !== '#ffffff' && rawColor !== '#fff') {
    return rawColor;
  }
  return '#E8002D';
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  selectedDriverId: string;
  onSelectDriver: (driverId: string) => void;
  isQualifying?: boolean;
  sessionType?: string;
  sessionName?: string;
  timeRemainingSec?: number;
  totalLaps?: number;
  trackStatus?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  entries: rawEntries,
  selectedDriverId,
  onSelectDriver,
  isQualifying = false,
  sessionType = 'PRACTICE',
  sessionName = 'Libres 1 (FP1)',
  timeRemainingSec = 3000,
  totalLaps = 0,
  trackStatus = 'GREEN',
}) => {
  const entries = useMemo(() => {
    if (!Array.isArray(rawEntries)) return [];
    const hasHadjar = rawEntries.some(e => e?.driver && (e.driver.code === 'HAD' || e.driver.number === 6));
    const result: LeaderboardEntry[] = [];
    for (const e of rawEntries) {
      if (!e || !e.driver) continue;
      const isTsu =
        e.driver.code === 'TSU' ||
        e.driver.id === 'tsu' ||
        e.driver.number === 22 ||
        (e.driver.lastName && e.driver.lastName.toLowerCase().includes('tsunoda'));
      if (isTsu) {
        if (!hasHadjar) {
          result.push({
            ...e,
            driver: {
              id: 'had',
              code: 'HAD',
              number: 6,
              firstName: 'Isack',
              lastName: 'Hadjar',
              team: 'Red Bull Racing',
              teamColor: '#3671C6',
              country: 'Francia',
              flag: '🇫🇷',
            },
          });
        }
        continue;
      }
      result.push(e);
    }
    return result.map((e, idx) => ({ ...e, position: idx + 1 }));
  }, [rawEntries]);

  const [viewMode, setViewMode] = useState<'timing' | 'stints'>('timing');

  // Local 1-second ticker so remaining session duration always counts down smoothly in the UI
  // App.tsx ticks every second and pushes the extrapolated value via props.
  // We mirror it into local state so CHEQUERED/RED-flag overrides still work.
  const [localRemainingSec, setLocalRemainingSec] = useState<number>(() =>
    timeRemainingSec !== undefined && timeRemainingSec >= 0 ? Math.floor(timeRemainingSec) : 0
  );

  React.useEffect(() => {
    if (trackStatus === 'CHEQUERED') {
      setLocalRemainingSec(0);
      return;
    }
    if (trackStatus === 'RED') return; // freeze during red flag
    if (timeRemainingSec !== undefined && timeRemainingSec >= 0) {
      setLocalRemainingSec(Math.floor(timeRemainingSec));
    }
  }, [timeRemainingSec, trackStatus]);

  // ── FLIP animation for smooth position changes ─────────────────────────────
  // FLIP = First, Last, Invert, Play
  // 1. FIRST: before React commits the reorder, snapshot each row's Y position
  // 2. LAST:  after commit, read new Y position
  // 3. INVERT: apply transform = (first_Y - last_Y) to make it look like it didn't move
  // 4. PLAY: transition that transform to 0 so it slides smoothly into place
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRectsRef = useRef<Map<string, number>>(new Map());

  // Called by each row via callback ref to register/unregister its DOM node
  const registerRow = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(id, el);
    } else {
      rowRefs.current.delete(id);
    }
  }, []);

  // FIRST: snapshot Y positions before React re-renders (runs synchronously before paint)
  useLayoutEffect(() => {
    const snapshot = new Map<string, number>();
    for (const [id, el] of rowRefs.current.entries()) {
      snapshot.set(id, el.getBoundingClientRect().top);
    }
    prevRectsRef.current = snapshot;
  });

  // LAST + INVERT + PLAY: after React commits the DOM reorder, animate rows to new positions
  useLayoutEffect(() => {
    const prev = prevRectsRef.current;
    const animatingIds = new Set<string>();

    for (const [id, el] of rowRefs.current.entries()) {
      const prevY = prev.get(id);
      if (prevY === undefined) continue;

      const nextY = el.getBoundingClientRect().top;
      const deltaY = prevY - nextY;

      // Skip if the row didn't actually move (or moved < 1px)
      if (Math.abs(deltaY) < 1) continue;

      animatingIds.add(id);

      // Cancel any ongoing animation on this element
      el.style.transition = 'none';
      el.style.transform = `translateY(${deltaY}px)`;

      // Force a reflow so the browser registers the inverted position
      void el.offsetHeight;

      // Now animate back to natural position — clamp duration so fast reorders feel snappy
      const duration = Math.min(420, Math.max(200, Math.abs(deltaY) * 1.6));
      el.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      el.style.transform = 'translateY(0)';

      // Clean up inline styles once the animation ends
      const onEnd = () => {
        el.style.transition = '';
        el.style.transform = '';
        el.removeEventListener('transitionend', onEnd);
      };
      el.addEventListener('transitionend', onEnd);
    }
  }, [entries]);

  // Overtake tracking (kept for glow/pill highlights — separate from FLIP movement)
  const prevPositionsRef = useRef<Map<string, number>>(new Map());
  const [overtakes, setOvertakes] = useState<Map<string, { dir: 'up' | 'down'; diff: number; timestamp: number }>>(new Map());
  const [overtakeToast, setOvertakeToast] = useState<{ gained: string; lost: string; pos: number } | null>(null);

  React.useEffect(() => {
    if (!entries || entries.length === 0) return;

    const now = Date.now();
    const newOvertakes = new Map<string, { dir: 'up' | 'down'; diff: number; timestamp: number }>();

    for (const [id, data] of overtakes.entries()) {
      if (now - data.timestamp < 3800) {
        newOvertakes.set(id, data);
      }
    }

    let detectedToast: { gained: string; lost: string; pos: number } | null = null;

    if (prevPositionsRef.current.size > 0) {
      entries.forEach((entry) => {
        const oldPos = prevPositionsRef.current.get(entry.driver.id);
        if (oldPos !== undefined && oldPos !== entry.position) {
          if (entry.position < oldPos) {
            newOvertakes.set(entry.driver.id, {
              dir: 'up',
              diff: oldPos - entry.position,
              timestamp: now,
            });
            const droppedDriver = entries.find(e => e.position === oldPos);
            if (droppedDriver) {
              detectedToast = {
                gained: entry.driver.lastName || entry.driver.code,
                lost: droppedDriver.driver.lastName || droppedDriver.driver.code,
                pos: entry.position,
              };
            }
          } else if (entry.position > oldPos) {
            newOvertakes.set(entry.driver.id, {
              dir: 'down',
              diff: entry.position - oldPos,
              timestamp: now,
            });
          }
        }
      });
    }

    const currentMap = new Map<string, number>();
    entries.forEach(e => currentMap.set(e.driver.id, e.position));
    prevPositionsRef.current = currentMap;

    if (newOvertakes.size > 0) {
      setOvertakes(new Map(newOvertakes));
    }
    if (detectedToast) {
      setOvertakeToast(detectedToast);
      const timer = setTimeout(() => {
        setOvertakeToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [entries]);

  // Find the overall session best lap time and sector times
  let minSessionBestSec = Infinity;
  let minS1Sec = Infinity;
  let minS2Sec = Infinity;
  let minS3Sec = Infinity;

  for (const e of entries) {
    const s = parseLapTimeToSec(e.bestLapTime);
    if (s < minSessionBestSec) {
      minSessionBestSec = s;
    }
    const s1 = Math.min(parseLapTimeToSec(e.s1BestTime), parseLapTimeToSec(e.s1Time));
    if (s1 < minS1Sec) minS1Sec = s1;
    const s2 = Math.min(parseLapTimeToSec(e.s2BestTime), parseLapTimeToSec(e.s2Time));
    if (s2 < minS2Sec) minS2Sec = s2;
    const s3 = Math.min(parseLapTimeToSec(e.s3BestTime), parseLapTimeToSec(e.s3Time));
    if (s3 < minS3Sec) minS3Sec = s3;
  }

  const currentRaceLap = Math.max(1, ...entries.map(e => e.lapsCompleted || e.tyre?.age || 0));

  // Determine whether this session is timed (Practice / Qualifying) vs Lap-based (Race / Sprint)
  const isTimedSession = sessionType === 'PRACTICE' || sessionType === 'QUALIFYING' || totalLaps === 0 || (sessionName && /fp|practice|libres|qual/i.test(sessionName));

  const formattedSessionBadge = (() => {
    const lower = (sessionName || '').toLowerCase();
    if (lower.includes('fp1') || lower.includes('practice 1') || lower.includes('libres 1')) return 'LIBRES 1 (FP1)';
    if (lower.includes('fp2') || lower.includes('practice 2') || lower.includes('libres 2')) return 'LIBRES 2 (FP2)';
    if (lower.includes('fp3') || lower.includes('practice 3') || lower.includes('libres 3')) return 'LIBRES 3 (FP3)';
    if (lower.includes('qual') || sessionType === 'QUALIFYING') return 'CLASIFICACIÓN';
    if (sessionType === 'SPRINT') return 'SPRINT';
    if (sessionType === 'RACE') return 'CARRERA';
    return 'LIBRES 1 (FP1)';
  })();

  const formattedRemainingTime = (() => {
    const sec = Math.max(0, localRemainingSec);
    const mins = Math.floor(sec / 60);
    const remSecs = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  })();

  // Guard against corrupted all-in-pit states
  const rawInPitCount = entries.filter(e => e.inPit).length;
  const shouldSanitizePits = rawInPitCount > 8 && trackStatus !== 'CHEQUERED';
  const effectiveInPitCount = entries.filter((e, i) => shouldSanitizePits ? i >= 18 : e.inPit).length;
  const effectiveOnTrackCount = Math.max(0, entries.length - effectiveInPitCount);

  return (
    <div className="f1-card leaderboard-container">
      {/* Top Header Card Controls: Timing / Stints toggle & Live Session Duration / Lap Counter */}
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>
            Tabla de Tiempos
          </span>

          {/* Session Type Badge (e.g. LIBRES 1 (FP1)) */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(225, 6, 0, 0.18)',
            border: '1px solid rgba(225, 6, 0, 0.45)',
            padding: '2px 8px',
            borderRadius: '6px',
            marginLeft: '4px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4d4d', boxShadow: '0 0 6px #ff4d4d' }} />
            <span style={{ fontSize: '0.66rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em', fontFamily: 'var(--font-display)' }}>
              {formattedSessionBadge}
            </span>
          </div>

          {/* Remaining Duration Timer (for FP1/FP2/FP3/Qualy) OR Lap Counter (for Race/Sprint) */}
          {isTimedSession ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: (localRemainingSec <= 0 || trackStatus === 'CHEQUERED')
                ? 'rgba(255, 255, 255, 0.1)'
                : trackStatus === 'RED'
                ? 'rgba(239, 68, 68, 0.18)'
                : 'rgba(0, 215, 182, 0.14)',
              border: (localRemainingSec <= 0 || trackStatus === 'CHEQUERED')
                ? '1px solid rgba(255, 255, 255, 0.28)'
                : trackStatus === 'RED'
                ? '1px solid rgba(239, 68, 68, 0.45)'
                : '1px solid rgba(0, 215, 182, 0.4)',
              padding: '2px 10px',
              borderRadius: '6px',
            }}
            title="Duración de la sesión en tiempo real"
            >
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                color: (localRemainingSec <= 0 || trackStatus === 'CHEQUERED')
                  ? '#e2e8f0'
                  : trackStatus === 'RED'
                  ? '#ff4d4d'
                  : '#00D7B6',
                letterSpacing: '0.5px',
              }}>
                {(localRemainingSec <= 0 || trackStatus === 'CHEQUERED')
                  ? '🏁 FINALIZADA'
                  : trackStatus === 'RED'
                  ? '⏸ DETENIDA'
                  : '⏱ RESTANTE'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.88rem', color: '#ffffff', letterSpacing: '0.03em' }}>
                {formattedRemainingTime}
              </span>
              <span style={{ fontSize: '0.64rem', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                / 60:00
              </span>
            </div>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(225, 6, 0, 0.16)',
              border: '1px solid rgba(225, 6, 0, 0.35)',
              padding: '2px 8px',
              borderRadius: '6px',
            }}>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#ff4d4d', letterSpacing: '0.5px' }}>
                LAP
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.86rem', color: '#ffffff' }}>
                {currentRaceLap}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 700 }}>
                / {totalLaps || 55}
              </span>
            </div>
          )}

          {/* On-Track vs In-Pit Live Counter Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '2px 8px',
            borderRadius: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.64rem',
            fontWeight: 700,
          }}>
            <span style={{ color: '#00e676' }}>● {effectiveOnTrackCount} PISTA</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            <span style={{ color: '#60a5fa' }}>{effectiveInPitCount} BOX</span>
          </div>

          <div style={{
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '6px',
            padding: '2px',
            marginLeft: '4px',
          }}>
            <button
              style={{
                background: viewMode === 'timing' ? '#2563eb' : 'transparent',
                color: viewMode === 'timing' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 10px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
              onClick={() => setViewMode('timing')}
            >
              Timing
            </button>
            <button
              style={{
                background: viewMode === 'stints' ? '#2563eb' : 'transparent',
                color: viewMode === 'stints' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 10px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
              onClick={() => setViewMode('stints')}
            >
              Stints
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="f1-badge badge-green" style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
            OFFICIAL FIA TIMING
          </div>
        </div>
      </div>

      {/* Table Header: POS | DRIVER | GAP | INT | LAST | BEST | MINI-SECTORS | LAPS | PIT | TYRE */}
      <div className="leaderboard-header-row">
        <span className="col-header-center">POS</span>
        <span style={{ paddingLeft: '6px' }}>DRIVER</span>
        <span className="col-header-center">GAP</span>
        <span className="col-header-center">INT</span>
        <span className="col-header-center">LAST</span>
        <span className="col-header-center">BEST</span>
        <span className="col-header-center" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          MINI-SECTORS (LAST / BEST) <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>ⓘ</span>
        </span>
        <span className="col-header-center">LAPS</span>
        <span className="col-header-center">PIT</span>
        <span className="col-header-center">TYRE</span>
      </div>

      {/* Live Overtake Toast Alert */}
      {overtakeToast && (
        <div className="overtake-alert-banner">
          <span className="overtake-lightning">⚡</span>
          <span className="overtake-alert-text">
            <strong>OVERTAKE:</strong> {overtakeToast.gained} moves up to <strong>P{overtakeToast.pos}</strong> (+1) over {overtakeToast.lost}
          </span>
        </div>
      )}

      {/* Table Body */}
      <div className="leaderboard-body">
        {entries.map((entry, index) => {
          const isSelected = entry.driver.id === selectedDriverId;
          const teamColor = getOfficialTeamColor(entry.driver.code, entry.driver.team, entry.driver.teamColor);
          const showQ1Divider = isQualifying && index === 15;
          const showQ2Divider = isQualifying && index === 10;

          const isLeader = index === 0;
          const displayedGap = isLeader ? '—' : (entry.gapToLeader ? entry.gapToLeader.replace('LÍDER', 'LEADER').replace('LIDER', 'LEADER') : '—');
          const displayedInt = isLeader ? '—' : (entry.gapToAhead ? entry.gapToAhead.replace('LÍDER', 'LEADER').replace('LIDER', 'LEADER') : '—');
          const displayLast = entry.lastLapTime && entry.lastLapTime !== '--:--.---' ? entry.lastLapTime : (entry.currentLapTime || '—');
          const displayBest = entry.bestLapTime && entry.bestLapTime !== '--:--.---' ? entry.bestLapTime : '—';
          
          const bestSec = parseLapTimeToSec(entry.bestLapTime);
          const isOverallBestLap = bestSec === minSessionBestSec && minSessionBestSec !== Infinity;
          const lapsCount = entry.lapsCompleted !== undefined ? entry.lapsCompleted : (entry.tyre?.age || 0);

          // Check live overtake animation for this row
          const ot = overtakes.get(entry.driver.id);
          const isOvertakeUp = ot?.dir === 'up' && (Date.now() - ot.timestamp < 3800);
          const isOvertakeDown = ot?.dir === 'down' && (Date.now() - ot.timestamp < 3800);

          // Sector best calculations (always pick the faster of sBestTime and sTime)
          const pickFasterSector = (best?: string, current?: string) => {
            const bSec = parseLapTimeToSec(best);
            const cSec = parseLapTimeToSec(current);
            if (bSec <= cSec && bSec !== Infinity) return best;
            if (cSec !== Infinity) return current;
            return best || current;
          };
          const s1Best = pickFasterSector(entry.s1BestTime, entry.s1Time);
          const s2Best = pickFasterSector(entry.s2BestTime, entry.s2Time);
          const s3Best = pickFasterSector(entry.s3BestTime, entry.s3Time);

          const s1BestSec = parseLapTimeToSec(s1Best);
          const s2BestSec = parseLapTimeToSec(s2Best);
          const s3BestSec = parseLapTimeToSec(s3Best);

          const s1BestStatus = s1BestSec === minS1Sec && minS1Sec !== Infinity ? 'purple' : 'green';
          const s2BestStatus = s2BestSec === minS2Sec && minS2Sec !== Infinity ? 'purple' : 'green';
          const s3BestStatus = s3BestSec === minS3Sec && minS3Sec !== Infinity ? 'purple' : 'green';

          // Compound color definitions
          const compoundLetter = entry.tyre?.compound ? entry.tyre.compound[0] : 'S';
          const isCompoundSoft = entry.tyre?.compound === 'SOFT';
          const isCompoundMedium = entry.tyre?.compound === 'MEDIUM';
          const isCompoundHard = entry.tyre?.compound === 'HARD';
          const isCompoundInter = entry.tyre?.compound === 'INTERMEDIATE';
          const isCompoundWet = entry.tyre?.compound === 'WET';

          const compColor = isCompoundSoft
            ? '#ff3b30'
            : isCompoundMedium
            ? '#ffd60a'
            : isCompoundHard
            ? '#ffffff'
            : isCompoundInter
            ? '#34c759'
            : isCompoundWet
            ? '#007aff'
            : '#64748b';

          const hasTyre = Boolean(entry.tyre && entry.tyre.compound);

          // Resolve driver pit state accurately (preventing stale IN PIT when on track or OUT LAP)
          const isDriverPitOut = shouldSanitizePits ? index === 17 : Boolean(entry.isPitOut && !entry.inPit);
          const isDriverInPit = shouldSanitizePits ? index >= 18 : Boolean(entry.inPit && !entry.isPitOut);

          return (
            <React.Fragment key={entry.driver.id}>
              {/* Qualy Q2 Cutoff */}
              {showQ2Divider && (
                <div className="cutoff-divider">
                  <span>Q2 ELIMINATION CUTOFF</span>
                  <span>ELIMINATION</span>
                </div>
              )}

              {/* Qualy Q1 Cutoff */}
              {showQ1Divider && (
                <div className="cutoff-divider">
                  <span>Q1 ELIMINATION CUTOFF</span>
                  <span>ELIMINATION</span>
                </div>
              )}

              <div
                ref={(el) => registerRow(entry.driver.id, el)}
                className={`leaderboard-row ${isSelected ? 'selected' : ''} ${isDriverInPit ? 'in-pit' : ''} ${entry.isEliminationRisk ? 'elimination-danger' : ''} ${entry.isKnockedOut ? 'knocked-out' : ''} ${isOvertakeUp ? 'overtake-row-up' : ''} ${isOvertakeDown ? 'overtake-row-down' : ''}`}
                style={{
                  '--team-color': teamColor,
                  borderLeftColor: teamColor,
                } as React.CSSProperties}
                onClick={() => onSelectDriver(entry.driver.id)}
              >
                {/* 1. POS */}
                <div className="cell-pos" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    color: index === 0 ? '#ffd700' : '#f1f5f9'
                  }}>
                    {entry.position}
                  </span>
                  {isOvertakeUp && (
                    <span className="overtake-pill-gain" title={`Overtake: +${ot.diff}`}>
                      ▲ +{ot.diff}
                    </span>
                  )}
                  {isOvertakeDown && (
                    <span className="overtake-pill-loss" title={`Position lost: -${ot.diff}`}>
                      ▼ -{ot.diff}
                    </span>
                  )}
                  {!isOvertakeUp && !isOvertakeDown && (entry.previousPosition - entry.position) > 0 && <span style={{ fontSize: '0.48rem', color: '#00e676', lineHeight: 1 }}>▲</span>}
                  {!isOvertakeUp && !isOvertakeDown && (entry.previousPosition - entry.position) < 0 && <span style={{ fontSize: '0.48rem', color: '#ff4444', lineHeight: 1 }}>▼</span>}
                </div>

                {/* 2. DRIVER (Logo + Solid Team Color Driver Chip) */}
                <div className="cell-driver-with-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <TeamLogo team={entry.driver.team} color={teamColor} size={24} />
                  <div
                    className="driver-team-chip"
                    style={{
                      backgroundColor: teamColor,
                      color: getContrastTextColor(teamColor),
                    }}
                    title={`${entry.driver.firstName} ${entry.driver.lastName} (${entry.driver.team})`}
                  >
                    {entry.driver.code}
                  </div>
                </div>

                {/* 3. GAP */}
                <div className="cell-gap" style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: isLeader ? '#64748b' : '#cbd5e1' }}>
                  {displayedGap}
                </div>

                {/* 4. INT */}
                <div className="cell-interval" style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: isLeader ? '#64748b' : '#cbd5e1' }}>
                  {displayedInt}
                </div>

                {/* 5. LAST */}
                <div className="cell-lap-single" style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.84rem', fontWeight: 700, color: entry.lastLapTime && !isDriverInPit ? '#00e676' : '#94a3b8' }}>
                  {displayLast}
                </div>

                {/* 6. BEST (Fastest lap of whole session in PURPLE!) */}
                <div className="cell-lap-single" style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.86rem' }}>
                  {isOverallBestLap ? (
                    <span style={{
                      color: '#d354ff',
                      fontWeight: 900,
                      textShadow: '0 0 12px rgba(211, 84, 255, 0.6)',
                      letterSpacing: '0.01em',
                    }}>
                      {displayBest}
                    </span>
                  ) : displayBest !== '—' ? (
                    <span style={{ color: '#f1f5f9', fontWeight: 800 }}>
                      {displayBest}
                    </span>
                  ) : (
                    <span style={{ color: '#64748b' }}>—</span>
                  )}
                </div>

                {/* 7. MINI-SECTORS (S1, S2, S3 with 25 mini-ticks + Último & Mejor) */}
                <div className="cell-mini-sectors" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '0 4px',
                  minWidth: 0,
                  flex: 1,
                }}>
                  <MiniSectorGroup
                    lastTime={entry.s1Time || s1Best}
                    bestTime={s1Best}
                    status={entry.s1Status}
                    bestStatus={s1BestStatus}
                    segments={entry.s1Segments}
                    count={8}
                  />
                  <MiniSectorGroup
                    lastTime={entry.s2Time || s2Best}
                    bestTime={s2Best}
                    status={entry.s2Status}
                    bestStatus={s2BestStatus}
                    segments={entry.s2Segments}
                    count={8}
                  />
                  <MiniSectorGroup
                    lastTime={entry.s3Time || s3Best}
                    bestTime={s3Best}
                    status={entry.s3Status}
                    bestStatus={s3BestStatus}
                    segments={entry.s3Segments}
                    count={9}
                  />
                </div>

                {/* 8. LAPS */}
                <div className="cell-laps-completed" style={{
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#94a3b8'
                }}>
                  {lapsCount}
                </div>

                {/* 9. PIT */}
                <div className="cell-pit-status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isDriverInPit ? (
                    <span style={{
                      background: 'rgba(37, 99, 235, 0.25)',
                      border: '1px solid rgba(59, 130, 246, 0.5)',
                      color: '#60a5fa',
                      fontSize: '0.60rem',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '4px',
                      letterSpacing: '0.03em',
                    }}>
                      IN PIT
                    </span>
                  ) : isDriverPitOut ? (
                    <span style={{
                      background: 'rgba(0, 230, 118, 0.2)',
                      border: '1px solid rgba(0, 230, 118, 0.45)',
                      color: '#00e676',
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      padding: '2px 4px',
                      borderRadius: '4px',
                    }}>
                      OUT LAP
                    </span>
                  ) : (
                    <span style={{
                      color: '#00e676',
                      fontSize: '0.60rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      opacity: 0.85,
                    }}>
                      {entry.pitStops && entry.pitStops > 0 && !isTimedSession ? `${entry.pitStops}P` : 'PISTA'}
                    </span>
                  )}
                </div>

                {/* 10. TYRE (Compound circle + Lap count) */}
                <div className="cell-tyre-clean" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}>
                  {hasTyre ? (
                    <>
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: `2px solid ${compColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: '0.62rem',
                          fontWeight: 900,
                          fontFamily: 'var(--font-display)',
                          color: compColor,
                          background: 'rgba(0,0,0,0.5)',
                        }}
                        title={`${entry.tyre.compound} (${entry.tyre.age} laps)`}
                      >
                        {compoundLetter}
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: compColor,
                      }}>
                        {entry.tyre.age}
                      </span>
                    </>
                  ) : (
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '1.5px solid #475569',
                      background: 'rgba(255,255,255,0.03)',
                    }} />
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
