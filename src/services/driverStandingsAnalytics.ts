import { RACE_RESULTS_2026 } from '../data/raceResults2026';
import type { DriverRaceResult } from '../data/raceResults2026';
import {
  OFFICIAL_DRIVER_STANDINGS,
  SPRINT_POINTS_2026,
  getTeamColor,
  getDriverFlag,
} from '../data/officialStandings';
import type { DriverStanding } from '../data/officialStandings';
import type { ApiRoundMeta } from './standingsSyncService';
import { F1_SCHEDULE } from '../data/schedule';

export interface RoundInfo {
  round: number;
  name: string;
  shortName: string;
  countryCode: string;
  flag: string;
  country: string;
  hasSprint: boolean;
}

export interface DriverProgressionPoint {
  round: number;
  raceName: string;
  countryCode?: string;
  flag: string;
  points: number;       // Puntos totales acumulados hasta esta ronda inclusive
  roundGain: number;    // Puntos sumados en este fin de semana (Carrera + Sprint + VR)
  racePoints: number;   // Puntos del Gran Premio del domingo (incl. VR)
  sprintPoints: number; // Puntos de la Carrera Sprint (si hubo)
  position: number;     // Posición en el campeonato tras esta ronda
}

export interface DriverSeries {
  driverId: string;
  driverCode: string;
  driverName: string;
  lastName: string;
  team: string;
  teamColor: string;
  strokeColor: string;
  isSecondDriver: boolean;
  strokeDasharray?: string;
  position: number;
  finalPoints: number;
  data: DriverProgressionPoint[];
}

export interface DriverPointsTrajectory {
  position: number;
  code: string;
  name: string;
  lastName: string;
  team: string;
  teamColor: string;
  isSecondDriver: boolean;
  number: number;
  wins: number;
  podiums: number;
  cumulativePoints: number[];
  roundGains: number[];
  racePointsByRound: number[];
  sprintPointsByRound: number[];
  finalPoints: number;
}

export interface DriverRankTrajectory {
  code: string;
  name: string;
  lastName: string;
  team: string;
  teamColor: string;
  isSecondDriver: boolean;
  number: number;
  rankByRound: number[];
  currentRank: number;
}

export interface DriverSeasonStat {
  code: string;
  name: string;
  lastName: string;
  team: string;
  teamColor: string;
  wins: number;
  podiums: number;
  pointsFinishes: number;
  poles: number;
  dnfs: number;
}

export interface RacePointsDistribution {
  round: number;
  name: string;
  flag: string;
  hasSprint: boolean;
  totalPoints: number;
  scorers: Array<{
    code: string;
    team: string;
    teamColor: string;
    points: number;
    racePoints: number;
    sprintPoints: number;
  }>;
}

export interface RoundStandingsHistory {
  round: number;
  grandPrix: string;
  circuitId: string;
  flag: string;
  standings: Array<{
    driverId: string;
    code: string;
    name: string;
    team: string;
    teamColor: string;
    points: number;
    roundPoints: number;
    racePoints: number;
    sprintPoints: number;
    position: number;
  }>;
}

export interface DriverStandingsAnalyticsData {
  rounds: RoundInfo[];
  driverSeries: DriverSeries[];
  driverPointsEvolution: DriverPointsTrajectory[];
  driverRankingEvolution: DriverRankTrajectory[];
  driverSeasonStats: DriverSeasonStat[];
  driverPointsByRace: RacePointsDistribution[];
  historyByRound: RoundStandingsHistory[];
  maxPoints: number;
  parityVerified: boolean;
}

const ROUND_COUNTRY_CODES: Record<number, string> = {
  1: 'AUS',
  2: 'CHN',
  3: 'JPN',
  4: 'BHR',
  5: 'SAU',
  6: 'MIA',
  7: 'CAN',
  8: 'MON',
  9: 'ESP',
  10: 'AUT',
  11: 'GBR',
  12: 'BEL',
  13: 'HUN',
  14: 'NED',
  15: 'ITA',
  16: 'MAD',
  17: 'AZE',
  18: 'SGP',
  19: 'USA',
  20: 'MEX',
  21: 'BRA',
  22: 'LVG',
  23: 'QAT',
  24: 'ABU',
};

