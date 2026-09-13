import type { LeaderboardEntry, SectorStatus } from '../types/telemetry';
import { DRIVERS } from '../data/drivers';

export const STORAGE_LIVE_LEADERBOARD_KEY = 'f1_live_leaderboard';

export interface OfficialTimingLine {
  Position: string;
  Line?: number;
  RacingNumber?: string;
  BestLapTime?: {
    Value: string;
    Lap?: number;
  };
  LastLapTime?: {
    Value: string;
  };
  TimeDiffToFastest?: string;
  TimeDiffToPositionAhead?: string;
  NumberOfLaps?: number;
  NumberOfPitStops?: number;
  InPit?: boolean;
  PitOut?: boolean;
  Stopped?: boolean;
  Retired?: boolean;
  Sectors?: Array<{
    Value?: string;
    PreviousValue?: string;
    Status?: number;
    OverallFastest?: boolean;
    PersonalFastest?: boolean;
    Segments?: Array<{
      Status?: number; // 2051: purple, 2048: green, 2049: yellow, 2064: blue/pit
    }>;
  }>;
  Speeds?: {
    ST?: { Value?: string };
    I1?: { Value?: string };
    I2?: { Value?: string };
  };
}

export interface OfficialTimingAppDataLine {
  RacingNumber?: string;
  Line?: number;
  Stints?: Array<{
    Compound?: string;
    TotalLaps?: number;
    New?: string;
  }>;
}

export interface OfficialDriverListItem {
  RacingNumber?: string;
  BroadcastName?: string;
  FullName?: string;
  Tla?: string;
  Line?: number;
  TeamName?: string;
  TeamColour?: string;
  FirstName?: string;
  LastName?: string;
}

class OfficialLiveTimingSyncService {
  private currentLeaderboard: LeaderboardEntry[] = [];
  private isPolling = false;
  private pollIntervalId: number | null = null;
  private listeners = new Set<(entries: LeaderboardEntry[]) => void>();

  constructor() {
    this.currentLeaderboard = this.loadFromStorage();
  }

  public getInitialLeaderboard(): LeaderboardEntry[] {
    if (this.currentLeaderboard.length === 0) {
      this.currentLeaderboard = this.loadFromStorage();
    }
    return this.currentLeaderboard;
  }

  public subscribe(fn: (entries: LeaderboardEntry[]) => void): () => void {
    this.listeners.add(fn);
    if (this.currentLeaderboard.length > 0) {
      fn(this.currentLeaderboard);
    }
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.saveToStorage(this.currentLeaderboard);
    this.listeners.forEach(fn => fn(this.currentLeaderboard));
  }

