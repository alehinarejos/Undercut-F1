  import { F1_SCHEDULE } from '../data/schedule';
import type { GrandPrixEvent, SessionSchedule } from '../data/schedule';

export interface ScheduleSyncState {
  schedule: GrandPrixEvent[];
  lastWeeklyCheck: Date | null;
  nextWeeklyCheck: Date | null;
  isChecking: boolean;
  statusMessage: string;
  source: string;
}

const STORAGE_KEY_LAST_CHECK = 'f1_schedule_last_weekly_check_v5';
const STORAGE_KEY_CUSTOM_SCHEDULE = 'f1_schedule_synced_2026_v5';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

class ScheduleSyncService {
  private state: ScheduleSyncState = {
    schedule: F1_SCHEDULE,
    lastWeeklyCheck: null,
    nextWeeklyCheck: null,
    isChecking: false,
    statusMessage: 'Horarios oficiales cargados',
    source: 'F1 Oficial',
  };

  private listeners: Set<(state: ScheduleSyncState) => void> = new Set();
  private checkInterval: number | null = null;

  constructor() {
    this.initFromStorage();
    // Check if a weekly check is due
    this.checkWeeklyScheduleIfNeeded();
    // Periodic interval to check if a week has elapsed
    this.checkInterval = window.setInterval(() => {
      this.checkWeeklyScheduleIfNeeded();
    }, 60 * 60 * 1000); // check hourly
  }

