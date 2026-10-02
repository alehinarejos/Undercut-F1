import { DRIVERS } from '../data/drivers';
import { F1_SCHEDULE } from '../data/schedule';
import type { LeaderboardEntry, SessionState } from '../types/telemetry';
import { scheduleSyncService, getEffectiveNowMs } from './scheduleSyncService';
import { sessionArchiveService } from './sessionArchiveService';

export interface ActiveSessionContext {
  sessionKey: string;
  sessionName: string;
  sessionType: SessionState['type'];
  circuitId: string;
  circuitName: string;
  isLive: boolean;
  remainingSec: number;
  durationSec: number;
  startTimeUtc: string;
  endTimeUtc: string;
}

export interface SessionLifecycleState {
  activeSession: ActiveSessionContext | null;
  previousSessionKey: string | null;
  currentSessionKey: string | null;
  isLive: boolean;
  lastTransitionAt: string | null;
  isChecking: boolean;
  source: 'CALENDAR_UTC' | 'OPENF1_API' | 'SIGNALR' | 'SIMULATION' | 'SERVER_CRON';
}

export type LifecycleListener = (state: SessionLifecycleState, isTransition: boolean) => void;

const STORAGE_ACTIVE_SESSION_KEY = 'f1_active_session_key_v4';
const STORAGE_LEADERBOARD_KEY = 'f1_official_latest_session_v4';
const STORAGE_SECTORS_KEY = 'f1_session_best_sectors_v4';
const BROADCAST_CHANNEL_NAME = 'f1_session_lifecycle_v1';

/**
 * Builds a pristine, 100% clean zeroed leaderboard for all 22 official drivers.
 * All lap times are '--:--.---', sector times are '--.---', laps = 0, status = IN_PIT.
 * Strictly adheres to 0% synthetic data rule.
 */
export function buildCleanZeroedLeaderboard(): LeaderboardEntry[] {
  return DRIVERS.map((driver, idx) => ({
    position: idx + 1,
    previousPosition: idx + 1,
    driver: {
      id: driver.id,
      code: driver.code,
      number: driver.number,
      firstName: driver.firstName,
      lastName: driver.lastName,
      team: driver.team,
      teamColor: driver.teamColor,
      country: driver.country,
      flag: driver.flag,
    },
    gapToLeader: idx === 0 ? 'LÍDER' : '—',
    gapToAhead: idx === 0 ? 'LEADER' : '—',
    intervalNum: 0,
    currentLapTime: '--:--.---',
    bestLapTime: '--:--.---',
    lastLapTime: '--:--.---',
    lastLapTimeNum: 0,
    s1Time: '--.---',
    s2Time: '--.---',
    s3Time: '--.---',
    s1BestTime: '--.---',
    s2BestTime: '--.---',
    s3BestTime: '--.---',
    s1Status: 'none',
    s2Status: 'none',
    s3Status: 'none',
    s1Segments: [],
    s2Segments: [],
    s3Segments: [],
    tyre: {
      compound: 'MEDIUM',
      age: 0,
      used: false,
    },
    pitStops: 0,
    inPit: true, // all cars in pit garage waiting for green flag
    isPitOut: false,
    isKnockedOut: false,
    isEliminationRisk: false,
    speedTrap: 0,
    trackProgress: 0,
    lapsCompleted: 0,
  }));
}

class SessionLifecycleService {
  private state: SessionLifecycleState = {
    activeSession: null,
    previousSessionKey: null,
    currentSessionKey: null,
    isLive: false,
    lastTransitionAt: null,
    isChecking: false,
    source: 'CALENDAR_UTC',
  };

  private listeners = new Set<LifecycleListener>();
  private checkIntervalId: number | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Read stored session key from storage
    try {
      this.state.currentSessionKey = localStorage.getItem(STORAGE_ACTIVE_SESSION_KEY);
    } catch {}