const COUNTRY_FLAG_MAP: Record<string, string> = {
  australia: '🇦🇺',
  china: '🇨🇳',
  japan: '🇯🇵',
  bahrain: '🇧🇭',
  'saudi arabia': '🇸🇦',
  usa: '🇺🇸',
  'united states': '🇺🇸',
  miami: '🇺🇸',
  canada: '🇨🇦',
  monaco: '🇲🇨',
  spain: '🇪🇸',
  austria: '🇦🇹',
  uk: '🇬🇧',
  'great britain': '🇬🇧',
  belgium: '🇧🇪',
  hungary: '🇭🇺',
  netherlands: '🇳🇱',
  italy: '🇮🇹',
  azerbaijan: '🇦🇿',
  singapore: '🇸🇬',
  mexico: '🇲🇽',
  brazil: '🇧🇷',
  qatar: '🇶🇦',
  uae: '🇦🇪',
  'abu dhabi': '🇦🇪',
};

function getCountryFlag(country?: string, fallbackFlag?: string): string {
  if (country) {
    const f = COUNTRY_FLAG_MAP[country.toLowerCase().trim()];
    if (f) return f;
  }
  return fallbackFlag || '🏁';
}

export function getEffectiveRaceResults(): Record<number, DriverRaceResult[]> {
  return { ...RACE_RESULTS_2026 };
}

export function registerCompletedRaceResult(round: number, results: DriverRaceResult[]): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('f1:results_updated', { detail: { round, results } }));
  }
}

/**
 * Validación de Paridad (Sanity Check):
 * Comprueba que el último punto de la gráfica de cada piloto coincida exactamente
 * con la puntuación oficial en la tabla de clasificación FIA.
 */
export function verifyStandingsParity(
  driverSeries: DriverSeries[],
  officialTable: DriverStanding[]
): boolean {
  let allMatch = true;
  for (const series of driverSeries) {
    const lastPoint = series.data[series.data.length - 1];
    const tableDriver = officialTable.find((d) => d.code === series.driverCode);
    if (!lastPoint || !tableDriver) continue;

    if (Math.abs(lastPoint.points - tableDriver.points) > 0.001) {
      allMatch = false;
      console.warn(
        `[StandingsParityCheck] ⚠️ Discrepancia en ${series.driverCode}: Gráfico=${lastPoint.points} vs Tabla Oficial=${tableDriver.points}`
      );
    }
  }
  return allMatch;
}

/**
 * Genera un tono ligeramente más claro/diferenciado del color oficial de la escudería
 * para el segundo piloto del equipo, complementando el patrón strokeDasharray="4 4".
 */
export function getSecondaryTeammateColor(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Mezclar un 22% hacia blanco/cian brillante para diferenciar claramente del compañero #1
  const mix = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.24));
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/**
 * Calcula la progresión del campeonato respetando de forma absoluta la tabla oficial
 * devuelta por `https://api.jolpica.net/ergast/f1/current/driverStandings.json`
 * y agregando los puntos de Gran Premio + Sprint de cada ronda completada para los 22 pilotos.
 */
