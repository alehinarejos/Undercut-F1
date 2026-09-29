import { 
  OFFICIAL_DRIVER_STANDINGS, 
  OFFICIAL_CONSTRUCTOR_STANDINGS, 
  getTeamColor, 
  getDriverFlag 
} from '../data/officialStandings';
import type { 
  DriverStanding, 
  ConstructorStanding 
} from '../data/officialStandings';
import { RACE_RESULTS_2026 } from '../data/raceResults2026';

const STANDINGS_CACHE_KEY = 'f1_official_standings_cache_v3';

export function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/f1 team|racing|team/gi, '').trim();
}

export function getOfficial2026Podiums(): { 
  driverPodiums: Record<string, number>; 
  constructorPodiums: Record<string, number>;
} {
  const driverPodiums: Record<string, number> = {};
  const constructorPodiums: Record<string, number> = {};

  Object.values(RACE_RESULTS_2026).forEach((roundResults) => {
    roundResults.forEach((res) => {
      const pos = res.position;
      if (pos && pos >= 1 && pos <= 3) {
        driverPodiums[res.code] = (driverPodiums[res.code] || 0) + 1;
        const normTeam = normalizeTeamName(res.team);
        constructorPodiums[res.team] = (constructorPodiums[res.team] || 0) + 1;
        if (normTeam && normTeam !== res.team) {
          constructorPodiums[normTeam] = (constructorPodiums[normTeam] || 0) + 1;
        }
      }
    });
  });

  return { driverPodiums, constructorPodiums };
}

export interface StandingsSyncState {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
  season: string;
  round: number;
  lastUpdated: Date | null;
  isSyncing: boolean;
  syncSuccess: boolean;
  syncCount: number;
  autoSyncActive: boolean;
  statusMessage: string;
}

interface CachedStandingsPayload {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
  season: string;
  round: number;
  timestamp: string;
}

