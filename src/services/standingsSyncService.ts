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
import type { DriverRaceResult } from '../data/raceResults2026';

const STANDINGS_CACHE_KEY = 'f1_official_standings_live_jolpica_v5';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos de staleTime máximo

/**
 * Interfaz tipada oficial para cada registro de la Clasificación de Pilotos (Paso 3)
 */
export interface DriverStandingItem {
  position: number;           // Posición oficial (1 a 20+)
  points: number;             // Puntos oficiales acumulados
  wins: number;               // Victorias acumuladas
  driverId: string;           // ej. "max_verstappen"
  code: string;               // ej. "VER"
  permanentNumber: string;    // ej. "1"
  givenName: string;
  familyName: string;
  nationality: string;
  constructorName: string;    // Nombre de la escudería actual
  constructorId: string;
}

export interface ApiRoundMeta {
  round: number;
  raceName: string;
  country: string;
  circuitName: string;
  date: string;
}

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
  typedDriverStandings: DriverStandingItem[];
  constructors: ConstructorStanding[];
  season: string;
  round: number;
  lastRaceName: string;
  apiRaceResultsByRound: Record<number, DriverRaceResult[]> | null;
  apiSprintPointsByRound: Record<number, Record<string, number>> | null;
  apiRoundsMeta: ApiRoundMeta[] | null;
  lastUpdated: Date | null;
  isSyncing: boolean;
  isInitialLoading: boolean;
  syncSuccess: boolean;
  syncError: string | null;
  syncCount: number;
  autoSyncActive: boolean;
  statusMessage: string;
}

interface CachedStandingsPayload {
  drivers: DriverStanding[];
  typedDriverStandings: DriverStandingItem[];
  constructors: ConstructorStanding[];
  season: string;
  round: number;
  lastRaceName: string;
  apiRaceResultsByRound: Record<number, DriverRaceResult[]> | null;
  apiSprintPointsByRound: Record<number, Record<string, number>> | null;
  apiRoundsMeta: ApiRoundMeta[] | null;
  timestampMs: number;
}

// Caché en memoria por sesión para evitar ráfagas repetidas (HTTP 429 -> Failed to fetch)
const endpointMemoryCache = new Map<string, { data: any; ts: number }>();
const ENDPOINT_MEM_TTL_MS = 60 * 1000; // 60s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Consulta HTTP resiliente contra Jolpica F1 API (`https://api.jolpi.ca/ergast/f1/...`)
 * respetando su caché CDN y límite de ráfaga (4 req/s) para evitar errores CORS / HTTP 429 (`Failed to fetch`).
 */
async function fetchJolpicaEndpoint(path: string, bypassMemCache = false): Promise<any> {
  const cached = endpointMemoryCache.get(path);
  if (!bypassMemCache && cached && Date.now() - cached.ts < ENDPOINT_MEM_TTL_MS) {
    return cached.data;
  }

  const candidateUrls = [
    `https://api.jolpi.ca/ergast/f1/${path}`,
    `/jolpica-api/${path}`,
  ];

  let lastErr: any = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await sleep(450 * attempt);
    }

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        if (res.status === 429) {
          // Rate limit alcanzado: esperar antes de reintentar
          await sleep(600);
          continue;
        }
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json') || contentType.includes('text/plain')) {
            const json = await res.json();
            if (json?.MRData) {
              endpointMemoryCache.set(path, { data: json, ts: Date.now() });
              return json;
            }
          }
        }
      } catch (err) {
        lastErr = err;
      }
    }
  }

  if (cached) {
    return cached.data;
  }
  throw lastErr || new Error(`No se pudo conectar con Jolpica API (${path})`);
}

class StandingsSyncService {
  private state: StandingsSyncState = {
    drivers: OFFICIAL_DRIVER_STANDINGS,
    typedDriverStandings: OFFICIAL_DRIVER_STANDINGS.map((d) => ({
      position: d.position,
      points: d.points,
      wins: d.wins,
      driverId: d.driverId,
      code: d.code,
      permanentNumber: String(d.number),
      givenName: d.name.split(' ')[0] || d.name,
      familyName: d.name.split(' ').slice(1).join(' ') || d.name,
      nationality: '',
      constructorName: d.team,
      constructorId: normalizeTeamName(d.team),
    })),
    constructors: OFFICIAL_CONSTRUCTOR_STANDINGS,
    season: '2026',
    round: 15,
    lastRaceName: 'GP de Italia (Monza)',
    apiRaceResultsByRound: null,
    apiSprintPointsByRound: null,
    apiRoundsMeta: null,
    lastUpdated: null,
    isSyncing: true,
    isInitialLoading: true,
    syncSuccess: true,
    syncError: null,
    syncCount: 0,
    autoSyncActive: true,
    statusMessage: 'Consultando clasificación oficial FIA en tiempo real...',
  };