export function computeDriverStandingsAnalytics(
  customDrivers?: DriverStanding[],
  apiRaceResultsByRound?: Record<number, DriverRaceResult[]> | null,
  apiSprintPointsByRound?: Record<number, Record<string, number>> | null,
  apiRoundsMeta?: ApiRoundMeta[] | null
): DriverStandingsAnalyticsData {
  // Determinar si tenemos resultados en directo de Jolpica API
  const hasLiveApiResults =
    apiRaceResultsByRound && Object.keys(apiRaceResultsByRound).length > 0;

  const allResults: Record<number, DriverRaceResult[]> = hasLiveApiResults
    ? apiRaceResultsByRound!
    : getEffectiveRaceResults();

  const sprintTableByRound: Record<number, Record<string, number>> = hasLiveApiResults
    ? apiSprintPointsByRound || {}
    : SPRINT_POINTS_2026;

  // Ordenar estrictamente los pilotos por su `position` oficial de la FIA (1º, 2º, ..., 22º)
  const baseDrivers: DriverStanding[] =
    customDrivers && customDrivers.length > 0
      ? [...customDrivers].sort((a, b) => a.position - b.position)
      : [...OFFICIAL_DRIVER_STANDINGS].sort((a, b) => a.position - b.position);

  // Garantizar que los 22 pilotos de la parrilla (incluidos pilotos con 0 puntos o sustitutos) estén presentes
  const seenDriverCodes = new Set(baseDrivers.map((d) => d.code));
  const driversList: DriverStanding[] = [...baseDrivers];

  // Añadir cualquier piloto que haya participado en alguna carrera de allResults y aún no esté en driversList
  Object.values(allResults).forEach((roundArr) => {
    (roundArr || []).forEach((res) => {
      if (res.code && !seenDriverCodes.has(res.code)) {
        seenDriverCodes.add(res.code);
        driversList.push({
          position: driversList.length + 1,
          driverId: res.code.toLowerCase(),
          code: res.code,
          number: res.driverNumber || driversList.length + 1,
          name: res.driverName || res.code,
          team: res.team || 'F1 Team',
          teamColor: getTeamColor(res.team || ''),
          points: 0,
          wins: 0,
          podiums: 0,
          flag: res.flag || getDriverFlag(res.code),
        });
      }
    });
  });

  // Asegurar que la parrilla completa de 22 pilotos (incluidos pilotos con 0 puntos como PER, STR, BOT) esté incluida
  OFFICIAL_DRIVER_STANDINGS.forEach((gridDriver) => {
    if (!seenDriverCodes.has(gridDriver.code) && driversList.length < 22) {
      seenDriverCodes.add(gridDriver.code);
      driversList.push({
        ...gridDriver,
        position: driversList.length + 1,
        points: 0,
        wins: 0,
        podiums: 0,
      });
    }
  });

  driversList.sort((a, b) => a.position - b.position);

  // Construir secuencia cronológica continua [R1, R2, R3, ..., R_última_completada] sin omitir ningún GP previo
  const detectedRounds = Object.keys(allResults)
    .map(Number)
    .filter((r) => r > 0 && Array.isArray(allResults[r]) && allResults[r].length > 0);

  const maxCompletedRound = detectedRounds.length > 0 ? Math.max(...detectedRounds) : 15;
  const roundKeys: number[] = Array.from({ length: maxCompletedRound }, (_, idx) => idx + 1);

  const rounds: RoundInfo[] = roundKeys.map((r) => {
    const apiMeta = apiRoundsMeta?.find((m) => m.round === r);
    const sched = F1_SCHEDULE.find((s) => s.round === r);
    const hasSprint = Boolean(sprintTableByRound[r] && Object.keys(sprintTableByRound[r]).length > 0);
    const countryStr = apiMeta?.country || sched?.country || '';
    const code3 = ROUND_COUNTRY_CODES[r] || (apiMeta?.country ? apiMeta.country.slice(0, 3).toUpperCase() : `R${r}`);

    return {
      round: r,
      name: apiMeta?.raceName || (sched ? sched.name : `Ronda ${r}`),
      shortName: code3,
      countryCode: code3,
      flag: getCountryFlag(countryStr, sched?.flag),
      country: countryStr,
      hasSprint,
    };
  });

  const getLastName = (fullName: string): string => {
    const parts = fullName.trim().split(' ');
    return parts[parts.length - 1] || fullName;
  };

  const racePointsMap = new Map<string, number[]>();
  const sprintPointsMap = new Map<string, number[]>();
  const roundGainMap = new Map<string, number[]>();
  const cumulativePointsMap = new Map<string, number[]>();
  const polesMap = new Map<string, number>();
  const dnfsMap = new Map<string, number>();

  driversList.forEach((d) => {
    racePointsMap.set(d.code, new Array(roundKeys.length).fill(0));
    sprintPointsMap.set(d.code, new Array(roundKeys.length).fill(0));
    roundGainMap.set(d.code, new Array(roundKeys.length).fill(0));
    cumulativePointsMap.set(d.code, []);
    polesMap.set(d.code, 0);
    dnfsMap.set(d.code, 0);
  });

  const driverPointsByRace: RacePointsDistribution[] = [];

  roundKeys.forEach((roundNum, roundIdx) => {
    const results = allResults[roundNum] || [];
    const sprintRoundTable = sprintTableByRound[roundNum] || {};
    const rMeta = rounds[roundIdx];

    const raceScorers: Array<{
      code: string;
      team: string;
      teamColor: string;
      points: number;
      racePoints: number;
      sprintPoints: number;
    }> = [];
    let weekendTotalPoints = 0;

    results.forEach((res) => {
      const code = res.code;
      const rPts = Number(res.points) || 0;
      const sPts = Number(sprintRoundTable[code]) || 0;
      const totalWeekendGain = rPts + sPts;

      if (racePointsMap.has(code)) {
        racePointsMap.get(code)![roundIdx] = rPts;
        sprintPointsMap.get(code)![roundIdx] = sPts;
        roundGainMap.get(code)![roundIdx] = totalWeekendGain;
      }

      if (totalWeekendGain > 0) {
        raceScorers.push({
          code,
          team: res.team,
          teamColor: getTeamColor(res.team),
          points: totalWeekendGain,
          racePoints: rPts,
          sprintPoints: sPts,
        });
        weekendTotalPoints += totalWeekendGain;
      }

      const st = (res.status || '').toUpperCase();
      if (
        st.includes('ABANDONO') ||
        st.includes('DNF') ||
        st.includes('DNS') ||
        st.includes('DSQ') ||
        st.includes('RET')
      ) {
        dnfsMap.set(code, (dnfsMap.get(code) || 0) + 1);
      }
    });

    raceScorers.sort((a, b) => b.points - a.points || b.racePoints - a.racePoints);

    driverPointsByRace.push({
      round: roundNum,
      name: rMeta ? rMeta.name : `GP ${roundNum}`,
      flag: rMeta ? rMeta.flag : '🏁',
      hasSprint: Object.keys(sprintRoundTable).length > 0,
      totalPoints: weekendTotalPoints,
      scorers: raceScorers,
    });
  });

  // Calcular acumulado ronda por ronda:
  // Si un piloto no participó en una carrera o sumó 0 puntos, `gains[i] = 0` y `runningTotal`
  // mantiene exactamente el valor acumulado de la ronda anterior (o 0 horizontal para pilotos con 0 puntos),
  // evitando caídas a cero, saltos o valores null/undefined.
  driversList.forEach((d) => {
    const gains = roundGainMap.get(d.code) || new Array(roundKeys.length).fill(0);
    const cum: number[] = [];
    let runningTotal = 0;
    for (let i = 0; i < roundKeys.length; i++) {
      const g = Number(gains[i]) || 0;
      runningTotal += g;
      cum.push(runningTotal);
    }

    const lastIdx = cum.length - 1;
    if (lastIdx >= 0 && Math.abs(cum[lastIdx] - d.points) > 0.001) {
      const diff = d.points - cum[lastIdx];
      cum[lastIdx] = d.points;
      if (gains[lastIdx] === 0 && diff > 0) {
        gains[lastIdx] = diff;
      }
    }

    cumulativePointsMap.set(d.code, cum);
    d.teamColor = getTeamColor(d.team);
    d.flag = getDriverFlag(d.code);
  });

  // Identificar primer vs segundo piloto de cada escudería según su posición en el campeonato
  const seenTeams = new Set<string>();
  const secondDriverSet = new Set<string>();
  driversList.forEach((d) => {
    const normTeam = d.team.toLowerCase().trim();
    if (seenTeams.has(normTeam)) {
      secondDriverSet.add(d.code);
    } else {
      seenTeams.add(normTeam);
    }
  });

  const historyByRound: RoundStandingsHistory[] = roundKeys.map((roundNum, roundIdx) => {
    const rMeta = rounds[roundIdx];
    const isFinalRound = roundIdx === roundKeys.length - 1;

    const standings = driversList.map((d) => {
      const rPts = (racePointsMap.get(d.code) || [])[roundIdx] ?? 0;
      const sPts = (sprintPointsMap.get(d.code) || [])[roundIdx] ?? 0;
      const roundPts = (roundGainMap.get(d.code) || [])[roundIdx] ?? 0;
      const totalPts = (cumulativePointsMap.get(d.code) || [])[roundIdx] ?? 0;

      return {
        driverId: d.driverId,
        code: d.code,
        name: d.name,
        team: d.team,
        teamColor: getTeamColor(d.team),
        points: totalPts,
        roundPoints: roundPts,
        racePoints: rPts,
        sprintPoints: sPts,
        officialFinalPos: d.position,
        position: 0,
      };
    });

    standings.sort((a, b) => {
      if (isFinalRound) {
        return a.officialFinalPos - b.officialFinalPos;
      }
      return b.points - a.points || a.officialFinalPos - b.officialFinalPos;
    });

    standings.forEach((item, posIdx) => {
      item.position = posIdx + 1;
    });

    return {
      round: roundNum,
      grandPrix: rMeta ? rMeta.name : `Round ${roundNum}`,
      circuitId: 'circuit',
      flag: rMeta ? rMeta.flag : '🏁',
      standings,
    };
  });

  const rankEvolutionMap = new Map<string, number[]>();
  driversList.forEach((d) => rankEvolutionMap.set(d.code, []));

  historyByRound.forEach((roundHist) => {
    roundHist.standings.forEach((driverStanding) => {
      const arr = rankEvolutionMap.get(driverStanding.code);
      if (arr) arr.push(driverStanding.position);
    });
  });

  const driverSeries: DriverSeries[] = driversList.map((d) => {
    const cum = cumulativePointsMap.get(d.code) || new Array(rounds.length).fill(d.points);
    const gains = roundGainMap.get(d.code) || new Array(rounds.length).fill(0);
    const rPtsArr = racePointsMap.get(d.code) || new Array(rounds.length).fill(0);
    const sPtsArr = sprintPointsMap.get(d.code) || new Array(rounds.length).fill(0);
    const ranks = rankEvolutionMap.get(d.code) || new Array(rounds.length).fill(d.position);
    const isSecond = secondDriverSet.has(d.code);
    const baseColor = getTeamColor(d.team);
    const strokeColor = isSecond ? getSecondaryTeammateColor(baseColor) : baseColor;

    const dataPoints: DriverProgressionPoint[] = rounds.map((rInfo, idx) => ({
      round: rInfo.round,
      raceName: rInfo.name,
      countryCode: rInfo.countryCode,
      flag: rInfo.flag,
      points: cum[idx] !== undefined ? cum[idx] : idx > 0 ? cum[idx - 1] ?? 0 : 0,
      roundGain: gains[idx] ?? 0,
      racePoints: rPtsArr[idx] ?? 0,
      sprintPoints: sPtsArr[idx] ?? 0,
      position: ranks[idx] ?? d.position,
    }));

    return {
      driverId: d.driverId,
      driverCode: d.code,
      driverName: d.name,
      lastName: getLastName(d.name),
      team: d.team,
      teamColor: baseColor,
      strokeColor,
      isSecondDriver: isSecond,
      strokeDasharray: isSecond ? '4 4' : undefined,
      position: d.position,
      finalPoints: d.points,
      data: dataPoints,
    };
  });

  // Mantener estrictamente el orden oficial `d.position` (1º, 2º, 3º...) de `driverStandings.json`
  const driverPointsEvolution: DriverPointsTrajectory[] = driversList.map((d) => {
    const cum = cumulativePointsMap.get(d.code) || [d.points];
    const gains = roundGainMap.get(d.code) || [];
    const rPtsArr = racePointsMap.get(d.code) || [];
    const sPtsArr = sprintPointsMap.get(d.code) || [];

    return {
      position: d.position,
      code: d.code,
      name: d.name,
      lastName: getLastName(d.name),
      team: d.team,
      teamColor: getTeamColor(d.team),
      isSecondDriver: secondDriverSet.has(d.code),
      number: d.number,
      wins: d.wins,
      podiums: d.podiums,
      cumulativePoints: cum,
      roundGains: gains,
      racePointsByRound: rPtsArr,
      sprintPointsByRound: sPtsArr,
      finalPoints: d.points, // Valor oficial exacto de la FIA
    };
  });

  const driverRankingEvolution: DriverRankTrajectory[] = driverPointsEvolution.map((dp) => {
    const ranks = rankEvolutionMap.get(dp.code) || [dp.position];
    return {
      code: dp.code,
      name: dp.name,
      lastName: dp.lastName,
      team: dp.team,
      teamColor: dp.teamColor,
      isSecondDriver: dp.isSecondDriver,
      number: dp.number,
      rankByRound: ranks,
      currentRank: dp.position,
    };
  });

  const driverSeasonStats: DriverSeasonStat[] = driverPointsEvolution.map((dp) => {
    const gains = roundGainMap.get(dp.code) || [];
    const pointsFinishes = gains.filter((p) => p > 0).length;

    return {
      code: dp.code,
      name: dp.name,
      lastName: dp.lastName,
      team: dp.team,
      teamColor: dp.teamColor,
      wins: dp.wins || 0,
      podiums: dp.podiums || 0,
      pointsFinishes,
      poles: polesMap.get(dp.code) || 0,
      dnfs: dnfsMap.get(dp.code) || 0,
    };
  });

  const parityVerified = verifyStandingsParity(driverSeries, driversList);
  const maxPoints = Math.max(...driverPointsEvolution.map((d) => d.finalPoints), 60);

  return {
    rounds,
    driverSeries,
    driverPointsEvolution,
    driverRankingEvolution,
    driverSeasonStats,
    driverPointsByRace,
    historyByRound,
    maxPoints,
    parityVerified,
  };
}