  /**
   * Load live recorded results from localStorage to maintain data across page reloads
   */
  public loadFromStorage(): LeaderboardEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_LIVE_LEADERBOARD_KEY) || 
                  localStorage.getItem('f1_saved_leaderboard_madrid') ||
                  localStorage.getItem('f1_official_live_timing_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[OfficialLiveTiming] Storage read failed:', e);
    }
    return [];
  }

  /**
   * Persist live results to localStorage
   */
  public saveToStorage(entries: LeaderboardEntry[]): void {
    if (typeof window === 'undefined' || !entries || entries.length === 0) return;
    try {
      const serialized = JSON.stringify(entries);
      localStorage.setItem(STORAGE_LIVE_LEADERBOARD_KEY, serialized);
      localStorage.setItem('f1_saved_leaderboard_madrid', serialized);
      localStorage.setItem('f1_official_live_timing_cache', serialized);
    } catch (e) {
      console.warn('[OfficialLiveTiming] Storage write failed:', e);
    }
  }

  /**
   * Map official F1 segment status codes to UI color states
   */
  private mapSegmentStatus(code?: number): SectorStatus {
    if (code === 2051) return 'purple';
    if (code === 2048) return 'green';
    if (code === 2049) return 'yellow';
    if (code === 2064) return 'pit';
    return 'none';
  }

  /**
   * Map official segments array into full microsector array
   */
  private extractSegments(rawSegments?: Array<{ Status?: number }>, _fallbackStatus: SectorStatus = 'none'): SectorStatus[] {
    if (!rawSegments || rawSegments.length === 0) {
      return [];
    }
    return rawSegments.map(s => this.mapSegmentStatus(s?.Status));
  }

  /**
   * Fetch live official timing data dynamically from the F1 static feed
   */
  public async syncOfficialLiveTiming(): Promise<LeaderboardEntry[]> {
    try {
      // 1. Detect candidate paths from SessionInfo.json
      const candidatePaths: string[] = [];
      try {
        const sessionInfoRes = await fetch('/f1-static/SessionInfo.json');
        if (sessionInfoRes.ok) {
          const sessionInfo = await sessionInfoRes.json();
          if (sessionInfo?.Path) {
            const raw = sessionInfo.Path.replace(/\/$/, '');
            candidatePaths.push(raw);
            // If the active session is Practice 2 or later, add earlier sessions as fallback
            if (raw.includes('Practice_2')) {
              candidatePaths.push(raw.replace('Practice_2', 'Practice_1'));
            } else if (raw.includes('Practice_3')) {
              candidatePaths.push(raw.replace('Practice_3', 'Practice_2'));
              candidatePaths.push(raw.replace('Practice_3', 'Practice_1'));
            } else if (raw.includes('Qualifying')) {
              candidatePaths.push(raw.replace('Qualifying', 'Practice_3'));
              candidatePaths.push(raw.replace('Qualifying', 'Practice_2'));
              candidatePaths.push(raw.replace('Qualifying', 'Practice_1'));
            }
          }
        }
      } catch (e) {
        console.warn('[OfficialLiveTiming] SessionInfo fetch failed:', e);
      }

      // Add default Spanish GP path as standard fallback
      candidatePaths.push('2026/2026-09-13_Spanish_Grand_Prix/2026-09-11_Practice_1');

      // 2. Find first path that provides valid TimingData.json
      let td: any = null;
      let appData: any = {};
      let driverList: any = {};
      let validPath: string | null = null;

      for (const p of candidatePaths) {
        try {
          const res = await fetch(`/f1-static/${p}/TimingData.json`);
          if (res.ok) {
            const text = await res.text();
            // Handle optional UTF-8 BOM
            const clean = text.replace(/^\uFEFF/, '');
            const parsed = JSON.parse(clean);
            if (parsed && parsed.Lines && Object.keys(parsed.Lines).length > 0) {
              td = parsed;
              validPath = p;
              break;
            }
          }
        } catch {
          // try next path
        }
      }

      if (!td || !validPath) {
        return this.currentLeaderboard;
      }

      // Fetch accompanying metadata in parallel
      try {
        const [appRes, dlRes] = await Promise.all([
          fetch(`/f1-static/${validPath}/TimingAppData.json`).catch(() => null),
          fetch(`/f1-static/${validPath}/DriverList.json`).catch(() => null),
        ]);
        if (appRes && appRes.ok) {
          const txt = (await appRes.text()).replace(/^\uFEFF/, '');
          appData = JSON.parse(txt);
        }
        if (dlRes && dlRes.ok) {
          const txt = (await dlRes.text()).replace(/^\uFEFF/, '');
          driverList = JSON.parse(txt);
        }
      } catch {
        // non-blocking
      }

      const lines: Record<string, OfficialTimingLine> = td.Lines || {};
      const appLines: Record<string, OfficialTimingAppDataLine> = appData.Lines || {};

      if (Object.keys(lines).length === 0) {
        return this.currentLeaderboard;
      }

      const updatedEntries: LeaderboardEntry[] = [];

      for (const [racingNum, line] of Object.entries(lines)) {
        const numInt = parseInt(racingNum, 10);
        const driverMeta = DRIVERS.find(d => d.number === numInt);
        const dlItem: Partial<OfficialDriverListItem> = driverList[racingNum] || {};

        const code = dlItem.Tla || driverMeta?.code || racingNum;
        const driverId = driverMeta?.id || code.toLowerCase();
        const team = dlItem.TeamName || driverMeta?.team || 'F1 Team';
        const teamColor = dlItem.TeamColour ? `#${dlItem.TeamColour}` : (driverMeta?.teamColor || '#ffffff');
        const pos = parseInt(line.Position || '99', 10);

        const bestLap = line.BestLapTime?.Value || line.LastLapTime?.Value || '--:--.---';
        const gapLeader = line.TimeDiffToFastest ? line.TimeDiffToFastest : (pos === 1 ? 'LÍDER' : '+0.000s');
        const gapAhead = line.TimeDiffToPositionAhead ? line.TimeDiffToPositionAhead : (pos === 1 ? 'LEADER' : '+0.000s');

        // Sector times and statuses
        const sectors = line.Sectors || [];
        const s1Raw = sectors[0]?.Value || sectors[0]?.PreviousValue || '';
        const s2Raw = sectors[1]?.Value || sectors[1]?.PreviousValue || '';
        const s3Raw = sectors[2]?.Value || sectors[2]?.PreviousValue || '';

        const s1Status: SectorStatus = sectors[0]?.OverallFastest ? 'purple' : sectors[0]?.PersonalFastest ? 'green' : (s1Raw ? (pos <= 3 ? 'green' : 'yellow') : 'none');
        const s2Status: SectorStatus = sectors[1]?.OverallFastest ? 'purple' : sectors[1]?.PersonalFastest ? 'green' : (s2Raw ? (pos <= 3 ? 'green' : 'yellow') : 'none');
        const s3Status: SectorStatus = sectors[2]?.OverallFastest ? 'purple' : sectors[2]?.PersonalFastest ? 'green' : (s3Raw ? (pos <= 3 ? 'green' : 'yellow') : 'none');

        const s1Segments = this.extractSegments(sectors[0]?.Segments, s1Status);
        const s2Segments = this.extractSegments(sectors[1]?.Segments, s2Status);
        const s3Segments = this.extractSegments(sectors[2]?.Segments, s3Status);

        // Tyre data from TimingAppData
        const rawStints = appLines[racingNum]?.Stints;
        const stints = Array.isArray(rawStints) 
          ? rawStints 
          : (typeof rawStints === 'object' && rawStints !== null 
              ? Object.keys(rawStints).sort((a, b) => Number(a) - Number(b)).map(k => (rawStints as any)[k]) 
              : []);
        const currentStint = stints[stints.length - 1];
        const compoundRaw = currentStint?.Compound?.toUpperCase() || 'MEDIUM';
        const compound = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].includes(compoundRaw) ? compoundRaw as any : 'MEDIUM';
        const tyreAge = currentStint?.TotalLaps || (line.NumberOfLaps ? Math.min(line.NumberOfLaps, 15) : 8);

        const speedTrap = parseInt(line.Speeds?.ST?.Value || '290', 10) || 290;

        // Parse best lap time to seconds for accurate sorting
        let bestLapNum = 999;
        if (bestLap && bestLap.includes(':')) {
          const parts = bestLap.split(':');
          bestLapNum = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
        }

        updatedEntries.push({
          position: pos,
          previousPosition: pos,
          driver: {
            id: driverId,
            code,
            number: numInt,
            firstName: dlItem.FirstName || driverMeta?.firstName || code,
            lastName: dlItem.LastName || driverMeta?.lastName || '',
            team,
            teamColor,
            country: driverMeta?.country || 'Internacional',
            flag: driverMeta?.flag || '🏁',
          },
          gapToLeader: gapLeader.startsWith('+') ? gapLeader : (pos === 1 ? 'LÍDER' : `+${gapLeader}`),
          gapToAhead: gapAhead.startsWith('+') ? gapAhead : (pos === 1 ? 'LEADER' : `+${gapAhead}`),
          intervalNum: parseFloat(gapAhead.replace('+', '').replace('s', '')) || 0,
          currentLapTime: bestLap,
          bestLapTime: bestLap,
          s1Time: s1Raw || '--.---',
          s2Time: s2Raw || '--.---',
          s3Time: s3Raw || '--.---',
          s1Status,
          s2Status,
          s3Status,
          s1Segments,
          s2Segments,
          s3Segments,
          tyre: {
            compound,
            age: tyreAge,
            used: currentStint?.New === 'false',
          },
          pitStops: line.NumberOfPitStops || (line.InPit ? 1 : 0),
          inPit: Boolean(line.InPit),
          isPitOut: Boolean(line.PitOut),
          isKnockedOut: Boolean(line.Retired || line.Stopped),
          isEliminationRisk: false,
          speedTrap,
          lastLapTimeNum: isNaN(bestLapNum) ? 95.0 : bestLapNum,
          trackProgress: ((0.92 - (pos - 1) * 0.042) + 1.0) % 1.0,
        });
      }

      updatedEntries.sort((a, b) => a.position - b.position);

      if (updatedEntries.length > 0) {
        this.currentLeaderboard = updatedEntries;
        this.notify();
      }

      return this.currentLeaderboard;
    } catch (err) {
      console.warn('[OfficialLiveTiming] Sync failed:', err);
      return this.currentLeaderboard;
    }
  }

  /**
   * Start live polling to continuously update the leaderboard in real time
   */
  public startLivePolling(intervalMs = 3500) {
    if (this.isPolling) return;
    this.isPolling = true;
    this.syncOfficialLiveTiming();
    this.pollIntervalId = window.setInterval(() => {
      this.syncOfficialLiveTiming();
    }, intervalMs);
  }

  public stopLivePolling() {
    this.isPolling = false;
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }
}

export const officialLiveTimingService = new OfficialLiveTimingSyncService();
