import { RACE_RESULTS_2026 } from '../data/raceResults2026';
import type { DriverRaceResult } from '../data/raceResults2026';
import { OFFICIAL_DRIVER_STANDINGS } from '../data/officialStandings';
import type { DriverStanding } from '../data/officialStandings';
import { F1_SCHEDULE } from '../data/schedule';
import { isGrandPrixCompleted, getEffectiveNowMs } from './scheduleSyncService';

export interface RoundInfo {
  round: number;
  name: string;
  shortName: string;
  flag: string;
  country: string;
}

export interface DriverPointsTrajectory {
  code: string;
  name: string;
  lastName: string;
  team: string;
  teamColor: string;
  number: number;
  cumulativePoints: number[];
  finalPoints: number;
}

export interface DriverRankTrajectory {
  code: string;
  name: string;
  lastName: string;
  team: string;
  teamColor: string;
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
  totalPoints: number;
  scorers: Array<{
    code: string;
    team: string;
    teamColor: string;
    points: number;
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
    position: number;
  }>;
}

export interface DriverStandingsAnalyticsData {
  rounds: RoundInfo[];
  driverPointsEvolution: DriverPointsTrajectory[];
  driverRankingEvolution: DriverRankTrajectory[];
  driverSeasonStats: DriverSeasonStat[];
  driverPointsByRace: RacePointsDistribution[];
  historyByRound: RoundStandingsHistory[];
  maxPoints: number;
}

const DYNAMIC_RESULTS_KEY = 'f1_dynamic_race_results_2026_v1';

/**
 * Retrieves base static results merged with any dynamic results ingested live or simulated
 */
export function getEffectiveRaceResults(): Record<number, DriverRaceResult[]> {
  const base: Record<number, DriverRaceResult[]> = { ...RACE_RESULTS_2026 };
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(DYNAMIC_RESULTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          Object.assign(base, parsed);
        }
      }
    } catch (err) {
      console.warn('[StandingsAnalytics] Error reading dynamic results:', err);
    }
  }
  return base;
}

/**
 * Registers new race results into the persistent dynamic results store (e.g. after a race finishes)
 */
export function registerCompletedRaceResult(round: number, results: DriverRaceResult[]): void {
  if (typeof window !== 'undefined') {
    try {
      const current = getEffectiveRaceResults();
      current[round] = results;
      localStorage.setItem(DYNAMIC_RESULTS_KEY, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent('f1:results_updated', { detail: { round } }));
      console.info(`[StandingsAnalytics] 🏁 Registered results for Round ${round}`);
    } catch (err) {
      console.warn('[StandingsAnalytics] Failed to save dynamic race result:', err);
    }
  }
}

if (typeof window !== 'undefined') {
  (window as any).__registerCompletedRaceResult = registerCompletedRaceResult;
}

/**
 * Computes dynamic season progression, trajectories, round-by-round points history and bump charts
 */
