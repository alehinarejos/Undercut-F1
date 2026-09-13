import { RACE_RESULTS_2026 } from '../data/raceResults2026';
import { OFFICIAL_DRIVER_STANDINGS } from '../data/officialStandings';
import type { DriverStanding } from '../data/officialStandings';
import { F1_SCHEDULE } from '../data/schedule';

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

export interface DriverStandingsAnalyticsData {
  rounds: RoundInfo[];
  driverPointsEvolution: DriverPointsTrajectory[];
  driverRankingEvolution: DriverRankTrajectory[];
  driverSeasonStats: DriverSeasonStat[];
  driverPointsByRace: RacePointsDistribution[];
  maxPoints: number;
}

export function computeDriverStandingsAnalytics(customDrivers?: DriverStanding[]): DriverStandingsAnalyticsData {
  // Determine available completed rounds from race results
  const roundKeys = Object.keys(RACE_RESULTS_2026)
    .map(Number)
    .sort((a, b) => a - b);

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

  // 1. Calculate points per round for each driver
  const pointsPerRoundMap = new Map<string, number[]>();
  driversList.forEach(d => {
    pointsPerRoundMap.set(d.code, new Array(rounds.length).fill(0));
  });

  // Track pole positions, DNFs, etc.
  const polesMap = new Map<string, number>();
  const dnfsMap = new Map<string, number>();
  driversList.forEach(d => {
    polesMap.set(d.code, 0);
    dnfsMap.set(d.code, 0);
  });

  // Track points distribution per race
  const driverPointsByRace: RacePointsDistribution[] = [];

  roundKeys.forEach((roundNum, roundIdx) => {
    const results = RACE_RESULTS_2026[roundNum] || [];
    const roundSched = F1_SCHEDULE.find(s => s.round === roundNum);
    const roundPole = roundSched?.polePosition?.toLowerCase();

    const raceScorers: Array<{ code: string; team: string; teamColor: string; points: number }> = [];
    let raceTotalPoints = 0;

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

    // Sort scorers by points descending
    raceScorers.sort((a, b) => b.points - a.points);

    driverPointsByRace.push({
      round: roundNum,
      name: roundSched ? roundSched.name : `GP ${roundNum}`,
      flag: roundSched ? roundSched.flag : '🏁',
      totalPoints: raceTotalPoints,
      scorers: raceScorers,
    });
  });

  // 2. Build cumulative points and rank evolution
  const cumulativePointsMap = new Map<string, number[]>();
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

  // Align final round cumulative points with OFFICIAL_DRIVER_STANDINGS points
  driversList.forEach(d => {
    const cum = cumulativePointsMap.get(d.code);
    if (cum && cum.length > 0) {
      cum[cum.length - 1] = d.points;
    }
  });

  // Build driver points trajectories
  const driverPointsEvolution: DriverPointsTrajectory[] = driversList.map(d => {
    const cum = cumulativePointsMap.get(d.code) || [d.points];
    return {
      code: d.code,
      name: d.name,
      lastName: getLastName(d.name),
      team: d.team,
      teamColor: d.teamColor,
      number: d.number,
      cumulativePoints: cum,
      finalPoints: d.points,
    };
  });

  // 3. Compute Ranking Evolution (Bump chart: rank 1 to 23 after each round)
  const rankEvolutionMap = new Map<string, number[]>();
  driversList.forEach(d => rankEvolutionMap.set(d.code, []));

  roundKeys.forEach((_, roundIdx) => {
    // Sort all drivers by their cumulative points at this round
    const standingsAtRound = driversList.map(d => ({
      code: d.code,
      points: (cumulativePointsMap.get(d.code) || [])[roundIdx] || 0,
      officialPos: d.position,
    }));

    standingsAtRound.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.officialPos - b.officialPos;
    });

    standingsAtRound.forEach((item, rankIdx) => {
      const arr = rankEvolutionMap.get(item.code);
      if (arr) arr.push(rankIdx + 1);
    });
  });

  const driverRankingEvolution: DriverRankTrajectory[] = driversList.map(d => {
    const ranks = rankEvolutionMap.get(d.code) || [d.position];
    return {
      code: d.code,
      name: d.name,
      lastName: getLastName(d.name),
      team: d.team,
      teamColor: d.teamColor,
      number: d.number,
      rankByRound: ranks,
      currentRank: d.position,
    };
  });

  // 4. Compute Season Stats (Wins, Podiums, Points finishes, Poles, DNFs)
  const driverSeasonStats: DriverSeasonStat[] = driversList.map(d => {
    const pts = pointsPerRoundMap.get(d.code) || [];
    const pointsFinishes = pts.filter(p => p > 0).length;

    return {
      code: d.code,
      name: d.name,
      lastName: getLastName(d.name),
      team: d.team,
      teamColor: d.teamColor,
      wins: d.wins || 0,
      podiums: d.podiums || 0,
      pointsFinishes: pointsFinishes,
      poles: polesMap.get(d.code) || 0,
      dnfs: dnfsMap.get(d.code) || 0,
    };
  });

  const maxPoints = Math.max(...driversList.map(d => d.points), 270);

  return {
    rounds,
    driverPointsEvolution,
    driverRankingEvolution,
    driverSeasonStats,
    driverPointsByRace,
    maxPoints,
  };
}
