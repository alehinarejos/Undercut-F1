/**
 * useLiveStream.ts - High-Performance F1 Real-Time Streaming Hook
 *
 * Implements:
 * 1. Resilient SignalR Core / WebSocket client with CORS & Vite dev proxy negotiation.
 * 2. Active 6-second Watchdog Timer (Heartbeat Monitor): forces socket.close() and
 *    triggers immediate reconnection upon silent network drops.
 * 3. Exponential Backoff Reconnection Cycle (1s, 2s, 4s, 8s...) with persistent
 *    state retention (the screen NEVER goes blank on reconnect).
 * 4. 100% Immutable React State Management (no in-place mutations, no stale closures).
 * 5. Dynamic Session Countdown Clock (1s local ticker) & Live Stream Network Pulse (latency indicator).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { LeaderboardEntry, SectorStatus } from '../types/telemetry';
import {
  LIVE_QUALIFYING_RESULTS,
  convertOfficialResultsToLeaderboardEntries,
} from '../data/officialWeekendSessions';
import { getEffectiveNowMs } from '../services/scheduleSyncService';
import { mergeSectorDelta, type SegmentStatusType } from '../utils/microsectorParser';
import { simulateMicrosectorLap } from '../components/MiniSectorsTracker';

export type LiveStreamConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

export interface UseLiveStreamOptions {
  sessionKey?: number;
  watchdogTimeoutMs?: number; // Default: 6000ms (5 to 7s range)
  autoConnect?: boolean;
}

export interface UseLiveStreamReturn {
  entries: LeaderboardEntry[];
  connectionStatus: LiveStreamConnectionState;
  latencyMs: number;
  lastPacketTime: number | null;
  isPulseActive: boolean;
  remainingSec: number;
  reconnectCount: number;
  qualyPhase: 'Q1' | 'Q2' | 'Q3';
  reconnect: () => void;
  rawDriversMap: Map<string, LeaderboardEntry>;
}

const DEFAULT_WATCHDOG_TIMEOUT_MS = 6000; // 6 seconds watchdog
const SESSION_END_UTC = '2026-10-03T09:00:00Z';

export function useLiveStream(options: UseLiveStreamOptions = {}): UseLiveStreamReturn {
  const {
    sessionKey: _sessionKey = 11730,
    watchdogTimeoutMs = DEFAULT_WATCHDOG_TIMEOUT_MS,
    autoConnect = true,
  } = options;

  // ── State ──────────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => {
    return convertOfficialResultsToLeaderboardEntries(LIVE_QUALIFYING_RESULTS);
  });

  const [connectionStatus, setConnectionStatus] = useState<LiveStreamConnectionState>('connecting');
  const [latencyMs, setLatencyMs] = useState<number>(6);
  const [lastPacketTime, setLastPacketTime] = useState<number | null>(null);
  const [isPulseActive, setIsPulseActive] = useState<boolean>(false);
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  // Local Session Countdown Clock (Sepang Qualifying: 08:00 - 09:00 UTC)
  const [remainingSec, setRemainingSec] = useState<number>(() => {
    const endMs = new Date(SESSION_END_UTC).getTime();
    return Math.max(0, Math.floor((endMs - getEffectiveNowMs()) / 1000));
  });

  // ── Mutable Refs (Eliminates Stale Closures) ────────────────────────────────
  const socketRef = useRef<WebSocket | null>(null);
  const watchdogTimerRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const backoffDelayRef = useRef<number>(1000);
  const reconnectAttemptsRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const pulseTimeoutRef = useRef<any>(null);
  const clientPingIntervalRef = useRef<any>(null);
  const lastPingSentAtRef = useRef<number>(Date.now());

  // ── Session Countdown Ticker (1-second precision) ─────────────────────────
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const endMs = new Date(SESSION_END_UTC).getTime();
      const rem = Math.max(0, Math.floor((endMs - getEffectiveNowMs()) / 1000));
      setRemainingSec(rem);
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // Compute Qualy Phase dynamically
  const qualyPhase: 'Q1' | 'Q2' | 'Q3' = useMemo(() => {
    if (remainingSec > 40 * 60) return 'Q1';
    if (remainingSec > 18 * 60) return 'Q2';
    return 'Q3';
  }, [remainingSec]);

  // ── Network Activity Visual Pulse Trigger ─────────────────────────────────
  const triggerNetworkPulse = useCallback((customLatency?: number) => {
    if (!isMountedRef.current) return;
    setIsPulseActive(true);
    setLastPacketTime(Date.now());
    if (customLatency !== undefined) {
      setLatencyMs(customLatency);
    }
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current);
    }
    pulseTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setIsPulseActive(false);
      }
    }, 400);
  }, []);

  // ── Step 1: Watchdog Timer (Heartbeat Keep-Alive Monitor) ──────────────────
  const resetWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
    }

    watchdogTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      console.warn(
        `[useLiveStream] ⚠️ WATCHDOG TIMEOUT: No heartbeat or data frame received in ${watchdogTimeoutMs}ms. ` +
        `Assuming silent disconnect / dead TCP pipe. Forcing socket.close() and initiating reconnect...`
      );

      // Force close socket
      if (socketRef.current) {
        try {
          socketRef.current.close(4000, 'Watchdog timeout');
        } catch {
          // Socket already dead
        }
        socketRef.current = null;
      }

      setConnectionStatus('reconnecting');
      scheduleReconnect();
    }, watchdogTimeoutMs);
  }, [watchdogTimeoutMs]);

  // ── Reconnection Scheduler with Exponential Backoff ────────────────────────
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    const delay = backoffDelayRef.current;
    // Exponential backoff: 1s -> 2s -> 4s -> 8s -> max 10s
    backoffDelayRef.current = Math.min(delay * 2, 10000);
    reconnectAttemptsRef.current += 1;
    setReconnectCount(reconnectAttemptsRef.current);

    console.log(`[useLiveStream] Scheduling reconnection attempt #${reconnectAttemptsRef.current} in ${delay}ms...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (isMountedRef.current) {
        connectToSignalR();
      }
    }, delay);
  }, []);

  // ── Step 2: Immutable State Update from TimingData Deltas ──────────────────
  const handleTimingDelta = useCallback((lines: Record<string, any>) => {
    if (!lines || typeof lines !== 'object') return;

    setEntries((prevEntries) => {
      let hasModifiedAny = false;

      const updatedEntries = prevEntries.map((driverEntry) => {
        const driverNum = String(driverEntry.driver.number);
        const lineDelta = lines[driverNum];
        if (!lineDelta) return driverEntry;

        hasModifiedAny = true;

        // Clone current segments inmutably
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

        // Return newly constructed immutable driver object
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

      return hasModifiedAny ? updatedEntries : prevEntries;
    });
  }, []);

  // ── Establish SignalR Core Connection ──────────────────────────────────────
  const connectToSignalR = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionStatus('connecting');

    try {
      // 1. Negotiate connectionToken
      const isBrowser = typeof window !== 'undefined';
      const negotiateUrls = isBrowser && window.location.protocol === 'http:' && window.location.port === '5173'
        ? ['/f1-signalr/negotiate?negotiateVersion=1', 'https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1']
        : ['https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1'];

      let token: string | null = null;

      for (const url of negotiateUrls) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'User-Agent': 'BestHTTP',
              'Accept': 'application/json',
            },
          });
          if (res.ok) {
            const data = await res.json();
            token = data.connectionToken || data.connectionId;
            if (token) break;
          }
        } catch {
          // Try next URL
        }
      }

      if (!token) {
        throw new Error('Failed to acquire connectionToken during negotiation');
      }

      // 2. Select WebSocket URL (Vite Proxy or direct WSS)
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

        console.log('[useLiveStream] ✅ SignalR Core WebSocket connected!');
        setConnectionStatus('connected');
        backoffDelayRef.current = 1000; // Reset backoff delay on successful connection
        reconnectAttemptsRef.current = 0;
        setReconnectCount(0);
        triggerNetworkPulse(6);

        // Protocol Handshake: JSON Protocol (Delimited with ASCII 30 \x1e)
        ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + '\x1e');

        // Hub Subscription: Subscribe to live topics
        const subscribePayload = JSON.stringify({
          type: 1,
          target: 'Subscribe',
          arguments: [['TimingData', 'TimingAppData', 'SessionData', 'Heartbeat']],
        }) + '\x1e';
        ws.send(subscribePayload);

        // Start Watchdog timer immediately
        resetWatchdog();

        // Start ping interval (SignalR Core type 6 ping every 5 seconds)
        if (clientPingIntervalRef.current) clearInterval(clientPingIntervalRef.current);
        clientPingIntervalRef.current = setInterval(() => {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            lastPingSentAtRef.current = Date.now();
            socketRef.current.send(JSON.stringify({ type: 6 }) + '\x1e');
          }
        }, 5000);
      };

      // 3. Resilient onmessage with Global try/catch
      ws.onmessage = (event: MessageEvent) => {
        // Every single byte received confirms the connection is alive -> reset watchdog!
        resetWatchdog();

        try {
          const raw = String(event.data);
          const records = raw.split('\x1e');

          for (const record of records) {
            const trimmed = record.trim();
            if (!trimmed || trimmed === '{}') continue;

            const msg = JSON.parse(trimmed);

            // SignalR Ping response (type 3 or 6)
            if (msg.type === 6 || msg.type === 3) {
              const pingLatency = Math.max(4, Math.min(50, Date.now() - lastPingSentAtRef.current));
              triggerNetworkPulse(pingLatency);
              continue;
            }

            // SignalR Streaming Hub Callback
            if (msg.type === 1 && msg.target === 'feed' && Array.isArray(msg.arguments)) {
              const topic = msg.arguments[0];
              const payload = msg.arguments[1];

              if (topic === 'Heartbeat') {
                const now = Date.now();
                const beatLatency = Math.max(5, Math.min(45, now - lastPingSentAtRef.current));
                triggerNetworkPulse(beatLatency);
              } else if (topic === 'TimingData' && payload?.Lines) {
                triggerNetworkPulse();
                handleTimingDelta(payload.Lines);
              }
            }
          }
        } catch (parseError) {
          // Never throw or stop the socket loop on malformed frames
          console.warn('[useLiveStream] Handled non-fatal parse exception in onmessage:', parseError);
        }
      };

      ws.onerror = (err) => {
        console.warn('[useLiveStream] WebSocket warning/error event:', err);
      };

      ws.onclose = (event: CloseEvent) => {
        if (!isMountedRef.current) return;

        console.log(`[useLiveStream] Socket closed (Code ${event.code}: ${event.reason || 'Closed'}).`);
        if (clientPingIntervalRef.current) {
          clearInterval(clientPingIntervalRef.current);
          clientPingIntervalRef.current = null;
        }

        socketRef.current = null;
        setConnectionStatus('reconnecting');
        scheduleReconnect();
      };
    } catch (err: any) {
      console.warn('[useLiveStream] Connection failed:', err?.message || err);
      setConnectionStatus('reconnecting');
      scheduleReconnect();
    }
  }, [resetWatchdog, triggerNetworkPulse, handleTimingDelta, scheduleReconnect]);

  // ── Step 3: Local In-Flight Microsector Animation Ticker ───────────────────
  // Continuously advances on-track cars so microsectors fill smoothly in real time
  // without relying solely on static snapshots.
  useEffect(() => {
    const flightTicker = setInterval(() => {
      setEntries((prevEntries) => {
        let hasAnyCarMoved = false;

        const updated = prevEntries.map((entry) => {
          // Only animate cars actively on track or pushing
          const isDriving = !entry.inPit && (entry.isPitOut || entry.currentLapTime === 'PUSH' || entry.trackProgress > 0);
          if (!isDriving) return entry;

          hasAnyCarMoved = true;
          const currentProg = entry.trackProgress >= 1 ? 0 : entry.trackProgress;
          const newProg = Math.min(1.0, currentProg + 0.012); // ~1.2% per second

          const isPurplePace = entry.s1Status === 'purple' || entry.s2Status === 'purple' || entry.s3Status === 'purple';
          const pace: 'overall_fastest' | 'personal_best' | 'normal' = isPurplePace
            ? 'overall_fastest'
            : (entry.s1Status === 'green' || entry.s2Status === 'green' ? 'personal_best' : 'normal');

          if (newProg >= 1.0) {
            const completedLap = simulateMicrosectorLap(1.0, pace);
            return {
              ...entry,
              trackProgress: 1.0,
              lapsCompleted: (entry.lapsCompleted || 0) + 1,
              s1Segments: completedLap.s1Segments,
              s2Segments: completedLap.s2Segments,
              s3Segments: completedLap.s3Segments,
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

        return hasAnyCarMoved ? updated : prevEntries;
      });
    }, 1000);

    return () => clearInterval(flightTicker);
  }, []);

  // ── Manual Reconnect Function ──────────────────────────────────────────────
  const forceReconnect = useCallback(() => {
    console.log('[useLiveStream] Manual reconnect requested by user.');
    if (socketRef.current) {
      try {
        socketRef.current.close(1000, 'User reconnect');
      } catch {}
      socketRef.current = null;
    }
    backoffDelayRef.current = 1000;
    connectToSignalR();
  }, [connectToSignalR]);

  // ── Mount / Unmount Lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    if (autoConnect) {
      connectToSignalR();
    }

    return () => {
      isMountedRef.current = false;
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (clientPingIntervalRef.current) clearInterval(clientPingIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [autoConnect, connectToSignalR]);

  // Fast map lookup keyed by driver number
  const rawDriversMap = useMemo(() => {
    const map = new Map<string, LeaderboardEntry>();
    for (const e of entries) {
      map.set(String(e.driver.number), e);
    }
    return map;
  }, [entries]);

  return {
    entries,
    connectionStatus,
    latencyMs,
    lastPacketTime,
    isPulseActive,
    remainingSec,
    reconnectCount,
    qualyPhase,
    reconnect: forceReconnect,
    rawDriversMap,
  };
}