  private initFromStorage() {
    try {
      const savedDate = localStorage.getItem(STORAGE_KEY_LAST_CHECK);
      if (savedDate) {
        const lastCheck = new Date(savedDate);
        this.state.lastWeeklyCheck = lastCheck;
        this.state.nextWeeklyCheck = new Date(lastCheck.getTime() + ONE_WEEK_MS);
      } else {
        const now = new Date();
        this.state.lastWeeklyCheck = now;
        this.state.nextWeeklyCheck = new Date(now.getTime() + ONE_WEEK_MS);
        localStorage.setItem(STORAGE_KEY_LAST_CHECK, now.toISOString());
      }

      const savedSchedule = localStorage.getItem(STORAGE_KEY_CUSTOM_SCHEDULE);
      if (savedSchedule) {
        const parsed = JSON.parse(savedSchedule);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.state.schedule = parsed.map(gp => {
            const canonical = F1_SCHEDULE.find(c => c.round === gp.round);
            const isFinished = canonical?.completed || isGrandPrixCompleted(gp);
            return {
              ...gp,
              completed: isFinished,
              winner: canonical?.winner || gp.winner,
              polePosition: canonical?.polePosition || gp.polePosition,
              sessions: canonical?.sessions || gp.sessions,
            };
          });
        }
      }
    } catch (err) {
      console.warn('Error reading schedule from storage:', err);
    }
  }

  public getState(): ScheduleSyncState {
    return this.state;
  }

  public subscribe(listener: (state: ScheduleSyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }

  public checkWeeklyScheduleIfNeeded(): void {
    const lastCheckTime = this.state.lastWeeklyCheck?.getTime() || 0;
    const now = Date.now();

    if (now - lastCheckTime >= ONE_WEEK_MS) {
      console.log('Comprobación semanal de horarios F1 activada...');
      this.fetchOfficialSchedule(false);
    }
  }

  /**
   * Manual or automatic fetch from official FIA / Jolpica calendar endpoint
   */
  public async fetchOfficialSchedule(isManual: boolean = false): Promise<void> {
    if (this.state.isChecking) return;

    this.state.isChecking = true;
    this.state.statusMessage = 'Comprobando horarios oficiales con la FIA...';
    this.notify();

    try {
      const res = await fetch('https://api.jolpi.ca/ergast/f1/current.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const races = data?.MRData?.RaceTable?.Races;

      if (Array.isArray(races) && races.length > 0) {
        const updated = this.state.schedule.map((gp) => {
          const apiRace = races.find((r: any) => parseInt(r.round, 10) === gp.round);
          if (!apiRace) return gp;

          const updatedSessions: SessionSchedule[] = gp.sessions.map((sess) => {
            let apiTime: string | undefined = undefined;
            let apiDate: string | undefined = undefined;

            if (sess.type === 'Race') {
              apiTime = apiRace.time;
              apiDate = apiRace.date;
            } else if (sess.type === 'FP1' && apiRace.FirstPractice) {
              apiTime = apiRace.FirstPractice.time;
              apiDate = apiRace.FirstPractice.date;
            } else if (sess.type === 'FP2' && apiRace.SecondPractice) {
              apiTime = apiRace.SecondPractice.time;
              apiDate = apiRace.SecondPractice.date;
            } else if (sess.type === 'FP3' && apiRace.ThirdPractice) {
              apiTime = apiRace.ThirdPractice.time;
              apiDate = apiRace.ThirdPractice.date;
            } else if (sess.type === 'Qualifying' && apiRace.Qualifying) {
              apiTime = apiRace.Qualifying.time;
              apiDate = apiRace.Qualifying.date;
            } else if (sess.type === 'Sprint' && apiRace.Sprint) {
              apiTime = apiRace.Sprint.time;
              apiDate = apiRace.Sprint.date;
            } else if (sess.type === 'Sprint Qualifying' && apiRace.SprintQualifying) {
              apiTime = apiRace.SprintQualifying.time;
              apiDate = apiRace.SprintQualifying.date;
            }

            // If the official feed confirmed a specific time
            if (apiTime && apiDate) {
              const fullUtc = `${apiDate}T${apiTime}`;
              return {
                ...sess,
                startTimeUtc: fullUtc,
                hasOfficialTime: true,
              };
            }

            // If time is missing or not yet determined, mark as n/d
            return {
              ...sess,
              hasOfficialTime: sess.startTimeUtc ? !sess.startTimeUtc.endsWith('T00:00:00Z') : false,
            };
          });

          return {
            ...gp,
            sessions: updatedSessions,
          };
        });

        this.state.schedule = updated;
        try {
          localStorage.setItem(STORAGE_KEY_CUSTOM_SCHEDULE, JSON.stringify(updated));
        } catch (e) {
          // ignore
        }
      }

      const now = new Date();
      this.state.lastWeeklyCheck = now;
      this.state.nextWeeklyCheck = new Date(now.getTime() + ONE_WEEK_MS);
      localStorage.setItem(STORAGE_KEY_LAST_CHECK, now.toISOString());

      this.state.statusMessage = isManual 
        ? `Horarios comprobados ahora mismo (${now.toLocaleTimeString()})`
        : `Comprobación semanal completada (${now.toLocaleDateString()})`;
    } catch (err: any) {
      console.warn('Error fetching official schedule:', err);
      this.state.statusMessage = 'Última comprobación semanal activa (datos en caché)';
    } finally {
      this.state.isChecking = false;
      this.notify();
    }
  }

  private parseLocalWithGmtOffsetToUtcIso(dateStr?: string, gmtOffset?: string): string | undefined {
    if (!dateStr || typeof dateStr !== 'string') return undefined;
    let utcIso = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
    if (!dateStr.endsWith('Z') && gmtOffset && typeof gmtOffset === 'string') {
      const cleanOffset = gmtOffset.trim();
      const sign = cleanOffset.startsWith('-') ? '-' : '+';
      const parts = cleanOffset.replace(/^[+-]/, '').split(':');
      if (parts.length >= 2) {
        const isoWithOffset = `${dateStr}${sign}${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        const parsed = new Date(isoWithOffset);
        if (!isNaN(parsed.getTime())) {
          utcIso = parsed.toISOString();
        }
      }
    }
    return utcIso;
  }

  /**
   * Update session time directly from live SignalR / WebSocket SessionInfo feed
   */
  public updateFromSignalRSessionInfo(sessionInfo: any): void {
    if (!sessionInfo) return;
    const sessionName = String(sessionInfo.Name || sessionInfo.Type || '');
    const startDate = sessionInfo.StartDate;
    const endDate = sessionInfo.EndDate;
    const gmtOffset = sessionInfo.GmtOffset;

    if (!startDate || !sessionName) return;

    const startUtcIso = this.parseLocalWithGmtOffsetToUtcIso(startDate, gmtOffset);
    const endUtcIso = this.parseLocalWithGmtOffsetToUtcIso(endDate, gmtOffset);
    if (!startUtcIso) return;

    const upcomingGp = this.state.schedule.find(g => !g.completed);
    if (!upcomingGp) return;

    let updatedAny = false;
    const lowerName = sessionName.toLowerCase();
    const updatedSessions = upcomingGp.sessions.map((sess) => {
      const match =
        (sess.type === 'FP1' && (lowerName.includes('practice 1') || lowerName.includes('fp1') || lowerName.includes('libres 1'))) ||
        (sess.type === 'FP2' && (lowerName.includes('practice 2') || lowerName.includes('fp2') || lowerName.includes('libres 2'))) ||
        (sess.type === 'FP3' && (lowerName.includes('practice 3') || lowerName.includes('fp3') || lowerName.includes('libres 3'))) ||
        (sess.type === 'Qualifying' && (lowerName.includes('qualifying') || lowerName.includes('qualy'))) ||
        (sess.type === 'Sprint' && lowerName === 'sprint') ||
        (sess.type === 'Sprint Qualifying' && lowerName.includes('sprint')) ||
        (sess.type === 'Race' && lowerName.includes('race'));

      if (match) {
        updatedAny = true;
        return {
          ...sess,
          startTimeUtc: startUtcIso,
          endTimeUtc: endUtcIso || sess.endTimeUtc,
          hasOfficialTime: true,
        };
      }
      return sess;
    });

    if (updatedAny) {
      upcomingGp.sessions = updatedSessions;
      this.state.source = 'F1 Oficial';
      this.state.statusMessage = `Horario oficial confirmado para ${sessionName}`;
      this.notify();
    }
  }

  /**
   * Mark a session as dynamically completed when live timing reports Chequered / Finished / 00:00:00
   */
  public markSessionFinished(sessionNameOrType?: string, finishedUtc?: string): void {
    const upcomingGp = this.state.schedule.find(g => !g.completed);
    if (!upcomingGp) return;

    const nowIso = finishedUtc || new Date().toISOString();
    const nowMs = Date.now();
    const lower = (sessionNameOrType || '').toLowerCase();
    let updated = false;

    upcomingGp.sessions = upcomingGp.sessions.map((sess) => {
      const startMs = new Date(sess.startTimeUtc).getTime();
      const matchByName =
        lower &&
        ((sess.type === 'FP1' && (lower.includes('practice 1') || lower.includes('fp1') || lower.includes('libres 1'))) ||
          (sess.type === 'FP2' && (lower.includes('practice 2') || lower.includes('fp2') || lower.includes('libres 2'))) ||
          (sess.type === 'FP3' && (lower.includes('practice 3') || lower.includes('fp3') || lower.includes('libres 3'))) ||
          (sess.type === 'Qualifying' && (lower.includes('qualifying') || lower.includes('qualy'))) ||
          (sess.type === 'Race' && lower.includes('race')));

      // Or if no name specified, match any session whose start time has already passed or is within 45 min
      const isCurrentlyActiveWindow = !isNaN(startMs) && nowMs >= startMs - 45 * 60 * 1000 && nowMs <= startMs + 150 * 60 * 1000;

      if (matchByName || (!lower && isCurrentlyActiveWindow)) {
        if (!sess.completed) {
          updated = true;
          return {
            ...sess,
            completed: true,
            endTimeUtc: nowIso,
          };
        }
      }
      return sess;
    });

    if (updated) {
      this.notify();
    }
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const scheduleSyncService = new ScheduleSyncService();

/**
 * Format session hour. If hasOfficialTime is false or time is missing, returns "n/d"
 */
export function formatOfficialHour(session: SessionSchedule): string {
  if (session.hasOfficialTime === false || !session.startTimeUtc) {
    return 'n/d';
  }

  try {
    const date = new Date(session.startTimeUtc);
    if (isNaN(date.getTime())) return 'n/d';

    // If starts at 00:00:00 without explicit official confirmation
    if (session.startTimeUtc.includes('T00:00:00') && !session.hasOfficialTime) {
      return 'n/d';
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 'h';
  } catch {
    return 'n/d';
  }
}

/**
 * Format session date and hour combined: e.g. "vie, 11 sep • 13:30h" or "vie, 11 sep • n/d"
 */
export function formatSessionFull(session: SessionSchedule): { dateStr: string; timeStr: string } {
  const timeStr = formatOfficialHour(session);
  let dateStr = 'TBD';

  if (session.startTimeUtc) {
    try {
      const date = new Date(session.startTimeUtc);
      if (!isNaN(date.getTime())) {
        dateStr = date.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
      }
    } catch {
      dateStr = 'TBD';
    }
  }

  return { dateStr, timeStr };
}

export type SessionStateKind = 'completed' | 'live' | 'next' | 'future';

export interface SessionTimelineInfo {
  session: SessionSchedule;
  status: SessionStateKind;
  startTime: number;
  endTime: number;
  formattedDate: string;
  formattedTime: string;
}

export interface GrandPrixTimeline {
  activeSession: SessionTimelineInfo | null;
  lastCompletedSession: SessionTimelineInfo | null;
  nextSession: SessionTimelineInfo | null;
  sessions: SessionTimelineInfo[];
  allCompleted: boolean;
}

/**
 * Computes exact state for every session of a Grand Prix (completed, live, next upcoming, future)
 */
export function getGrandPrixTimeline(gp: GrandPrixEvent): GrandPrixTimeline {
  const now = Date.now();
  let activeSession: SessionTimelineInfo | null = null;
  let lastCompletedSession: SessionTimelineInfo | null = null;
  let nextSession: SessionTimelineInfo | null = null;

  const sessionInfos: SessionTimelineInfo[] = gp.sessions.map((sess) => {
    const startTime = new Date(sess.startTimeUtc).getTime();
    // Typical session duration in ms: FP: 60m, Qualy: 60m, Sprint: 45m, Race: 120m
    let durationMs = 60 * 60 * 1000;
    if (sess.type === 'Race') durationMs = 120 * 60 * 1000;
    if (sess.type === 'Sprint') durationMs = 45 * 60 * 1000;
    const explicitEnd = sess.endTimeUtc ? new Date(sess.endTimeUtc).getTime() : NaN;
    const endTime = !isNaN(explicitEnd) ? explicitEnd : (!isNaN(startTime) ? startTime + durationMs : NaN);

    let status: SessionStateKind = 'future';
    if (sess.completed) {
      status = 'completed';
    } else if (!isNaN(startTime) && !isNaN(endTime)) {
      if (now >= startTime && now < endTime) {
        status = 'live';
      } else if (now >= endTime) {
        status = 'completed';
      } else {
        status = 'future';
      }
    }

    const { dateStr, timeStr } = formatSessionFull(sess);
    return {
      session: sess,
      status,
      startTime,
      endTime,
      formattedDate: dateStr,
      formattedTime: timeStr,
    };
  });

  // Identify active, last completed, and next upcoming
  for (const s of sessionInfos) {
    if (s.status === 'live') {
      activeSession = s;
    } else if (s.status === 'completed') {
      lastCompletedSession = s;
    } else if (s.status === 'future' && !nextSession) {
      s.status = 'next';
      nextSession = s;
    }
  }

  const allCompleted = sessionInfos.length > 0 && sessionInfos.every(s => s.status === 'completed');

  return {
    activeSession,
    lastCompletedSession,
    nextSession,
    sessions: sessionInfos,
    allCompleted,
  };
}

/**
 * Robust check if a Grand Prix has already completed based on explicit flag or if the Race has ended
 */
export function isGrandPrixCompleted(gp: GrandPrixEvent): boolean {
  if (gp.completed) return true;
  const raceSession = gp.sessions.find(s => s.type === 'Race');
  if (raceSession?.startTimeUtc) {
    const raceStart = new Date(raceSession.startTimeUtc).getTime();
    if (!isNaN(raceStart)) {
      // Completed if 3.5 hours after race start time
      return Date.now() > (raceStart + 3.5 * 3600 * 1000);
    }
  }
  const end = new Date(`${gp.endDate}T23:59:59Z`).getTime();
  return !isNaN(end) && Date.now() > end;
}

/**
 * Returns the actual next upcoming Grand Prix where the race is still in the future
 */
export function getNextUpcomingGrandPrix(schedule: GrandPrixEvent[]): GrandPrixEvent {
  const upcoming = schedule.find(gp => !isGrandPrixCompleted(gp));
  return upcoming || schedule[schedule.length - 1];
}

/**
 * Returns the Race session (or undefined if not found)
 */
export function getRaceSession(gp: GrandPrixEvent): SessionSchedule | undefined {
  return gp.sessions.find(s => s.type === 'Race');
}

/**
 * Returns the exact timestamp (in ms) of the Race session for a Grand Prix
 */
export function getRaceTargetTimestamp(gp: GrandPrixEvent): number {
  const race = getRaceSession(gp);
  if (race?.startTimeUtc) {
    const t = new Date(race.startTimeUtc).getTime();
    if (!isNaN(t)) return t;
  }
  return new Date(`${gp.endDate}T13:00:00Z`).getTime();
}

/**
 * Computes remaining time breakdown (days, hours, minutes, seconds)
 */
export function getTimeRemaining(targetDateMs: number, nowMs: number = Date.now()) {
  const diff = Math.max(0, targetDateMs - nowMs);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  const isPast = diff <= 0;
  return { days, hours, minutes, seconds, diff, isPast };
}