    // 2. Setup BroadcastChannel for cross-tab realtime sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      } catch (e) {
        console.warn('[SessionLifecycle] BroadcastChannel unavailable:', e);
      }
    }

    // 3. Listen for cross-tab storage changes
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_ACTIVE_SESSION_KEY && event.newValue && event.newValue !== this.state.currentSessionKey) {
        console.info(`[SessionLifecycle] Session key changed in another tab: ${event.newValue}`);
        this.checkSessionTransition(true);
      }
    });

    // 4. Background Wakeup Triggers (Tab focus, visibility change, online status)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.info('[SessionLifecycle] Tab became visible: running autonomous check');
        this.checkSessionTransition(true);
      }
    });

    window.addEventListener('focus', () => {
      this.checkSessionTransition(false);
    });

    window.addEventListener('online', () => {
      this.checkSessionTransition(true);
    });

    // 5. Autonomous Background Polling Loop (every 5 seconds)
    this.checkIntervalId = window.setInterval(() => {
      this.checkSessionTransition(false);
    }, 5000);

    // Initial check
    this.checkSessionTransition(true);

    // Register simulation on window for testing
    (window as any).__sessionLifecycle = this;
    (window as any).__simulateSessionTransition = (fromType: string, toType: string, circuitId?: string) => {
      return this.simulateSessionTransition(fromType, toType, circuitId);
    };
  }

  public getState(): SessionLifecycleState {
    return { ...this.state };
  }

  public subscribe(listener: LifecycleListener): () => void {
    this.listeners.add(listener);
    listener(this.state, false);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(isTransition: boolean) {
    const copy = { ...this.state };
    this.listeners.forEach(fn => fn(copy, isTransition));
  }

  /**
   * Resolves the scheduled session based on UTC time and official schedule
   */
  public resolveScheduledSession(nowMs: number = getEffectiveNowMs()): ActiveSessionContext | null {
    const liveSchedule = scheduleSyncService.getState().schedule || F1_SCHEDULE;

    for (const gp of liveSchedule) {
      for (const sess of gp.sessions) {
        const start = new Date(sess.startTimeUtc).getTime();
        const durMin = sess.type === 'Race' ? 120 : sess.type === 'Sprint' ? 45 : 60;
        const explicitEnd = sess.endTimeUtc ? new Date(sess.endTimeUtc).getTime() : NaN;
        const end = !isNaN(explicitEnd) ? explicitEnd : start + durMin * 60 * 1000;

        if (isNaN(start) || isNaN(end)) continue;

        // Is current UTC time within this session's window?
        if (nowMs >= start && nowMs < end) {
          const remainingSec = Math.max(0, Math.round((end - nowMs) / 1000));
          const engineType: SessionState['type'] =
            sess.type === 'Race' ? 'RACE' :
            sess.type === 'Sprint' ? 'SPRINT' :
            (sess.type === 'Qualifying' || sess.type === 'Sprint Qualifying') ? 'QUALIFYING' : 'PRACTICE';

          const sessionKey = `${gp.circuitId}-${sess.type}-${sess.startTimeUtc}`;

          return {
            sessionKey,
            sessionName: `${gp.name} - ${sess.name}`,
            sessionType: engineType,
            circuitId: gp.circuitId,
            circuitName: gp.name,
            isLive: true,
            remainingSec,
            durationSec: durMin * 60,
            startTimeUtc: sess.startTimeUtc,
            endTimeUtc: sess.endTimeUtc || new Date(end).toISOString(),
          };
        }
      }
    }

    return null;
  }

  /**
   * Core autonomous check: detects session transitions, archives previous session,
   * purges old caches, and resets timing table to clean zeroes.
   */
  public async checkSessionTransition(forceCheck = false): Promise<boolean> {
    if (this.state.isChecking && !forceCheck) return false;
    this.state.isChecking = true;

    try {
      const nowMs = getEffectiveNowMs();
      const scheduledActive = this.resolveScheduledSession(nowMs);

      // Check if session has changed
      const currentStoredKey = typeof window !== 'undefined' 
        ? localStorage.getItem(STORAGE_ACTIVE_SESSION_KEY) || this.state.currentSessionKey 
        : this.state.currentSessionKey;

      if (scheduledActive) {
        const targetKey = scheduledActive.sessionKey;
        const isNewSession = targetKey !== currentStoredKey;

        if (isNewSession) {
          console.info(`[SessionLifecycle] 🚨 NEW SESSION TRANSITION DETECTED: ${currentStoredKey} ➔ ${targetKey}`);
          await this.executeSessionTransition(currentStoredKey, scheduledActive, 'CALENDAR_UTC');
          return true;
        } else {
          // Same active session: update remaining time
          this.state.activeSession = scheduledActive;
          this.state.isLive = true;
          this.notify(false);
        }
      } else {
        // No session currently in scheduled window
        if (this.state.isLive) {
          // A live session just ended!
          console.info(`[SessionLifecycle] Session ended according to schedule window: ${currentStoredKey}`);
          this.archiveCurrentLeaderboardIfPossible(currentStoredKey || 'unknown-session');
          this.state.isLive = false;
          this.notify(false);
        }
      }

      return false;
    } catch (err) {
      console.warn('[SessionLifecycle] Error checking session transition:', err);
      return false;
    } finally {
      this.state.isChecking = false;
    }
  }

  /**
   * Archives current leaderboard before wiping it
   */
  private archiveCurrentLeaderboardIfPossible(sessionKey: string) {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_LEADERBOARD_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check if it has any actual lap times
          const hasTimes = parsed.some(e => e.bestLapTime && e.bestLapTime !== '--:--.---' && e.bestLapTime !== '—');
          if (hasTimes) {
            const currentGp = F1_SCHEDULE.find(g => !g.completed) || F1_SCHEDULE[0];
            sessionArchiveService.archiveSession(
              sessionKey,
              this.state.activeSession?.sessionName || `Sesión ${sessionKey}`,
              this.state.activeSession?.circuitId || currentGp.circuitId,
              this.state.activeSession?.sessionType || 'PRACTICE',
              parsed,
              this.state.activeSession?.circuitName || currentGp.name
            );
          }
        }
      }
    } catch (e) {
      console.warn('[SessionLifecycle] Failed to archive previous leaderboard:', e);
    }
  }

  /**
   * Executes a full atomic session transition:
   * 1. Archives concluded session immutably
   * 2. Clears previous session caches (leaderboard, best sectors)
   * 3. Sets new active session key in storage
   * 4. Resets to clean zeroed timing state
   * 5. Propagates transition across browser tabs via BroadcastChannel
   * 6. Notifies subscribers
   */
  public async executeSessionTransition(
    previousKey: string | null,
    newSession: ActiveSessionContext,
    source: SessionLifecycleState['source'] = 'CALENDAR_UTC'
  ): Promise<void> {
    const transitionTime = new Date().toISOString();

    // 1. Archive previous session if it had valid times
    if (previousKey) {
      this.archiveCurrentLeaderboardIfPossible(previousKey);
    }

    // 2. Wipe stale caches for the new session
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_LEADERBOARD_KEY);
        localStorage.removeItem(STORAGE_SECTORS_KEY);
        localStorage.setItem(STORAGE_ACTIVE_SESSION_KEY, newSession.sessionKey);
      } catch (e) {
        console.warn('[SessionLifecycle] Storage update failed during transition:', e);
      }
    }

    // 3. Update state
    this.state = {
      activeSession: newSession,
      previousSessionKey: previousKey,
      currentSessionKey: newSession.sessionKey,
      isLive: newSession.isLive,
      lastTransitionAt: transitionTime,
      isChecking: false,
      source,
    };

    // 4. Broadcast transition across tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'SESSION_TRANSITION',
          previousKey,
          newSession,
          transitionTime,
          source,
        });
      } catch (e) {
        console.warn('[SessionLifecycle] Broadcast failed:', e);
      }
    }

    // 5. Notify local listeners
    this.notify(true);
    console.info(`[SessionLifecycle] ✅ Session transition complete to: ${newSession.sessionName} (${newSession.sessionKey})`);
  }

  private handleBroadcastMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'SESSION_TRANSITION' && msg.newSession) {
      console.info(`[SessionLifecycle] 📡 Received session transition from peer tab: ${msg.newSession.sessionKey}`);
      this.state = {
        activeSession: msg.newSession,
        previousSessionKey: msg.previousKey,
        currentSessionKey: msg.newSession.sessionKey,
        isLive: msg.newSession.isLive,
        lastTransitionAt: msg.transitionTime,
        isChecking: false,
        source: 'BROADCAST_SYNC' as any,
      };
      this.notify(true);
    }
  }

  /**
   * Simulation & Testing Harness:
   * Allows developer or automated test to trigger an instant session transition
   * (e.g. FP1 -> FP2, FP3 -> Qualifying, Qualifying -> Race)
   */
  public async simulateSessionTransition(
    fromType: string = 'FP1',
    toType: string = 'FP2',
    circuitId?: string
  ): Promise<ActiveSessionContext> {
    const cid = circuitId || 'madrid';
    const currentGp = F1_SCHEDULE.find(g => g.circuitId === cid) || F1_SCHEDULE[15];
    const prevKey = `${cid}-${fromType}-simulated`;
    const newKey = `${cid}-${toType}-${new Date().toISOString()}`;

    const durationSec = toType.toLowerCase().includes('race') ? 7200 : 3600;
    const sessionType: SessionState['type'] =
      toType.toLowerCase().includes('race') ? 'RACE' :
      toType.toLowerCase().includes('sprint') ? 'SPRINT' :
      toType.toLowerCase().includes('qual') ? 'QUALIFYING' : 'PRACTICE';

    const simContext: ActiveSessionContext = {
      sessionKey: newKey,
      sessionName: `${currentGp.name} - ${toType.toUpperCase()}`,
      sessionType,
      circuitId: cid,
      circuitName: currentGp.name,
      isLive: true,
      remainingSec: durationSec,
      durationSec,
      startTimeUtc: new Date().toISOString(),
      endTimeUtc: new Date(Date.now() + durationSec * 1000).toISOString(),
    };

    console.info(`[SessionLifecycle] 🧪 Simulating session transition: ${fromType} ➔ ${toType}`);
    await this.executeSessionTransition(prevKey, simContext, 'SIMULATION');
    return simContext;
  }

  public destroy() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.listeners.clear();
  }
}

export const sessionLifecycleService = new SessionLifecycleService();
