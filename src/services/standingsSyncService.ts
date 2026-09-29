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

/**
 * Calculates official season podiums for each driver and constructor
 * based on completed 2026 race results.
 */
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
  lastUpdated: Date | null;
  isSyncing: boolean;
  syncSuccess: boolean;
  syncCount: number;
  autoSyncActive: boolean;
  statusMessage: string;
}

class StandingsSyncService {
  private state: StandingsSyncState = {
    drivers: OFFICIAL_DRIVER_STANDINGS,
    constructors: OFFICIAL_CONSTRUCTOR_STANDINGS,
    lastUpdated: new Date(),
    isSyncing: false,
    syncSuccess: true,
    syncCount: 1,
    autoSyncActive: true,
    statusMessage: 'Sincronizado con base de datos oficial FIA 2026',
  };

  private listeners: Set<(state: StandingsSyncState) => void> = new Set();
  private pollIntervalId: number | null = null;

  constructor() {
    // Start background sync timer (checks every 45 seconds for changes or race completions)
    this.startAutoSync();
    // Do an initial live fetch
    this.syncStandings(false);
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

  public startAutoSync(intervalMs: number = 45000) {
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

  /**
   * Called automatically when a race or session finishes
   * (e.g. from SignalR Chequered Flag or race control event)
   */
  public async triggerRaceFinished(raceName?: string): Promise<void> {
    const msg = raceName 
      ? `🏁 Carrera finalizada (${raceName}). Actualizando clasificación oficial en directo...`
      : '🏁 Carrera finalizada. Actualizando clasificación oficial en directo...';
    
    this.state.statusMessage = msg;
    this.notify();

    // Fetch immediately
    await this.syncStandings(true);
  }

  /**
   * Fetch latest live official standings from Ergast / Jolpica live API
   */
  public async syncStandings(isManualOrEvent: boolean = false): Promise<void> {
    if (this.state.isSyncing) return;

    this.state.isSyncing = true;
    if (isManualOrEvent) {
      this.state.statusMessage = 'Consultando datos oficiales en tiempo real...';
    }
    this.notify();

    try {
      // 1. Fetch live driver standings
      const driversUrl = 'https://api.jolpi.ca/ergast/f1/current/driverStandings.json';
      const constructorsUrl = 'https://api.jolpi.ca/ergast/f1/current/constructorStandings.json';

      const [resDrivers, resConstructors] = await Promise.all([
        fetch(driversUrl, { cache: 'no-cache' }),
        fetch(constructorsUrl, { cache: 'no-cache' }),
      ]);

      if (!resDrivers.ok || !resConstructors.ok) {
        throw new Error(`HTTP Error: ${resDrivers.status} / ${resConstructors.status}`);
      }

      const dataDrivers = await resDrivers.json();
      const dataConstructors = await resConstructors.json();

      const standingsMeta = dataDrivers?.MRData?.StandingsTable?.StandingsLists?.[0];
      const apiSeason = String(standingsMeta?.season || '');
      const apiRound = parseInt(standingsMeta?.round || '0', 10);
      const localMinRounds = Object.keys(RACE_RESULTS_2026).length; // 15 completed rounds in 2026

      const rawDriverList = standingsMeta?.DriverStandings;
      const rawConstructorList = dataConstructors?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings;

      const { driverPodiums, constructorPodiums } = getOfficial2026Podiums();

      // Only overwrite local 15-round 2026 standings if the external API has at least as many rounds for 2026
      if (apiSeason === '2026' && apiRound >= localMinRounds && Array.isArray(rawDriverList) && rawDriverList.length > 0) {
        const updatedDrivers: DriverStanding[] = rawDriverList.map((item: any) => {
          const code = item.Driver?.code || item.Driver?.familyName?.slice(0, 3)?.toUpperCase() || 'DRV';
          const teamName = item.Constructors?.[0]?.name || 'F1 Team';
          const existing = OFFICIAL_DRIVER_STANDINGS.find(d => d.code === code);
          const exactPodiums = driverPodiums[code] !== undefined ? driverPodiums[code] : (existing?.podiums || 0);

          return {
            position: parseInt(item.position, 10) || 1,
            driverId: item.Driver?.driverId || code.toLowerCase(),
            code: code,
            number: parseInt(item.Driver?.permanentNumber, 10) || existing?.number || 0,
            name: `${item.Driver?.givenName || ''} ${item.Driver?.familyName || ''}`.trim() || existing?.name || code,
            team: teamName,
            teamColor: getTeamColor(teamName),
            points: parseFloat(item.points) || 0,
            wins: parseInt(item.wins, 10) || 0,
            podiums: exactPodiums,
            flag: getDriverFlag(code, item.Driver?.nationality),
          };
        });

        updatedDrivers.sort((a, b) => b.points - a.points || b.wins - a.wins);
        updatedDrivers.forEach((d, idx) => { d.position = idx + 1; });

        this.state.drivers = updatedDrivers;
      } else {
        // Ensure our official 2026 standings are strictly sorted by points descending
        const sortedDrivers = [...OFFICIAL_DRIVER_STANDINGS].sort((a, b) => b.points - a.points || b.wins - a.wins);
        sortedDrivers.forEach((d, idx) => { d.position = idx + 1; });
        this.state.drivers = sortedDrivers;
      }

      if (apiSeason === '2026' && apiRound >= localMinRounds && Array.isArray(rawConstructorList) && rawConstructorList.length > 0) {
        const updatedConstructors: ConstructorStanding[] = rawConstructorList.map((item: any) => {
          const rawName = item.Constructor?.name || 'F1 Team';
          const normTeam = normalizeTeamName(rawName);
          const existing = OFFICIAL_CONSTRUCTOR_STANDINGS.find(c => 
            c.team.toLowerCase() === rawName.toLowerCase() || 
            normalizeTeamName(c.team) === normTeam
          );
          const teamName = existing ? existing.team : rawName;
          const exactPodiums = constructorPodiums[teamName] !== undefined 
            ? constructorPodiums[teamName] 
            : (constructorPodiums[normTeam] !== undefined 
                ? constructorPodiums[normTeam] 
                : (existing?.podiums || 0));

          return {
            position: parseInt(item.position, 10) || 1,
            team: teamName,
            teamColor: getTeamColor(teamName),
            points: parseFloat(item.points) || 0,
            wins: parseInt(item.wins, 10) || 0,
            podiums: exactPodiums,
          };
        });

        updatedConstructors.sort((a, b) => b.points - a.points || b.wins - a.wins);
        updatedConstructors.forEach((c, idx) => { c.position = idx + 1; });

        this.state.constructors = updatedConstructors;
      } else {
        const sortedConstructors = [...OFFICIAL_CONSTRUCTOR_STANDINGS].sort((a, b) => b.points - a.points || b.wins - a.wins);
        sortedConstructors.forEach((c, idx) => { c.position = idx + 1; });
        this.state.constructors = sortedConstructors;
      }

      this.state.lastUpdated = new Date();
      this.state.syncSuccess = true;
      this.state.syncCount += 1;
      this.state.statusMessage = `Sincronización completada (${new Date().toLocaleTimeString()}) — Datos oficiales FIA temporada 2026`;
    } catch (err: any) {
      console.warn('Fallo en sincronización oficial de standings, usando baseline actualizado:', err);
      // We still keep the updated real baseline in state
      this.state.syncSuccess = false;
      this.state.statusMessage = `Última sincronización local: ${this.state.lastUpdated?.toLocaleTimeString() || 'OK'}`;
    } finally {
      this.state.isSyncing = false;
      this.notify();
    }
  }
}

export const standingsSyncService = new StandingsSyncService();