export function computeDriverStandingsAnalytics(customDrivers?: DriverStanding[]): DriverStandingsAnalyticsData {
  const allResults = getEffectiveRaceResults();
  const effectiveNow = getEffectiveNowMs();

  // 1. Identify all completed rounds: from stored results + completed GPs in schedule
  const resultRoundNumbers = Object.keys(allResults).map(Number);
  const completedScheduleRounds = F1_SCHEDULE
    .filter(gp => isGrandPrixCompleted(gp, effectiveNow))
    .map(gp => gp.round);

  const allCompletedRoundSet = new Set<number>([...resultRoundNumbers, ...completedScheduleRounds]);
  const roundKeys = Array.from(allCompletedRoundSet).sort((a, b) => a - b);

  // If no rounds are completed yet, default to first round placeholder
  if (roundKeys.length === 0) {
    roundKeys.push(1);
  }

  const rounds: RoundInfo[] = roundKeys.map(r => {
    const sched = F1_SCHEDULE.find(s => s.round === r);
    return {
      round: r,
      name: sched ? sched.name : `Ronda ${r}`,
      shortName: sched ? sched.name.replace(/^GP de /i, '').replace(/^Gran Premio de /i, '') : `R${r}`,
      flag: sched ? sched.flag : '🏁',
      country: sched ? sched.country : '',
    };
  });

  // Unique driver codes from official standings or live synced drivers
  const driversList = (customDrivers && customDrivers.length > 0) 
    ? [...customDrivers] 
    : [...OFFICIAL_DRIVER_STANDINGS];

  // Helper to extract last name
  const getLastName = (fullName: string): string => {
    const parts = fullName.trim().split(' ');
    return parts[parts.length - 1] || fullName;
  };

  // Maps to track points and stats
  const pointsPerRoundMap = new Map<string, number[]>();
  const cumulativePointsMap = new Map<string, number[]>();
  const polesMap = new Map<string, number>();
  const dnfsMap = new Map<string, number>();

  driversList.forEach(d => {
    pointsPerRoundMap.set(d.code, new Array(roundKeys.length).fill(0));
    cumulativePointsMap.set(d.code, []);
    polesMap.set(d.code, 0);
    dnfsMap.set(d.code, 0);
  });

  const driverPointsByRace: RacePointsDistribution[] = [];

  // Populate round-by-round points from results
  roundKeys.forEach((roundNum, roundIdx) => {
    const results = allResults[roundNum] || [];
    const roundSched = F1_SCHEDULE.find(s => s.round === roundNum);
    const roundPole = roundSched?.polePosition?.toLowerCase();

    const raceScorers: Array<{ code: string; team: string; teamColor: string; points: number }> = [];
    let raceTotalPoints = 0;

    if (results.length > 0) {
      results.forEach(res => {
        if (pointsPerRoundMap.has(res.code)) {
          const arr = pointsPerRoundMap.get(res.code)!;
          arr[roundIdx] = res.points || 0;
        }

        if (res.points > 0) {
          raceScorers.push({
            code: res.code,
            team: res.team,
            teamColor: res.teamColor,
            points: res.points,
          });
          raceTotalPoints += res.points;
        }

        // Check DNF
        const st = (res.status || '').toUpperCase();
        if (st.includes('ABANDONO') || st.includes('DNF') || st.includes('DNS') || st.includes('DSQ') || st.includes('RET')) {
          dnfsMap.set(res.code, (dnfsMap.get(res.code) || 0) + 1);
        }

        // Check Pole
        if (roundPole && (res.driverName.toLowerCase().includes(roundPole) || roundPole.includes(res.code.toLowerCase()))) {
          polesMap.set(res.code, (polesMap.get(res.code) || 0) + 1);
        }
      });
    } else {
      // If round is marked completed but individual results not yet available,
      // reconcile points delta from customDrivers to ensure live updates immediately reflect in progression
      driversList.forEach(d => {
        const arr = pointsPerRoundMap.get(d.code)!;
        // Calculate prior cumulative sum
        const priorSum = arr.slice(0, roundIdx).reduce((a, b) => a + b, 0);
        const delta = Math.max(0, d.points - priorSum);
        arr[roundIdx] = delta;
        if (delta > 0) {
          raceScorers.push({
            code: d.code,
            team: d.team,
            teamColor: d.teamColor,
            points: delta,
          });
          raceTotalPoints += delta;
        }
      });
    }

    raceScorers.sort((a, b) => b.points - a.points);

    driverPointsByRace.push({
      round: roundNum,
      name: roundSched ? roundSched.name : `GP ${roundNum}`,
      flag: roundSched ? roundSched.flag : '🏁',
      totalPoints: raceTotalPoints,
      scorers: raceScorers,
    });
  });

  // Build cumulative running totals round-by-round
  driversList.forEach(d => {
    const pts = pointsPerRoundMap.get(d.code) || [];
    const cum: number[] = [];
    let running = 0;
    pts.forEach(p => {
      running += p;
      cum.push(running);
    });
    cumulativePointsMap.set(d.code, cum);
  });

  // Build driver points trajectories and sort strictly by finalPoints descending
  const driverPointsEvolution: DriverPointsTrajectory[] = driversList.map(d => {
    const cum = cumulativePointsMap.get(d.code) || [d.points];
    const finalPts = cum.length > 0 ? cum[cum.length - 1] : d.points;
    return {
      code: d.code,
      name: d.name,
      lastName: getLastName(d.name),
      team: d.team,
      teamColor: d.teamColor,
      number: d.number,
      cumulativePoints: cum,
      finalPoints: Math.max(finalPts, d.points),
    };
  });

  driverPointsEvolution.sort((a, b) => b.finalPoints - a.finalPoints);

  // Build round-by-round historical standings model
  const historyByRound: RoundStandingsHistory[] = roundKeys.map((roundNum, roundIdx) => {
    const sched = F1_SCHEDULE.find(s => s.round === roundNum);
    const standings = driversList.map(d => {
      const roundPts = (pointsPerRoundMap.get(d.code) || [])[roundIdx] || 0;
      const totalPts = (cumulativePointsMap.get(d.code) || [])[roundIdx] || 0;
      return {
        driverId: d.driverId,
        code: d.code,
        name: d.name,
        team: d.team,
        teamColor: d.teamColor,
        points: totalPts,
        roundPoints: roundPts,
        position: 0,
      };
    });

    standings.sort((a, b) => b.points - a.points);
    standings.forEach((item, posIdx) => {
      item.position = posIdx + 1;
    });

    return {
      round: roundNum,
      grandPrix: sched ? sched.name : `Round ${roundNum}`,
      circuitId: sched ? sched.circuitId : 'circuit',
      flag: sched ? sched.flag : '🏁',
      standings,
    };
  });

  // 3. Compute Ranking Evolution (Bump chart: rank 1 to 23 after each round)
  const rankEvolutionMap = new Map<string, number[]>();
  driversList.forEach(d => rankEvolutionMap.set(d.code, []));

  historyByRound.forEach((roundHist) => {
    roundHist.standings.forEach((driverStanding) => {
      const arr = rankEvolutionMap.get(driverStanding.code);
      if (arr) arr.push(driverStanding.position);
    });
  });

  const driverRankingEvolution: DriverRankTrajectory[] = driverPointsEvolution.map((dp, idx) => {
    const ranks = rankEvolutionMap.get(dp.code) || [idx + 1];
    return {
      code: dp.code,
      name: dp.name,
      lastName: dp.lastName,
      team: dp.team,
      teamColor: dp.teamColor,
      number: dp.number,
      rankByRound: ranks,
      currentRank: ranks.length > 0 ? ranks[ranks.length - 1] : idx + 1,
    };
  });

  // 4. Compute Season Stats (Wins, Podiums, Points finishes, Poles, DNFs) ordered by championship rank
  const driverSeasonStats: DriverSeasonStat[] = driverPointsEvolution.map(dp => {
    const d = driversList.find(drv => drv.code === dp.code);
    const pts = pointsPerRoundMap.get(dp.code) || [];
    const pointsFinishes = pts.filter(p => p > 0).length;

    return {
      code: dp.code,
      name: dp.name,
      lastName: dp.lastName,
      team: dp.team,
      teamColor: dp.teamColor,
      wins: d?.wins || 0,
      podiums: d?.podiums || 0,
      pointsFinishes,
      poles: polesMap.get(dp.code) || 0,
      dnfs: dnfsMap.get(dp.code) || 0,
    };
  });

  const maxPoints = Math.max(...driverPointsEvolution.map(d => d.finalPoints), 60);

  return {
    rounds,
    driverPointsEvolution,
    driverRankingEvolution,
    driverSeasonStats,
    driverPointsByRace,
    historyByRound,
    maxPoints,
  };
}
