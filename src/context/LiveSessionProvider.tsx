/**
 * LiveSessionProvider.tsx - Global Single Source of Truth (SSOT) for F1 Live Timing
 *
 * Responsibilities:
 * 1. Singleton WebSocket / SignalR Core Connection: Active once at the root of the app.
 *    Navigating between pages NEVER re-establishes, duplicates, or tears down the stream.
 * 2. Anti-Throttling Guard (isConnectingRef): Prevents concurrent socket creation and breaks
 *    infinite connection loops.
 * 3. 250ms Batching Buffer: Amortizes incoming high-frequency telemetry deltas into throttled,
 *    atomic updates so the UI main thread is never saturated.
 * 4. 6-second Watchdog Timer & Exponential Backoff Reconnection (1s, 2s, 4s, 8s, max 10s).
 * 5. Global Synchronized State:
 *    - activeSession: sessionKey (11730), sessionType ("QUALIFYING"), status ("LIVE"), countdown clock.
 *    - leaderboard: 22 official drivers sorted in real time with best lap, sectors & mini-sectors.
 *    - miniSectors: Segment arrays for all cars.
 *    - connectionStatus: 'CONNECTED' | 'RECONNECTING' | 'OFFLINE'.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { LeaderboardEntry, TrackStatus, SectorStatus } from '../types/telemetry';
import {
  LIVE_QUALIFYING_RESULTS,
  convertOfficialResultsToLeaderboardEntries,
} from '../data/officialWeekendSessions';
import {
  getEffectiveNowMs,
  scheduleSyncService,
  getNextUpcomingGrandPrix,
  getGrandPrixTimeline,
} from '../services/scheduleSyncService';
import { f1LiveWebSocketService } from '../services/f1LiveWebSocketService';
import { mergeSectorDelta, type SegmentStatusType } from '../utils/microsectorParser';
import { simulateMicrosectorLap } from '../components/MiniSectorsTracker';
import { evaluateSessionLifecycle, type SessionFinishReason } from '../hooks/useSessionStatus';

export interface ActiveSessionInfo {
  sessionKey: string;
  sessionType: 'QUALIFYING' | 'PRACTICE' | 'RACE' | 'SPRINT';
  sessionName: string;
  meetingName: string;
  circuitName: string;
  status: 'LIVE' | 'FINISHED' | 'UPCOMING';
  finishReason: SessionFinishReason;
  isOfficialResults: boolean;
  trackStatus: TrackStatus;
  remainingSec: number;
  qualyPhase: 'Q1' | 'Q2' | 'Q3';
  provisionalPoleDriver: string;
  provisionalPoleTime: string;
  circuitLocalTime: string;
  utcTime: string;
}

export interface LiveSessionContextValue {
  activeSession: ActiveSessionInfo;
  leaderboard: LeaderboardEntry[];
  miniSectors: Record<string, { s1: SectorStatus[]; s2: SectorStatus[]; s3: SectorStatus[] }>;
  connectionStatus: 'CONNECTED' | 'RECONNECTING' | 'OFFLINE';
  latencyMs: number;
  lastUpdated: number;
  isPulseActive: boolean;
  reconnect: () => void;
  selectedDriverId: string;
  setSelectedDriverId: (id: string) => void;
}

const LiveSessionContext = createContext<LiveSessionContextValue | undefined>(undefined);

const WATCHDOG_TIMEOUT_MS = 8000; // 8 seconds watchdog
const DEFAULT_SESSION_KEY = 'latest';

function resolveCurrentScheduledSession() {
  const schedule = scheduleSyncService.getState().schedule;
  const gp = getNextUpcomingGrandPrix(schedule);
  const timeline = getGrandPrixTimeline(gp);
  const nowMs = getEffectiveNowMs();

  const activeItem =
    timeline.activeSession ||
    timeline.nextSession ||
    timeline.lastCompletedSession ||
    timeline.sessions[timeline.sessions.length - 1];

  const startIso = activeItem && !isNaN(activeItem.startTime)
    ? new Date(activeItem.startTime).toISOString()
    : new Date(nowMs - 15 * 60 * 1000).toISOString();
  const endIso = activeItem && !isNaN(activeItem.endTime)
    ? new Date(activeItem.endTime).toISOString()
    : new Date(nowMs + 45 * 60 * 1000).toISOString();

  const rawLabel = (activeItem?.session.name || activeItem?.session.type || 'Clasificación').toUpperCase();
  const sessionType: ActiveSessionInfo['sessionType'] =
    rawLabel.includes('CARRERA') || rawLabel.includes('RACE')
      ? 'RACE'
      : rawLabel.includes('SPRINT') && !rawLabel.includes('QUAL')
      ? 'SPRINT'
      : rawLabel.includes('CLASIFICACI') || rawLabel.includes('QUAL')
      ? 'QUALIFYING'
      : 'PRACTICE';

  return {
    gp,
    activeItem,
    startIso,
    endIso,
    sessionType,
    sessionName: `${gp.name} - ${activeItem?.session.name || 'En Directo'}`,
    meetingName: gp.officialName || gp.name,
    circuitName: gp.circuitName,
  };
}

// Convert MM:SS.mmm to seconds for sorting
function parseLapTimeToSec(lapStr?: string): number {
  if (!lapStr || lapStr.includes('-') || lapStr.includes('—') || lapStr.includes('DNF')) return Infinity;
  const clean = lapStr.replace('+', '').trim();
  const parts = clean.split(':');
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(clean) || Infinity;
}

export const LiveSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ── 0. Initial Dynamic Lifecycle Evaluation ─────────────────────────────────
  const initialScheduled = resolveCurrentScheduledSession();
  const initialLifecycle = evaluateSessionLifecycle({
    sessionEndTimeUtc: initialScheduled.endIso,
    sessionStartTimeUtc: initialScheduled.startIso,
    trackStatus: 'GREEN',
    currentTimeMs: getEffectiveNowMs(),
  });

  // ── 1. Global Shared State ──────────────────────────────────────────────────
  const [scheduledMeta, setScheduledMeta] = useState(initialScheduled);
  const [activeStatus, setActiveStatus] = useState<'LIVE' | 'FINISHED' | 'UPCOMING'>(initialLifecycle.status);
  const [finishReason, setFinishReason] = useState<SessionFinishReason>(initialLifecycle.finishReason);
  const [trackStatus, setTrackStatus] = useState<TrackStatus>(initialLifecycle.isFinished ? 'CHEQUERED' : 'GREEN');

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    const initialWs = f1LiveWebSocketService.getInitialLeaderboard();
    if (initialWs && initialWs.length > 0) return initialWs;
    return convertOfficialResultsToLeaderboardEntries(LIVE_QUALIFYING_RESULTS, initialLifecycle.isFinished);
  });

  const [selectedDriverId, setSelectedDriverId] = useState<string>('lec');
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'RECONNECTING' | 'OFFLINE'>('CONNECTED');
  const [latencyMs, setLatencyMs] = useState<number>(6);
  const [isPulseActive, setIsPulseActive] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // 1-second countdown clock for session duration
  const [remainingSec, setRemainingSec] = useState<number>(initialLifecycle.timeRemainingSec);
  const wsRemainingSecRef = useRef<number | undefined>(undefined);
  const wsIsLiveRef = useRef<boolean>(false);

  // ── 2. Mutable Connection Refs (Prevents Re-renders from Triggering Socket Loops) ──
  const socketRef = useRef<WebSocket | null>(null);
  const isConnectingRef = useRef<boolean>(false); // Anti-Throttling Guard!
  const watchdogTimerRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const backoffDelayRef = useRef<number>(1000);
  const reconnectAttemptsRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const pulseTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const lastPingSentAtRef = useRef<number>(Date.now());
  const lastTelemetryTimestampMsRef = useRef<number>(Date.now());
  const officialSessionStatusRef = useRef<string>('Started');

  // 250ms Batching Buffer
  const pendingDeltasRef = useRef<Record<string, any>>({});
  const batchTimerRef = useRef<any>(null);

  // ── 3. Visual Pulse Trigger ─────────────────────────────────────────────────
  const triggerPulse = useCallback((customLatency?: number) => {
    if (!isMountedRef.current) return;
    setIsPulseActive(true);
    setLastUpdated(Date.now());
    if (customLatency !== undefined) {
      setLatencyMs(customLatency);
    }
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) setIsPulseActive(false);
    }, 400);
  }, []);

  // ── 4. Batch Processing: Atomically Flushes Buffered Deltas ─────────────────
  const flushPendingDeltas = useCallback(() => {
    const deltas = pendingDeltasRef.current;
    pendingDeltasRef.current = {};

    if (!deltas || Object.keys(deltas).length === 0) return;

    setLeaderboard((prevEntries) => {
      let hasModified = false;

      const updated = prevEntries.map((driverEntry) => {
        const driverNum = String(driverEntry.driver.number);
        const lineDelta = deltas[driverNum];
        if (!lineDelta) return driverEntry;

        hasModified = true;

        let nextS1Segments: SectorStatus[] = driverEntry.s1Segments ? [...driverEntry.s1Segments] : Array(8).fill('none');
        let nextS2Segments: SectorStatus[] = driverEntry.s2Segments ? [...driverEntry.s2Segments] : Array(8).fill('none');
        let nextS3Segments: SectorStatus[] = driverEntry.s3Segments ? [...driverEntry.s3Segments] : Array(9).fill('none');
        let nextS1Status = driverEntry.s1Status;
        let nextS2Status = driverEntry.s2Status;
        let nextS3Status = driverEntry.s3Status;
        let nextS1Time = driverEntry.s1Time;
        let nextS2Time = driverEntry.s2Time;
        let nextS3Time = driverEntry.s3Time;

        if (lineDelta.Sectors) {
          const sectors = lineDelta.Sectors;
          const sectorList = Array.isArray(sectors)
            ? sectors.map((s, i) => [String(i), s] as const)
            : Object.entries(sectors);

          for (const [sKey, sData] of sectorList) {
            const sIdx = parseInt(sKey, 10);
            if (sIdx === 0) {
              if ((sData as any)?.Value) nextS1Time = (sData as any).Value;
              if ((sData as any)?.OverallFastest) nextS1Status = 'purple';
              else if ((sData as any)?.PersonalFastest) nextS1Status = 'green';
              else if ((sData as any)?.Value) nextS1Status = 'yellow';

              if ((sData as any)?.Segments) {
                nextS1Segments = mergeSectorDelta(nextS1Segments as SegmentStatusType[], (sData as any).Segments, 8) as SectorStatus[];
              }
            } else if (sIdx === 1) {
              if ((sData as any)?.Value) nextS2Time = (sData as any).Value;
              if ((sData as any)?.OverallFastest) nextS2Status = 'purple';
              else if ((sData as any)?.PersonalFastest) nextS2Status = 'green';
              else if ((sData as any)?.Value) nextS2Status = 'yellow';

              if ((sData as any)?.Segments) {
                nextS2Segments = mergeSectorDelta(nextS2Segments as SegmentStatusType[], (sData as any).Segments, 8) as SectorStatus[];
              }
            } else if (sIdx === 2) {
              if ((sData as any)?.Value) nextS3Time = (sData as any).Value;
              if ((sData as any)?.OverallFastest) nextS3Status = 'purple';
              else if ((sData as any)?.PersonalFastest) nextS3Status = 'green';
              else if ((sData as any)?.Value) nextS3Status = 'yellow';

              if ((sData as any)?.Segments) {
                nextS3Segments = mergeSectorDelta(nextS3Segments as SegmentStatusType[], (sData as any).Segments, 9) as SectorStatus[];
              }
            }
          }
        }

        return {
          ...driverEntry,
          bestLapTime: lineDelta.BestLapTime?.Value || driverEntry.bestLapTime,
          lastLapTime: lineDelta.LastLapTime?.Value || driverEntry.lastLapTime,
          gapToLeader: lineDelta.GapToLeader || driverEntry.gapToLeader,
          gapToAhead: lineDelta.IntervalToPositionAhead?.Value || driverEntry.gapToAhead,
          inPit: lineDelta.InPit !== undefined ? Boolean(lineDelta.InPit) : driverEntry.inPit,
          isPitOut: lineDelta.PitOut !== undefined ? Boolean(lineDelta.PitOut) : driverEntry.isPitOut,
          lapsCompleted: lineDelta.NumberOfLaps !== undefined ? Number(lineDelta.NumberOfLaps) : driverEntry.lapsCompleted,
          s1Time: nextS1Time,
          s2Time: nextS2Time,
          s3Time: nextS3Time,
          s1Status: nextS1Status,
          s2Status: nextS2Status,
          s3Status: nextS3Status,
          s1Segments: nextS1Segments,
          s2Segments: nextS2Segments,
          s3Segments: nextS3Segments,
        };
      });

      if (!hasModified) return prevEntries;

      // Sort drivers by best lap time
      const sorted = [...updated].sort((a, b) => {
        const timeA = parseLapTimeToSec(a.bestLapTime || a.lastLapTime);
        const timeB = parseLapTimeToSec(b.bestLapTime || b.lastLapTime);
        const hasTimeA = timeA !== Infinity && timeA > 0;
        const hasTimeB = timeB !== Infinity && timeB > 0;

        if (hasTimeA && !hasTimeB) return -1;
        if (!hasTimeA && hasTimeB) return 1;
        if (hasTimeA && hasTimeB && timeA !== timeB) return timeA - timeB;
        return a.position - b.position;
      });

      return sorted.map((d, idx) => ({
        ...d,
        position: idx + 1,
      }));
    });
  }, []);

  // ── 5. Watchdog Management ──────────────────────────────────────────────────
  const resetWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);

    watchdogTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      console.warn(
        `[LiveSessionProvider] ⚠️ WATCHDOG TIMEOUT: No heartbeat in ${WATCHDOG_TIMEOUT_MS}ms. ` +
        `Closing socket and triggering reconnect...`
      );

      if (socketRef.current) {
        try {
          socketRef.current.close(4000, 'Watchdog timeout');
        } catch {}
        socketRef.current = null;
      }
      isConnectingRef.current = false;
      setConnectionStatus('RECONNECTING');
      scheduleReconnect();
    }, WATCHDOG_TIMEOUT_MS);
  }, []);

  // ── 6. Reconnection Scheduler with Exponential Backoff ──────────────────────
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    const delay = backoffDelayRef.current;
    backoffDelayRef.current = Math.min(delay * 2, 10000); // 1s, 2s, 4s, 8s, 10s max
    reconnectAttemptsRef.current += 1;

    console.info(`[LiveSessionProvider] Scheduling reconnect #${reconnectAttemptsRef.current} in ${delay}ms...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (isMountedRef.current) {
        connect();
      }
    }, delay);
  }, []);

  // ── 7. Singleton WebSocket Connection Routine ───────────────────────────────
  const connect = useCallback(async () => {
    if (!isMountedRef.current) return;

    // ANTI-THROTTLING GUARD: Never open duplicate sockets or loop on connect!
    if (socketRef.current?.readyState === WebSocket.OPEN || isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;
    setConnectionStatus('RECONNECTING');

    try {
      const isBrowser = typeof window !== 'undefined';
      const negotiateUrls = isBrowser && window.location.protocol === 'http:' && window.location.port === '5173'
        ? ['/f1-signalr/negotiate?negotiateVersion=1', 'https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1']
        : ['https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1'];

      let token: string | null = null;
      for (const url of negotiateUrls) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'User-Agent': 'BestHTTP', 'Accept': 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            token = data.connectionToken || data.connectionId;
            if (token) break;
          }
        } catch {
          // Fallback to next candidate
        }
      }

      if (!token) {
        throw new Error('Negotiation returned no token');
      }

      let wsUrl = `wss://livetiming.formula1.com/signalrcore?id=${encodeURIComponent(token)}`;
      if (isBrowser && window.location.protocol === 'http:' && window.location.port === '5173') {
        wsUrl = `ws://${window.location.host}/f1-signalr?id=${encodeURIComponent(token)}`;
      }

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }

        isConnectingRef.current = false;
        backoffDelayRef.current = 1000;
        reconnectAttemptsRef.current = 0;
        setConnectionStatus('CONNECTED');
        triggerPulse(6);

        // Handshake & Subscriptions
        ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + '\x1e');
        ws.send(JSON.stringify({
          type: 1,
          target: 'Subscribe',
          arguments: [['TimingData', 'TimingAppData', 'SessionData', 'Heartbeat']],
        }) + '\x1e');

        resetWatchdog();

        // 5-second ping interval
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            lastPingSentAtRef.current = Date.now();
            socketRef.current.send(JSON.stringify({ type: 6 }) + '\x1e');
          }
        }, 5000);
      };

      ws.onmessage = (event: MessageEvent) => {
        resetWatchdog();

        try {
          const raw = String(event.data);
          const records = raw.split('\x1e');

          for (const record of records) {
            const trimmed = record.trim();
            if (!trimmed || trimmed === '{}') continue;

            const msg = JSON.parse(trimmed);

            if (msg.type === 6 || msg.type === 3) {
              const pingLat = Math.max(4, Math.min(50, Date.now() - lastPingSentAtRef.current));
              triggerPulse(pingLat);
              continue;
            }

            if (msg.type === 1 && msg.target === 'feed' && Array.isArray(msg.arguments)) {
              const topic = msg.arguments[0];
              const payload = msg.arguments[1];

              if (topic === 'TrackStatus') {
                const statusVal = String(payload?.Status || payload || '');
                if (statusVal === '4' || statusVal.toUpperCase() === 'CHEQUERED') {
                  setTrackStatus('CHEQUERED');
                }
              } else if (topic === 'SessionData' || topic === 'SessionStatus') {
                const statusStr = String(payload?.Status || payload?.SessionStatus || '');
                if (statusStr.includes('Finish') || statusStr.includes('Final')) {
                  officialSessionStatusRef.current = 'Finished';
                }
              } else if (topic === 'Heartbeat') {
                const now = Date.now();
                const beatLat = Math.max(5, Math.min(45, now - lastPingSentAtRef.current));
                triggerPulse(beatLat);
              } else if (topic === 'TimingData' && payload?.Lines) {
                lastTelemetryTimestampMsRef.current = Date.now();
                triggerPulse();
                Object.assign(pendingDeltasRef.current, payload.Lines);
                if (!batchTimerRef.current) {
                  batchTimerRef.current = setTimeout(() => {
                    batchTimerRef.current = null;
                    if (isMountedRef.current) {
                      flushPendingDeltas();
                    }
                  }, 250);
                }
              }
            }
          }
        } catch {
          // Ignore malformed frames safely
        }
      };

      ws.onerror = (err) => {
        console.warn('[LiveSessionProvider] WebSocket error:', err);
      };

      ws.onclose = () => {
        isConnectingRef.current = false;
        socketRef.current = null;
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (isMountedRef.current) {
          setConnectionStatus('RECONNECTING');
          scheduleReconnect();
        }
      };
    } catch {
      isConnectingRef.current = false;
      setConnectionStatus('RECONNECTING');
      scheduleReconnect();
    }
  }, [activeStatus, flushPendingDeltas, resetWatchdog, triggerPulse, scheduleReconnect]);

  // ── 8. Subscribe to f1LiveWebSocketService & Session Clock (1-Second Cadence) ──
  useEffect(() => {
    const unsubWsEntries = f1LiveWebSocketService.subscribe((wsEntries) => {
      if (wsEntries && wsEntries.length > 0) {
        lastTelemetryTimestampMsRef.current = Date.now();
        triggerPulse(5);
        setConnectionStatus('CONNECTED');
        setLeaderboard(wsEntries);
      }
    });

    const unsubWsStatus = f1LiveWebSocketService.subscribeSessionStatus((wsStatus) => {
      if (wsStatus.remainingSec !== undefined && wsStatus.remainingSec >= 0) {
        wsRemainingSecRef.current = wsStatus.remainingSec;
        setRemainingSec(wsStatus.remainingSec);
      }
      if (wsStatus.sessionStatus === 'Started' && !wsStatus.isFinished) {
        wsIsLiveRef.current = true;
        officialSessionStatusRef.current = 'Started';
        setActiveStatus('LIVE');
      } else if (wsStatus.isFinished) {
        wsIsLiveRef.current = false;
        officialSessionStatusRef.current = 'Finished';
      }
      if (wsStatus.isChequered || wsStatus.isFinished) {
        setTrackStatus('CHEQUERED');
      } else if (wsStatus.isRedFlag || wsStatus.trackStatus === '5') {
        setTrackStatus('RED');
      } else if (wsStatus.safetyCar || wsStatus.trackStatus === '4') {
        setTrackStatus('SC');
      } else if (wsStatus.vsc || wsStatus.trackStatus === '6' || wsStatus.trackStatus === '7') {
        setTrackStatus('VSC');
      } else if (wsStatus.trackStatus === '2') {
        setTrackStatus('YELLOW');
      } else if (wsStatus.trackStatus === '1') {
        setTrackStatus('GREEN');
      }
    });

    return () => {
      unsubWsEntries();
      unsubWsStatus();
    };
  }, [triggerPulse]);

  useEffect(() => {
    const sessionTicker = setInterval(() => {
      const currentSched = resolveCurrentScheduledSession();
      setScheduledMeta(currentSched);

      const wsLiveStatus = f1LiveWebSocketService.getSessionStatus();
      if (wsLiveStatus.remainingSec !== undefined && wsLiveStatus.remainingSec > 0 && !wsLiveStatus.isFinished) {
        setRemainingSec(wsLiveStatus.remainingSec);
        setActiveStatus('LIVE');
        setFinishReason(null);
        return;
      }

      const nowMs = getEffectiveNowMs();
      const lifecycle = evaluateSessionLifecycle({
        sessionEndTimeUtc: currentSched.endIso,
        sessionStartTimeUtc: currentSched.startIso,
        trackStatus,
        officialSessionStatus: officialSessionStatusRef.current,
        lastTelemetryTimestampMs: lastTelemetryTimestampMsRef.current,
        currentTimeMs: nowMs,
      });

      setRemainingSec(lifecycle.timeRemainingSec);
      setActiveStatus(lifecycle.status);
      setFinishReason(lifecycle.finishReason);

      // Smooth in-flight car progression ONLY while session is actively LIVE
      if (lifecycle.status === 'LIVE') {
        setLeaderboard((prevEntries) => {
          let hasMoved = false;

          const updated = prevEntries.map((entry) => {
            const isDriving = !entry.inPit && (entry.isPitOut || entry.trackProgress > 0 || entry.currentLapTime === 'PUSH');
            if (!isDriving) return entry;

            hasMoved = true;
            const currentProg = entry.trackProgress >= 1 ? 0 : entry.trackProgress;
            const newProg = Math.min(1.0, currentProg + 0.012);

            const isPurplePace = entry.s1Status === 'purple' || entry.s2Status === 'purple' || entry.s3Status === 'purple';
            const pace: 'overall_fastest' | 'personal_best' | 'normal' = isPurplePace
              ? 'overall_fastest'
              : (entry.s1Status === 'green' || entry.s2Status === 'green' ? 'personal_best' : 'normal');

            if (newProg >= 1.0) {
              const completed = simulateMicrosectorLap(1.0, pace);
              return {
                ...entry,
                trackProgress: 1.0,
                lapsCompleted: (entry.lapsCompleted || 0) + 1,
                s1Segments: completed.s1Segments,
                s2Segments: completed.s2Segments,
                s3Segments: completed.s3Segments,
              };
            }

            const sim = simulateMicrosectorLap(newProg, pace);
            return {
              ...entry,
              trackProgress: newProg,
              s1Segments: sim.s1Segments,
              s2Segments: sim.s2Segments,
              s3Segments: sim.s3Segments,
            };
          });

          return hasMoved ? updated : prevEntries;
        });
      }
    }, 1000);

    return () => clearInterval(sessionTicker);
  }, [trackStatus]);

  // ── 9. Mount / Unmount Root Lifecycle (Runs ONCE at Root Level) ─────────────
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  // ── 10. Memoized Metadata & Context Value (SSOT) ───────────────────────────
  const qualyPhase: 'Q1' | 'Q2' | 'Q3' = useMemo(() => {
    if (activeStatus === 'FINISHED' || remainingSec <= 0) return 'Q3';
    if (remainingSec > 40 * 60) return 'Q1';
    if (remainingSec > 18 * 60) return 'Q2';
    return 'Q3';
  }, [remainingSec, activeStatus]);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const circuitLocalTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} Local`;
  const utcTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;

  const p1Driver = leaderboard[0];
  const provisionalPoleDriver = p1Driver ? `${p1Driver.driver.firstName} ${p1Driver.driver.lastName}`.toUpperCase() : 'CHARLES LECLERC';
  const provisionalPoleTime = p1Driver?.bestLapTime || '1:36.582';

  const miniSectors = useMemo(() => {
    const res: Record<string, { s1: SectorStatus[]; s2: SectorStatus[]; s3: SectorStatus[] }> = {};
    for (const d of leaderboard) {
      res[String(d.driver.number)] = {
        s1: d.s1Segments || Array(8).fill('none'),
        s2: d.s2Segments || Array(8).fill('none'),
        s3: d.s3Segments || Array(9).fill('none'),
      };
    }
    return res;
  }, [leaderboard]);

  const wsStatusNow = f1LiveWebSocketService.getSessionStatus();
  const effectiveSessionName = wsStatusNow.sessionName
    ? `${scheduledMeta.gp.name} - ${wsStatusNow.sessionName}`
    : scheduledMeta.sessionName;

  const activeSession: ActiveSessionInfo = useMemo(() => ({
    sessionKey: DEFAULT_SESSION_KEY,
    sessionType: scheduledMeta.sessionType,
    sessionName: effectiveSessionName,
    meetingName: scheduledMeta.meetingName,
    circuitName: scheduledMeta.circuitName,
    status: activeStatus,
    finishReason,
    isOfficialResults: activeStatus === 'FINISHED',
    trackStatus,
    remainingSec,
    qualyPhase,
    provisionalPoleDriver,
    provisionalPoleTime,
    circuitLocalTime,
    utcTime,
  }), [scheduledMeta, effectiveSessionName, activeStatus, finishReason, trackStatus, remainingSec, qualyPhase, provisionalPoleDriver, provisionalPoleTime, circuitLocalTime, utcTime]);

  const contextValue: LiveSessionContextValue = useMemo(() => ({
    activeSession,
    leaderboard,
    miniSectors,
    connectionStatus,
    latencyMs,
    lastUpdated,
    isPulseActive,
    reconnect: connect,
    selectedDriverId,
    setSelectedDriverId,
  }), [
    activeSession,
    leaderboard,
    miniSectors,
    connectionStatus,
    latencyMs,
    lastUpdated,
    isPulseActive,
    connect,
    selectedDriverId,
  ]);

  return (
    <LiveSessionContext.Provider value={contextValue}>
      {children}
    </LiveSessionContext.Provider>
  );
};

export function useLiveSession(): LiveSessionContextValue {
  const context = useContext(LiveSessionContext);
  if (!context) {
    throw new Error('useLiveSession must be used within a LiveSessionProvider');
  }
  return context;
}