async function fetchWithMirrorFallback(primaryUrl: string, mirrorUrl: string): Promise<any> {
  try {
    const res = await fetch(primaryUrl, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch {
    // Try secondary mirror
  }
  const resMirror = await fetch(mirrorUrl, { cache: 'no-store' });
  if (!resMirror.ok) {
    throw new Error(`HTTP Error: ${resMirror.status}`);
  }
  return await resMirror.json();
}

class StandingsSyncService {
  private state: StandingsSyncState = {
    drivers: OFFICIAL_DRIVER_STANDINGS,
    constructors: OFFICIAL_CONSTRUCTOR_STANDINGS,
    season: '2026',
    round: 15,
    lastUpdated: new Date(),
    isSyncing: false,
    syncSuccess: true,
    syncCount: 0,
    autoSyncActive: true,
    statusMessage: 'Inicializando clasificación oficial FIA...',
  };

  private listeners: Set<(state: StandingsSyncState) => void> = new Set();
  private pollIntervalId: number | null = null;

  constructor() {
    this.hydrateFromCache();
    this.startAutoSync(60000);
    this.syncStandings(false);
  }

  private hydrateFromCache(): void {
    try {
      const raw = localStorage.getItem(STANDINGS_CACHE_KEY);
      if (!raw) return;
      const parsed: CachedStandingsPayload = JSON.parse(raw);
      if (Array.isArray(parsed.drivers) && parsed.drivers.length > 0 && Array.isArray(parsed.constructors) && parsed.constructors.length > 0) {
        this.state.drivers = parsed.drivers;
        this.state.constructors = parsed.constructors;
        this.state.season = parsed.season || '2026';
        this.state.round = parsed.round || 15;
        this.state.lastUpdated = parsed.timestamp ? new Date(parsed.timestamp) : new Date();
        this.state.statusMessage = `Clasificación oficial FIA cargada desde caché (${this.state.season} R${this.state.round})`;
      }
    } catch {
      // Ignore malformed cache
    }
  }

  private saveToCache(drivers: DriverStanding[], constructors: ConstructorStanding[], season: string, round: number): void {
    try {
      const payload: CachedStandingsPayload = {
        drivers,
        constructors,
        season,
        round,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(STANDINGS_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Storage quota full or unavailable
    }
  }

  public getState(): StandingsSyncState {
    return this.state;
  }

  public subscribe(listener: (state: StandingsSyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  public startAutoSync(intervalMs: number = 60000) {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }
    this.pollIntervalId = window.setInterval(() => {
      this.syncStandings(false);
    }, intervalMs);
    this.state.autoSyncActive = true;
    this.notify();
  }

  public stopAutoSync() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.state.autoSyncActive = false;
    this.notify();
  }

  public async triggerRaceFinished(raceName?: string): Promise<void> {
    this.state.statusMessage = raceName
      ? `🏁 Sesión finalizada (${raceName}). Sincronizando clasificación oficial FIA...`
      : '🏁 Sesión finalizada. Sincronizando clasificación oficial FIA...';
    this.notify();
    await this.syncStandings(true);
  }

  /**
   * Consulta directa a la API oficial de clasificación (Jolpica / Ergast F1 API)
   * sin bloqueos artificiales y con persistencia SWR en localStorage.
   */
  public async syncStandings(isManualOrEvent: boolean = false): Promise<void> {
    if (this.state.isSyncing) return;

    this.state.isSyncing = true;
    if (isManualOrEvent) {
      this.state.statusMessage = 'Sincronizando puntos y clasificación oficial FIA en directo...';
    }
    this.notify();

    try {
      const [dataDrivers, dataConstructors] = await Promise.all([
        fetchWithMirrorFallback(
          'https://api.jolpi.ca/ergast/f1/current/driverStandings.json',
          'https://api.jolpica.net/ergast/f1/current/driverStandings.json'
        ),
        fetchWithMirrorFallback(
          'https://api.jolpi.ca/ergast/f1/current/constructorStandings.json',
          'https://api.jolpica.net/ergast/f1/current/constructorStandings.json'
        ),
      ]);

      const standingsMeta = dataDrivers?.MRData?.StandingsTable?.StandingsLists?.[0];
      const apiSeason = String(standingsMeta?.season || '2026');
      const apiRound = parseInt(standingsMeta?.round || '1', 10);

      const rawDriverList = standingsMeta?.DriverStandings;
      const rawConstructorList = dataConstructors?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings;

      const { driverPodiums, constructorPodiums } = getOfficial2026Podiums();

      if (Array.isArray(rawDriverList) && rawDriverList.length > 0) {
        const updatedDrivers: DriverStanding[] = rawDriverList.map((item: any, index: number) => {
          const code = (
            item.Driver?.code ||
            item.Driver?.familyName?.slice(0, 3) ||
            'DRV'
          ).toUpperCase();
          const teamName = item.Constructors?.[0]?.name || 'F1 Team';
          const existing = OFFICIAL_DRIVER_STANDINGS.find((d) => d.code === code);
          const wins = parseInt(item.wins, 10) || 0;
          const exactPodiums =
            driverPodiums[code] !== undefined
              ? Math.max(driverPodiums[code], wins)
              : Math.max(existing?.podiums || 0, wins);

          return {
            position: parseInt(item.position, 10) || index + 1,
            driverId: item.Driver?.driverId || code.toLowerCase(),
            code,
            number: parseInt(item.Driver?.permanentNumber, 10) || existing?.number || 0,
            name:
              `${item.Driver?.givenName || ''} ${item.Driver?.familyName || ''}`.trim() ||
              existing?.name ||
              code,
            team: teamName,
            teamColor: getTeamColor(teamName),
            points: parseFloat(item.points) || 0,
            wins,
            podiums: exactPodiums,
            flag: getDriverFlag(code, item.Driver?.nationality),
          };
        });

        updatedDrivers.sort((a, b) => b.points - a.points || b.wins - a.wins || a.position - b.position);
        updatedDrivers.forEach((d, idx) => {
          d.position = idx + 1;
        });

        this.state.drivers = updatedDrivers;
      }

      if (Array.isArray(rawConstructorList) && rawConstructorList.length > 0) {
        const updatedConstructors: ConstructorStanding[] = rawConstructorList.map((item: any, index: number) => {
          const rawName = item.Constructor?.name || 'F1 Team';
          const normTeam = normalizeTeamName(rawName);
          const existing = OFFICIAL_CONSTRUCTOR_STANDINGS.find(
            (c) =>
              c.team.toLowerCase() === rawName.toLowerCase() ||
              normalizeTeamName(c.team) === normTeam
          );
          const teamName = existing ? existing.team : rawName;
          const wins = parseInt(item.wins, 10) || 0;
          const exactPodiums =
            constructorPodiums[teamName] !== undefined
              ? Math.max(constructorPodiums[teamName], wins)
              : constructorPodiums[normTeam] !== undefined
              ? Math.max(constructorPodiums[normTeam], wins)
              : Math.max(existing?.podiums || 0, wins);

          return {
            position: parseInt(item.position, 10) || index + 1,
            team: teamName,
            teamColor: getTeamColor(teamName),
            points: parseFloat(item.points) || 0,
            wins,
            podiums: exactPodiums,
          };
        });

        updatedConstructors.sort((a, b) => b.points - a.points || b.wins - a.wins || a.position - b.position);
        updatedConstructors.forEach((c, idx) => {
          c.position = idx + 1;
        });

        this.state.constructors = updatedConstructors;
      }

      this.state.season = apiSeason;
      this.state.round = apiRound;
      this.state.lastUpdated = new Date();
      this.state.syncSuccess = true;
      this.state.syncCount += 1;
      this.state.statusMessage = `Clasificación oficial FIA sincronizada (${new Date().toLocaleTimeString()}) — Temporada ${apiSeason} Ronda ${apiRound}`;

      this.saveToCache(this.state.drivers, this.state.constructors, apiSeason, apiRound);
    } catch (err: any) {
      console.warn('Error consultando API Jolpica/Ergast, manteniendo últimos datos oficiales registrados:', err);
      this.state.syncSuccess = false;
      this.state.statusMessage = `Últimos datos oficiales conservados (${this.state.lastUpdated?.toLocaleTimeString() || 'OK'})`;
    } finally {
      this.state.isSyncing = false;
      this.notify();
    }
  }
}

export const standingsSyncService = new StandingsSyncService();