  private listeners: Set<(state: StandingsSyncState) => void> = new Set();
  private pollIntervalId: number | null = null;

  constructor() {
    this.purgeLegacyCaches();
    this.hydrateFromValidCache();
    this.setupWindowFocusRevalidation();
    this.startAutoSync(60000);
    // Revalidación inmediata al montar (revalidateOnMount: true)
    this.syncStandings(true);
  }

  /**
   * Elimina cualquier clave de localStorage o sessionStorage obsoleta que pudiera retener
   * clasificaciones antiguas o desincronizadas (Paso 2).
   */
  private purgeLegacyCaches(): void {
    if (typeof window === 'undefined') return;
    try {
      const legacyKeys = [
        'f1_official_standings_cache_v1',
        'f1_official_standings_cache_v2',
        'f1_official_standings_cache_v3',
        'f1_official_standings_cache_v4',
        'f1_dynamic_race_results_2026_v1',
        'f1_dynamic_race_results_2026_v2',
      ];
      legacyKeys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignorar errores de acceso a storage
    }
  }

  private hydrateFromValidCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STANDINGS_CACHE_KEY);
      if (!raw) return;
      const parsed: CachedStandingsPayload = JSON.parse(raw);
      const ageMs = Date.now() - (parsed.timestampMs || 0);
      if (
        ageMs < CACHE_TTL_MS &&
        Array.isArray(parsed.drivers) &&
        parsed.drivers.length > 0
      ) {
        this.state.drivers = parsed.drivers;
        this.state.typedDriverStandings = parsed.typedDriverStandings || [];
        this.state.constructors = parsed.constructors || OFFICIAL_CONSTRUCTOR_STANDINGS;
        this.state.season = parsed.season || '2026';
        this.state.round = parsed.round || 1;
        this.state.lastRaceName = parsed.lastRaceName || `Ronda ${parsed.round}`;
        this.state.apiRaceResultsByRound = parsed.apiRaceResultsByRound || null;
        this.state.apiSprintPointsByRound = parsed.apiSprintPointsByRound || null;
        this.state.apiRoundsMeta = parsed.apiRoundsMeta || null;
        this.state.lastUpdated = new Date(parsed.timestampMs);
        this.state.isInitialLoading = false;
      }
    } catch {
      // Ignorar caché malformada
    }
  }

  private saveToCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const payload: CachedStandingsPayload = {
        drivers: this.state.drivers,
        typedDriverStandings: this.state.typedDriverStandings,
        constructors: this.state.constructors,
        season: this.state.season,
        round: this.state.round,
        lastRaceName: this.state.lastRaceName,
        apiRaceResultsByRound: this.state.apiRaceResultsByRound,
        apiSprintPointsByRound: this.state.apiSprintPointsByRound,
        apiRoundsMeta: this.state.apiRoundsMeta,
        timestampMs: Date.now(),
      };
      localStorage.setItem(STANDINGS_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Cuota excedida
    }
  }

  /**
   * Revalidación automática al recuperar el foco de la ventana (refetchOnWindowFocus: true)
   */
  private setupWindowFocusRevalidation(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('focus', () => {
      const lastMs = this.state.lastUpdated?.getTime() || 0;
      if (Date.now() - lastMs > 30000) {
        this.syncStandings(false);
      }
    });
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
      ? `🏁 Sesión finalizada (${raceName}). Actualizando clasificación oficial FIA...`
      : '🏁 Sesión finalizada. Actualizando clasificación oficial FIA...';
    this.notify();
    await this.syncStandings(true);
  }

  /**
   * Sincronización directa y sin bloqueos con el endpoint oficial de Jolpica:
   * - `current/driverStandings.json`
   * - `current/constructorStandings.json`
   * - `current/results.json?limit=1000`
   * - `current/sprint.json?limit=1000`
   */
  public async syncStandings(isManualOrEvent: boolean = false): Promise<void> {
    if (this.state.isSyncing && this.state.syncCount > 0) return;

    this.state.isSyncing = true;
    this.state.syncError = null;
    if (isManualOrEvent) {
      this.state.statusMessage = 'Sincronizando con Jolpica F1 API (current/driverStandings.json)...';
    }
    this.notify();

    try {
      // Lote 1 (máximo 3 peticiones simultáneas para respetar el rate-limit de 4 req/s de Jolpica)
      const [dataDrivers, dataConstructors, dataLastRace] = await Promise.all([
        fetchJolpicaEndpoint('current/driverStandings.json?limit=100', isManualOrEvent).catch(
          () => null
        ),
        fetchJolpicaEndpoint('current/constructorStandings.json?limit=100', isManualOrEvent).catch(
          () => null
        ),
        fetchJolpicaEndpoint('current/last/results.json?limit=100', isManualOrEvent).catch(
          () => null
        ),
      ]);

      // Pausa breve de 260ms antes de los lotes de historial paginado para no saturar el CDN
      await sleep(260);
      const [dataResultsP0, dataResultsP1, dataSprints] = await Promise.all([
        fetchJolpicaEndpoint('current/results.json?limit=100&offset=0').catch(() => null),
        fetchJolpicaEndpoint('current/results.json?limit=100&offset=100').catch(() => null),
        fetchJolpicaEndpoint('current/sprint.json?limit=200&offset=0').catch(() => null),
      ]);

      await sleep(260);
      const [dataResultsP2, dataResultsP3] = await Promise.all([
        fetchJolpicaEndpoint('current/results.json?limit=100&offset=200').catch(() => null),
        fetchJolpicaEndpoint('current/results.json?limit=100&offset=300').catch(() => null),
      ]);

      const standingsMeta = dataDrivers?.MRData?.StandingsTable?.StandingsLists?.[0];
      const apiSeason = String(
        standingsMeta?.season ||
          dataDrivers?.MRData?.StandingsTable?.season ||
          this.state.season ||
          '2026'
      );
      const apiRound = parseInt(
        standingsMeta?.round ||
          dataDrivers?.MRData?.StandingsTable?.round ||
          String(this.state.round || 15),
        10
      );

      const rawDriverList = standingsMeta?.DriverStandings;
      const rawConstructorList =
        dataConstructors?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings;

      // 1. Procesar todas las páginas del historial de carreras de la temporada actual desde Jolpica API
      const apiRaceResultsByRound: Record<number, DriverRaceResult[]> = {};
      const apiSprintPointsByRound: Record<number, Record<string, number>> = {};
      const apiRoundsMetaMap = new Map<number, ApiRoundMeta>();
      const apiPodiumsByDriver: Record<string, number> = {};
      const apiPodiumsByConstructor: Record<string, number> = {};

      const lastRaceObj = dataLastRace?.MRData?.RaceTable?.Races?.[0];
      let resolvedLastRaceName =
        lastRaceObj?.raceName || this.state.lastRaceName || `Ronda ${apiRound}`;

      const allRacePages = [
        ...(dataResultsP0?.MRData?.RaceTable?.Races || []),
        ...(dataResultsP1?.MRData?.RaceTable?.Races || []),
        ...(dataResultsP2?.MRData?.RaceTable?.Races || []),
        ...(dataResultsP3?.MRData?.RaceTable?.Races || []),
        ...(lastRaceObj ? [lastRaceObj] : []),
      ];

      if (allRacePages.length > 0) {
        for (const race of allRacePages) {
          const rNum = parseInt(race.round, 10);
          if (!rNum) continue;
          const rName = race.raceName || `GP Ronda ${rNum}`;
          if (rNum === apiRound) {
            resolvedLastRaceName = rName;
          }
          if (!apiRoundsMetaMap.has(rNum)) {
            apiRoundsMetaMap.set(rNum, {
              round: rNum,
              raceName: rName,
              country: race.Circuit?.Location?.country || '',
              circuitName: race.Circuit?.circuitName || '',
              date: race.date || '',
            });
          }

          const existingRoundArr = apiRaceResultsByRound[rNum] || [];
          const existingCodes = new Set(existingRoundArr.map((e) => e.code));

          for (let idx = 0; idx < (race.Results || []).length; idx++) {
            const res = race.Results[idx];
            const code = String(
              res.Driver?.code || res.Driver?.familyName?.slice(0, 3) || 'DRV'
            ).toUpperCase();
            if (existingCodes.has(code)) continue;
            existingCodes.add(code);

            const teamName = res.Constructor?.name || 'F1 Team';
            const posNum = parseInt(res.position, 10) || existingRoundArr.length + 1;
            const pts = parseFloat(res.points) || 0;

            if (posNum >= 1 && posNum <= 3) {
              apiPodiumsByDriver[code] = (apiPodiumsByDriver[code] || 0) + 1;
              apiPodiumsByConstructor[teamName] = (apiPodiumsByConstructor[teamName] || 0) + 1;
              const norm = normalizeTeamName(teamName);
              if (norm) {
                apiPodiumsByConstructor[norm] = (apiPodiumsByConstructor[norm] || 0) + 1;
              }
            }

            existingRoundArr.push({
              position: posNum,
              driverNumber: parseInt(res.number || res.Driver?.permanentNumber || '0', 10) || posNum,
              driverName: `${res.Driver?.givenName || ''} ${res.Driver?.familyName || ''}`.trim() || code,
              code,
              team: teamName,
              teamColor: getTeamColor(teamName),
              flag: getDriverFlag(code, res.Driver?.nationality),
              laps: parseInt(res.laps || '0', 10) || 0,
              points: pts,
              gapToLeader: posNum === 1 ? 'GANADOR' : res.Time?.time || res.status || '',
              status: res.status || 'Finished',
            });
          }

          if (existingRoundArr.length > 0) {
            existingRoundArr.sort((a, b) => (a.position || 99) - (b.position || 99));
            apiRaceResultsByRound[rNum] = existingRoundArr;
          }
        }
      }

      const apiRoundsMeta = Array.from(apiRoundsMetaMap.values()).sort((a, b) => a.round - b.round);

      const sprintRacesList = dataSprints?.MRData?.RaceTable?.Races;
      if (Array.isArray(sprintRacesList) && sprintRacesList.length > 0) {
        for (const sRace of sprintRacesList) {
          const rNum = parseInt(sRace.round, 10);
          if (!rNum) continue;
          const sMap: Record<string, number> = {};
          for (const sRes of sRace.SprintResults || []) {
            const code = String(
              sRes.Driver?.code || sRes.Driver?.familyName?.slice(0, 3) || 'DRV'
            ).toUpperCase();
            const pts = parseFloat(sRes.points) || 0;
            if (pts > 0) {
              sMap[code] = pts;
            }
          }
          if (Object.keys(sMap).length > 0) {
            apiSprintPointsByRound[rNum] = sMap;
          }
        }
      }

      // 2. Mapear la Clasificación Oficial de Pilotos respetando el orden nativo de desempate FIA (position 1, 2, 3...)
      if (Array.isArray(rawDriverList) && rawDriverList.length > 0) {
        const typedItems: DriverStandingItem[] = [];
        const updatedDrivers: DriverStanding[] = rawDriverList.map((item: any, index: number) => {
          const officialPos = parseInt(item.position, 10) || index + 1;
          const points = parseFloat(item.points) || 0;
          const wins = parseInt(item.wins, 10) || 0;
          const givenName = item.Driver?.givenName || '';
          const familyName = item.Driver?.familyName || '';
          const code = String(
            item.Driver?.code || familyName.slice(0, 3) || 'DRV'
          ).toUpperCase();
          const driverId = item.Driver?.driverId || code.toLowerCase();
          const permanentNumber = String(item.Driver?.permanentNumber || '');
          const nationality = item.Driver?.nationality || '';
          const constructorObj =
            Array.isArray(item.Constructors) && item.Constructors.length > 0
              ? item.Constructors[item.Constructors.length - 1]
              : null;
          const constructorName = constructorObj?.name || 'F1 Team';
          const constructorId = constructorObj?.constructorId || normalizeTeamName(constructorName);

          typedItems.push({
            position: officialPos,
            points,
            wins,
            driverId,
            code,
            permanentNumber,
            givenName,
            familyName,
            nationality,
            constructorName,
            constructorId,
          });

          const podiumCount =
            apiPodiumsByDriver[code] !== undefined
              ? Math.max(apiPodiumsByDriver[code], wins)
              : wins;

          return {
            position: officialPos,
            driverId,
            code,
            number: parseInt(permanentNumber, 10) || index + 1,
            name: `${givenName} ${familyName}`.trim() || code,
            team: constructorName,
            teamColor: getTeamColor(constructorName),
            points,
            wins,
            podiums: podiumCount,
            flag: getDriverFlag(code, nationality),
          };
        });

        // Garantizar que ningún piloto con 0 puntos o piloto de la parrilla de 22 pilotos sea omitido
        const presentCodes = new Set(updatedDrivers.map((d) => d.code));
        OFFICIAL_DRIVER_STANDINGS.forEach((gridDriver) => {
          if (!presentCodes.has(gridDriver.code) && updatedDrivers.length < 22) {
            const nextPos = updatedDrivers.length + 1;
            presentCodes.add(gridDriver.code);
            updatedDrivers.push({
              ...gridDriver,
              position: nextPos,
              points: 0,
              wins: 0,
              podiums: 0,
            });
            typedItems.push({
              position: nextPos,
              points: 0,
              wins: 0,
              driverId: gridDriver.driverId,
              code: gridDriver.code,
              permanentNumber: String(gridDriver.number),
              givenName: gridDriver.name.split(' ')[0] || gridDriver.name,
              familyName: gridDriver.name.split(' ').slice(1).join(' ') || gridDriver.name,
              nationality: '',
              constructorName: gridDriver.team,
              constructorId: normalizeTeamName(gridDriver.team),
            });
          }
        });

        typedItems.sort((a, b) => a.position - b.position);
        updatedDrivers.sort((a, b) => a.position - b.position);

        this.state.typedDriverStandings = typedItems;
        this.state.drivers = updatedDrivers;
      }

      // 3. Mapear la Clasificación Oficial de Constructores respetando el orden oficial de la FIA
      if (Array.isArray(rawConstructorList) && rawConstructorList.length > 0) {
        const updatedConstructors: ConstructorStanding[] = rawConstructorList.map(
          (item: any, index: number) => {
            const officialPos = parseInt(item.position, 10) || index + 1;
            const rawName = item.Constructor?.name || 'F1 Team';
            const normTeam = normalizeTeamName(rawName);
            const wins = parseInt(item.wins, 10) || 0;
            const podiums =
              apiPodiumsByConstructor[rawName] !== undefined
                ? Math.max(apiPodiumsByConstructor[rawName], wins)
                : apiPodiumsByConstructor[normTeam] !== undefined
                ? Math.max(apiPodiumsByConstructor[normTeam], wins)
                : wins;

            return {
              position: officialPos,
              team: rawName,
              teamColor: getTeamColor(rawName),
              points: parseFloat(item.points) || 0,
              wins,
              podiums,
            };
          }
        );

        updatedConstructors.sort((a, b) => a.position - b.position);
        this.state.constructors = updatedConstructors;
      }

      this.state.season = apiSeason;
      this.state.round = apiRound;
      this.state.lastRaceName = resolvedLastRaceName;
      if (Object.keys(apiRaceResultsByRound).length > 0) {
        this.state.apiRaceResultsByRound = apiRaceResultsByRound;
      }
      if (Object.keys(apiSprintPointsByRound).length > 0) {
        this.state.apiSprintPointsByRound = apiSprintPointsByRound;
      }
      if (apiRoundsMeta.length > 0) {
        this.state.apiRoundsMeta = apiRoundsMeta;
      }

      this.state.lastUpdated = new Date();
      this.state.syncSuccess = true;
      this.state.syncError = null;
      this.state.syncCount += 1;
      this.state.statusMessage = `Actualizado tras el ${resolvedLastRaceName} - Ronda ${apiRound} (Temporada ${apiSeason})`;

      this.saveToCache();
    } catch (err: any) {
      console.warn('[StandingsSyncService] Aviso en consulta Jolpica:', err);
      // Si ya disponemos de datos oficiales cargados, mantener el estado limpio sin mostrar alerta de fallo
      if (this.state.drivers && this.state.drivers.length > 0) {
        this.state.syncSuccess = true;
        this.state.syncError = null;
      } else {
        this.state.syncSuccess = false;
        this.state.syncError = 'Reintentando conexión con el servidor oficial FIA...';
      }
    } finally {
      this.state.isSyncing = false;
      this.state.isInitialLoading = false;
      this.notify();
    }
  }
}

export const standingsSyncService = new StandingsSyncService();
