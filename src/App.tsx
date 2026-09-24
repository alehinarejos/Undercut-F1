import React, { useState, useEffect, useRef } from 'react';
import { TelemetryEngine } from './services/telemetryEngine';
import { officialF1Api } from './services/officialF1Api';
import { f1SignalR } from './services/f1SignalRClient';
import { f1LiveWebSocketService } from './services/f1LiveWebSocketService';
import type { SignalRConnectionStatus } from './services/f1SignalRClient';
import type { 
  LeaderboardEntry, 
  CarTelemetry as CarTelemetryType, 
  SessionState, 
  TrackStatus,
  RaceControlMessage, 
  TeamRadio, 
  PitPrediction 
} from './types/telemetry';
import { Header } from './components/Header';
import { Leaderboard } from './components/Leaderboard';
import { BestLapBenchmarks } from './components/BestLapBenchmarks';
import { FastestBySector } from './components/FastestBySector';
import { RaceControl } from './components/RaceControl';
import { ScheduleView } from './components/ScheduleView';
import { HomeDashboardView } from './components/HomeDashboardView';
import { OfficialLeaderboardView } from './components/OfficialLeaderboardView';
import { F1_SCHEDULE } from './data/schedule';
import { scheduleSyncService, getNextUpcomingGrandPrix, getGrandPrixTimeline } from './services/scheduleSyncService';
import { useLanguage } from './context/LanguageContext';
import { 
  getRouteFromPathname, 
  getPathnameForRoute, 
  updateSeoMetadata, 
  type AppRoute 
} from './utils/seoManager';

import './styles/global.css';
import './styles/dashboard.css';
import './styles/leaderboard.css';
import './styles/circuit-map.css';
import './styles/car-telemetry.css';
import './styles/race-control.css';
import './styles/schedule.css';
import './styles/home-layout.css';
import './styles/sidebar-drawer.css';

