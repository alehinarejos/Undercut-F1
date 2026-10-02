import type { LeaderboardEntry } from '../types/telemetry';

export interface ArchivedSessionSummary {
  sessionKey: string;
  sessionName: string;
  circuitId: string;
  circuitName: string;
  sessionType: string;
  archivedAtUtc: string;
  totalLaps: number;
  entriesCount: number;
  fastestLap?: {
    driverCode: string;
    driverNumber: number;
    lapTime: string;
    team: string;
  };
}

export interface ArchivedSessionRecord extends ArchivedSessionSummary {
  leaderboardSnapshot: LeaderboardEntry[];
  rawVersion: number;
}

const STORAGE_ARCHIVE_INDEX_KEY = 'f1_archived_sessions_index_v1';
const ARCHIVE_PREFIX = 'f1_session_archive_v1_';

class SessionArchiveService {
  /**
   * Helper to parse lap time into seconds for comparisons
   */
  private parseLapTimeToSeconds(timeStr?: string): number {
    if (!timeStr || timeStr.includes('-') || timeStr.includes('DNF') || !timeStr.includes(':')) {
      return Infinity;
    }
    const clean = timeStr.replace('+', '').trim();
    const parts = clean.split(':');
    if (parts.length === 2) {
      const mins = parseFloat(parts[0]);
      const secs = parseFloat(parts[1]);
      if (!isNaN(mins) && !isNaN(secs)) {
        return mins * 60 + secs;
      }
    }
    return Infinity;
  }

  /**
   * Archives a completed session immutably into permanent storage.
   * If the session had no completed times (all blank), it will not overwrite an existing valid archive.
   */
  public archiveSession(
    sessionKey: string,
    sessionName: string,
    circuitId: string,
    sessionType: string,
    leaderboard: LeaderboardEntry[],
    circuitName?: string
  ): ArchivedSessionRecord | null {
    if (typeof window === 'undefined') return null;
    if (!sessionKey || !leaderboard || leaderboard.length === 0) return null;

    try {
      // Find the fastest lap in the leaderboard
      let bestSec = Infinity;
      let fastestLap: {
        driverCode: string;
        driverNumber: number;
        lapTime: string;
        team: string;
      } | null = null;

      leaderboard.forEach(entry => {
        const timeStr = entry.bestLapTime;
        const sec = this.parseLapTimeToSeconds(timeStr);
        if (sec < bestSec && sec >= 50 && sec <= 240) {
          bestSec = sec;
          fastestLap = {
            driverCode: entry.driver.code,
            driverNumber: entry.driver.number,
            lapTime: timeStr,
            team: entry.driver.team,
          };
        }
      });

      // Max completed laps across all drivers
      const maxLaps = leaderboard.reduce((acc, curr) => {
        const laps = curr.lapsCompleted ?? curr.tyre?.age ?? 0;
        return Math.max(acc, laps);
      }, 0);

      // Check if existing archive exists
      const existingRaw = localStorage.getItem(`${ARCHIVE_PREFIX}${sessionKey}`);
      if (existingRaw) {
        try {
          const existingParsed = JSON.parse(existingRaw) as ArchivedSessionRecord;
          // If existing archive already has valid laps and incoming does not, preserve existing
          if (existingParsed && existingParsed.fastestLap && !fastestLap) {
            console.info(`[SessionArchive] Keeping existing archive for ${sessionKey} (had better data)`);
            return existingParsed;
          }
        } catch {
          // continue with new save
        }
      }

      const record: ArchivedSessionRecord = {
        sessionKey,
        sessionName,
        circuitId,
        circuitName: circuitName || circuitId.toUpperCase(),
        sessionType,
        archivedAtUtc: new Date().toISOString(),
        totalLaps: maxLaps,
        entriesCount: leaderboard.length,
        fastestLap: fastestLap || undefined,
        leaderboardSnapshot: JSON.parse(JSON.stringify(leaderboard)), // clone
        rawVersion: 1,
      };

      // 1. Store immutable record
      localStorage.setItem(`${ARCHIVE_PREFIX}${sessionKey}`, JSON.stringify(record));

      // 2. Update index list
      this.updateIndex(record);

      // 3. Update weekend fastest lap if eligible
      if (bestSec !== Infinity && fastestLap !== null) {
        try {
          const wkKey = `f1_weekend_fastest_v2_${circuitId}`;
          const currentWkRaw = localStorage.getItem(wkKey);
          let shouldUpdateWk = true;
          if (currentWkRaw) {
            const currentWk = JSON.parse(currentWkRaw);
            if (currentWk && typeof currentWk.sec === 'number' && currentWk.sec <= bestSec) {
              shouldUpdateWk = false;
            }
          }
          if (shouldUpdateWk) {
            const validFastest: { driverCode: string; driverNumber: number; lapTime: string; team: string } = fastestLap;
            localStorage.setItem(wkKey, JSON.stringify({
              sec: bestSec,
              driverCode: validFastest.driverCode,
              sessionLabel: sessionName,
            }));
          }
        } catch {}
      }

      const lapTimeLog = fastestLap ? (fastestLap as any).lapTime : 'none';
      console.info(`[SessionArchive] 💾 Session archived immutably: ${sessionKey} (${record.sessionName}) - ${leaderboard.length} drivers, fastest: ${lapTimeLog}`);
      return record;
    } catch (err) {
      console.warn('[SessionArchive] Error archiving session:', err);
      return null;
    }
  }

  private updateIndex(summary: ArchivedSessionSummary): void {
    try {
      const raw = localStorage.getItem(STORAGE_ARCHIVE_INDEX_KEY);
      let list: ArchivedSessionSummary[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];

      // Remove existing entry with same key
      list = list.filter(item => item.sessionKey !== summary.sessionKey);

      // Add new summary at start
      const shallowSummary: ArchivedSessionSummary = {
        sessionKey: summary.sessionKey,
        sessionName: summary.sessionName,
        circuitId: summary.circuitId,
        circuitName: summary.circuitName,
        sessionType: summary.sessionType,
        archivedAtUtc: summary.archivedAtUtc,
        totalLaps: summary.totalLaps,
        entriesCount: summary.entriesCount,
        fastestLap: summary.fastestLap,
      };
      list.unshift(shallowSummary);

      // Keep up to 30 past sessions
      if (list.length > 30) list = list.slice(0, 30);

      localStorage.setItem(STORAGE_ARCHIVE_INDEX_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('[SessionArchive] Error updating archive index:', err);
    }
  }

  public getArchivedSession(sessionKey: string): ArchivedSessionRecord | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${ARCHIVE_PREFIX}${sessionKey}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn(`[SessionArchive] Error fetching session ${sessionKey}:`, err);
    }
    return null;
  }

  public getAllArchivedSummaries(): ArchivedSessionSummary[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_ARCHIVE_INDEX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  public clearAllArchives(): void {
    if (typeof window === 'undefined') return;
    const summaries = this.getAllArchivedSummaries();
    summaries.forEach(s => {
      localStorage.removeItem(`${ARCHIVE_PREFIX}${s.sessionKey}`);
    });
    localStorage.removeItem(STORAGE_ARCHIVE_INDEX_KEY);
  }
}

export const sessionArchiveService = new SessionArchiveService();
