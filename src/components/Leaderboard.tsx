import React, { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { Activity } from 'lucide-react';
import type { LeaderboardEntry } from '../types/telemetry';
import { TeamLogo } from './TeamLogo';
import { DriverSessionModal } from './DriverSessionModal';
import { 
  OFFICIAL_FP1_RESULTS, 
  OFFICIAL_FP2_RESULTS, 
  OFFICIAL_FP3_RESULTS,
  convertOfficialResultsToLeaderboardEntries 
} from '../data/officialWeekendSessions';
import { useLiveSession } from '../context/LiveSessionProvider';
import { MiniSectorsTracker } from './MiniSectorsTracker';
import {
  scheduleSyncService,
  getNextUpcomingGrandPrix,
  getGrandPrixTimeline,
} from '../services/scheduleSyncService';

export type WeekendSessionKey = 'FP1' | 'FP2' | 'FP3' | 'QUALIFYING' | 'RACE';

export interface WeekendSessionMeta {
  key: WeekendSessionKey;
  label: string;
  badgeName: string;
  status: 'completed' | 'live' | 'next' | 'future' | 'scheduled';
  scheduledTime: string;
  sessionKey: number;
}

export function buildWeekendSessionTabs(): WeekendSessionMeta[] {
  const schedule = scheduleSyncService.getState().schedule;
  const gp = getNextUpcomingGrandPrix(schedule);
  const timeline = getGrandPrixTimeline(gp);

  const findSessionItem = (types: string[]) =>
    timeline.sessions.find(s => types.includes(s.session.type));

  const fp1 = findSessionItem(['FP1']);
  const fp2 = findSessionItem(['FP2', 'Sprint Qualifying']);
  const fp3 = findSessionItem(['FP3', 'Sprint']);
  const qualy = findSessionItem(['Qualifying']);
  const race = findSessionItem(['Race']);

  const formatSched = (item: typeof fp1, fallback: string) => {
    if (!item) return fallback;
    const statusSuffix =
      item.status === 'live'
        ? ' (🔴 EN DIRECTO)'
        : item.status === 'completed'
        ? ' (Finalizado)'
        : '';
    return `${item.formattedDate} • ${item.formattedTime}h${statusSuffix}`;
  };

  return [
    {
      key: 'FP1',
      label: 'FP1',
      badgeName: fp1?.session.name.toUpperCase() || 'LIBRES 1 (FP1)',
      status: fp1?.status || 'completed',
      scheduledTime: formatSched(fp1, 'Viernes • Libres 1 (FP1)'),
      sessionKey: 11727,
    },
    {
      key: 'FP2',
      label: fp2?.session.type === 'Sprint Qualifying' ? 'SQ' : 'FP2',
      badgeName: fp2?.session.name.toUpperCase() || 'LIBRES 2 (FP2)',
      status: fp2?.status || 'completed',
      scheduledTime: formatSched(fp2, 'Viernes • Libres 2 (FP2)'),
      sessionKey: 11728,
    },
    {
      key: 'FP3',
      label: fp3?.session.type === 'Sprint' ? 'Sprint' : 'FP3',
      badgeName: fp3?.session.name.toUpperCase() || 'LIBRES 3 (FP3)',
      status: fp3?.status || 'completed',
      scheduledTime: formatSched(fp3, 'Sábado • Libres 3 (FP3)'),
      sessionKey: 11729,
    },
    {
      key: 'QUALIFYING',
      label: 'Qualy',
      badgeName: qualy?.session.name.toUpperCase() || 'CLASIFICACIÓN',
      status: qualy?.status || 'completed',
      scheduledTime: formatSched(qualy, 'Sábado • Clasificación'),
      sessionKey: 11730,
    },
    {
      key: 'RACE',
      label: 'Carrera',
      badgeName: race?.session.name.toUpperCase() || 'CARRERA',
      status: race?.status || 'scheduled',
      scheduledTime: formatSched(race, 'Domingo • Carrera'),
      sessionKey: 11731,
    },
  ];
}

function createScheduledLeaderboardEntries(template: typeof OFFICIAL_FP2_RESULTS): LeaderboardEntry[] {
  return template.map((r, idx) => ({
    position: idx + 1,
    previousPosition: idx + 1,
    driver: {
      id: r.code.toLowerCase(),
      code: r.code,
      number: r.driverNumber,
      firstName: r.firstName,
      lastName: r.lastName,
      team: r.team,
      teamColor: r.teamColor,
      country: r.country || 'F1',
      flag: r.country === 'NLD' ? '🇳🇱' : r.country === 'GBR' ? '🇬🇧' : r.country === 'MCO' ? '🇲🇨' : r.country === 'ESP' ? '🇪🇸' : r.country === 'FRA' ? '🇫🇷' : r.country === 'AUS' ? '🇦🇺' : r.country === 'ITA' ? '🇮🇹' : r.country === 'DEU' ? '🇩🇪' : r.country === 'BRA' ? '🇧🇷' : r.country === 'CAN' ? '🇨🇦' : r.country === 'ARG' ? '🇦🇷' : r.country === 'MEX' ? '🇲🇽' : '🏁',
    },
    gapToLeader: '—',
    gapToAhead: '—',
    intervalNum: 0,
    currentLapTime: '—',
    bestLapTime: '—',
    lastLapTime: '—',
    lastLapTimeNum: 0,
    s1Time: '—',
    s2Time: '—',
    s3Time: '—',
    s1BestTime: '—',
    s2BestTime: '—',
    s3BestTime: '—',
    s1Status: 'none',
    s2Status: 'none',
    s3Status: 'none',
    s1Segments: Array(8).fill('none'),
    s2Segments: Array(8).fill('none'),
    s3Segments: Array(9).fill('none'),
    tyre: {
      compound: 'SOFT',
      age: 0,
      used: false,
    },
    pitStops: 0,
    inPit: true,
    isPitOut: false,
    speedTrap: 0,
    trackProgress: 0,
    lapsCompleted: 0,
  }));
}

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
  sessionId?: string;
  timeRemainingSec?: number;
  totalLaps?: number;
  trackStatus?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  entries: propEntries,
  selectedDriverId,
  onSelectDriver,
  isQualifying = false,
  sessionType = 'PRACTICE',
  sessionName = 'Libres 1 (FP1)',
  sessionId = 'latest',
  timeRemainingSec = 3000,
  totalLaps = 0,
  trackStatus = 'GREEN',
}) => {
  const [modalDriver, setModalDriver] = useState<{
    driverNumber: number | string;
    driverCode: string;
    driverName: string;
    team: string;
    teamColor: string;
    flag?: string;
    position?: number;
  } | null>(null);

  // Global Single Source of Truth (SSOT) from LiveSessionProvider
  const {
    activeSession,
    leaderboard: ssotLeaderboard,
    latencyMs,
    isPulseActive,
  } = useLiveSession();

  const resolveTabFromSession = useCallback((name?: string, type?: string): WeekendSessionKey => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('fp1') || lower.includes('libres 1')) return 'FP1';
    if (lower.includes('fp2') || lower.includes('libres 2')) return 'FP2';
    if (lower.includes('fp3') || lower.includes('libres 3')) return 'FP3';
    if (type === 'RACE' || lower.includes('carrera') || lower.includes('race')) return 'RACE';
    return 'QUALIFYING';
  }, []);

  const activePropTab = useMemo(
    () => resolveTabFromSession(sessionName, sessionType),
    [sessionName, sessionType, resolveTabFromSession]
  );

  // Active Session Switcher Tab (syncs with parent session selector too)
  const [selectedSessionTab, setSelectedSessionTab] = useState<WeekendSessionKey>(() =>
    resolveTabFromSession(sessionName, sessionType)
  );

  React.useEffect(() => {
    setSelectedSessionTab(activePropTab);
  }, [activePropTab]);

  const activeRawEntries = useMemo(() => {
    // 1. If viewing the currently active session tab passed from App.tsx, use live propEntries
    if (selectedSessionTab === activePropTab && propEntries && propEntries.length > 0) {
      return propEntries;
    }

    // 2. Live Qualifying tab fallback
    if (selectedSessionTab === 'QUALIFYING') {
      return propEntries && propEntries.length > 0 ? propEntries : ssotLeaderboard;
    }

    // 3. Completed practice sessions
    if (selectedSessionTab === 'FP3') {
      return convertOfficialResultsToLeaderboardEntries(OFFICIAL_FP3_RESULTS);
    }
    if (selectedSessionTab === 'FP1') {
      return convertOfficialResultsToLeaderboardEntries(OFFICIAL_FP1_RESULTS);
    }
    if (selectedSessionTab === 'FP2') {
      return convertOfficialResultsToLeaderboardEntries(OFFICIAL_FP2_RESULTS);
    }

    // 4. Race tab: if propEntries has race data, use it; otherwise scheduled grid
    if (propEntries && propEntries.length > 0 && activePropTab === 'RACE') {
      return propEntries;
    }
    return createScheduledLeaderboardEntries(OFFICIAL_FP2_RESULTS);
  }, [selectedSessionTab, activePropTab, propEntries, ssotLeaderboard]);

  const entries = useMemo(() => {
    if (!Array.isArray(activeRawEntries)) return [];
    // Ensure all 22 official drivers in the grid are preserved without filtering anyone out
    const result: LeaderboardEntry[] = [];
    for (const e of activeRawEntries) {
      if (!e || !e.driver) continue;
      result.push(e);
    }
    const sorted = [...result].sort((a, b) => {
      // 1. In timed sessions (practice/qualy), sort by best lap time (fastest first)
      const timeA = parseLapTimeToSec(a.bestLapTime || a.lastLapTime);
      const timeB = parseLapTimeToSec(b.bestLapTime || b.lastLapTime);
      const hasTimeA = timeA !== Infinity && timeA > 0;
      const hasTimeB = timeB !== Infinity && timeB > 0;

      // Drivers WITH a completed lap always come ahead of drivers WITHOUT a time
      if (hasTimeA && !hasTimeB) return -1;
      if (!hasTimeA && hasTimeB) return 1;
      if (hasTimeA && hasTimeB) {
        if (timeA !== timeB) return timeA - timeB;
      }

      // If positions are valid and distinct, order by real position
      if (a.position && b.position && a.position !== b.position) {
        return a.position - b.position;
      }
      return (a.position || a.driver.number || 99) - (b.position || b.driver.number || 99);
    });

    return sorted.map((e, idx) => ({
      ...e,
      position: idx + 1,
    }));
  }, [activeRawEntries]);

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
    let hasPositionChange = false;
    let detectedToast: { gained: string; lost: string; pos: number } | null = null;

    if (prevPositionsRef.current.size > 0) {
      entries.forEach((entry) => {
        const oldPos = prevPositionsRef.current.get(entry.driver.id);
        if (oldPos !== undefined && oldPos !== entry.position) {
          hasPositionChange = true;
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

    // Only update overtakes state if a position genuinely changed (breaks infinite loop!)
    if (hasPositionChange) {
      setOvertakes(newOvertakes);
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

  const weekendSessions = useMemo(() => buildWeekendSessionTabs(), [sessionName, trackStatus]);
  const upcomingGp = useMemo(() => getNextUpcomingGrandPrix(scheduleSyncService.getState().schedule), [sessionName]);
  const gpTimeline = useMemo(() => getGrandPrixTimeline(upcomingGp), [upcomingGp, sessionName, trackStatus]);
  const isAnySessionLiveNow = Boolean(gpTimeline.activeSession) || activeSession.status === 'LIVE';

  const currentSessionMeta = weekendSessions.find(s => s.key === selectedSessionTab) || weekendSessions[3];
  const isScheduledSession = selectedSessionTab === 'RACE' && activePropTab !== 'RACE';
  const effectiveSessionKey = currentSessionMeta.sessionKey;

  const isQualyFinished = !isAnySessionLiveNow || trackStatus === 'CHEQUERED' || (localRemainingSec <= 0 && activeSession.status === 'FINISHED');
  const isCurrentTabFinished =
    !isAnySessionLiveNow ||
    (selectedSessionTab !== activePropTab && (selectedSessionTab === 'FP1' || selectedSessionTab === 'FP2' || selectedSessionTab === 'FP3')) ||
    (selectedSessionTab === activePropTab && trackStatus === 'CHEQUERED');

  const formattedSessionBadge = selectedSessionTab === activePropTab
    ? (isCurrentTabFinished ? `🏁 RESULTADOS CONSOLIDADOS - ${currentSessionMeta.badgeName}` : `🔴 EN DIRECTO - ${(sessionName || currentSessionMeta.badgeName).toUpperCase()}`)
    : `🏁 ${currentSessionMeta.badgeName}`;

  const formattedRemainingTime = (() => {
    if (isScheduledSession || isCurrentTabFinished) return '00:00';
    const sec = Math.max(0, localRemainingSec > 0 ? localRemainingSec : activeSession.remainingSec);
    const mins = Math.floor(sec / 60);
    const remSecs = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  })();

  // Real on-track vs in-pit counts without artificial overrides
  const effectiveInPitCount = isCurrentTabFinished ? entries.length : entries.filter(e => e.inPit).length;
  const effectiveOnTrackCount = isCurrentTabFinished ? 0 : Math.max(0, entries.length - effectiveInPitCount);

  // Qualifying cutoff calculations
  const isQualy = isQualifying || sessionType === 'QUALIFYING' || /qual|clasif/i.test(sessionName || '') || selectedSessionTab === 'QUALIFYING';
  const totalCars = entries.length;
  // In 2026 regulations with 22 cars (11 teams, e.g. Cadillac):
  // Q1 eliminates 6 cars (P17-P22, top 16 advance) -> cutoff divider before index 16 (P17)
  // Q2 eliminates 6 cars (P11-P16, top 10 advance) -> cutoff divider before index 10 (P11)
  const q1CutoffIndex = totalCars >= 22 ? 16 : 15;
  const q2CutoffIndex = 10;

  const sessionNameLower = (sessionName || '').toLowerCase();
  const isExplicitQ3 = sessionNameLower.includes('q3') || sessionNameLower.includes('qualifying 3') || sessionNameLower.includes('clasificación 3');
  const isExplicitQ2 = sessionNameLower.includes('q2') || sessionNameLower.includes('qualifying 2') || sessionNameLower.includes('clasificación 2');
  const isExplicitQ1 = sessionNameLower.includes('q1') || sessionNameLower.includes('qualifying 1') || sessionNameLower.includes('clasificación 1');

  const knockedOutCount = entries.filter(e => e.isKnockedOut).length;

  let qualyPhase: 'Q1' | 'Q2' | 'Q3' = 'Q1';
  if (selectedSessionTab === 'QUALIFYING') {
    qualyPhase = activeSession.qualyPhase;
  } else if (isExplicitQ3 || knockedOutCount >= 10) {
    qualyPhase = 'Q3';
  } else if (isExplicitQ2 || (knockedOutCount >= 5 && knockedOutCount < 10)) {
    qualyPhase = 'Q2';
  } else if (isExplicitQ1 || knockedOutCount < 5) {
    qualyPhase = 'Q1';
  } else {
    qualyPhase = 'Q1';
  }

  return (
    <div className="f1-card leaderboard-container">
      {/* Top Header Card Controls: Timing / Stints toggle & Live Session Duration / Lap Counter */}
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>
            Tabla de Tiempos
          </span>

          {/* Session Type Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: isCurrentTabFinished ? 'rgba(255, 255, 255, 0.12)' : 'rgba(225, 6, 0, 0.18)',
            border: `1px solid ${isCurrentTabFinished ? 'rgba(255, 255, 255, 0.3)' : 'rgba(225, 6, 0, 0.45)'}`,
            padding: '2px 8px',
            borderRadius: '6px',
            marginLeft: '4px',
          }}>
            {!isCurrentTabFinished && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4d4d', boxShadow: '0 0 6px #ff4d4d' }} />}
            <span style={{ fontSize: '0.66rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em', fontFamily: 'var(--font-display)' }}>
              {formattedSessionBadge}
            </span>
          </div>

          {/* Remaining Duration Timer (for FP1/FP2/FP3/Qualy) OR Lap Counter (for Race/Sprint) */}
          {isScheduledSession ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(59, 130, 246, 0.14)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              padding: '2px 10px',
              borderRadius: '6px',
            }}
            title="Sesión programada según calendario oficial"
            >
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#60a5fa', letterSpacing: '0.5px' }}>
                📅 PROGRAMADA
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.74rem', color: '#ffffff' }}>
                {currentSessionMeta.scheduledTime}
              </span>
            </div>
          ) : isTimedSession ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: (isCurrentTabFinished || localRemainingSec <= 0 || trackStatus === 'CHEQUERED')
                ? 'rgba(255, 255, 255, 0.1)'
                : trackStatus === 'RED'
                ? 'rgba(239, 68, 68, 0.18)'
                : 'rgba(0, 215, 182, 0.14)',
              border: (isCurrentTabFinished || localRemainingSec <= 0 || trackStatus === 'CHEQUERED')
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
                color: (isCurrentTabFinished || localRemainingSec <= 0 || trackStatus === 'CHEQUERED')
                  ? '#e2e8f0'
                  : trackStatus === 'RED'
                  ? '#ff4d4d'
                  : '#00D7B6',
                letterSpacing: '0.5px',
              }}>
                {(isCurrentTabFinished || localRemainingSec <= 0 || trackStatus === 'CHEQUERED')
                  ? '🏁 FINALIZADA'
                  : trackStatus === 'RED'
                  ? '⏸ DETENIDA'
                  : '⏱ RESTANTE'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.88rem', color: '#ffffff', letterSpacing: '0.03em' }}>
                {isCurrentTabFinished ? '00:00' : formattedRemainingTime}
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
                / {totalLaps || 56}
              </span>
            </div>
          )}

          {/* On-Track vs In-Pit Live Counter Pill */}
          {isScheduledSession ? (
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
              <span style={{ color: '#94a3b8' }}>22 EN ESPERA</span>
            </div>
          ) : (
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
              <span style={{ color: isCurrentTabFinished ? '#94a3b8' : '#00e676' }}>
                {isCurrentTabFinished ? '● 0 PISTA' : `● ${effectiveOnTrackCount} PISTA`}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              <span style={{ color: '#60a5fa' }}>
                {isCurrentTabFinished ? '22 BOX / PARC FERMÉ' : `${effectiveInPitCount} BOX`}
              </span>
            </div>
          )}

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

        {/* Right Header Area: Session Switcher & Official FIA Timing Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="session-switcher-bar">
            <span className="session-switcher-label">SESIÓN:</span>
            {weekendSessions.map((sess) => {
              const isSelected = selectedSessionTab === sess.key;
              const isCompleted = sess.status === 'completed' || (sess.key !== 'RACE' && !isAnySessionLiveNow);
              const isLive = sess.status === 'live';

              return (
                <button
                  key={sess.key}
                  className={`session-tab-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedSessionTab(sess.key)}
                  title={sess.scheduledTime}
                >
                  {isCompleted && <span className="tab-check">✓</span>}
                  {isLive && <span className="tab-live-dot" />}
                  <span>{sess.label}</span>
                </button>
              );
            })}
          </div>

          <div className="f1-badge badge-green" style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
            OFFICIAL FIA TIMING
          </div>
        </div>
      </div>

      {/* Standby Banner for Scheduled Upcoming Sessions */}
      {isScheduledSession && (
        <div className="session-scheduled-banner">
          <div className="session-scheduled-info">
            <span style={{ fontSize: '1.25rem' }}>📅</span>
            <div>
              <div className="session-scheduled-title">
                Sesión Programada — {currentSessionMeta.badgeName}
              </div>
              <div className="session-scheduled-subtitle">
                Comienza el {currentSessionMeta.scheduledTime}
              </div>
            </div>
          </div>
          <div className="session-scheduled-badge">
            PARRILLA A CERO
          </div>
        </div>
      )}

      {/* Qualifying Header Ribbon */}
      {selectedSessionTab === 'QUALIFYING' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 14px',
          background: isQualyFinished
            ? 'linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0%, rgba(211, 84, 255, 0.10) 50%, rgba(0, 215, 182, 0.08) 100%)'
            : 'linear-gradient(90deg, rgba(225, 6, 0, 0.14) 0%, rgba(211, 84, 255, 0.12) 50%, rgba(0, 215, 182, 0.12) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isQualyFinished ? 'rgba(255, 255, 255, 0.12)' : 'rgba(239, 68, 68, 0.25)',
              border: `1px solid ${isQualyFinished ? 'rgba(255, 255, 255, 0.3)' : 'rgba(239, 68, 68, 0.55)'}`,
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.66rem',
              fontWeight: 900,
              color: isQualyFinished ? '#ffffff' : '#ff4d4d',
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.04em',
            }}>
              {!isQualyFinished && <span className="tab-live-dot" style={{ width: '6px', height: '6px', background: '#ff4d4d' }} />}
              {isQualyFinished ? '🏁 SESIÓN FINALIZADA - RESULTADOS OFICIALES' : `🔴 ${qualyPhase} EN DIRECTO`}
            </span>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.64rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: '#cbd5e1',
            }}>
              <span>📍 {activeSession.circuitName.split(' ')[0]}: {activeSession.circuitLocalTime}</span>
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>•</span>
              <span>{activeSession.utcTime}</span>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: isQualyFinished ? 'rgba(255, 255, 255, 0.1)' : activeSession.trackStatus === 'GREEN' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 214, 10, 0.15)',
              border: `1px solid ${isQualyFinished ? 'rgba(255, 255, 255, 0.25)' : activeSession.trackStatus === 'GREEN' ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 214, 10, 0.4)'}`,
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.62rem',
              fontWeight: 800,
              color: isQualyFinished ? '#f1f5f9' : activeSession.trackStatus === 'GREEN' ? '#00e676' : '#ffd60a',
              letterSpacing: '0.03em',
            }}>
              {isQualyFinished ? '🏁 BANDERA A CUADROS (PARC FERMÉ)' : `● ${activeSession.trackStatus === 'GREEN' ? 'BANDERA VERDE' : 'BANDERA AMARILLA'}`}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Live Network Stream & Latency Indicator */}
            <div
              className="network-stream-pulse-pill"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: isQualyFinished ? 'rgba(255, 255, 255, 0.08)' : (isPulseActive ? 'rgba(0, 230, 118, 0.24)' : 'rgba(0, 230, 118, 0.12)'),
                border: `1px solid ${isQualyFinished ? 'rgba(255, 255, 255, 0.2)' : (isPulseActive ? 'rgba(0, 230, 118, 0.75)' : 'rgba(0, 230, 118, 0.35)')}`,
                padding: '2px 10px',
                borderRadius: '6px',
                fontSize: '0.66rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                color: isQualyFinished ? '#cbd5e1' : '#00e676',
                boxShadow: !isQualyFinished && isPulseActive ? '0 0 12px rgba(0, 230, 118, 0.45)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              title={isQualyFinished ? "Sesión oficial concluida — Datos consolidados FIA" : "Stream de telemetría oficial F1 en vivo conectado vía SignalR Core"}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: isQualyFinished ? '#94a3b8' : '#00e676',
                  boxShadow: isQualyFinished ? 'none' : (isPulseActive ? '0 0 10px #00e676, 0 0 16px #00e676' : '0 0 4px #00e676'),
                  transform: !isQualyFinished && isPulseActive ? 'scale(1.35)' : 'scale(1)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  display: 'inline-block',
                }}
              />
              <span style={{ letterSpacing: '0.04em' }}>
                {isQualyFinished ? 'OFICIAL FIA — CONSOLIDADO' : `STREAM EN VIVO — ${latencyMs} ms`}
              </span>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(211, 84, 255, 0.16)',
              border: '1px solid rgba(211, 84, 255, 0.45)',
              padding: '2px 10px',
              borderRadius: '6px',
              fontSize: '0.68rem',
            }}>
              <span style={{ color: '#d354ff', fontWeight: 900, fontFamily: 'var(--font-display)' }}>
                {isQualyFinished ? '🏆 POLE POSITION OFICIAL:' : 'POLE PROVISIONAL:'}
              </span>
              <span style={{ color: '#ffffff', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{activeSession.provisionalPoleDriver}</span>
              <span style={{ color: '#d354ff', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>{activeSession.provisionalPoleTime}</span>
            </div>
          </div>
        </div>
      )}

      {/* Table Header: POS | PILOTO | GAP | INT | LAST | BEST | SECTORES / STINTS | LAPS | PARADAS | NEUMÁTICO | ESTADO | DATA */}
      <div className="leaderboard-header-row">
        <span className="col-header-center">POS</span>
        <span style={{ paddingLeft: '6px' }}>PILOTO</span>
        <span className="col-header-center">GAP</span>
        <span className="col-header-center">INT</span>
        <span className="col-header-center">ÚLTIMA</span>
        <span className="col-header-center">MEJOR</span>
        <span className="col-header-center" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          {viewMode === 'stints' ? 'HISTORIAL DE STINTS Y NEUMÁTICOS' : 'MICROSECTORES (S1 • S2 • S3)'}
        </span>
        <span className="col-header-center" title="Vueltas completadas">VUEL.</span>
        <span className="col-header-center" title="Número de paradas en boxes">PARADAS</span>
        <span className="col-header-center" title="Compuesto actual, edad del neumático y estado">NEUMÁTICO</span>
        <span className="col-header-center" title="Estado del monoplaza en pista">ESTADO</span>
        <span className="col-header-center" title="Historial de telemetría y vueltas">DATA</span>
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

          // Qualifying cutoffs and state determination:
          // In Q1: show Q1 elimination line above index q1CutoffIndex (P17 in 22 cars, P16 in 20 cars)
          const showQ1Divider = isQualy && qualyPhase === 'Q1' && index === q1CutoffIndex;
          // In Q2: show Q2 elimination line above index q2CutoffIndex (P11)
          const showQ2Divider = isQualy && qualyPhase === 'Q2' && index === q2CutoffIndex;
          // In Q2 or Q3: show divider for cars already eliminated in Q1
          const showEliminatedInQ1Divider = isQualy && (qualyPhase === 'Q2' || qualyPhase === 'Q3') && index === q1CutoffIndex;
          // In Q3: show divider for cars eliminated in Q2
          const showEliminatedInQ2Divider = isQualy && qualyPhase === 'Q3' && index === q2CutoffIndex;

          const isEliminationRisk = isQualy && (
            (qualyPhase === 'Q1' && index >= q1CutoffIndex) ||
            (qualyPhase === 'Q2' && index >= q2CutoffIndex && index < q1CutoffIndex)
          );

          const isKnockedOut = Boolean(
            entry.isKnockedOut ||
            (isQualy && qualyPhase === 'Q2' && index >= q1CutoffIndex) ||
            (isQualy && qualyPhase === 'Q3' && index >= q2CutoffIndex)
          );

          const isLeader = index === 0;
          const p1BestSec = parseLapTimeToSec(entries[0]?.bestLapTime);
          const prevBestSec = index > 0 ? parseLapTimeToSec(entries[index - 1]?.bestLapTime) : Infinity;
          const bestSec = parseLapTimeToSec(entry.bestLapTime);

          const rawGapStr = entry.gapToLeader ? entry.gapToLeader.replace('LÍDER', 'LEADER').replace('LIDER', 'LEADER') : '';
          const computedGapFallback = (!isLeader && bestSec !== Infinity && p1BestSec !== Infinity && bestSec >= p1BestSec)
            ? `+${(bestSec - p1BestSec).toFixed(3)}`
            : '—';
          const displayedGap = isLeader ? '—' : (rawGapStr && rawGapStr !== '—' && rawGapStr !== 'LEADER' ? rawGapStr : computedGapFallback);

          const rawIntStr = entry.gapToAhead ? entry.gapToAhead.replace('LÍDER', 'LEADER').replace('LIDER', 'LEADER') : '';
          const computedIntFallback = (!isLeader && bestSec !== Infinity && prevBestSec !== Infinity && bestSec >= prevBestSec)
            ? `+${(bestSec - prevBestSec).toFixed(3)}`
            : '—';
          const displayedInt = isLeader ? '—' : (rawIntStr && rawIntStr !== '—' && rawIntStr !== 'LEADER' ? rawIntStr : computedIntFallback);

          const displayLast = entry.lastLapTime && entry.lastLapTime !== '--:--.---' ? entry.lastLapTime : (entry.currentLapTime || '—');
          const displayBest = entry.bestLapTime && entry.bestLapTime !== '--:--.---' ? entry.bestLapTime : '—';
          
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
          const isDriverPitOut = Boolean(entry.isPitOut && !entry.inPit);
          const isDriverInPit = Boolean(entry.inPit && !entry.isPitOut);
          const hasActiveFlyingSegments = !isDriverInPit && !isDriverPitOut && (
            (entry.s1Segments || []).some(s => s === 'purple' || s === 'green') ||
            (entry.s2Segments || []).some(s => s === 'purple' || s === 'green') ||
            (entry.s3Segments || []).some(s => s === 'purple' || s === 'green')
          );
          const isPushingLap = !isCurrentTabFinished && !isDriverInPit && !isDriverPitOut && (entry.currentLapTime === 'PUSH' || (isQualy && hasActiveFlyingSegments));

          return (
            <React.Fragment key={entry.driver.id}>
              {/* Qualy Q2 Cutoff (Active during Q2) */}
              {showQ2Divider && (
                <div className="cutoff-divider">
                  <span>Q2 ELIMINATION CUTOFF (TOP 10 ADVANCE TO Q3)</span>
                  <span>ELIMINATION ZONE</span>
                </div>
              )}

              {/* Qualy Q1 Cutoff (Active during Q1) */}
              {showQ1Divider && (
                <div className="cutoff-divider">
                  <span>Q1 ELIMINATION CUTOFF (TOP {q1CutoffIndex} ADVANCE)</span>
                  <span>ELIMINATION ZONE</span>
                </div>
              )}

              {/* Previously Eliminated in Q2 Divider (shown in Q3) */}
              {showEliminatedInQ2Divider && (
                <div className="cutoff-divider knocked-out-divider">
                  <span>ELIMINATED IN Q2 (P11–P{q1CutoffIndex})</span>
                  <span>KNOCKED OUT</span>
                </div>
              )}

              {/* Previously Eliminated in Q1 Divider (shown in Q2 / Q3) */}
              {showEliminatedInQ1Divider && (
                <div className="cutoff-divider knocked-out-divider">
                  <span>ELIMINATED IN Q1 (P{q1CutoffIndex + 1}–P{totalCars})</span>
                  <span>KNOCKED OUT</span>
                </div>
              )}

              <div
                ref={(el) => registerRow(entry.driver.id, el)}
                className={`leaderboard-row ${isSelected ? 'selected' : ''} ${isDriverInPit ? 'in-pit' : ''} ${isEliminationRisk ? 'elimination-danger' : ''} ${isKnockedOut ? 'knocked-out' : ''} ${isOvertakeUp ? 'overtake-row-up' : ''} ${isOvertakeDown ? 'overtake-row-down' : ''}`}
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

                {/* 2. DRIVER (Logo + Solid Team Color Driver Chip + Surname) */}
                <div className="cell-driver-with-logo" style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
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
                  <span
                    className="driver-lastname"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      color: '#f1f5f9',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={`${entry.driver.firstName} ${entry.driver.lastName} (#${entry.driver.number})`}
                  >
                    {entry.driver.lastName}
                  </span>
                </div>

                {/* 3. GAP */}
                <div className="cell-gap" style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: isLeader ? '#00e676' : '#cbd5e1' }}>
                  {isLeader && isQualy ? (
                    <span style={{ color: '#00e676', fontWeight: 900, fontSize: '0.74rem', letterSpacing: '0.04em' }}>POLE</span>
                  ) : displayedGap}
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

                {/* 7. MINI-SECTORS OR STINTS STRATEGY VIEW */}
                {viewMode === 'stints' ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0 6px',
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {(entry.stints && entry.stints.length > 0 ? entry.stints : (hasTyre ? [entry.tyre] : [])).map((stint, sIdx) => {
                      const stColor =
                        stint.compound === 'SOFT'
                          ? '#ff3b30'
                          : stint.compound === 'MEDIUM'
                          ? '#ffd60a'
                          : stint.compound === 'HARD'
                          ? '#ffffff'
                          : stint.compound === 'INTERMEDIATE'
                          ? '#34c759'
                          : stint.compound === 'WET'
                          ? '#007aff'
                          : '#94a3b8';
                      return (
                        <div
                          key={sIdx}
                          style={{
                            flex: Math.max(1, stint.age || 1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${stColor}55`,
                            borderLeft: `3px solid ${stColor}`,
                            minWidth: '64px',
                          }}
                          title={`Stint ${sIdx + 1}: ${stint.compound} (${stint.age} vueltas • ${stint.used ? 'Usado' : 'Nuevo'})`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                border: `2px solid ${stColor}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.58rem',
                                fontWeight: 900,
                                color: stColor,
                                fontFamily: 'var(--font-display)',
                              }}
                            >
                              {stint.compound?.[0] || 'S'}
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                              {stint.age}v
                            </span>
                          </div>
                          <span style={{ fontSize: '0.56rem', fontWeight: 700, color: stint.used ? '#94a3b8' : '#00e676', fontFamily: 'var(--font-mono)' }}>
                            {stint.used ? 'USADO' : 'NUEVO'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <MiniSectorsTracker
                    s1Segments={entry.s1Segments}
                    s2Segments={entry.s2Segments}
                    s3Segments={entry.s3Segments}
                    s1Time={entry.s1Time || s1Best}
                    s2Time={entry.s2Time || s2Best}
                    s3Time={entry.s3Time || s3Best}
                    s1BestTime={s1Best}
                    s2BestTime={s2Best}
                    s3BestTime={s3Best}
                    s1Status={entry.s1Status}
                    s2Status={entry.s2Status}
                    s3Status={entry.s3Status}
                    s1BestStatus={s1BestStatus}
                    s2BestStatus={s2BestStatus}
                    s3BestStatus={s3BestStatus}
                    trackProgress={isCurrentTabFinished ? 1.0 : entry.trackProgress}
                    driverStatus={isCurrentTabFinished ? 'PIT' : (isPushingLap ? 'PUSH' : isDriverInPit ? 'PIT' : 'ON_TRACK')}
                    inPit={isCurrentTabFinished ? true : isDriverInPit}
                    showTimes={true}
                  />
                )}

                {/* 8. LAPS */}
                <div className="cell-laps-completed" style={{
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: '#e2e8f0'
                }}>
                  {lapsCount}
                </div>

                {/* 9. PARADAS (Pit Stops Count) */}
                <div className="cell-pit-stops" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      minWidth: '38px',
                      padding: '3px 7px',
                      borderRadius: '5px',
                      background: (entry.pitStops || 0) > 0 ? 'rgba(59, 130, 246, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${(entry.pitStops || 0) > 0 ? 'rgba(59, 130, 246, 0.38)' : 'rgba(255, 255, 255, 0.08)'}`,
                      color: (entry.pitStops || 0) > 0 ? '#93c5fd' : '#64748b',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                    }}
                    title={`${entry.pitStops || 0} parada(s) en boxes registradas`}
                  >
                    {entry.pitStops ?? 0}
                    <span style={{ fontSize: '0.54rem', opacity: 0.75, fontWeight: 700 }}>PIT</span>
                  </span>
                </div>

                {/* 10. NEUMÁTICO (Compound circle + Lap age + New/Used + Previous Stint Dots) */}
                <div className="cell-tyre-clean" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}>
                  {hasTyre ? (
                    <>
                      {/* Previous stint mini dots if driver has pitted */}
                      {entry.stints && entry.stints.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} title={`Historial: ${entry.stints.map(s => `${s.compound[0]}(${s.age}v)`).join(' → ')}`}>
                          {entry.stints.slice(0, -1).slice(-2).map((prevStint, pIdx) => {
                            const pCol =
                              prevStint.compound === 'SOFT' ? '#ff3b30' :
                              prevStint.compound === 'MEDIUM' ? '#ffd60a' :
                              prevStint.compound === 'HARD' ? '#ffffff' :
                              prevStint.compound === 'INTERMEDIATE' ? '#34c759' : '#007aff';
                            return (
                              <span
                                key={pIdx}
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  border: `1.5px solid ${pCol}`,
                                  background: 'rgba(0,0,0,0.6)',
                                  display: 'inline-block',
                                  opacity: 0.75,
                                }}
                              />
                            );
                          })}
                        </div>
                      )}
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: `2.5px solid ${compColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: '0.68rem',
                          fontWeight: 900,
                          fontFamily: 'var(--font-display)',
                          color: compColor,
                          background: 'rgba(0,0,0,0.65)',
                          boxShadow: `0 0 8px ${compColor}33`,
                        }}
                        title={`${entry.tyre.compound} • ${entry.tyre.age} vueltas (${entry.tyre.used ? 'Usado' : 'Nuevo'})`}
                      >
                        {compoundLetter}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.05 }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          color: '#f8fafc',
                        }}>
                          {entry.tyre.age}v
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.52rem',
                          fontWeight: 700,
                          color: entry.tyre.used ? '#94a3b8' : '#00e676',
                          letterSpacing: '0.02em',
                        }}>
                          {entry.tyre.used ? 'USADO' : 'NUEVO'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: '1.5px solid #475569',
                      background: 'rgba(255,255,255,0.03)',
                    }} />
                  )}
                </div>

                {/* 11. ESTADO (Track / Pit Status) */}
                <div className="cell-pit-status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isCurrentTabFinished ? (
                    <span className="qualy-pit-badge" style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      fontSize: '0.58rem',
                      letterSpacing: '0.04em',
                    }}>
                      BOX / FIN
                    </span>
                  ) : isDriverInPit ? (
                    <span className="qualy-pit-badge">
                      IN PIT
                    </span>
                  ) : isPushingLap ? (
                    <span className="qualy-push-badge">
                      ⚡ PUSH
                    </span>
                  ) : isDriverPitOut ? (
                    <span style={{
                      background: 'rgba(0, 230, 118, 0.2)',
                      border: '1px solid rgba(0, 230, 118, 0.45)',
                      color: '#00e676',
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      OUT LAP
                    </span>
                  ) : (
                    <span className="qualy-track-badge">
                      ● PISTA
                    </span>
                  )}
                </div>

                {/* 11. ACTION BUTTON: Open Driver Session Modal */}
                <div className="cell-action-modal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    className="driver-laps-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalDriver({
                        driverNumber: entry.driver.number,
                        driverCode: entry.driver.code,
                        driverName: `${entry.driver.firstName} ${entry.driver.lastName}`,
                        team: entry.driver.team,
                        teamColor,
                        flag: entry.driver.flag,
                        position: entry.position,
                      });
                    }}
                    title={`Ver historial de vueltas y telemetría de ${entry.driver.code}`}
                    aria-label={`Ver historial de vueltas y telemetría de ${entry.driver.code}`}
                  >
                    <Activity size={13} />
                  </button>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Driver Session Details Modal */}
      {modalDriver && (
        <DriverSessionModal
          isOpen={Boolean(modalDriver)}
          onClose={() => setModalDriver(null)}
          driverNumber={modalDriver.driverNumber}
          driverCode={modalDriver.driverCode}
          driverName={modalDriver.driverName}
          team={modalDriver.team}
          teamColor={modalDriver.teamColor}
          flag={modalDriver.flag}
          position={modalDriver.position}
          sessionKey={effectiveSessionKey || sessionId}
          sessionName={currentSessionMeta.badgeName}
          overallBestLapTime={minSessionBestSec !== Infinity ? entries[0]?.bestLapTime : undefined}
        />
      )}
    </div>
  );
};