export const App: React.FC = () => {
  const { t, language } = useLanguage();
  // Telemetry Engine (connected to realistic data stream & official fallback)
  const engineRef = useRef<TelemetryEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new TelemetryEngine('madrid');
  }
  const engine = engineRef.current;

  // Active tab: synchronized with URL pathname for SEO and direct deep links
  const [activeTab, setActiveTabState] = useState<AppRoute>(() => {
    if (typeof window !== 'undefined') {
      return getRouteFromPathname(window.location.pathname);
    }
    return 'home';
  });

  // Navigate function that updates URL without full page reload & updates SEO
  const setActiveTab = (tab: AppRoute) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      const newPath = getPathnameForRoute(tab);
      const search = window.location.search; // preserve ?lang=...
      const targetUrl = search ? `${newPath}${search}` : newPath;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', targetUrl);
      }
      updateSeoMetadata(tab, language);
    }
  };

  // Listen to browser Back/Forward (popstate) navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const route = getRouteFromPathname(window.location.pathname);
      setActiveTabState(route);
      updateSeoMetadata(route, language);
    };

    window.addEventListener('popstate', handlePopState);
    // Initial SEO metadata update on mount
    updateSeoMetadata(activeTab, language);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [language]);

  // Update SEO metadata whenever active tab or language changes
  useEffect(() => {
    updateSeoMetadata(activeTab, language);
  }, [activeTab, language]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => engine.getLeaderboard());
  const [session, setSession] = useState<SessionState>(() => {
    const base = engine.getSession();
    if (typeof window !== 'undefined') {
      try {
        const savedFinished = localStorage.getItem('f1_session_finished_at_ms');
        if (savedFinished) {
          const parsed = Number(savedFinished);
          if (!isNaN(parsed) && parsed > 0 && (Date.now() - parsed) < 90 * 60 * 1000) {
            return { ...base, finishedAtMs: parsed };
          } else {
            localStorage.removeItem('f1_session_finished_at_ms');
          }
        }
      } catch {}
    }
    return base;
  });
  const [selectedDriverId, setSelectedDriverId] = useState<string>(() => engine.getSelectedDriverId());
  const [, setTelemetry] = useState<CarTelemetryType | null>(() => engine.getSelectedTelemetry());
  const [, setPitPrediction] = useState<PitPrediction | null>(() => engine.calculatePitPrediction('ant'));
  const [raceControlMessages, setRaceControlMessages] = useState<RaceControlMessage[]>(() => engine.getRaceControlMessages());
  const [teamRadios, setTeamRadios] = useState<TeamRadio[]>(() => engine.getTeamRadios());

  // Live connection state
  const [signalRStatus, setSignalRStatus] = useState<SignalRConnectionStatus>('connecting');
  const [signalRDetails, setSignalRDetails] = useState<string>('Conectado');

  // Official live status
  const [isOfficialLive, setIsOfficialLive] = useState<boolean>(false);
  const [, setOfficialStatusMessage] = useState<string>('Conectado a los datos oficiales de Fórmula 1');

  // Synchronize right panel height exactly with the leaderboard table
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [leftPanelHeight, setLeftPanelHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!leftPanelRef.current) return;
    const updateHeight = () => {
      if (leftPanelRef.current) {
        const h = leftPanelRef.current.offsetHeight;
        if (h > 0) {
          setLeftPanelHeight(h);
        }
      }
    };

    updateHeight();
    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(leftPanelRef.current);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [activeTab, leaderboard.length]);

  // ===== REAL-TIME SESSION DETECTION FROM OFFICIAL SCHEDULE + LIVE TIMING =====
  // Returns the currently active session (if any) or null based on real UTC clock and live stream status
  const getCurrentScheduledSession = () => {
    const wsStatus = f1LiveWebSocketService.getSessionStatus();
    const now = new Date();
    const nowMs = now.getTime();
    const liveSchedule = scheduleSyncService.getState().schedule || F1_SCHEDULE;
    for (const gp of liveSchedule) {
      for (const sess of gp.sessions) {
        const start = new Date(sess.startTimeUtc);
        const durMin = sess.type === 'Race' ? 120 : sess.type === 'Sprint' ? 45 : 60;
        const end = sess.endTimeUtc
          ? new Date(sess.endTimeUtc)
          : new Date(start.getTime() + durMin * 60 * 1000);

        // Skip sessions that haven't started or are genuinely past their end time
        if (nowMs < start.getTime() || nowMs >= end.getTime()) continue;

        // At this point the current time is inside the session's UTC window.
        // Ignore the 'completed' flag — it may have been set erroneously by stale WebSocket data.

        // Only treat as finished if wsStatus.isFinished is for THIS same session
        const wsName = (wsStatus.sessionName || '').toLowerCase();
        const schedName = (sess.name || '').toLowerCase();
        const schedType = (sess.type || '').toLowerCase();
        const isSameWsSession = Boolean(
          wsName && (schedName.includes(wsName) || wsName.includes(schedType) || (wsName.includes('practice 1') && schedType === 'fp1') || (wsName.includes('practice 2') && schedType === 'fp2') || (wsName.includes('practice 3') && schedType === 'fp3'))
        );
        if (isSameWsSession && (wsStatus.isFinished || wsStatus.isChequered)) {
          return null;
        }

        const scheduleRemainingSec = Math.max(0, (end.getTime() - nowMs) / 1000);
        const remainingSec = (isSameWsSession && wsStatus.remainingSec !== undefined && wsStatus.remainingSec > 0)
          ? wsStatus.remainingSec
          : scheduleRemainingSec;
        return { gp, sess, start, end, durSec: durMin * 60, remainingSec };
      }
    }
    return null;
  };

  // Track which session we detected as active to know when it changes
  const activeSessionKeyRef = useRef<string | null>(null);
  // Track if we've already loaded real data for the last completed session
  const loadedSessionKeyRef = useRef<number | null>(null);

  // Load real timing data from OpenF1 for a completed session
  const loadRealSessionData = async (sessionKey: number, _meetingKey?: number) => {
    if (loadedSessionKeyRef.current === sessionKey) return; // already loaded
    loadedSessionKeyRef.current = sessionKey;
    console.info(`[OpenF1] Loading real data for session_key=${sessionKey}`);
    try {
      const results = await officialF1Api.getSessionBestLaps(sessionKey);
      if (results && results.length > 0) {
        engine.ingestRealSessionResults(results);
        console.info(`[OpenF1] ✅ Loaded ${results.length} drivers real timing data`);
      } else {
        console.warn('[OpenF1] No real data available yet for this session');
      }
    } catch (e) {
      console.warn('[OpenF1] Failed to load real session data:', e);
    }
  };

  // On mount: find the most recently completed or active session and load its real data
  useEffect(() => {
    const loadLastSession = async () => {
      try {
        const latest = await officialF1Api.checkLiveStatus();
        const targetSession = latest.activeSession || latest.latestCompletedSession;
        if (targetSession?.session_key) {
          await loadRealSessionData(targetSession.session_key, targetSession.meeting_key);
        }
      } catch (e) {
        console.warn('[OpenF1] Could not load latest session:', e);
      }
    };

    loadLastSession();
  }, [engine]);

  // Poll every 5 seconds to detect session changes from the schedule and live stream
  useEffect(() => {
    const detectSession = () => {
      const active = getCurrentScheduledSession();
      const wsStatus = f1LiveWebSocketService.getSessionStatus();
      const isWsLive = wsStatus.sessionStatus === 'Started' && !wsStatus.isFinished && !wsStatus.isChequered;
      const isSignalRLive = f1SignalR.getStatus() === 'live_streaming' && !wsStatus.isFinished && !wsStatus.isChequered;

      if (active) {
        const key = `${active.gp.circuitId}-${active.sess.type}-${active.sess.startTimeUtc}`;
        const isNewSession = activeSessionKeyRef.current !== key;
        const engineType: SessionState['type'] =
          active.sess.type === 'Race' ? 'RACE' :
          active.sess.type === 'Sprint' ? 'SPRINT' :
          (active.sess.type === 'Qualifying' || active.sess.type === 'Sprint Qualifying') ? 'QUALIFYING' : 'PRACTICE';

        const liveRemainingSec = Math.max(0, Math.round(active.remainingSec));

        if (isNewSession) {
          activeSessionKeyRef.current = key;
          engine.setCircuit(active.gp.circuitId);

          // Sync WebSocket & Engine session caches (preserving active WS TimingData if already streaming this session)
          f1LiveWebSocketService.resetForNewSession(
            key,
            `${active.gp.name} - ${active.sess.name}`,
            active.sess.type,
            liveRemainingSec
          );

          engine.resetForNewSession(
            `${active.gp.name} - ${active.sess.name}`,
            engineType,
            liveRemainingSec,
            key
          );

          const wsLiveEntries = f1LiveWebSocketService.getInitialLeaderboard();
          if (wsLiveEntries && wsLiveEntries.length > 0) {
            engine.ingestOfficialLiveEntries(wsLiveEntries);
          } else {
            f1LiveWebSocketService.requestFullState();
          }

          loadedSessionKeyRef.current = null;
          officialF1Api.checkLiveStatus().then(latest => {
            const targetSession = latest.activeSession || latest.latestCompletedSession;
            if (targetSession?.session_key) {
              loadRealSessionData(targetSession.session_key, targetSession.meeting_key);
            }
          }).catch(() => {});

          setLeaderboard(engine.getLeaderboard());
          setSession(engine.getSession());
          console.info(`[SessionManager] New session detected: ${active.sess.name} at ${active.gp.name}. Remaining: ${liveRemainingSec}s`);
        } else {
          engine.updateLiveSessionState({
            name: `${active.gp.name} - ${active.sess.name}`,
            type: engineType,
            timeRemainingSec: liveRemainingSec,
            totalLaps: (engineType === 'RACE' || engineType === 'SPRINT') ? undefined : 0,
          });
          setSession(prev => ({
            ...prev,
            name: `${active.gp.name} - ${active.sess.name}`,
            type: engineType,
            timeRemainingSec: liveRemainingSec,
            trackStatus: prev.trackStatus === 'CHEQUERED' ? 'GREEN' : prev.trackStatus,
            totalLaps: (engineType === 'RACE' || engineType === 'SPRINT') ? prev.totalLaps : 0,
            finishedAtMs: undefined,
          }));
        }
        setIsOfficialLive(true);
        engine.setSessionEnded(false);
      } else if (isWsLive || isSignalRLive) {
        setIsOfficialLive(true);
        engine.setSessionEnded(false);
        if (wsStatus.remainingSec !== undefined && wsStatus.remainingSec > 0) {
          const rem = Math.max(0, Math.round(wsStatus.remainingSec));
          engine.updateLiveSessionState({
            timeRemainingSec: rem,
          });
          setSession(prev => ({
            ...prev,
            timeRemainingSec: rem,
            trackStatus: prev.trackStatus === 'CHEQUERED' ? 'GREEN' : prev.trackStatus,
          }));
        }
      } else {
        // No official session live right now — check if a session finished recently (< 90 min ago)
        const upcomingGp = getNextUpcomingGrandPrix(scheduleSyncService.getState().schedule);
        const timeline = getGrandPrixTimeline(upcomingGp);
        const lastComp = timeline.lastCompletedSession;
        const nowMs = Date.now();
        const isRecentlyFinished =
          wsStatus.isFinished ||
          wsStatus.isChequered ||
          (lastComp != null && !isNaN(lastComp.endTime) && (nowMs - lastComp.endTime) >= 0 && (nowMs - lastComp.endTime) < 90 * 60 * 1000);

        if (activeSessionKeyRef.current !== null) {
          activeSessionKeyRef.current = null;
          engine.setSessionEnded(true);
        }
        setIsOfficialLive(false);

        if (isRecentlyFinished) {
          const finishedAt = lastComp?.endTime || nowMs;
          const sessName = lastComp ? `${upcomingGp.name} - ${lastComp.session.name}` : undefined;
          engine.setSessionEnded(true);
          engine.updateLiveSessionState({
            name: sessName,
            timeRemainingSec: 0,
            trackStatus: 'CHEQUERED',
            finishedAtMs: finishedAt,
          });
          setSession(prev => ({
            ...prev,
            name: sessName || prev.name,
            timeRemainingSec: 0,
            trackStatus: 'CHEQUERED',
            finishedAtMs: finishedAt,
          }));
        } else if (!engine.isEngineRunning()) {
          engine.start();
        }
      }
    };

    detectSession(); // run immediately on mount
    const interval = setInterval(detectSession, 1000); // tick every 1s for real-time countdown & live session sync
    return () => clearInterval(interval);
  }, [engine]);

  // Synchronize live mode with engine
  useEffect(() => {
    engine.setLiveMode(isOfficialLive);
  }, [isOfficialLive, engine]);

  // Connect to official F1 SignalR feed on mount
  useEffect(() => {
    f1SignalR.setListeners({
      onStatusChange: (status, details) => {
        setSignalRStatus(status);
        if (details) setSignalRDetails(details);
        if (status === 'live_streaming') {
          setIsOfficialLive(true);
        }
      },
      onTrackStatus: (trackStatus) => {
        const mappedTrack: TrackStatus = trackStatus.status === '1' ? 'GREEN' : trackStatus.status === '2' ? 'YELLOW' : 'GREEN';
        engine.updateLiveSessionState({
          trackStatus: mappedTrack,
          safetyCarDeployed: trackStatus.status === '4',
          vscDeployed: trackStatus.status === '6',
        });
        setSession(prev => ({
          ...prev,
          trackStatus: mappedTrack,
          safetyCarDeployed: trackStatus.status === '4',
          vscDeployed: trackStatus.status === '6',
        }));
      },
      onWeatherData: (weather) => {
        engine.updateLiveSessionState({
          airTemp: weather.airTemp,
          trackTemp: weather.trackTemp,
          humidity: weather.humidity,
          windSpeed: weather.windSpeed,
          rainProbability: weather.rainfall ? 95 : 0,
        });
        setSession(prev => ({
          ...prev,
          airTemp: weather.airTemp,
          trackTemp: weather.trackTemp,
          humidity: weather.humidity,
          windSpeed: weather.windSpeed,
          rainProbability: weather.rainfall ? 95 : 0,
        }));
      },
      onTimingData: (timingData) => {
        if (timingData) {
          engine.ingestSignalRTimingData(timingData);
        }
      },
      onSessionInfo: (sessionInfo) => {
        if (sessionInfo && typeof sessionInfo === 'object') {
          const rawName = String(sessionInfo.Name || '');
          const rawType = String(sessionInfo.Type || '');
          const isQualy = rawType.toLowerCase().includes('qual') || rawName.toLowerCase().includes('qual');
          const sessType: SessionState['type'] = isQualy
            ? 'QUALIFYING'
            : rawType.toLowerCase().includes('race')
            ? 'RACE'
            : rawType.toLowerCase().includes('sprint')
            ? 'SPRINT'
            : 'PRACTICE';
          engine.updateLiveSessionState({
            name: rawName || undefined,
            type: sessType,
            totalLaps: (sessType === 'PRACTICE' || sessType === 'QUALIFYING') ? 0 : undefined,
          });
        }
      },
      onRaceControl: (rawMsg) => {
        if (!rawMsg) return;
        const rawText = typeof rawMsg === 'string' ? rawMsg : rawMsg.Message || rawMsg.messageEn || JSON.stringify(rawMsg);
        const flagStr = String(rawMsg.Flag || rawMsg.flag || '').toUpperCase();
        let flag: RaceControlMessage['flag'] = 'GREEN';
        if (flagStr.includes('DOUBLE') || rawText.toUpperCase().includes('DOUBLE YELLOW')) {
          flag = 'DOUBLE_YELLOW';
        } else if (flagStr.includes('YELLOW') || rawText.toUpperCase().includes('YELLOW')) {
          flag = 'YELLOW';
        } else if (flagStr.includes('RED') || rawText.toUpperCase().includes('RED')) {
          flag = 'RED';
        } else if (flagStr.includes('CHEQUERED') || rawText.toUpperCase().includes('CHEQUERED')) {
          flag = 'CHEQUERED';
        }

        let category: RaceControlMessage['category'] = 'FLAG';
        const upper = rawText.toUpperCase();
        if (upper.includes('SAFETY CAR')) category = 'SAFETY_CAR';
        else if (upper.includes('DELETED') || upper.includes('TRACK LIMITS')) category = 'INCIDENT';
        else if (upper.includes('PIT')) category = 'PIT_LANE';
        else if (upper.includes('RAIN') || upper.includes('WEATHER')) category = 'WEATHER';

        const timeStr = rawMsg.Utc 
          ? new Date(rawMsg.Utc).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const newMsg: RaceControlMessage = {
          id: `rc-sig-${rawMsg.Utc || Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: timeStr,
          flag,
          scope: rawMsg.Scope || 'Track',
          sector: rawMsg.Sector ? Number(rawMsg.Sector) : undefined,
          driverNumber: rawMsg.RacingNumber ? Number(rawMsg.RacingNumber) : undefined,
          messageEn: rawText,
          messageEs: rawMsg.messageEs || rawText,
          category,
        };

        if (flag === 'RED' || flag === 'YELLOW' || flag === 'CHEQUERED' || flag === 'GREEN') {
          engine.updateLiveSessionState({
            trackStatus: flag,
            safetyCarDeployed: category === 'SAFETY_CAR',
          });
          setSession(prev => ({
            ...prev,
            trackStatus: flag,
            safetyCarDeployed: category === 'SAFETY_CAR',
          }));
        }

        setRaceControlMessages(prev => [newMsg, ...prev.filter(m => m.id !== newMsg.id)]);
      },
      onClock: (clockData) => {
        if (clockData && typeof clockData === 'object') {
          const remaining = clockData.Remaining;
          const isExtrapolating = clockData.Extrapolating !== false;
          if (remaining && typeof remaining === 'string') {
            const parts = remaining.split(':').map(Number);
            let baseSec = 0;
            if (parts.length === 3) baseSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
            else if (parts.length === 2) baseSec = parts[0] * 60 + parts[1];

            let sec = baseSec;
            if (isExtrapolating && clockData.Utc) {
              const clockUtcMs = new Date(clockData.Utc).getTime();
              if (!isNaN(clockUtcMs)) {
                const elapsedSec = Math.max(0, (Date.now() - clockUtcMs) / 1000);
                sec = Math.max(0, Math.round(baseSec - elapsedSec));
              }
            }

            if (sec > 0) {
              engine.updateLiveSessionState({
                timeRemainingSec: sec,
              });
            }
            setSession(prev => ({
              ...prev,
              timeRemainingSec: sec > 0 ? sec : prev.timeRemainingSec,
              trackStatus: !isExtrapolating && prev.trackStatus !== 'CHEQUERED' ? 'RED' : prev.trackStatus,
            }));
          }
        }
      },
    });

    // Start connection to livetiming.formula1.com/signalrcore
    f1SignalR.connect();

    return () => {
      f1SignalR.disconnect();
    };
  }, [engine]);

  // Fetch status message from official API (but DON'T override isOfficialLive — handled by schedule detector above)
  const checkStatus = async () => {
    f1SignalR.connect();
    try {
      const status = await officialF1Api.checkLiveStatus();
      setOfficialStatusMessage(status.statusMessage);
      // Only override with API data if SignalR says we're live_streaming (real live feed connected)
      if (signalRStatus === 'live_streaming') {
        setIsOfficialLive(true);
      }
    } catch {
      // ignore fetch errors
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60000); // less aggressive: every 60s
    return () => clearInterval(interval);
  }, []);


  // Live WebSocket synchronization with official F1 telemetry stream
  useEffect(() => {
    f1LiveWebSocketService.startConnection();

    const unsubscribeStatus = f1LiveWebSocketService.subscribeSessionStatus((status) => {
      const isFinished = status.isFinished || status.isChequered;
      const isLiveOnTrack = status.sessionStatus === 'Started' && !isFinished;

      // If the UTC schedule says a session is live right now, NEVER let stale WebSocket
      // 'isFinished' signals (e.g. from cached FP1 data) override it.
      const scheduledActive = getCurrentScheduledSession();
      if (isFinished && scheduledActive) {
        // Session is currently live per schedule — ignore this stale finish signal
        return;
      }

      if (isFinished) {
        setIsOfficialLive(false);
        setSignalRStatus('connected');
        setSignalRDetails('Sesión finalizada');
        engine.setSessionEnded(true);
        const parsedFinishedTime = status.finishedUtc ? new Date(status.finishedUtc).getTime() : undefined;
        const now = Date.now();
        const finishedAtMs = (parsedFinishedTime && !isNaN(parsedFinishedTime)) ? parsedFinishedTime : now;
        const isRecent = (now - finishedAtMs) < 90 * 60 * 1000;

        engine.updateLiveSessionState({
          trackStatus: isRecent ? 'CHEQUERED' : 'GREEN',
          timeRemainingSec: 0,
          finishedAtMs: isRecent ? finishedAtMs : undefined,
        });

        setSession(prev => {
          if (isRecent) {
            try {
              if (typeof window !== 'undefined') {
                localStorage.setItem('f1_session_finished_at_ms', String(finishedAtMs));
              }
            } catch {}
          }
          return {
            ...prev,
            trackStatus: isRecent ? 'CHEQUERED' : 'GREEN',
            timeRemainingSec: 0,
            finishedAtMs: isRecent ? finishedAtMs : undefined,
          };
        });
      } else if (isLiveOnTrack) {
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('f1_session_finished_at_ms');
          }
        } catch {}
        setIsOfficialLive(true);
        setSignalRStatus('live_streaming');
        setSignalRDetails('Conectado a F1 Live Timing (Directo)');
        engine.setSessionEnded(false);
        const isQualy = status.sessionType?.toLowerCase().includes('qual') || status.sessionName?.toLowerCase().includes('qual');
        const sessType: SessionState['type'] = isQualy
          ? 'QUALIFYING'
          : status.sessionType?.toLowerCase().includes('race')
          ? 'RACE'
          : status.sessionType?.toLowerCase().includes('sprint')
          ? 'SPRINT'
          : 'PRACTICE';

        const activeSched = getCurrentScheduledSession();
        const resolvedRemainingSec = (status.remainingSec !== undefined && status.remainingSec > 0)
          ? status.remainingSec
          : (activeSched?.remainingSec || undefined);

        engine.updateLiveSessionState({
          name: status.sessionName || undefined,
          type: status.sessionType ? sessType : undefined,
          trackStatus: status.safetyCar ? 'SC' : status.vsc ? 'VSC' : 'GREEN',
          safetyCarDeployed: !!status.safetyCar,
          vscDeployed: !!status.vsc,
          timeRemainingSec: resolvedRemainingSec,
          totalLaps: (sessType === 'PRACTICE' || sessType === 'QUALIFYING') ? 0 : undefined,
        });

        setSession(prev => ({
          ...prev,
          name: status.sessionName || prev.name,
          type: status.sessionType ? sessType : prev.type,
          trackStatus: status.safetyCar ? 'SC' : status.vsc ? 'VSC' : 'GREEN',
          safetyCarDeployed: !!status.safetyCar,
          vscDeployed: !!status.vsc,
          timeRemainingSec: resolvedRemainingSec !== undefined ? resolvedRemainingSec : prev.timeRemainingSec,
          totalLaps: (sessType === 'PRACTICE' || sessType === 'QUALIFYING') ? 0 : prev.totalLaps,
        }));
      }
    });

    const unsubscribeEntries = f1LiveWebSocketService.subscribe((liveEntries) => {
      if (liveEntries && liveEntries.length > 0) {
        engine.ingestOfficialLiveEntries(liveEntries);
        const currentStatus = f1LiveWebSocketService.getSessionStatus();
        const isFinished = currentStatus.isFinished || currentStatus.isChequered || currentStatus.remaining === '00:00:00';
        if (!isFinished && currentStatus.sessionStatus === 'Started') {
          setIsOfficialLive(true);
          setSignalRStatus('live_streaming');
          setSignalRDetails('Conectado a F1 Live Timing (Directo)');
        }
      }
    });

    const unsubscribeRaceControl = f1LiveWebSocketService.subscribeRaceControl((liveMsg) => {
      const mappedStatus: TrackStatus | null =
        liveMsg.flag === 'RED' ? 'RED' :
        liveMsg.flag === 'YELLOW' || liveMsg.flag === 'DOUBLE_YELLOW' ? 'YELLOW' :
        liveMsg.flag === 'CHEQUERED' ? 'CHEQUERED' :
        liveMsg.flag === 'GREEN' ? 'GREEN' : null;

      if (mappedStatus) {
        setSession(prev => ({
          ...prev,
          trackStatus: mappedStatus,
          safetyCarDeployed: liveMsg.category === 'SAFETY_CAR',
        }));
      }
      setRaceControlMessages(prev => [liveMsg, ...prev.filter(m => m.id !== liveMsg.id)]);
    });

    const unsubscribeCarData = f1LiveWebSocketService.subscribeCarData((carDataMap) => {
      engine.ingestLiveCarData(carDataMap);
    });

    return () => {
      f1LiveWebSocketService.stopConnection();
      unsubscribeStatus();
      unsubscribeEntries();
      unsubscribeRaceControl();
      unsubscribeCarData();
    };
  }, [engine]);

  // Connect listeners and start engine for real telemetry feed
  useEffect(() => {
    engine.setListeners({
      onTick: (data) => {
        setLeaderboard(data.leaderboard);
        setSession(data.session);
        setTelemetry(data.selectedDriverTelemetry);
        setPitPrediction(data.pitPrediction);
      },
      onRaceControlMessage: (msg) => {
        const mappedStatus: TrackStatus | null =
          msg.flag === 'RED' ? 'RED' :
          msg.flag === 'YELLOW' || msg.flag === 'DOUBLE_YELLOW' ? 'YELLOW' :
          msg.flag === 'CHEQUERED' ? 'CHEQUERED' :
          msg.flag === 'GREEN' ? 'GREEN' : null;

        if (mappedStatus) {
          setSession(prev => ({
            ...prev,
            trackStatus: mappedStatus,
            safetyCarDeployed: msg.category === 'SAFETY_CAR',
          }));
        }
        setRaceControlMessages(prev => [msg, ...prev.filter(m => m.id !== msg.id)]);
      },
      onTeamRadio: (radio) => {
        setTeamRadios(prev => [radio, ...prev]);
      },
    });

    // Initial state emit
    engine.emitCurrentState();

    return () => {
      engine.stop();
    };
  }, [engine]);

  const handleSelectDriver = (driverId: string) => {
    setSelectedDriverId(driverId);
    engine.setSelectedDriver(driverId);
  };

  return (
    <div className="app-container">
      {/* Top Header Navigation (With F1 SignalR status, zero fake controls) */}
      <Header
        session={session}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOfficialLive={isOfficialLive}
        signalRStatus={signalRStatus}
        signalRDetails={signalRDetails}
        onRefreshLive={checkStatus}
        trackStatus={session.trackStatus || 'GREEN'}
        raceControlMessages={raceControlMessages}
      />

      {/* Main View Area */}
      <main className="main-content">
        <div key={activeTab} className="tab-page-transition">
          {/* TAB: Home Formula 1 Dashboard (Replicating formula1dashboard.com) */}
          {activeTab === 'home' && (
            <HomeDashboardView
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {/* TAB: Full Live Timing & Telemetry Dashboard */}
          {activeTab === 'timing' && (
            <>
              {/* Telemetry Layout Grid: 80% Tabla de tiempos (Leaderboard) / 20% Barra Lateral */}
              <div className="telemetry-layout-grid">
                {/* Panel Izquierdo: Tabla de Tiempos (Full Height, 80% Ancho) */}
                <div className="telemetry-left-panel" ref={leftPanelRef}>
                  {(() => {
                    const liveActive = getCurrentScheduledSession();
                    const effectiveSessionName = liveActive
                      ? `${liveActive.gp.name} - ${liveActive.sess.name}`
                      : session.name;
                    const effectiveRemainingSec = liveActive
                      ? Math.max(0, Math.round(liveActive.remainingSec))
                      : session.timeRemainingSec;
                    const effectiveTrackStatus = liveActive && session.trackStatus === 'CHEQUERED'
                      ? 'GREEN'
                      : session.trackStatus;
                    return (
                      <Leaderboard
                        entries={leaderboard}
                        selectedDriverId={selectedDriverId}
                        onSelectDriver={handleSelectDriver}
                        isQualifying={session.type === 'QUALIFYING'}
                        sessionType={session.type}
                        sessionName={effectiveSessionName}
                        timeRemainingSec={effectiveRemainingSec}
                        totalLaps={session.totalLaps}
                        trackStatus={effectiveTrackStatus}
                      />
                    );
                  })()}
                </div>

                {/* Columna Derecha: Benchmarks + Control de Carrera / Radios + Más Rápido por Sector */}
                <div 
                  className="telemetry-right-panel"
                  style={{
                    height: leftPanelHeight ? `${leftPanelHeight}px` : '100%',
                    maxHeight: leftPanelHeight ? `${leftPanelHeight}px` : undefined,
                  }}
                >
                  {/* 1. Best Lap Benchmarks (Session Best, Weekend Best, Circuit Record) */}
                  <BestLapBenchmarks
                    entries={leaderboard}
                    sessionName={session.name || 'Practice 3'}
                    circuitName={session.circuit.name}
                    circuit={session.circuit}
                  />

                  {/* 2. Control de Carrera y Radios de Equipo (flex: 1 con scroll interno en los mensajes) */}
                  <div className="telemetry-rc-section" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <RaceControl
                      messages={raceControlMessages}
                      radios={teamRadios}
                    />
                  </div>

                  {/* 3. Más Rápido por Sector (Sustituye al velocímetro) */}
                  <FastestBySector entries={leaderboard} />
                </div>
              </div>
            </>
          )}

          {/* TAB: Official Leaderboard (World Drivers & Constructors Championship) */}
          {activeTab === 'leaderboard' && (
            <OfficialLeaderboardView />
          )}

          {/* TAB: Official 24-GP Calendar Schedule */}
          {activeTab === 'schedule' && (
            <ScheduleView />
          )}
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer style={{
        marginTop: 'auto',
        padding: '24px 20px',
        borderTop: '1px solid var(--f1-border)',
        background: 'rgba(8, 10, 15, 0.95)',
        textAlign: 'center',
        fontSize: '0.72rem',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)'
      }}>
        <p style={{ maxWidth: '820px', margin: '0 auto 8px auto', lineHeight: 1.5 }}>
          {t('footer_text')}
        </p>
        <p style={{ color: 'var(--text-secondary)' }}>
          {t('footer_subtext')}
        </p>
      </footer>
    </div>
  );
};

export default App;
