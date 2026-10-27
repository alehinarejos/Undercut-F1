// OpenF1 API Service — fetches real F1 timing, position and telemetry data

export interface OpenF1Session {
  session_key: number;
  session_type: string;
  session_name: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
  circuit_key: number;
  circuit_short_name: string;
  country_name: string;
  country_code: string;
  location: string;
  year: number;
  is_cancelled: boolean;
}

export interface OpenF1Position {
  date: string;
  session_key: number;
  driver_number: number;
  meeting_key: number;
  position: number;
}

export interface OpenF1CarData {
  date: string;
  session_key: number;
  speed: number;
  rpm: number;
  n_gear: number;
  throttle: number;
  brake: number;
  drs: number | null;
  driver_number: number;
}

export interface OpenF1Lap {
  meeting_key: number;
  session_key: number;
  driver_number: number;
  lap_number: number;
  date_start: string | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  i1_speed: number | null;
  i2_speed: number | null;
  st_speed: number | null;
  is_pit_out_lap: boolean;
  lap_duration: number | null;
  segments_sector_1: number[];
  segments_sector_2: number[];
  segments_sector_3: number[];
}

export interface OpenF1Driver {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  first_name: string;
  last_name: string;
  headshot_url: string | null;
  country_code: string | null;
  session_key: number;
  meeting_key: number;
}

export interface BestLapResult {
  driverNumber: number;
  nameAcronym: string;
  teamName: string;
  teamColor: string;
  bestLapSec: number;
  bestLapFormatted: string;
  lastLapFormatted?: string;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  speedTrap: number | null;
  finalPosition: number;
  lapsCompleted?: number;
  pitStops?: number;
  compound?: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET';
  tyreAge?: number;
  tyreUsed?: boolean;
  stints?: Array<{ compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET'; age: number; used: boolean }>;
}

export interface LiveSessionStatus {
  isLive: boolean;
  statusMessage: string;
  activeSession: OpenF1Session | null;
  latestCompletedSession: OpenF1Session | null;
  nextSession: {
    name: string;
    circuit: string;
    dateStart: string;
  } | null;
}

function formatLapTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

class OfficialF1Service {
  private baseUrl = 'https://api.openf1.org/v1';

  /**
   * Resuelve la sesión oficial activa o más reciente en OpenF1:
   * Realiza GET /sessions?year=current (con fallbacks), ordena cronológicamente por date_start
   * en orden descendente, y selecciona la sesión más reciente que ya haya comenzado (date_start <= now()).
   */
  public async resolveActiveSession(): Promise<OpenF1Session | null> {
    const currentYear = new Date().getFullYear();
    const candidateEndpoints = [
      `${this.baseUrl}/sessions?year=current`,
      `${this.baseUrl}/sessions?year=${currentYear}`,
      `${this.baseUrl}/sessions?year=2026`,
      `${this.baseUrl}/sessions?session_key=latest`,
      `${this.baseUrl}/sessions`,
    ];

    for (const url of candidateEndpoints) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const nowMs = Date.now();
          const sorted = [...data]
            .filter((s: OpenF1Session) => s && s.session_key && !s.is_cancelled)
            .sort((a: OpenF1Session, b: OpenF1Session) => {
              const tA = a.date_start ? new Date(a.date_start).getTime() : 0;
              const tB = b.date_start ? new Date(b.date_start).getTime() : 0;
              return tB - tA;
            });

          if (sorted.length > 0) {
            const started = sorted.find(s => {
              const startMs = s.date_start ? new Date(s.date_start).getTime() : 0;
              return startMs > 0 && startMs <= nowMs;
            }) || sorted[0];

            return started;
          }
        }
      } catch {
        // try next endpoint
      }
    }
    return null;
  }

  // Check whether an official session is currently taking place in 2026
  public async checkLiveStatus(): Promise<LiveSessionStatus> {
    try {
      const latest = await this.resolveActiveSession();
      
      if (!latest) {
        return {
          isLive: false,
          statusMessage: 'No hay sesiones registradas en la temporada 2026',
          activeSession: null,
          latestCompletedSession: null,
          nextSession: {
            name: 'FP2 - GP de España (Madrid)',
            circuit: 'Madring',
            dateStart: '2026-09-11T15:00:00Z',
          },
        };
      }

      const now = new Date().getTime();
      const startTime = new Date(latest.date_start).getTime();
      const endTime = new Date(latest.date_end).getTime();

      const isLive = now >= startTime && now <= endTime;

      return {
        isLive,
        statusMessage: isLive 
          ? `🔴 SESIÓN EN DIRECTO: ${latest.session_name} - ${latest.circuit_short_name}` 
          : `⚪ EN ESPERA: Sin sesión en pista. Última: ${latest.session_name} (${latest.circuit_short_name})`,
        activeSession: isLive ? latest : null,
        latestCompletedSession: latest,
        nextSession: {
          name: 'Libres 1 (FP1) - GP de México',
          circuit: 'Hermanos Rodríguez',
          dateStart: '2026-10-30T18:30:00Z',
        },
      };
    } catch {
      return {
        isLive: false,
        statusMessage: 'Conectado a los datos oficiales • En espera',
        activeSession: null,
        latestCompletedSession: null,
        nextSession: {
          name: 'Libres 1 (FP1) - GP de México',
          circuit: 'Hermanos Rodríguez',
          dateStart: '2026-10-30T18:30:00Z',
        },
      };
    }
  }

  /**
   * Get sessions for a meeting (GP)
   */
  public async getMeetingSessions(meetingKey: number): Promise<OpenF1Session[]> {
    try {
      const res = await fetch(`${this.baseUrl}/sessions?meeting_key=${meetingKey}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  /**
   * Get drivers for a session
   */
  public async getSessionDrivers(sessionKey: number): Promise<OpenF1Driver[]> {
    try {
      const res = await fetch(`${this.baseUrl}/drivers?session_key=${sessionKey}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  /**
   * Get ALL laps, stints, and pit stops for a session and compute best lap & tyre/pit stats per driver
   */
  public async getSessionBestLaps(sessionKey: number): Promise<BestLapResult[]> {
    try {
      const [lapsRes, posRes, driversRes, stintsRes, pitRes] = await Promise.all([
        fetch(`${this.baseUrl}/laps?session_key=${sessionKey}`),
        fetch(`${this.baseUrl}/position?session_key=${sessionKey}`),
        fetch(`${this.baseUrl}/drivers?session_key=${sessionKey}`),
        fetch(`${this.baseUrl}/stints?session_key=${sessionKey}`),
        fetch(`${this.baseUrl}/pit?session_key=${sessionKey}`),
      ]);

      if (!lapsRes.ok) return [];

      const laps: OpenF1Lap[] = await lapsRes.json();
      const positions: OpenF1Position[] = posRes.ok ? await posRes.json() : [];
      const drivers: OpenF1Driver[] = driversRes.ok ? await driversRes.json() : [];
      const stintsRaw: any[] = stintsRes.ok ? await stintsRes.json() : [];
      const pitsRaw: any[] = pitRes.ok ? await pitRes.json() : [];

      const normalizeCompound = (raw?: string): 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET' => {
        const up = String(raw || '').toUpperCase().trim();
        if (up.includes('HARD') || up === 'H' || up === 'C1' || up === 'C2') return 'HARD';
        if (up.includes('MED') || up === 'M' || up === 'C3') return 'MEDIUM';
        if (up.includes('INT') || up === 'I') return 'INTERMEDIATE';
        if (up.includes('WET') || up === 'W') return 'WET';
        return 'SOFT';
      };

      // Build driver map
      const driverMap = new Map<number, OpenF1Driver>();
      drivers.forEach(d => driverMap.set(d.driver_number, d));

      // Compute stints per driver
      const driverStintsMap = new Map<number, Array<{ stintNumber: number; compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET'; age: number; used: boolean; lapEnd: number }>>();
      if (Array.isArray(stintsRaw)) {
        for (const st of stintsRaw) {
          const dNum = Number(st.driver_number);
          if (!dNum) continue;
          const lapStart = Number(st.lap_start) || 1;
          const lapEnd = Number(st.lap_end) || lapStart;
          const ageAtStart = Number(st.tyre_age_at_start) || 0;
          const stintLaps = Math.max(1, lapEnd - lapStart + 1);
          const totalAge = ageAtStart + stintLaps;
          const list = driverStintsMap.get(dNum) || [];
          list.push({
            stintNumber: Number(st.stint_number) || (list.length + 1),
            compound: normalizeCompound(st.compound),
            age: totalAge,
            used: ageAtStart > 0,
            lapEnd,
          });
          driverStintsMap.set(dNum, list);
        }
        driverStintsMap.forEach((list, k) => {
          list.sort((a, b) => a.stintNumber - b.stintNumber);
          driverStintsMap.set(k, list);
        });
      }

      // Compute pit stop count per driver from /pit endpoint
      const driverPitCountMap = new Map<number, number>();
      if (Array.isArray(pitsRaw)) {
        for (const p of pitsRaw) {
          const dNum = Number(p.driver_number);
          if (!dNum) continue;
          driverPitCountMap.set(dNum, (driverPitCountMap.get(dNum) || 0) + 1);
        }
      }

      // Compute best lap, last lap, and max lap number per driver
      const bestLaps = new Map<number, {
        dur: number;
        lastDur: number;
        s1: number | null;
        s2: number | null;
        s3: number | null;
        speedTrap: number | null;
        maxLap: number;
      }>();

      laps.forEach(lap => {
        const prev = bestLaps.get(lap.driver_number);
        const maxLap = Math.max(prev?.maxLap || 0, Number(lap.lap_number) || 0);
        if (!lap.lap_duration || lap.is_pit_out_lap) {
          if (prev) prev.maxLap = maxLap;
          return;
        }
        if (!prev) {
          bestLaps.set(lap.driver_number, {
            dur: lap.lap_duration,
            lastDur: lap.lap_duration,
            s1: lap.duration_sector_1,
            s2: lap.duration_sector_2,
            s3: lap.duration_sector_3,
            speedTrap: lap.st_speed,
            maxLap,
          });
        } else {
          prev.lastDur = lap.lap_duration;
          prev.maxLap = maxLap;
          if (lap.lap_duration < prev.dur) {
            prev.dur = lap.lap_duration;
            prev.s1 = lap.duration_sector_1 ?? prev.s1;
            prev.s2 = lap.duration_sector_2 ?? prev.s2;
            prev.s3 = lap.duration_sector_3 ?? prev.s3;
            prev.speedTrap = lap.st_speed ?? prev.speedTrap;
          }
        }
      });

      // Compute final positions from position data (last known position per driver)
      const finalPositions = new Map<number, number>();
      positions.forEach(p => {
        finalPositions.set(p.driver_number, p.position);
      });

      // Build results
      const results: BestLapResult[] = [];
      bestLaps.forEach((lap, driverNum) => {
        const driver = driverMap.get(driverNum);
        const stints = driverStintsMap.get(driverNum) || [];
        const latestStint = stints.length > 0 ? stints[stints.length - 1] : undefined;
        const stintBasedPits = stints.length > 1 ? stints.length - 1 : 0;
        const explicitPits = driverPitCountMap.get(driverNum) || 0;
        const pitStops = Math.max(explicitPits, stintBasedPits);
        const maxStintLap = stints.reduce((acc, s) => Math.max(acc, s.lapEnd), 0);
        const lapsCompleted = Math.max(lap.maxLap, maxStintLap);

        results.push({
          driverNumber: driverNum,
          nameAcronym: driver?.name_acronym || String(driverNum),
          teamName: driver?.team_name || 'Unknown',
          teamColor: driver?.team_colour ? `#${driver.team_colour}` : '#ffffff',
          bestLapSec: lap.dur,
          bestLapFormatted: formatLapTime(lap.dur),
          lastLapFormatted: formatLapTime(lap.lastDur),
          s1: lap.s1,
          s2: lap.s2,
          s3: lap.s3,
          speedTrap: lap.speedTrap,
          finalPosition: finalPositions.get(driverNum) || 99,
          lapsCompleted,
          pitStops,
          compound: latestStint?.compound || 'MEDIUM',
          tyreAge: latestStint?.age || Math.max(1, lapsCompleted),
          tyreUsed: latestStint?.used ?? false,
          stints: stints.map(s => ({ compound: s.compound, age: s.age, used: s.used })),
        });
      });

      // Sort by finalPosition if available (e.g. Race), or by bestLapSec
      results.sort((a, b) => {
        if (a.finalPosition !== 99 && b.finalPosition !== 99 && a.finalPosition !== b.finalPosition) {
          return a.finalPosition - b.finalPosition;
        }
        return a.bestLapSec - b.bestLapSec;
      });

      // Re-assign sequential positions
      results.forEach((r, i) => { r.finalPosition = i + 1; });

      return results;
    } catch (e) {
      console.warn('[OpenF1] Failed to fetch session best laps:', e);
      return [];
    }
  }

  /**
   * Get latest car telemetry for a driver in a session (last known data point)
   */
  public async getLatestCarTelemetry(sessionKey: number, driverNumber: number): Promise<OpenF1CarData | null> {
    try {
      const res = await fetch(`${this.baseUrl}/car_data?session_key=${sessionKey}&driver_number=${driverNumber}`);
      if (!res.ok) return null;
      const data: OpenF1CarData[] = await res.json();
      if (!data || data.length === 0) return null;
      return data[data.length - 1]; // Latest data point
    } catch {
      return null;
    }
  }

  /**
   * Get official positions for a session
   */
  public async getSessionPositions(sessionKey: number): Promise<OpenF1Position[]> {
    try {
      const res = await fetch(`${this.baseUrl}/position?session_key=${sessionKey}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  /**
   * Get official car telemetry for a driver in a session
   */
  public async getDriverTelemetry(sessionKey: number, driverNumber: number): Promise<OpenF1CarData[]> {
    try {
      const res = await fetch(`${this.baseUrl}/car_data?session_key=${sessionKey}&driver_number=${driverNumber}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  /**
   * Get all laps for a specific driver in a session
   */
  public async getDriverLaps(sessionKey: number | string, driverNumber: number): Promise<OpenF1Lap[]> {
    try {
      const res = await fetch(`${this.baseUrl}/laps?session_key=${sessionKey}&driver_number=${driverNumber}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  /**
   * Get all stints for a specific driver in a session
   */
  public async getDriverStints(sessionKey: number | string, driverNumber: number): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/stints?session_key=${sessionKey}&driver_number=${driverNumber}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}

export const officialF1Api = new OfficialF1Service();
