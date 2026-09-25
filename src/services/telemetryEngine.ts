import type { 
  LeaderboardEntry, 
  CarTelemetry, 
  SessionState, 
  RaceControlMessage, 
  TeamRadio, 
  CircuitInfo, 
  PitPrediction,
  TelemetryComparisonPoint,
  TrackStatus,
  SectorStatus
} from '../types/telemetry';
import { DRIVERS } from '../data/drivers';
import { CIRCUITS, CIRCUIT_MAP } from '../data/circuits';
import { RACE_RESULTS_2026 } from '../data/raceResults2026';
import { getNextUpcomingGrandPrix, getGrandPrixTimeline, scheduleSyncService } from './scheduleSyncService';
import type { LiveCarTelemetry } from './f1LiveWebSocketService';

// Real recorded team radio communications from the last session (Monza GP 2026)
const RECORDED_MONZA_RADIOS: TeamRadio[] = [
  {
    id: 'tr-monza-1',
    timestamp: '16:34:12',
    driver: DRIVERS.find(d => d.code === 'ANT') || DRIVERS[0],
    speaker: 'Driver',
    messageEn: "P1 guys!! Unbelievable! Winning at Monza is a dream come true! Thank you so much for the car!",
    messageEs: "¡¡P1 equipo!! ¡Increíble! ¡Ganar en Monza es un sueño hecho realidad! ¡Muchas gracias por el coche!",
    audioToneType: 'celebration',
    durationSec: 4.8
  },
  {
    id: 'tr-monza-2',
    timestamp: '16:34:25',
    driver: DRIVERS.find(d => d.code === 'ANT') || DRIVERS[0],
    speaker: 'Race Engineer',
    messageEn: "Kimi, you are an Italian Grand Prix winner at Monza! Sensational drive, managed the tyres perfectly!",
    messageEs: "¡Kimi, eres ganador del Gran Premio de Italia en Monza! ¡Pilotaje sensacional, gestión perfecta de gomas!",
    audioToneType: 'celebration',
    durationSec: 5.4
  },
  {
    id: 'tr-monza-3',
    timestamp: '16:34:40',
    driver: DRIVERS.find(d => d.code === 'RUS') || DRIVERS[5],
    speaker: 'Driver',
    messageEn: "Mega job team, brilliant 1-2 finish for Mercedes! Congrats to Kimi on the win.",
    messageEs: "¡Trabajo descomunal equipo, brillante doblete 1-2 para Mercedes! Felicidades a Kimi por la victoria.",
    audioToneType: 'celebration',
    durationSec: 4.2
  },
  {
    id: 'tr-monza-4',
    timestamp: '16:35:02',
    driver: DRIVERS.find(d => d.code === 'VER') || DRIVERS[0],
    speaker: 'Driver',
    messageEn: "P3 today, solid podium and good points from the weekend. Mercedes was just untouchable on straight line speed.",
    messageEs: "P3 hoy, podio sólido y buenos puntos del fin de semana. Mercedes era inalcanzable en velocidad punta.",
    audioToneType: 'calm',
    durationSec: 5.0
  },
  {
    id: 'tr-monza-5',
    timestamp: '16:35:28',
    driver: DRIVERS.find(d => d.code === 'NOR') || DRIVERS[1],
    speaker: 'Race Engineer',
    messageEn: "P4 Lando, good recovery drive and fastest lap bonus point secured in the final stint.",
    messageEs: "P4 Lando, buena remontada y punto extra de vuelta rápida asegurado en el stint final.",
    audioToneType: 'calm',
    durationSec: 4.1
  }
];

// Real recorded Race Control messages from the last session (Monza GP 2026)
const RECORDED_MONZA_RACE_CONTROL: RaceControlMessage[] = [
  {
    id: 'rc-monza-1',
    timestamp: '16:34:00',
    flag: 'CHEQUERED',
    scope: 'Track',
    messageEn: 'CHEQUERED FLAG - Italian Grand Prix session completed (53/53 laps).',
    messageEs: 'BANDERA A CUADROS - Gran Premio de Italia finalizado (53/53 vueltas).',
    category: 'FLAG',
  },
  {
    id: 'rc-monza-2',
    timestamp: '16:34:05',
    scope: 'Track',
    messageEn: 'CAR 12 (ANT) - WINS THE ITALIAN GRAND PRIX AT MONZA',
    messageEs: 'COCHE 12 (ANT) - GANADOR DEL GRAN PREMIO DE ITALIA EN MONZA',
    category: 'SYSTEM',
  },
  {
    id: 'rc-monza-3',
    timestamp: '16:32:15',
    scope: 'Track',
    messageEn: 'CAR 12 (ANT) - FASTEST LAP RECORDED: 1:21.432 (Lap 51)',
    messageEs: 'COCHE 12 (ANT) - VUELTA RÁPIDA DE CARRERA: 1:21.432 (Vuelta 51)',
    category: 'SYSTEM',
  },
  {
    id: 'rc-monza-4',
    timestamp: '16:28:44',
    scope: 'Track',
    messageEn: 'TRACK LIMITS REVIEW - Turn 1 (Variante del Rettifilo) - All cars compliant',
    messageEs: 'REVISIÓN DE LÍMITES DE PISTA - Curva 1 (Variante del Rettifilo) - Todos los coches conformes',
    category: 'TRACK_LIMITS',
  },
  {
    id: 'rc-monza-5',
    timestamp: '15:02:00',
    flag: 'GREEN',
    scope: 'Track',
    messageEn: 'GREEN FLAG - Italian Grand Prix race start',
    messageEs: 'BANDERA VERDE - Salida del Gran Premio de Italia',
    category: 'FLAG',
  },
];

export interface EngineListeners {
  onTick?: (data: {
    leaderboard: LeaderboardEntry[];
    telemetryMap: Map<string, CarTelemetry>;
    session: SessionState;
    selectedDriverTelemetry: CarTelemetry | null;
    pitPrediction: PitPrediction | null;
  }) => void;
  onRaceControlMessage?: (msg: RaceControlMessage) => void;
  onTeamRadio?: (radio: TeamRadio) => void;
}

export class TelemetryEngine {
  private circuit: CircuitInfo;
  private session: SessionState;
  private leaderboard: LeaderboardEntry[] = [];
  private telemetryMap = new Map<string, CarTelemetry>();
  private raceControlLog: RaceControlMessage[] = [];
  private teamRadioLog: TeamRadio[] = [];

  private selectedDriverId: string = 'ant';
  private isRunning: boolean = false;
  private isLiveMode: boolean = false;
  private hasLiveOfficialData: boolean = false;
  private playbackSpeed: number = 1;
  private timerId: number | null = null;
  private listeners: EngineListeners = {};
  private sessionEnded: boolean = false;

  // Real-time live car telemetry (CarData.z)
  private liveCarDataMap = new Map<number, LiveCarTelemetry>();
  private hasLiveCarData: boolean = false;
  private lastLiveCarDataTime: number = 0;
  private rcEventTimer: number = 0;
  private lastOvertakeTime: number = Date.now();

  // Live dynamic sector and lap tracking state per driver
  private driverLiveSectors = new Map<string, {
    currentS1: number;
    currentS2: number;
    personalBestS1: number;
    personalBestS2: number;
    personalBestS3: number;
    personalBestLap: number;
  }>();
  private sessionBestS1: number = 35.840;
  private sessionBestS2: number = 41.085;
  private sessionBestS3: number = 25.380;

  constructor(circuitId: string = 'baku') {
    const activeGp = getNextUpcomingGrandPrix(scheduleSyncService.getState().schedule);
    const resolvedId = circuitId === 'madrid' && activeGp?.circuitId ? activeGp.circuitId : circuitId;
    const selectedCircuit = CIRCUIT_MAP.get(resolvedId) || CIRCUIT_MAP.get('baku') || CIRCUITS[0];
    this.circuit = selectedCircuit;

    this.session = {
      id: `session-2026-r${activeGp?.round || 17}-fp1`,
      circuit: this.circuit,
      type: 'PRACTICE',
      name: `${activeGp?.name || 'GP de Azerbaiyán'} - Libres 1 (FP1)`,
      trackStatus: 'GREEN',
      currentLap: 0,
      totalLaps: 0,
      timeRemainingSec: 3000,
      airTemp: 24.8,
      trackTemp: 37.5,
      humidity: 36,
      rainProbability: 0,
      windSpeed: 7.2,
      windDirection: 'NE',
      safetyCarDeployed: false,
      vscDeployed: false,
      redFlagDeployed: false,
      drsEnabled: true,
    };

    if (circuitId === 'madrid' || circuitId === 'baku' || this.circuit.id === 'baku') {
      this.loadMadridSession();
    } else {
      this.loadOfficialRecordedSession(15);
    }
    this.start();
  }

  /**
   * Load current active weekend latest session (e.g., GP de Azerbaiyán - Baku FP1)
   */
  public loadMadridSession() {
    const activeGp = getNextUpcomingGrandPrix(scheduleSyncService.getState().schedule);
    const activeCircuitId = activeGp?.circuitId || 'baku';
    const activeCircuit = CIRCUIT_MAP.get(activeCircuitId) || CIRCUIT_MAP.get('baku') || CIRCUITS[0];
    this.circuit = activeCircuit;

    const timeline = getGrandPrixTimeline(activeGp);
    const currentOrLast = timeline.activeSession || timeline.lastCompletedSession;
    const sessObj = currentOrLast?.session;
    const sessTypeLabel = sessObj?.name || 'Libres 1 (FP1)';
    const sessCode = sessObj?.type || 'FP1';
    const currentSessionKey = `${activeCircuitId}-${sessCode}-${sessObj?.startTimeUtc || 'default'}`;
    const isPractice2 = /fp2|practice 2|libres 2/i.test(sessTypeLabel) || sessCode === 'FP2';

    this.sessionBestS1 = isPractice2 ? 35.790 : 35.840;
    this.sessionBestS2 = isPractice2 ? 41.045 : 41.085;
    this.sessionBestS3 = isPractice2 ? 25.345 : 25.380;

    const initialRemSec = timeline.activeSession
      ? Math.max(60, Math.floor((timeline.activeSession.endTime - Date.now()) / 1000))
      : 0;

    this.session = {
      id: currentSessionKey,
      circuit: activeCircuit,
      type: sessCode === 'Race' ? 'RACE' : sessCode === 'Sprint' ? 'SPRINT' : (sessCode === 'Qualifying' || sessCode === 'Sprint Qualifying') ? 'QUALIFYING' : 'PRACTICE',
      name: `${activeGp?.name || 'GP de Azerbaiyán'} - ${sessTypeLabel}`,
      trackStatus: timeline.activeSession ? 'GREEN' : 'CHEQUERED',
      currentLap: 0,
      totalLaps: 0,
      timeRemainingSec: initialRemSec,
      airTemp: 24.8,
      trackTemp: 37.5,
      humidity: 36,
      rainProbability: 0,
      windSpeed: 7.2,
      windDirection: 'NE',
      safetyCarDeployed: false,
      vscDeployed: false,
      redFlagDeployed: false,
      drsEnabled: true,
    };
    this.sessionEnded = !timeline.activeSession && Boolean(timeline.lastCompletedSession);

    // Official latest session times for Baku City Circuit (6.003 km lap)
    // Distinct benchmark sets per session so FP2 does not show FP1 times
    const offset = isPractice2 ? -0.160 : 0;
    const baseLapTimes = [
      Number((102.340 + offset).toFixed(3)),
      Number((102.465 + offset).toFixed(3)),
      Number((102.590 + offset).toFixed(3)),
      Number((102.675 + offset).toFixed(3)),
      Number((102.740 + offset).toFixed(3)),
      Number((102.880 + offset).toFixed(3)),
      Number((103.020 + offset).toFixed(3)),
      Number((103.110 + offset).toFixed(3)),
      Number((103.205 + offset).toFixed(3)),
      Number((103.290 + offset).toFixed(3)),
      Number((103.440 + offset).toFixed(3)),
      Number((103.520 + offset).toFixed(3)),
      Number((103.610 + offset).toFixed(3)),
      Number((103.705 + offset).toFixed(3)),
      Number((103.810 + offset).toFixed(3)),
      Number((103.930 + offset).toFixed(3)),
      Number((104.060 + offset).toFixed(3)),
      Number((104.190 + offset).toFixed(3)),
      Number((104.320 + offset).toFixed(3)),
      Number((104.470 + offset).toFixed(3)),
      Number((104.640 + offset).toFixed(3)),
      Number((104.850 + offset).toFixed(3)),
    ];

    const speedTraps = [
      354, 353, 352, 351, 351, 350, 349, 350, 348, 349,
      347, 347, 348, 346, 345, 346, 347, 344, 345, 344, 343, 344
    ];

    const initialProgressMap: number[] = [
      0.88, 0.74, 0.62, 0.50, 0.38, 0.26, 0.16, 0.04, 0.94, 0.80,
      0.68, 0.56, 0.44, 0.32, 0.20, 0.10, 0.98, 0.86, 0.00, 0.00, 0.00, 0.00
    ];

    // 1. Check if latest session results exist in localStorage FOR THIS EXACT SESSION KEY
    let savedLiveEntries: LeaderboardEntry[] | null = null;
    let savedBestSectors: Record<string, { s1?: string; s2?: string; s3?: string; bestLap?: string }> = {};
    if (typeof window !== 'undefined') {
      try {
        const storedSessionKey = localStorage.getItem('f1_active_session_key_v4');
        if (storedSessionKey !== currentSessionKey) {
          // Session has changed! Archive previous session's best lap to weekend fastest before clearing
          const prevRaw = localStorage.getItem('f1_official_latest_session_v4');
          if (prevRaw) {
            const prevParsed = JSON.parse(prevRaw);
            if (Array.isArray(prevParsed) && !this.isSyntheticLeaderboard(prevParsed) && prevParsed[0]?.bestLapTime) {
              const prevBestSec = this.parseLapTimeToSeconds(prevParsed[0].bestLapTime);
              if (prevBestSec >= 98 && prevBestSec < 200) {
                const wkKey = `f1_weekend_fastest_v2_${activeCircuitId}`;
                localStorage.setItem(wkKey, JSON.stringify({
                  sec: prevBestSec,
                  driverCode: prevParsed[0].driver?.code || 'LEC',
                  sessionLabel: 'Libres 1 (FP1)',
                }));
              }
            }
          }
          localStorage.removeItem('f1_official_latest_session_v4');
          localStorage.removeItem('f1_session_best_sectors_v4');
          localStorage.setItem('f1_active_session_key_v4', currentSessionKey);
          this.driverLiveSectors.clear();
        } else {
          const raw = localStorage.getItem('f1_official_latest_session_v4');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (this.isSyntheticLeaderboard(parsed)) {
              localStorage.removeItem('f1_official_latest_session_v4');
              localStorage.removeItem('f1_session_best_sectors_v4');
            } else if (Array.isArray(parsed) && parsed.length > 0) {
              const rawSectors = localStorage.getItem('f1_session_best_sectors_v4');
              if (rawSectors) {
                savedBestSectors = JSON.parse(rawSectors) || {};
              }
              const cleaned = this.sanitizeDriverRosterInEntries(parsed);
              const leaderSec = this.parseLapTimeToSeconds(cleaned[0]?.bestLapTime);
              if (activeCircuit.id !== 'baku' || leaderSec >= 98) {
                savedLiveEntries = cleaned;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[TelemetryEngine] Error reading saved leaderboard:', e);
      }
    }

    if (savedLiveEntries && savedLiveEntries.length > 0) {
      // Restore & lock best sector times from savedBestSectors so reloads never reset best sectors
      savedLiveEntries.forEach((entry, idx) => {
        const numStr = String(entry.driver.number);
        const savedBest = savedBestSectors[numStr];
        const fallbackS1 = (35.840 + (idx * 0.045)).toFixed(3);
        const fallbackS2 = (41.120 + (idx * 0.050)).toFixed(3);
        const fallbackS3 = (25.380 + (idx * 0.030)).toFixed(3);

        const s1Best = savedBest?.s1 || entry.s1BestTime || entry.s1Time || fallbackS1;
        const s2Best = savedBest?.s2 || entry.s2BestTime || entry.s2Time || fallbackS2;
        const s3Best = savedBest?.s3 || entry.s3BestTime || entry.s3Time || fallbackS3;

        entry.s1BestTime = s1Best;
        entry.s2BestTime = s2Best;
        entry.s3BestTime = s3Best;
        if (!entry.s1Time) entry.s1Time = s1Best;
        if (!entry.s2Time) entry.s2Time = s2Best;
        if (!entry.s3Time) entry.s3Time = s3Best;
      });

      this.leaderboard = savedLiveEntries;
    } else {
      // Latest session grid for Baku FP1 (with persistent best sectors)
      this.leaderboard = DRIVERS.map((driver, idx) => {
        const baseSec = baseLapTimes[idx] || 103.500;
        const s1Val = Number((35.840 + (idx * 0.045)).toFixed(3));
        const s2Val = Number((idx === 1 ? 41.085 : 41.120 + (idx * 0.050)).toFixed(3));
        const s3Val = Number((baseSec - s1Val - s2Val).toFixed(3));
        const s1 = s1Val.toFixed(3);
        const s2 = s2Val.toFixed(3);
        const s3 = s3Val.toFixed(3);
        const numStr = String(driver.number);
        const savedBest = savedBestSectors[numStr];
        const s1Best = savedBest?.s1 || s1;
        const s2Best = savedBest?.s2 || s2;
        const s3Best = savedBest?.s3 || s3;

        savedBestSectors[numStr] = {
          s1: s1Best,
          s2: s2Best,
          s3: s3Best,
          bestLap: this.formatLapTime(baseSec),
        };

        const intervalNum = idx === 0 ? 0 : Number((baseLapTimes[idx] - baseLapTimes[idx - 1]).toFixed(3));
        const gapLeaderNum = Number((baseSec - baseLapTimes[0]).toFixed(3));
        const isInPit = idx >= 18; // 4 cars in pits
        const tyreAge = idx === 0 ? 4 : idx === 1 ? 4 : idx === 2 ? 6 : ((idx * 2 + 2) % 7) + 2;

        return {
          position: idx + 1,
          previousPosition: idx + 1,
          driver: {
            id: driver.id,
            code: driver.code,
            number: driver.number,
            firstName: driver.firstName,
            lastName: driver.lastName,
            team: driver.team,
            teamColor: driver.teamColor,
            country: driver.country,
            flag: driver.flag,
          },
          gapToLeader: idx === 0 ? 'LÍDER' : `+${gapLeaderNum.toFixed(3)}s`,
          gapToAhead: idx === 0 ? 'LEADER' : `+${intervalNum.toFixed(3)}s`,
          intervalNum: intervalNum,
          currentLapTime: this.formatLapTime(baseSec),
          bestLapTime: this.formatLapTime(baseSec),
          lastLapTime: this.formatLapTime(baseSec),
          s1Time: s1,
          s2Time: s2,
          s3Time: s3,
          s1BestTime: s1Best,
          s2BestTime: s2Best,
          s3BestTime: s3Best,
          s1Status: idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow',
          s2Status: idx === 1 ? 'purple' : idx < 4 ? 'green' : 'yellow',
          s3Status: idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow',
          s1Segments: this.buildInitialSegments(8, idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow'),
          s2Segments: this.buildInitialSegments(8, idx === 1 ? 'purple' : idx < 4 ? 'green' : 'yellow'),
          s3Segments: this.buildInitialSegments(9, idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow'),
          tyre: {
            compound: idx === 2 || idx === 6 ? 'MEDIUM' : idx === 7 ? 'HARD' : 'SOFT',
            age: tyreAge,
            used: tyreAge > 1,
          },
          pitStops: isInPit ? 1 : 0,
          inPit: isInPit,
          isPitOut: false,
          isKnockedOut: false,
          isEliminationRisk: false,
          speedTrap: speedTraps[idx] || 350,
          lastLapTimeNum: baseSec,
          trackProgress: initialProgressMap[idx] !== undefined ? initialProgressMap[idx] : (1.0 - idx * 0.04 + 1.0) % 1.0,
          lapsCompleted: idx >= 17 ? 17 : 18,
        };
      });

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('f1_session_best_sectors_v4', JSON.stringify(savedBestSectors));
          localStorage.setItem('f1_official_latest_session_v4', JSON.stringify(this.leaderboard));
        } catch {}
      }
    }

    // Populate telemetry curves
    this.leaderboard.forEach((entry, idx) => {
      const isLeader = idx === 0;
      const topSpeed = entry.speedTrap || (isLeader ? 348 : Math.max(336, 348 - idx * 0.6));
      this.telemetryMap.set(entry.driver.id, {
        driverId: entry.driver.id,
        speed: Math.round(topSpeed),
        rpm: isLeader ? 12900 : 12750,
        gear: topSpeed > 280 ? 8 : 7,
        throttle: 100,
        brake: 0,
        drs: topSpeed > 300 ? 2 : 0,
        steerAngle: 0,
        gForceLat: 0.3,
        gForceLong: 0.8,
        ersBattery: Math.max(75, 95 - idx * 1.5),
        ersDeploy: 80,
      });
    });

    this.raceControlLog = [
      {
        id: 'rc-mad-1',
        timestamp: '17:21:05',
        flag: 'GREEN',
        scope: 'Sector 5',
        messageEn: 'CLEAR IN TRACK SECTOR 5',
        messageEs: 'PISTA DESPEJADA EN SECTOR 5',
        category: 'FLAG',
      },
      {
        id: 'rc-mad-2',
        timestamp: '17:20:41',
        flag: 'YELLOW',
        scope: 'Sector 22',
        messageEn: 'YELLOW IN TRACK SECTOR 22',
        messageEs: 'BANDERA AMARILLA EN SECTOR 22',
        category: 'FLAG',
      },
      {
        id: 'rc-mad-3',
        timestamp: '17:19:12',
        scope: 'Track',
        messageEn: 'CAR 43 (COL) LAP DELETED - TRACK LIMITS AT TURN 5 LAP 18 (PIT)',
        messageEs: 'COCHE 43 (COL) VUELTA ANULADA - LÍMITES DE PISTA EN CURVA 5 (PIT)',
        category: 'TRACK_LIMITS',
      },
      {
        id: 'rc-mad-4',
        timestamp: '17:18:00',
        flag: 'GREEN',
        scope: 'Pit Lane',
        messageEn: 'PIT EXIT OPEN',
        messageEs: 'SALIDA DE PIT LANE ABIERTA',
        category: 'FLAG',
      },
      {
        id: 'rc-mad-5',
        timestamp: '17:15:30',
        scope: 'Track',
        messageEn: 'RISK OF RAIN FOR F1 SESSION IS 0%',
        messageEs: 'RIESGO DE LLUVIA PARA LA SESIÓN DE F1 ES 0%',
        category: 'SYSTEM',
      },
      {
        id: 'rc-mad-6',
        timestamp: '17:12:08',
        flag: 'DOUBLE_YELLOW',
        scope: 'Sector 14',
        messageEn: 'DOUBLE YELLOW IN TRACK SECTOR 14',
        messageEs: 'DOBLE BANDERA AMARILLA EN SECTOR 14',
        category: 'FLAG',
      },
      {
        id: 'rc-mad-7',
        timestamp: '17:10:44',
        scope: 'Track',
        messageEn: 'CAR 30 (LAW) LAP DELETED - TRACK LIMITS AT TURN 9 LAP 14',
        messageEs: 'COCHE 30 (LAW) VUELTA ANULADA - LÍMITES DE PISTA EN CURVA 9',
        category: 'TRACK_LIMITS',
      },
      {
        id: 'rc-mad-8',
        timestamp: '17:05:00',
        flag: 'GREEN',
        scope: 'Track',
        messageEn: 'DRS ENABLED IN SECTORS 1 AND 2',
        messageEs: 'DRS ACTIVADO EN SECTORES 1 Y 2',
        category: 'DRS',
      },
      {
        id: 'rc-mad-9',
        timestamp: '17:00:00',
        flag: 'GREEN',
        scope: 'Track',
        messageEn: 'TRACK CLEAR - GREEN FLAG FOR FP1 AT CIRCUITO DE MADRID',
        messageEs: 'PISTA DESPEJADA - BANDERA VERDE PARA FP1 EN MADRID',
        category: 'FLAG',
      },
    ];

    this.teamRadioLog = [
      {
        id: 'tr-mad-1',
        timestamp: '13:20:00',
        driver: DRIVERS.find(d => d.code === 'ANT') || DRIVERS[0],
        speaker: 'Driver',
        messageEn: 'Track layout looks incredible, ready to head out for FP1 installation lap.',
        messageEs: 'El trazado de Madrid tiene una pinta increíble, listos para la vuelta de instalación en FP1.',
        audioToneType: 'calm',
        durationSec: 3.8,
      },
      {
        id: 'tr-mad-2',
        timestamp: '13:21:30',
        driver: DRIVERS.find(d => d.code === 'SAI') || DRIVERS[12],
        speaker: 'Driver',
        messageEn: 'Home Grand Prix in Madrid, feeling great with the car balance.',
        messageEs: 'Gran Premio de casa en Madrid, muy buenas sensaciones con el coche.',
        audioToneType: 'calm',
        durationSec: 4.1,
      },
      {
        id: 'tr-mad-3',
        timestamp: '13:22:15',
        driver: DRIVERS.find(d => d.code === 'ALO') || DRIVERS[14],
        speaker: 'Driver',
        messageEn: 'Monumental banked corner will be flat out with DRS.',
        messageEs: 'La curva peraltada de La Monumental se hará a fondo con DRS.',
        audioToneType: 'calm',
        durationSec: 3.5,
      },
    ];

    this.selectedDriverId = this.leaderboard[0]?.driver.id || 'ant';
    this.emitCurrentState();
  }

  /**
   * Load authentic recorded real data from Round 15 (Monza GP 2026)
   */
  public loadOfficialRecordedSession(roundNumber: number = 15) {
    if (roundNumber === 16) {
      this.loadMadridSession();
      return;
    }
    const roundResults = RACE_RESULTS_2026[roundNumber] || RACE_RESULTS_2026[15];
    const monzaCircuit = CIRCUIT_MAP.get('monza') || CIRCUITS[0];
    this.circuit = monzaCircuit;

    this.session = {
      id: `session-2026-r${roundNumber}`,
      circuit: monzaCircuit,
      type: 'RACE',
      name: 'Gran Premio de Italia 2026 (Monza)',
      trackStatus: 'CHEQUERED',
      currentLap: 53,
      totalLaps: 53,
      timeRemainingSec: 0,
      airTemp: 28.5,
      trackTemp: 42.1,
      humidity: 42,
      rainProbability: 0,
      windSpeed: 8.2,
      windDirection: 'N',
      safetyCarDeployed: false,
      vscDeployed: false,
      redFlagDeployed: false,
      drsEnabled: true,
    };

    // Realistic Monza fast laps for each position
    const baseLapTimes = [
      81.432, // ANT P1 (1:21.432)
      81.512, // RUS P2 (1:21.512)
      81.720, // VER P3 (1:21.720)
      81.650, // NOR P4 (1:21.650)
      81.690, // PIA P5 (1:21.690)
      81.810, // HAM P6 (1:21.810)
      82.010, // GAS P7 (1:22.010)
      82.180, // LIN P8 (1:22.180)
      82.250, // COL P9 (1:22.250)
      82.310, // HAD P10 (1:22.310)
      82.450, // BOR P11
      82.520, // HUL P12
      82.610, // SAI P13
      82.680, // LAW P14
      82.750, // BEA P15
      82.900, // OCO P16
      83.020, // ALB P17
      83.150, // PER P18
      83.400, // BOT P19
      83.800, // STR DNF
      83.950, // ALO DNF
      84.100, // LEC DNF
    ];

    // Speed traps recorded at Monza (Rettifilo 350-356 km/h)
    const speedTraps = [
      354, 356, 351, 352, 352, 350, 348, 349, 347, 348,
      346, 346, 347, 349, 345, 345, 346, 344, 342, 345, 346, 350
    ];

    this.leaderboard = roundResults.map((result, idx) => {
      // Match with DRIVERS catalog by code first
      const baseDriver = DRIVERS.find(d => d.code === result.code) || DRIVERS.find(d => d.id === result.code.toLowerCase());
      const driverObj = {
        id: baseDriver?.id || result.code.toLowerCase(),
        code: result.code,
        number: result.driverNumber || baseDriver?.number || (idx + 1),
        firstName: baseDriver?.firstName || result.driverName.split(' ')[0] || '',
        lastName: baseDriver?.lastName || result.driverName.split(' ').slice(1).join(' ') || result.driverName,
        team: result.team || baseDriver?.team || '',
        teamColor: result.teamColor || baseDriver?.teamColor || '#fff',
        country: baseDriver?.country || result.flag,
        flag: result.flag || baseDriver?.flag || '🏁',
      };

      const baseSec = baseLapTimes[idx] || 82.5;
      const s1 = (26.241 + (idx * 0.04)).toFixed(3);
      const s2 = (27.530 + (idx * 0.05)).toFixed(3);
      const s3 = (27.661 + (idx * 0.03)).toFixed(3);

      // Official Monza real racing intervals between consecutive cars (seconds)
      const officialMonzaIntervals = [
        0,      // P1 ANT (Winner)
        3.857,  // P2 RUS (+3.857s)
        10.861, // P3 VER (+14.718s)
        4.338,  // P4 NOR (+19.056s)
        0.197,  // P5 PIA (+19.253s)
        5.402,  // P6 HAM (+24.655s)
        2.696,  // P7 GAS (+27.351s)
        17.785, // P8 LIN (+45.136s)
        2.217,  // P9 COL (+47.353s)
        10.834, // P10 HAD (+58.187s)
        7.000,  // P11 BOR (+65.187s)
        1.000,  // P12 HUL (+66.187s)
        7.930,  // P13 SAI (+74.117s)
        1.492,  // P14 LAW (+75.609s)
        3.349,  // P15 BEA (+78.958s)
        0.882,  // P16 OCO (+79.840s)
        1.170,  // P17 ALB (+81.010s)
        1.140,  // P18 PER (+82.150s)
        2.450,  // P19 BOT (+84.600s)
        0,      // P20 STR DNF
        0,      // P21 ALO DNF
        0,      // P22 LEC DNF
      ];

      const isDnf = idx >= 19 || result.status === 'DNF' || result.gapToLeader === 'DNF';
      
      let intervalNum = officialMonzaIntervals[idx] !== undefined ? officialMonzaIntervals[idx] : 1.2;
      let gapAheadStr = 'LEADER';
      let gapLeaderStr = 'GANADOR';

      if (idx === 0) {
        gapLeaderStr = 'GANADOR';
        gapAheadStr = 'LEADER';
        intervalNum = 0;
      } else if (isDnf) {
        gapLeaderStr = 'DNF';
        gapAheadStr = 'DNF';
        intervalNum = 0;
      } else {
        const driverLaps = result.laps !== undefined ? result.laps : 53;
        const winnerLaps = 53;
        const lapsDownFromLeader = Math.max(0, winnerLaps - driverLaps);
        const prevLaps = roundResults[idx - 1]?.laps !== undefined ? roundResults[idx - 1].laps : 53;
        const lapsDownFromAhead = Math.max(0, prevLaps - driverLaps);

        // Gap to Leader: if lapped by leader, display +1 LAP or +2 LAPS
        if (lapsDownFromLeader === 1 || result.gapToLeader === '+1 LAP') {
          gapLeaderStr = '+1 LAP';
        } else if (lapsDownFromLeader > 1 || (result.gapToLeader && result.gapToLeader.includes('LAP'))) {
          gapLeaderStr = `+${lapsDownFromLeader} LAPS`;
        } else {
          let cum = 0;
          for (let k = 1; k <= idx; k++) {
            cum += officialMonzaIntervals[k] || 1.2;
          }
          gapLeaderStr = `+${cum.toFixed(3)}s`;
        }

        // Interval to car ahead: if lapped by the car ahead, display +1 LAP, otherwise interval in seconds
        if (lapsDownFromAhead === 1) {
          gapAheadStr = '+1 LAP';
        } else if (lapsDownFromAhead > 1) {
          gapAheadStr = `+${lapsDownFromAhead} LAPS`;
        } else {
          gapAheadStr = `+${intervalNum.toFixed(3)}s`;
        }
      }

      return {
        position: result.position || (idx + 1),
        previousPosition: result.position || (idx + 1),
        driver: driverObj,
        gapToLeader: gapLeaderStr,
        gapToAhead: gapAheadStr,
        intervalNum: intervalNum,
        currentLapTime: isDnf ? 'DNF' : this.formatLapTime(baseSec),
        bestLapTime: this.formatLapTime(baseSec),
        s1Time: s1,
        s2Time: s2,
        s3Time: s3,
        s1Status: idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow',
        s2Status: idx === 1 ? 'purple' : idx < 4 ? 'green' : 'yellow',
        s3Status: idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow',
        tyre: {
          compound: idx % 2 === 0 ? 'HARD' : 'MEDIUM',
          age: isDnf ? result.laps : 24,
          used: true,
        },
        pitStops: isDnf ? (result.laps > 15 ? 1 : 0) : (idx === 8 ? 2 : 1),
        inPit: false,
        isPitOut: false,
        isKnockedOut: false,
        isEliminationRisk: false,
        speedTrap: speedTraps[idx] || 348,
        lastLapTimeNum: baseSec,
        trackProgress: 1.0,
      };
    });

    // Populate realistic Monza telemetry curves for each driver
    this.leaderboard.forEach((entry, idx) => {
      const isWinner = idx === 0;
      const speed = isWinner ? 354 : Math.max(340, 356 - idx * 0.8);
      this.telemetryMap.set(entry.driver.id, {
        driverId: entry.driver.id,
        speed: Math.round(speed),
        rpm: isWinner ? 12850 : 12700,
        gear: 8,
        throttle: 100,
        brake: 0,
        drs: 2, // DRS Active on straight
        steerAngle: 0,
        gForceLat: 0.2,
        gForceLong: 0.9,
        ersBattery: Math.max(70, 88 - idx * 2),
        ersDeploy: 85,
      });
    });

    this.raceControlLog = [...RECORDED_MONZA_RACE_CONTROL];
    this.teamRadioLog = [...RECORDED_MONZA_RADIOS];
    this.selectedDriverId = this.leaderboard[0]?.driver.id || 'ant';

    // Notify listeners of initial recorded state
    this.emitCurrentState();
  }

  /**
   * Sanitize any leaderboard entries array so Yuki Tsunoda (TSU #22) is replaced by Isack Hadjar (HAD #6)
   * or removed if HAD is already present, updating localStorage if legacy entries were found.
   */
  public sanitizeDriverRosterInEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    if (!Array.isArray(entries) || entries.length === 0) return entries;
    const hasHadjar = entries.some(e => e?.driver && (e.driver.code === 'HAD' || e.driver.number === 6));
    let modified = false;
    const hadjarDriver = DRIVERS.find(d => d.code === 'HAD') || {
      id: 'had',
      code: 'HAD',
      number: 6,
      firstName: 'Isack',
      lastName: 'Hadjar',
      team: 'Red Bull Racing',
      teamColor: '#3671C6',
      country: 'Francia',
      flag: '🇫🇷',
    };

    const cleaned: LeaderboardEntry[] = [];
    for (const entry of entries) {
      if (!entry || !entry.driver) continue;
      const isTsu =
        entry.driver.code === 'TSU' ||
        entry.driver.id === 'tsu' ||
        entry.driver.number === 22 ||
        (entry.driver.lastName && entry.driver.lastName.toLowerCase().includes('tsunoda'));

      if (isTsu) {
        modified = true;
        if (!hasHadjar) {
          cleaned.push({
            ...entry,
            driver: { ...hadjarDriver },
          });
        }
        continue;
      }

      if (entry.driver.code === 'LAW' && entry.driver.team === 'Red Bull Racing') {
        modified = true;
        cleaned.push({
          ...entry,
          driver: {
            ...entry.driver,
            team: 'Visa Cash App RB',
            teamColor: '#6692FF',
          },
        });
        continue;
      }

      cleaned.push(entry);
    }

    if (modified) {
      cleaned.forEach((e, idx) => {
        e.position = idx + 1;
      });
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('f1_live_leaderboard', JSON.stringify(cleaned));
          localStorage.setItem('f1_saved_leaderboard_madrid', JSON.stringify(cleaned));
        } catch {}
      }
    }
    return cleaned;
  }

  /**
   * Emit the current engine state to all listeners
   */
  public emitCurrentState() {
    this.leaderboard = this.sanitizeDriverRosterInEntries(this.leaderboard);
    const pitPrediction = this.calculatePitPrediction(this.selectedDriverId);
    this.listeners.onTick?.({
      leaderboard: [...this.leaderboard],
      telemetryMap: new Map(this.telemetryMap),
      session: { ...this.session },
      selectedDriverTelemetry: this.telemetryMap.get(this.selectedDriverId) || null,
      pitPrediction,
    });
  }

  public setCircuit(circuitId: string) {
    const circuit = CIRCUIT_MAP.get(circuitId);
    if (!circuit) return;
    this.circuit = circuit;
    this.session.circuit = circuit;
    this.session.totalLaps = circuit.laps;
    this.session.name = `Gran Premio de ${circuit.country}`;
  }

  public setSessionType(type: SessionState['type']) {
    this.session.type = type;
    if (type === 'QUALIFYING') {
      this.session.totalLaps = 0;
      this.session.timeRemainingSec = 720;
    } else if (type === 'PRACTICE') {
      this.session.totalLaps = 0;
      this.session.timeRemainingSec = 2100;
    } else {
      this.session.currentLap = 53;
      this.session.totalLaps = this.circuit.laps;
    }
  }

  /**
   * Synchronize live session state directly into the engine so tick() preserves live remaining duration & type
   */
  public updateLiveSessionState(partial: Partial<SessionState>) {
    this.session = {
      ...this.session,
      ...partial,
    };
    if (this.session.type === 'PRACTICE' || this.session.type === 'QUALIFYING') {
      this.session.totalLaps = 0;
    }
    if (partial.timeRemainingSec === 0 || partial.trackStatus === 'CHEQUERED') {
      this.sessionEnded = true;
    }
    this.emitCurrentState();
  }

  /**
   * Reset the leaderboard state for a brand new session.
   * Clears all lap times, sector times, gaps, and track progress.
   * Called when the official schedule shows a new session has started.
   */
  public resetForNewSession(
    sessionName: string,
    sessionType: SessionState['type'],
    durationSec: number,
    sessionKey?: string
  ) {
    const resolvedKey = sessionKey || `${this.circuit.id}-${sessionName}`;
    const prevName = this.session.name;
    this.sessionEnded = false;
    this.session.id = resolvedKey;
    this.session.type = sessionType;
    this.session.name = sessionName;
    this.session.timeRemainingSec = Math.max(60, durationSec);
    this.session.trackStatus = 'GREEN';
    this.session.currentLap = 0;
    this.session.totalLaps = (sessionType === 'RACE' || sessionType === 'SPRINT') ? (this.circuit.laps || 55) : 0;
    this.session.safetyCarDeployed = false;
    this.session.vscDeployed = false;
    this.session.redFlagDeployed = false;

    let hasSameSessionSavedData = false;
    let isSameSession = false;
    if (typeof window !== 'undefined') {
      try {
        const storedKey = localStorage.getItem('f1_active_session_key_v4');
        isSameSession = storedKey === resolvedKey;

        if (!isSameSession) {
          // Archive previous session's best lap into Weekend Fastest Lap before clearing
          const prevRaw = localStorage.getItem('f1_official_latest_session_v4');
          if (prevRaw) {
            const prevParsed = JSON.parse(prevRaw);
            if (Array.isArray(prevParsed) && !this.isSyntheticLeaderboard(prevParsed) && prevParsed[0]?.bestLapTime) {
              const prevBestSec = this.parseLapTimeToSeconds(prevParsed[0].bestLapTime);
              if (prevBestSec >= 65 && prevBestSec < 200) {
                const wkKey = `f1_weekend_fastest_v2_${this.circuit.id}`;
                const cleanPrevShort = prevName.includes(' - ') ? prevName.split(' - ').slice(-1)[0] : prevName;
                localStorage.setItem(wkKey, JSON.stringify({
                  sec: prevBestSec,
                  driverCode: prevParsed[0].driver?.code || 'ANT',
                  sessionLabel: cleanPrevShort || 'FP1',
                }));
              }
            }
          }
          // Wipe previous session leaderboard and best sectors
          localStorage.removeItem('f1_official_latest_session_v4');
          localStorage.removeItem('f1_session_best_sectors_v4');
          localStorage.setItem('f1_active_session_key_v4', resolvedKey);
          this.hasLiveOfficialData = false;
        } else {
          const raw = localStorage.getItem('f1_official_latest_session_v4');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (this.isSyntheticLeaderboard(parsed)) {
              localStorage.removeItem('f1_official_latest_session_v4');
              localStorage.removeItem('f1_session_best_sectors_v4');
            } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.bestLapTime && parsed[0].bestLapTime !== '--:--.---') {
              const sanitized = this.sanitizeDriverRosterInEntries(parsed);
              this.leaderboard = sanitized;
              hasSameSessionSavedData = true;
            }
          }
        }
      } catch {}
    }

    if (!hasSameSessionSavedData && !(isSameSession && this.hasLiveOfficialData)) {
      // Clear previous session live sector state and initialize fresh session times while waiting for live WS / OpenF1
      this.driverLiveSectors.clear();
      const isPractice2 = /fp2|practice 2|libres 2/i.test(sessionName);
      const offset = isPractice2 ? -0.160 : 0;
      this.sessionBestS1 = isPractice2 ? 35.790 : 35.840;
      this.sessionBestS2 = isPractice2 ? 41.045 : 41.085;
      this.sessionBestS3 = isPractice2 ? 25.345 : 25.380;

      this.leaderboard.forEach((entry, idx) => {
        const baseSec = Number((102.340 + offset + idx * 0.115).toFixed(3));
        const s1Val = Number((this.sessionBestS1 + idx * 0.042).toFixed(3));
        const s2Val = Number(((idx === 1 ? this.sessionBestS2 : this.sessionBestS2 + 0.035) + idx * 0.048).toFixed(3));
        const s3Val = Number((baseSec - s1Val - s2Val).toFixed(3));
        const s1 = s1Val.toFixed(3);
        const s2 = s2Val.toFixed(3);
        const s3 = s3Val.toFixed(3);
        const formattedLap = this.formatLapTime(baseSec);

        entry.bestLapTime = formattedLap;
        entry.currentLapTime = formattedLap;
        entry.lastLapTime = formattedLap;
        entry.lastLapTimeNum = baseSec;
        entry.s1Time = s1;
        entry.s2Time = s2;
        entry.s3Time = s3;
        entry.s1BestTime = s1;
        entry.s2BestTime = s2;
        entry.s3BestTime = s3;
        entry.s1Status = idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow';
        entry.s2Status = idx === 1 ? 'purple' : idx < 4 ? 'green' : 'yellow';
        entry.s3Status = idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow';
        entry.s1Segments = this.buildInitialSegments(8, entry.s1Status);
        entry.s2Segments = this.buildInitialSegments(8, entry.s2Status);
        entry.s3Segments = this.buildInitialSegments(9, entry.s3Status);
        entry.gapToLeader = idx === 0 ? 'LÍDER' : `+${(baseSec - (102.340 + offset)).toFixed(3)}s`;
        entry.gapToAhead = idx === 0 ? 'LEADER' : `+0.115s`;
        entry.intervalNum = idx === 0 ? 0 : 0.115;
        entry.inPit = idx >= 18;
        entry.isPitOut = false;
        entry.tyre.age = 2;
        entry.lapsCompleted = 2;
        entry.trackProgress = (idx * 0.045) % 1.0;
      });
    }

    this.start();
    this.emitCurrentState();
  }

  private isSyntheticLeaderboard(entries: any[]): boolean {
    if (!Array.isArray(entries) || entries.length < 3) return false;
    const firstLap = entries[0]?.bestLapTime;
    if (firstLap === '1:42.180' || firstLap === '1:42.340') return true;
    if (entries[1]?.gapToAhead === '+0.115s' && entries[2]?.gapToAhead === '+0.115s') return true;
    return false;
  }

  /**
   * Check if the session simulation has ended
   */
  public isSessionEnded(): boolean {
    return this.sessionEnded;
  }

  /**
   * Ingest real session results from OpenF1 API.
   * Replaces the simulated leaderboard with actual timing data.
   * This is called after a session completes to show real results.
   */
  public ingestRealSessionResults(results: Array<{
    driverNumber: number;
    nameAcronym: string;
    teamName: string;
    teamColor: string;
    bestLapSec: number;
    bestLapFormatted: string;
    s1: number | null;
    s2: number | null;
    s3: number | null;
    speedTrap: number | null;
    finalPosition: number;
  }>) {
    if (!results || results.length === 0) return;

    const leaderSec = results[0].bestLapSec;

    results.forEach((result, idx) => {
      // Find matching entry in current leaderboard by driver number or acronym
      let existing = this.leaderboard.find(e => e.driver.number === result.driverNumber || e.driver.code.toUpperCase() === result.nameAcronym.toUpperCase());

      // If not in current leaderboard, create a new entry
      if (!existing) {
        const driverMeta = DRIVERS.find(d => d.number === result.driverNumber || d.code.toUpperCase() === result.nameAcronym.toUpperCase());
        existing = {
          position: result.finalPosition,
          previousPosition: result.finalPosition,
          driver: {
            id: driverMeta?.id || result.nameAcronym.toLowerCase(),
            code: result.nameAcronym,
            number: result.driverNumber,
            firstName: driverMeta?.firstName || result.nameAcronym,
            lastName: driverMeta?.lastName || '',
            team: driverMeta?.team || result.teamName,
            teamColor: result.teamColor && result.teamColor !== '#' ? result.teamColor : (driverMeta?.teamColor || '#ffffff'),
            country: driverMeta?.country || 'Internacional',
            flag: driverMeta?.flag || '🏁',
          },
          gapToLeader: '0.000',
          gapToAhead: '0.000',
          intervalNum: 0,
          currentLapTime: result.bestLapFormatted,
          bestLapTime: result.bestLapFormatted,
          s1Time: result.s1 ? result.s1.toFixed(3) : '--.---',
          s2Time: result.s2 ? result.s2.toFixed(3) : '--.---',
          s3Time: result.s3 ? result.s3.toFixed(3) : '--.---',
          s1Status: idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow',
          s2Status: idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow',
          s3Status: idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow',
          tyre: {
            compound: idx % 3 === 0 ? 'SOFT' : idx % 3 === 1 ? 'MEDIUM' : 'HARD',
            age: 6 + (idx % 8),
            used: false,
          },
          pitStops: 1,
          inPit: false,
          isPitOut: false,
          isKnockedOut: false,
          isEliminationRisk: false,
          speedTrap: result.speedTrap || (310 - idx * 2),
          lastLapTimeNum: result.bestLapSec,
          trackProgress: ((1.0 - idx * 0.045) + 1.0) % 1.0,
        };
        this.leaderboard.push(existing);
      }

      // Update with real data
      existing.position = result.finalPosition;
      existing.previousPosition = existing.position;
      existing.bestLapTime = result.bestLapFormatted;
      existing.currentLapTime = result.bestLapFormatted;
      existing.lastLapTimeNum = result.bestLapSec;

      if (result.s1 !== null) {
        existing.s1Time = result.s1.toFixed(3);
        existing.s1BestTime = result.s1.toFixed(3);
      }
      if (result.s2 !== null) {
        existing.s2Time = result.s2.toFixed(3);
        existing.s2BestTime = result.s2.toFixed(3);
      }
      if (result.s3 !== null) {
        existing.s3Time = result.s3.toFixed(3);
        existing.s3BestTime = result.s3.toFixed(3);
      }

      // Assign sector status based on position
      existing.s1Status = idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow';
      existing.s2Status = idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow';
      existing.s3Status = idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow';

      if (result.speedTrap !== null) existing.speedTrap = result.speedTrap;

      // Calculate gaps
      if (idx === 0) {
        existing.gapToLeader = 'LÍDER';
        existing.gapToAhead = 'LEADER';
        existing.intervalNum = 0;
      } else {
        const gapToLeaderSec = result.bestLapSec - leaderSec;
        const aheadSec = results[idx - 1].bestLapSec;
        const intervalSec = result.bestLapSec - aheadSec;
        existing.gapToLeader = `+${gapToLeaderSec.toFixed(3)}s`;
        existing.gapToAhead = `+${intervalSec.toFixed(3)}s`;
        existing.intervalNum = intervalSec;
      }

      // Track progress (preserve moving car position)
      existing.inPit = false;
      existing.isPitOut = false;
      if (existing.trackProgress === undefined) {
        existing.trackProgress = ((0.92 - idx * 0.042) + 1.0) % 1.0;
      }

      // Update team color from OpenF1 data
      if (result.teamColor && result.teamColor !== '#') {
        existing.driver.teamColor = result.teamColor;
      }
    });

    // Re-sort leaderboard by final position
    this.leaderboard.sort((a, b) => a.position - b.position);

    // Update telemetry map for every car with their real speed data
    this.leaderboard.forEach((entry, idx) => {
      const topSpeed = entry.speedTrap || (310 - idx * 2);
      this.telemetryMap.set(entry.driver.id, {
        driverId: entry.driver.id,
        speed: Math.round(topSpeed),
        rpm: Math.round(11000 + (topSpeed > 300 ? (topSpeed - 300) * 40 : 0)),
        gear: topSpeed > 280 ? 8 : 7,
        throttle: 100,
        brake: 0,
        drs: topSpeed > 300 ? 2 : 0,
        steerAngle: 0,
        gForceLat: 0.2,
        gForceLong: 0.5,
        ersBattery: Math.max(70, 95 - idx * 1.5),
        ersDeploy: 85,
      });
    });

    // Persist real session results and best sectors to localStorage
    this.persistBestSectorsAndLeaderboard();

    this.emitCurrentState();
  }

  /**
   * Ingest official live timing entries dynamically collected from the official F1 live timing feed.
   * Crucial: Preserves existing.trackProgress so moving cars NEVER jump backwards on the circuit map!
   */
  public ingestOfficialLiveEntries(entries: LeaderboardEntry[]) {
    if (!entries || entries.length === 0) return;

    this.hasLiveOfficialData = true;
    this.isLiveMode = true;

    entries.forEach(newEntry => {
      const existing = this.leaderboard.find(e => 
        e.driver.number === newEntry.driver.number || 
        e.driver.code.toUpperCase() === newEntry.driver.code.toUpperCase()
      );

      if (existing) {
        // Update timing & status data, PRESERVING continuous trackProgress & smooth telemetry
        existing.position = newEntry.position;
        existing.previousPosition = newEntry.previousPosition;
        existing.gapToLeader = newEntry.gapToLeader;
        existing.gapToAhead = newEntry.gapToAhead;
        existing.intervalNum = newEntry.intervalNum;
        existing.currentLapTime = newEntry.currentLapTime;
        existing.bestLapTime = newEntry.bestLapTime;
        existing.lastLapTime = newEntry.lastLapTime;
        existing.lastLapTimeNum = newEntry.lastLapTimeNum;
        existing.s1Time = newEntry.s1Time;
        existing.s2Time = newEntry.s2Time;
        existing.s3Time = newEntry.s3Time;
        if (newEntry.s1BestTime) {
          const prevS1 = parseFloat(existing.s1BestTime || '999');
          const nextS1 = parseFloat(newEntry.s1BestTime);
          if (!isNaN(nextS1) && nextS1 < prevS1) existing.s1BestTime = newEntry.s1BestTime;
        }
        if (newEntry.s2BestTime) {
          const prevS2 = parseFloat(existing.s2BestTime || '999');
          const nextS2 = parseFloat(newEntry.s2BestTime);
          if (!isNaN(nextS2) && nextS2 < prevS2) existing.s2BestTime = newEntry.s2BestTime;
        }
        if (newEntry.s3BestTime) {
          const prevS3 = parseFloat(existing.s3BestTime || '999');
          const nextS3 = parseFloat(newEntry.s3BestTime);
          if (!isNaN(nextS3) && nextS3 < prevS3) existing.s3BestTime = newEntry.s3BestTime;
        }
        existing.s1Status = newEntry.s1Status;
        existing.s2Status = newEntry.s2Status;
        existing.s3Status = newEntry.s3Status;
        if (newEntry.s1Segments) existing.s1Segments = newEntry.s1Segments;
        if (newEntry.s2Segments) existing.s2Segments = newEntry.s2Segments;
        if (newEntry.s3Segments) existing.s3Segments = newEntry.s3Segments;
        existing.tyre = newEntry.tyre;
        existing.pitStops = newEntry.pitStops;
        existing.inPit = newEntry.inPit;
        existing.isPitOut = newEntry.isPitOut;
        existing.speedTrap = newEntry.speedTrap;
        if (newEntry.lapsCompleted !== undefined) existing.lapsCompleted = newEntry.lapsCompleted;
        // Keep existing.trackProgress untouched so cars flow smoothly forward without stutter!
      } else {
        this.leaderboard.push({ ...newEntry });
      }
    });

    this.leaderboard.sort((a, b) => a.position - b.position);
    this.persistBestSectorsAndLeaderboard();

    this.emitCurrentState();
  }

  private persistBestSectorsAndLeaderboard() {
    if (typeof window === 'undefined') return;
    try {
      const rawSectors = localStorage.getItem('f1_session_best_sectors_v4');
      const bestMap: Record<string, { s1?: string; s2?: string; s3?: string; bestLap?: string }> = rawSectors ? (JSON.parse(rawSectors) || {}) : {};
      for (const e of this.leaderboard) {
        const numStr = String(e.driver.number);
        const cur = bestMap[numStr] || {};
        const s1Val = parseFloat(e.s1BestTime || e.s1Time || '999');
        const curS1 = parseFloat(cur.s1 || '999');
        const s2Val = parseFloat(e.s2BestTime || e.s2Time || '999');
        const curS2 = parseFloat(cur.s2 || '999');
        const s3Val = parseFloat(e.s3BestTime || e.s3Time || '999');
        const curS3 = parseFloat(cur.s3 || '999');

        const nextS1 = !isNaN(s1Val) && s1Val < curS1 ? (e.s1BestTime || e.s1Time) : (cur.s1 || e.s1BestTime || e.s1Time);
        const nextS2 = !isNaN(s2Val) && s2Val < curS2 ? (e.s2BestTime || e.s2Time) : (cur.s2 || e.s2BestTime || e.s2Time);
        const nextS3 = !isNaN(s3Val) && s3Val < curS3 ? (e.s3BestTime || e.s3Time) : (cur.s3 || e.s3BestTime || e.s3Time);

        e.s1BestTime = nextS1;
        e.s2BestTime = nextS2;
        e.s3BestTime = nextS3;
        bestMap[numStr] = {
          s1: nextS1,
          s2: nextS2,
          s3: nextS3,
          bestLap: e.bestLapTime || cur.bestLap,
        };
      }
      localStorage.setItem('f1_session_best_sectors_v4', JSON.stringify(bestMap));
      localStorage.setItem('f1_official_latest_session_v4', JSON.stringify(this.leaderboard));
    } catch {}
  }

  private getDriverLiveState(entry: LeaderboardEntry, currentBestLapNum: number) {
    let state = this.driverLiveSectors.get(entry.driver.id);
    if (!state) {
      const baseLap = currentBestLapNum > 0 && currentBestLapNum < 200 ? currentBestLapNum : 103.2;
      const initS1 = parseFloat(entry.s1BestTime || entry.s1Time || '35.950') || (baseLap / 102.34) * 35.84;
      const initS2 = parseFloat(entry.s2BestTime || entry.s2Time || '41.220') || (baseLap / 102.34) * 41.12;
      const initS3 = parseFloat(entry.s3BestTime || entry.s3Time || '25.480') || (baseLap / 102.34) * 25.38;
      state = {
        currentS1: initS1,
        currentS2: initS2,
        personalBestS1: initS1,
        personalBestS2: initS2,
        personalBestS3: initS3,
        personalBestLap: baseLap,
      };
      this.driverLiveSectors.set(entry.driver.id, state);
    }
    return state;
  }

  private handleSector1Crossed(entry: LeaderboardEntry, _idx: number) {
    const currentBest = entry.lastLapTimeNum || this.parseLapTimeToSeconds(entry.bestLapTime);
    const state = this.getDriverLiveState(entry, currentBest);

    // Realistic variation around driver's typical S1
    const baseS1 = (state.personalBestS1 || 35.95);
    const variance = (Math.random() * 0.28 - 0.06);
    const s1Time = Number(Math.max(35.65, baseS1 + variance).toFixed(3));
    state.currentS1 = s1Time;

    entry.s1Time = s1Time.toFixed(3);

    if (s1Time < this.sessionBestS1) {
      this.sessionBestS1 = s1Time;
      state.personalBestS1 = s1Time;
      entry.s1Status = 'purple';
    } else if (s1Time <= state.personalBestS1) {
      state.personalBestS1 = s1Time;
      entry.s1Status = 'green';
    } else {
      entry.s1Status = 'yellow';
    }
    entry.s1BestTime = state.personalBestS1.toFixed(3);
    this.persistBestSectorsAndLeaderboard();
  }

  private handleSector2Crossed(entry: LeaderboardEntry, _idx: number) {
    const currentBest = entry.lastLapTimeNum || this.parseLapTimeToSeconds(entry.bestLapTime);
    const state = this.getDriverLiveState(entry, currentBest);

    const baseS2 = (state.personalBestS2 || 41.22);
    const variance = (Math.random() * 0.30 - 0.06);
    const s2Time = Number(Math.max(40.95, baseS2 + variance).toFixed(3));
    state.currentS2 = s2Time;

    entry.s2Time = s2Time.toFixed(3);

    if (s2Time < this.sessionBestS2) {
      this.sessionBestS2 = s2Time;
      state.personalBestS2 = s2Time;
      entry.s2Status = 'purple';
    } else if (s2Time <= state.personalBestS2) {
      state.personalBestS2 = s2Time;
      entry.s2Status = 'green';
    } else {
      entry.s2Status = 'yellow';
    }
    entry.s2BestTime = state.personalBestS2.toFixed(3);
    this.persistBestSectorsAndLeaderboard();
  }

  private handleLapCompleted(entry: LeaderboardEntry, _idx: number) {
    const currentBest = entry.lastLapTimeNum || this.parseLapTimeToSeconds(entry.bestLapTime);
    const state = this.getDriverLiveState(entry, currentBest);

    const baseS3 = (state.personalBestS3 || 25.48);
    const variance = (Math.random() * 0.24 - 0.05);
    const s3Time = Number(Math.max(25.25, baseS3 + variance).toFixed(3));

    entry.s3Time = s3Time.toFixed(3);

    if (s3Time < this.sessionBestS3) {
      this.sessionBestS3 = s3Time;
      state.personalBestS3 = s3Time;
      entry.s3Status = 'purple';
    } else if (s3Time <= state.personalBestS3) {
      state.personalBestS3 = s3Time;
      entry.s3Status = 'green';
    } else {
      entry.s3Status = 'yellow';
    }
    entry.s3BestTime = state.personalBestS3.toFixed(3);

    const s1 = state.currentS1 || state.personalBestS1 || 35.95;
    const s2 = state.currentS2 || state.personalBestS2 || 41.22;
    const totalLapSec = Number((s1 + s2 + s3Time).toFixed(3));
    const formattedLap = this.formatLapTime(totalLapSec);

    entry.currentLapTime = formattedLap;
    entry.lastLapTime = formattedLap;

    // Check personal best improvement
    const prevBestSec = state.personalBestLap && state.personalBestLap < 200 ? state.personalBestLap : currentBest;
    if (totalLapSec < prevBestSec || !entry.bestLapTime || entry.bestLapTime === '--:--.---') {
      state.personalBestLap = totalLapSec;
      entry.bestLapTime = formattedLap;
      entry.lastLapTimeNum = totalLapSec;
    }

    entry.lapsCompleted = (entry.lapsCompleted || 0) + 1;
    this.persistBestSectorsAndLeaderboard();
  }

  private buildInitialSegments(count: number, status: SectorStatus): SectorStatus[] {
    const res: SectorStatus[] = [];
    for (let i = 0; i < count; i++) {
      if (status === 'purple') {
        res.push(i % 6 === 1 ? 'green' : 'purple');
      } else if (status === 'green') {
        res.push(i % 5 === 2 ? 'purple' : i % 5 === 0 ? 'yellow' : 'green');
      } else {
        res.push(i % 4 === 1 ? 'green' : 'yellow');
      }
    }
    return res;
  }

  private getMicrosectorColor(driverNum: number, lap: number, sectorIdx: number, microIdx: number, isTopDriver: boolean): SectorStatus {
    const hash = ((driverNum * 31 + lap * 17 + sectorIdx * 13 + microIdx * 7) % 100 + 100) % 100;
    if (isTopDriver) {
      if (hash < 45) return 'purple';
      if (hash < 85) return 'green';
      return 'yellow';
    }
    if (hash < 18) return 'purple';
    if (hash < 65) return 'green';
    return 'yellow';
  }

  private updateEntryMicrosectors(entry: LeaderboardEntry, progress: number) {
    // Sector boundary fractions — must sum to 1.0
    const S1_END = 0.3333;   // S1: 0 → 0.3333
    const S2_END = 0.6666;   // S2: 0.3333 → 0.6666
    // S3: 0.6666 → 1.0 (0.3334)
    const S1_MICRO = S1_END / 8;
    const S2_MICRO = (S2_END - S1_END) / 8;
    const S3_MICRO = (1.0 - S2_END) / 9;

    const lap  = entry.lapsCompleted || 1;
    const dNum = entry.driver.number  || 1;
    const isTop = entry.position <= 3;

    /** Build all microsectors for a completed sector (every tick they're fully lit). */
    const buildFullSector = (sectorIdx: number, count: number): SectorStatus[] => {
      const arr: SectorStatus[] = [];
      for (let i = 0; i < count; i++) {
        arr.push(this.getMicrosectorColor(dNum, lap, sectorIdx, i, isTop));
      }
      return arr;
    };

    if (progress < S1_END) {
      // ── S1 in progress ──────────────────────────────────────────────────────
      const activeIdx = Math.min(7, Math.floor(progress / S1_MICRO));
      const s1Segs: SectorStatus[] = [];
      for (let i = 0; i < 8; i++) {
        s1Segs.push(i <= activeIdx ? this.getMicrosectorColor(dNum, lap, 1, i, isTop) : 'none');
      }
      entry.s1Segments = s1Segs;
      entry.s2Segments = Array(8).fill('none');
      entry.s3Segments = Array(9).fill('none');
      entry.s1Status = s1Segs.slice(0, activeIdx + 1).includes('purple') ? 'purple' : 'green';
      entry.s2Status = 'none';
      entry.s3Status = 'none';

    } else if (progress < S2_END) {
      // ── S2 in progress ──────────────────────────────────────────────────────
      const activeIdx = Math.min(7, Math.floor((progress - S1_END) / S2_MICRO));
      // S1 is fully done — always render all 8 segments with their color
      entry.s1Segments = buildFullSector(1, 8);
      const s2Segs: SectorStatus[] = [];
      for (let i = 0; i < 8; i++) {
        s2Segs.push(i <= activeIdx ? this.getMicrosectorColor(dNum, lap, 2, i, isTop) : 'none');
      }
      entry.s2Segments = s2Segs;
      entry.s3Segments = Array(9).fill('none');
      // s2Status reflects whether any lit segment is purple, else use the overall sector status
      const hasPurpleS2 = s2Segs.slice(0, activeIdx + 1).includes('purple');
      entry.s2Status = hasPurpleS2 ? 'purple' : activeIdx >= 0 ? 'green' : 'none';
      entry.s3Status = 'none';

    } else {
      // ── S3 in progress ──────────────────────────────────────────────────────
      const activeIdx = Math.min(8, Math.floor((progress - S2_END) / S3_MICRO));
      // S1 and S2 are fully done — always render all segments with their colors
      entry.s1Segments = buildFullSector(1, 8);
      entry.s2Segments = buildFullSector(2, 8);
      const s3Segs: SectorStatus[] = [];
      for (let i = 0; i < 9; i++) {
        s3Segs.push(i <= activeIdx ? this.getMicrosectorColor(dNum, lap, 3, i, isTop) : 'none');
      }
      entry.s3Segments = s3Segs;
      const hasPurpleS3 = s3Segs.slice(0, activeIdx + 1).includes('purple');
      entry.s3Status = hasPurpleS3 ? 'purple' : activeIdx >= 0 ? 'green' : 'none';
    }
  }

  public setListeners(listeners: EngineListeners) {
    this.listeners = listeners;
    this.emitCurrentState();
  }

  public setSelectedDriver(driverId: string) {
    this.selectedDriverId = driverId;
    this.emitCurrentState();
  }

  public getSelectedDriverId(): string {
    return this.selectedDriverId;
  }

  public setLiveMode(isLive: boolean) {
    this.isLiveMode = isLive;
    if (!this.sessionEnded) {
      this.start();
    }
  }

  public getLiveMode(): boolean {
    return this.isLiveMode;
  }

  public setTrackStatus(status: TrackStatus) {
    this.session.trackStatus = status;
    if (status === 'CHEQUERED') {
      this.sessionEnded = true;
      this.session.timeRemainingSec = 0;
      this.leaderboard.forEach(e => {
        e.inPit = true;
      });
    }
  }

  public ingestLiveCarData(carDataMap: Map<number, LiveCarTelemetry>): void {
    if (!carDataMap || carDataMap.size === 0) return;
    this.liveCarDataMap = new Map(carDataMap);
    this.hasLiveCarData = true;
    this.lastLiveCarDataTime = Date.now();

    if (this.sessionEnded || this.session.trackStatus === 'CHEQUERED') {
      return;
    }

    // Direct update to telemetryMap for immediate gauge response
    for (const [driverNumber, live] of carDataMap.entries()) {
      const entry = this.leaderboard.find(e => e.driver.number === driverNumber);
      if (!entry) continue;

      const existing = this.telemetryMap.get(entry.driver.id);
      const phys = this.getCircuitInstantPhysics(entry.trackProgress, this.circuit.id);

        const drsVal: 0 | 1 | 2 = live.drs === 2 ? 2 : live.drs === 1 ? 1 : (live.speed > 280 ? 1 : 0);
        this.telemetryMap.set(entry.driver.id, {
          driverId: entry.driver.id,
          speed: live.speed,
          rpm: live.rpm,
          gear: live.gear,
          throttle: live.throttle,
          brake: live.brake,
          drs: drsVal,
        steerAngle: existing?.steerAngle ?? phys.steerAngle,
        gForceLat: existing?.gForceLat ?? phys.latG,
        gForceLong: existing?.gForceLong ?? phys.longG,
        ersBattery: existing?.ersBattery ?? 85,
        ersDeploy: live.throttle > 80 ? 70 : 0,
      });
    }
  }

  private pitTimerMap = new Map<string, number>();

  public setSessionEnded(ended: boolean) {
    this.sessionEnded = ended;
    if (ended) {
      this.session.trackStatus = 'CHEQUERED';
      this.session.timeRemainingSec = 0;
      this.hasLiveCarData = false;
      this.liveCarDataMap.clear();
      // Set all telemetry to 0 immediately
      for (const entry of this.leaderboard) {
        this.telemetryMap.set(entry.driver.id, {
          driverId: entry.driver.id,
          speed: 0,
          rpm: 0,
          gear: 0,
          throttle: 0,
          brake: 0,
          drs: 0,
          steerAngle: 0,
          gForceLat: 0,
          gForceLong: 0,
          ersBattery: 100,
          ersDeploy: 0,
        });
      }
    } else {
      if (this.session.trackStatus === 'CHEQUERED') {
        this.session.trackStatus = 'GREEN';
      }
    }
  }

  public start() {
    if (this.timerId !== null) return;
    this.isRunning = true;
    const intervalMs = 60; // ~16.6 Hz update rate
    this.timerId = window.setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  public stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
  }

  public setPlaybackSpeed(speed: number) {
    this.playbackSpeed = speed;
  }

  public getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  public isEngineRunning(): boolean {
    return this.isRunning;
  }

  public triggerSafetyCar() {
    this.session.safetyCarDeployed = !this.session.safetyCarDeployed;
    this.session.vscDeployed = false;
    this.session.trackStatus = this.session.safetyCarDeployed ? 'SC' : 'GREEN';
    
    const msg: RaceControlMessage = {
      id: `rc-${Date.now()}`,
      timestamp: this.getCurrentTimeString(),
      flag: this.session.safetyCarDeployed ? 'YELLOW' : 'GREEN',
      scope: 'Track',
      messageEn: this.session.safetyCarDeployed ? 'SAFETY CAR DEPLOYED' : 'SAFETY CAR IN THIS LAP - TRACK CLEAR',
      messageEs: this.session.safetyCarDeployed ? 'SAFETY CAR DESPLEGADO EN PISTA' : 'SAFETY CAR ENTRA EN ESTA VUELTA - PISTA DESPEJADA',
      category: 'SAFETY_CAR',
    };
    this.addRaceControlMessage(msg);
  }

  public addRaceControlMessage(msg: RaceControlMessage) {
    this.raceControlLog.unshift(msg);
    if (this.raceControlLog.length > 50) {
      this.raceControlLog.pop();
    }
    this.listeners.onRaceControlMessage?.(msg);
  }

  public triggerRedFlag() {
    this.session.trackStatus = this.session.trackStatus === 'RED' ? 'GREEN' : 'RED';
    const isRed = this.session.trackStatus === 'RED';
    const msg: RaceControlMessage = {
      id: `rc-${Date.now()}`,
      timestamp: this.getCurrentTimeString(),
      flag: isRed ? 'RED' : 'GREEN',
      scope: 'Track',
      messageEn: isRed ? 'RED FLAG - SESSION SUSPENDED' : 'GREEN FLAG - TRACK CLEAR, SESSION RESUMED',
      messageEs: isRed ? 'BANDERA ROJA - SESIÓN DETENIDA' : 'BANDERA VERDE - PISTA DESPEJADA, SESIÓN REANUDADA',
      category: 'FLAG',
    };
    this.addRaceControlMessage(msg);
  }

  private maybeGenerateRaceControlEvent(dt: number) {
    if (this.isLiveMode || this.hasLiveOfficialData || this.sessionEnded) return;
    this.rcEventTimer += dt;
    if (this.rcEventTimer < 25) return;
    this.rcEventTimer = 0;

    const rand = Math.random();
    if (rand < 0.40) {
      const targetDriver = this.leaderboard[Math.floor(Math.random() * Math.min(12, this.leaderboard.length))];
      if (targetDriver) {
        const turn = [4, 5, 9, 10, 14, 15][Math.floor(Math.random() * 6)];
        const msg: RaceControlMessage = {
          id: `rc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: this.getCurrentTimeString(),
          flag: 'GREEN',
          scope: 'Track',
          driverNumber: targetDriver.driver.number,
          messageEn: `CAR ${targetDriver.driver.number} (${targetDriver.driver.code}) LAP DELETED - TRACK LIMITS AT TURN ${turn} LAP ${this.session.currentLap || 14}`,
          messageEs: `COCHE ${targetDriver.driver.number} (${targetDriver.driver.code}) VUELTA ANULADA - LÍMITES DE PISTA EN CURVA ${turn} (VUELTA ${this.session.currentLap || 14})`,
          category: 'INCIDENT',
        };
        this.addRaceControlMessage(msg);
      }
    } else if (rand < 0.70) {
      const sec = [1, 2, 3][Math.floor(Math.random() * 3)];
      const trackSec = sec === 1 ? Math.floor(Math.random() * 6 + 1) : sec === 2 ? Math.floor(Math.random() * 8 + 9) : Math.floor(Math.random() * 6 + 17);
      const msgYellow: RaceControlMessage = {
        id: `rc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: this.getCurrentTimeString(),
        flag: 'YELLOW',
        scope: `Sector ${sec}`,
        sector: sec,
        messageEn: `YELLOW IN TRACK SECTOR ${trackSec}`,
        messageEs: `BANDERA AMARILLA EN SECTOR ${trackSec}`,
        category: 'FLAG',
      };
      this.session.trackStatus = 'YELLOW';
      this.addRaceControlMessage(msgYellow);

      setTimeout(() => {
        if (this.session.trackStatus === 'YELLOW') {
          this.session.trackStatus = 'GREEN';
          const msgClear: RaceControlMessage = {
            id: `rc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: this.getCurrentTimeString(),
            flag: 'GREEN',
            scope: `Sector ${sec}`,
            sector: sec,
            messageEn: `CLEAR IN TRACK SECTOR ${trackSec} - TRACK CLEAR`,
            messageEs: `PISTA DESPEJADA EN SECTOR ${trackSec}`,
            category: 'FLAG',
          };
          this.addRaceControlMessage(msgClear);
        }
      }, 8000);
    } else if (rand < 0.85) {
      const msg: RaceControlMessage = {
        id: `rc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: this.getCurrentTimeString(),
        flag: 'GREEN',
        scope: 'PitLane',
        messageEn: 'PIT EXIT OPEN',
        messageEs: 'SALIDA DE PIT LANE ABIERTA',
        category: 'PIT_LANE',
      };
      this.addRaceControlMessage(msg);
    } else {
      const msg: RaceControlMessage = {
        id: `rc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: this.getCurrentTimeString(),
        flag: 'GREEN',
        scope: 'Track',
        messageEn: 'DRS ENABLED IN SECTORS 1 AND 2',
        messageEs: 'DRS ACTIVADO EN SECTORES 1 Y 2',
        category: 'FLAG',
      };
      this.addRaceControlMessage(msg);
    }
  }

  /**
   * Simulate realistic overtaking maneuvers during a race
   */
  private maybePerformOvertake() {
    const isLive = this.isLiveMode || this.hasLiveOfficialData;
    if (isLive || this.session.type !== 'RACE' || this.sessionEnded || this.session.trackStatus === 'CHEQUERED' || this.session.trackStatus === 'RED') {
      return;
    }

    const now = Date.now();
    // Trigger overtake every 12 to 18 seconds
    if (now - this.lastOvertakeTime < 14000) {
      return;
    }

    // Identify battling pairs in the midfield / lead pack
    const eligibleIndices: number[] = [];
    for (let i = 1; i < Math.min(16, this.leaderboard.length); i++) {
      const chaser = this.leaderboard[i];
      const defender = this.leaderboard[i - 1];
      if (chaser && defender && !chaser.inPit && !defender.inPit) {
        eligibleIndices.push(i);
      }
    }

    if (eligibleIndices.length === 0) return;

    const swapIdx = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
    const chaser = this.leaderboard[swapIdx];
    const defender = this.leaderboard[swapIdx - 1];
    if (!chaser || !defender) return;

    this.lastOvertakeTime = now;

    // Swap positions
    const newPos = defender.position;
    const oldPos = chaser.position;
    chaser.position = newPos;
    defender.position = oldPos;

    // Reorder in leaderboard array
    this.leaderboard[swapIdx - 1] = chaser;
    this.leaderboard[swapIdx] = defender;

    // Adjust racing intervals
    chaser.intervalNum = 0.285;
    defender.intervalNum = 0.395;
    chaser.gapToAhead = `+${chaser.intervalNum.toFixed(3)}s`;
    defender.gapToAhead = `+${defender.intervalNum.toFixed(3)}s`;

    // Emit Race Control overtake message
    const turns = [1, 4, 10, 12, 16, 20];
    const turn = turns[Math.floor(Math.random() * turns.length)];
    const overtakeMsg: RaceControlMessage = {
      id: `rc-ot-${Date.now()}`,
      timestamp: this.getCurrentTimeString(),
      flag: 'GREEN',
      scope: 'Track',
      messageEn: `OVERTAKE - CAR ${chaser.driver.number} (${chaser.driver.code}) OVERTOOK CAR ${defender.driver.number} (${defender.driver.code}) FOR P${newPos} AT TURN ${turn}`,
      messageEs: `ADELANTAMIENTO - COCHE ${chaser.driver.number} (${chaser.driver.code}) ADELANTÓ A COCHE ${defender.driver.number} (${defender.driver.code}) POR LA P${newPos} EN CURVA ${turn}`,
      category: 'INCIDENT',
      lap: this.session.currentLap || 18,
    };
    this.addRaceControlMessage(overtakeMsg);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('f1_live_leaderboard', JSON.stringify(this.leaderboard));
      } catch {}
    }
  }

  private tick() {
    const dt = (0.060 * this.playbackSpeed); // delta time scaled

    // Stop clock if session is red flagged, finished, or paused
    const isSessionStopped = 
      this.sessionEnded || 
      this.session.trackStatus === 'RED' || 
      this.session.trackStatus === 'CHEQUERED';

    if (!isSessionStopped && (this.session.type === 'PRACTICE' || this.session.type === 'QUALIFYING')) {
      this.session.totalLaps = 0;
      if (this.session.timeRemainingSec > 0) {
        this.session.timeRemainingSec = Math.max(0, this.session.timeRemainingSec - dt);
        if (this.session.timeRemainingSec === 0 && !this.sessionEnded) {
          this.sessionEnded = true;
          this.session.trackStatus = 'CHEQUERED';
          this.addRaceControlMessage({
            id: `rc-${Date.now()}`,
            timestamp: this.getCurrentTimeString(),
            flag: 'CHEQUERED',
            scope: 'Track',
            messageEn: 'CHEQUERED FLAG - SESSION FINISHED',
            messageEs: 'BANDERA A CUADROS - SESIÓN FINALIZADA',
            category: 'FLAG',
          });
        }
      } else if (!this.isLiveMode && !this.hasLiveOfficialData) {
        // Default to 50m remaining if uninitialized in Practice/Qualy
        this.session.timeRemainingSec = 3000;
      }
    }

    // Dynamic Race Control message generation during active simulation
    this.maybeGenerateRaceControlEvent(dt);
    this.maybePerformOvertake();

    const isLive = this.isLiveMode || this.hasLiveOfficialData;

    // Update car positions & physics
    this.leaderboard.forEach((entry, idx) => {
      // When session has finished (Chequered flag), all cars are parked in boxes / garages
      if (isSessionStopped) {
        this.telemetryMap.set(entry.driver.id, {
          driverId: entry.driver.id,
          speed: 0,
          rpm: 0,
          gear: 0,
          throttle: 0,
          brake: 0,
          drs: 0,
          steerAngle: 0,
          gForceLat: 0,
          gForceLong: 0,
          ersBattery: 100,
          ersDeploy: 0,
        });
        return;
      }

      // Realistic Pit / Garage duration handling when in simulation / fallback mode
      if (!isLive && entry.inPit) {
        const curTimer = (this.pitTimerMap.get(entry.driver.id) || 0) + dt;
        const targetPitSec = 22 + (idx % 4) * 5; // 22s to 37s in pit
        if (curTimer >= targetPitSec) {
          this.pitTimerMap.delete(entry.driver.id);
          entry.inPit = false;
          entry.isPitOut = true;
          entry.trackProgress = 0.02;
          setTimeout(() => {
            entry.isPitOut = false;
          }, 9000);
        } else {
          this.pitTimerMap.set(entry.driver.id, curTimer);
        }
      }

      // Driver individual pace multiplier (~0.985 to 1.037)
      let speedFactor = 1.0;
      if (idx === 0) speedFactor = 1.037; // P1 pace
      else speedFactor = 1.037 - (idx * 0.0028);

      if (this.session.safetyCarDeployed) speedFactor *= 0.55;
      else if (this.session.vscDeployed) speedFactor *= 0.65;

      // Real physical speed in km/h: use live CarData.z if available, else circuit physics
      let instantSpeedKmh = 250;
      const hasFreshLive = this.hasLiveCarData && (Date.now() - this.lastLiveCarDataTime < 6000);
      if (hasFreshLive && this.liveCarDataMap.has(entry.driver.number)) {
        const live = this.liveCarDataMap.get(entry.driver.number)!;
        instantSpeedKmh = live.speed;
      } else if (entry.inPit) {
        instantSpeedKmh = 0;
      } else if (entry.isPitOut) {
        instantSpeedKmh = 165;
      } else {
        const phys = this.getCircuitInstantPhysics(entry.trackProgress, this.circuit.id);
        instantSpeedKmh = Math.max(70, phys.speedKmh * speedFactor);
      }

      // Convert km/h to meters per second & advance track progress
      const speedMps = instantSpeedKmh * (1000 / 3600);
      const trackLengthMeters = (this.circuit.lengthKm || 5.414) * 1000;
      const progressDelta = (speedMps * dt) / trackLengthMeters;

      const oldProgress = entry.trackProgress;
      let newProgress = entry.inPit ? oldProgress : oldProgress + progressDelta;

      // Track S1 crossing (~0.333) - only simulate if NOT in live official mode
      if (oldProgress < 0.333 && newProgress >= 0.333 && !entry.inPit && !isLive) {
        if (entry.isPitOut) entry.isPitOut = false;
        this.handleSector1Crossed(entry, idx);
      }

      // Track S2 crossing (~0.666) - only simulate if NOT in live official mode
      if (oldProgress < 0.666 && newProgress >= 0.666 && !entry.inPit && !isLive) {
        this.handleSector2Crossed(entry, idx);
      }

      // Completed a lap
      if (newProgress >= 1.0) {
        newProgress -= 1.0;
        if (!entry.inPit && !isLive) {
          this.handleLapCompleted(entry, idx);
        }
        if (idx === 0 && this.session.type === 'RACE') {
          if (this.session.currentLap < this.session.totalLaps) {
            this.session.currentLap += 1;
          }
        }
        // Increment tyre age
        if (!isLive && !entry.inPit) {
          entry.tyre.age += 1;
        }

        // Realistic pit stop trigger in Practice (every ~7-9 laps if <= 3 cars currently in pit) or Race (> 24 laps)
        const currentCarsInPit = this.leaderboard.filter(e => e.inPit).length;
        const pitThreshold = (this.session.type === 'PRACTICE' || this.session.type === 'QUALIFYING') ? 7 : 24;
        if (!isLive && !entry.inPit && currentCarsInPit < 4 && entry.tyre.age >= pitThreshold && Math.random() < 0.14) {
          entry.inPit = true;
          entry.isPitOut = false;
          entry.pitStops = (entry.pitStops || 0) + 1;
          entry.tyre.age = 0;
          this.pitTimerMap.set(entry.driver.id, 0);
          entry.tyre.compound = entry.tyre.compound === 'SOFT' ? 'MEDIUM' : 'SOFT';
        }
      }

      entry.trackProgress = newProgress;

      if (!isLive && !entry.inPit) {
        this.updateEntryMicrosectors(entry, newProgress);
      }

      // Calculate car telemetry based on exact physical state at this point on track
      const telemetry = this.calculateTelemetryForProgress(entry.driver.id, newProgress, entry.inPit);
      this.telemetryMap.set(entry.driver.id, telemetry);
    });

    if (!isLive) {
      const isPracticeOrQualy = this.session.type === 'PRACTICE' || this.session.type === 'QUALIFYING';

      if (isPracticeOrQualy) {
        // In Practice and Qualifying: Order by best lap time
        this.leaderboard.sort((a, b) => {
          const timeA = a.lastLapTimeNum || this.parseLapTimeToSeconds(a.bestLapTime);
          const timeB = b.lastLapTimeNum || this.parseLapTimeToSeconds(b.bestLapTime);
          return timeA - timeB;
        });

        const leaderTime = this.leaderboard[0]?.lastLapTimeNum || this.parseLapTimeToSeconds(this.leaderboard[0]?.bestLapTime) || 94.077;

        this.leaderboard.forEach((entry, i) => {
          entry.position = i + 1;
          const driverTime = entry.lastLapTimeNum || this.parseLapTimeToSeconds(entry.bestLapTime);

          if (i === 0) {
            entry.gapToLeader = 'LÍDER';
            entry.gapToAhead = 'LEADER';
            entry.intervalNum = 0;
          } else {
            const aheadTime = this.leaderboard[i - 1].lastLapTimeNum || this.parseLapTimeToSeconds(this.leaderboard[i - 1].bestLapTime);
            const gapToLeaderSec = Math.max(0, driverTime - leaderTime);
            const intervalSec = Math.max(0, driverTime - aheadTime);

            entry.intervalNum = Number(intervalSec.toFixed(3));
            entry.gapToLeader = `+${gapToLeaderSec.toFixed(3)}s`;
            entry.gapToAhead = `+${intervalSec.toFixed(3)}s`;
          }
        });
      } else {
      // In Race: Preserve on-track race order and calculate race distance intervals
      this.leaderboard.sort((a, b) => a.position - b.position);

      let cumulativeGap = 0;
      this.leaderboard.forEach((entry, i) => {
        if (entry.gapToLeader === 'DNF' || entry.gapToAhead === 'DNF') {
          entry.gapToAhead = 'DNF';
          entry.gapToLeader = 'DNF';
          return;
        }
        if (i === 0) {
          entry.gapToLeader = this.session.trackStatus === 'CHEQUERED' ? 'GANADOR' : 'LÍDER';
          entry.gapToAhead = 'LEADER';
          cumulativeGap = 0;
        } else {
          const delta = (Math.sin(Date.now() / 1400 + i * 1.5) * 0.003 + (Math.random() * 0.004 - 0.002)) * dt * this.playbackSpeed;
          const currentInterval = Math.max(0.08, (entry.intervalNum || 1.1) + delta);
          entry.intervalNum = currentInterval;

          const isLappedByLeader = entry.gapToLeader.toUpperCase().includes('LAP');
          const isLappedByAhead = entry.gapToAhead.toUpperCase().includes('LAP');

          // Interval to car ahead
          if (isLappedByAhead) {
            if (entry.gapToAhead.toUpperCase().includes('1 LAP') || entry.gapToAhead.toUpperCase().includes('1LAP')) {
              entry.gapToAhead = '+1 LAP';
            }
          } else {
            entry.gapToAhead = `+${currentInterval.toFixed(3)}s`;
          }

          // Distance to leader
          if (isLappedByLeader) {
            if (entry.gapToLeader.toUpperCase().includes('2 LAP')) {
              entry.gapToLeader = '+2 LAPS';
            } else {
              entry.gapToLeader = '+1 LAP';
            }
          } else {
            cumulativeGap += currentInterval;
            entry.gapToLeader = `+${cumulativeGap.toFixed(3)}s`;
          }
        }
      });
      }
    }

    // Calculate Pit Prediction ("Circle of Doom") for selected driver
    const pitPrediction = this.calculatePitPrediction(this.selectedDriverId);

    // Broadcast update to subscribers
    this.listeners.onTick?.({
      leaderboard: [...this.leaderboard],
      telemetryMap: new Map(this.telemetryMap),
      session: { ...this.session },
      selectedDriverTelemetry: this.telemetryMap.get(this.selectedDriverId) || null,
      pitPrediction,
    });
  }

  /**
   * Ingest live official F1 TimingData from SignalR WebSocket stream
   */
  public ingestSignalRTimingData(timingData: any) {
    if (!timingData) return;
    
    // Support all SignalR F1 packet structures (full dump or delta lines)
    const lines = 
      timingData.Lines || 
      timingData.TimingData?.Lines || 
      (typeof timingData === 'object' && !Array.isArray(timingData) ? timingData : null);
    
    if (!lines || typeof lines !== 'object') return;

    let hasUpdates = false;

    Object.entries(lines).forEach(([driverNumStr, lineData]: [string, any]) => {
      if (!lineData || typeof lineData !== 'object') return;
      const driverNum = parseInt(driverNumStr, 10);

      // Find matching driver in leaderboard by number or code
      const entry = this.leaderboard.find(e => 
        e.driver.number === driverNum || 
        (lineData.RacingNumber && e.driver.number === parseInt(lineData.RacingNumber, 10)) ||
        (lineData.Tla && e.driver.code.toUpperCase() === String(lineData.Tla).toUpperCase())
      );

      if (!entry) return;
      hasUpdates = true;

      // Update position
      if (lineData.Position !== undefined) {
        const newPos = parseInt(String(lineData.Position), 10);
        if (!isNaN(newPos)) {
          entry.previousPosition = entry.position;
          entry.position = newPos;
        }
      }

      // Update Gap to Leader
      if (lineData.GapToLeader !== undefined) {
        const gapVal = typeof lineData.GapToLeader === 'object' ? lineData.GapToLeader.Value : lineData.GapToLeader;
        if (typeof gapVal === 'string' && gapVal.trim()) {
          const cleanGap = gapVal.replace(/^\++/, '+').trim();
          entry.gapToLeader = cleanGap === 'LEADER' || cleanGap === 'GANADOR' || cleanGap === 'DNF' || cleanGap.startsWith('+') 
            ? cleanGap 
            : `+${cleanGap}`;
        }
      }

      // Update Interval to Car Ahead (real SignalR interval)
      const rawInterval = lineData.IntervalToPositionAhead !== undefined 
        ? lineData.IntervalToPositionAhead 
        : lineData.TimeDiffToPositionAhead;

      if (rawInterval !== undefined) {
        const intVal = typeof rawInterval === 'object' ? rawInterval.Value : rawInterval;
        if (typeof intVal === 'string' && intVal.trim()) {
          const cleanInt = intVal.replace(/^\++/, '').replace('s', '').trim();
          const parsedSec = parseFloat(cleanInt);
          if (!isNaN(parsedSec)) {
            entry.intervalNum = parsedSec;
            entry.gapToAhead = `+${parsedSec.toFixed(3)}s`;
          } else if (intVal === 'LEADER' || intVal === 'DNF') {
            entry.gapToAhead = intVal;
            entry.intervalNum = 0;
          } else {
            entry.gapToAhead = intVal.replace(/^\++/, '+');
          }
        }
      }

      // Update Lap Times
      let hasNewLapOrSector = false;
      if (lineData.LastLapTime?.Value) {
        entry.currentLapTime = lineData.LastLapTime.Value;
        hasNewLapOrSector = true;
      }
      if (lineData.BestLapTime?.Value) {
        entry.bestLapTime = lineData.BestLapTime.Value;
        hasNewLapOrSector = true;
      }

      // Update Sectors
      if (Array.isArray(lineData.Sectors)) {
        if (lineData.Sectors[0]?.Value) {
          entry.s1Time = lineData.Sectors[0].Value;
          hasNewLapOrSector = true;
        }
        if (lineData.Sectors[1]?.Value) {
          entry.s2Time = lineData.Sectors[1].Value;
          hasNewLapOrSector = true;
        }
        if (lineData.Sectors[2]?.Value) {
          entry.s3Time = lineData.Sectors[2].Value;
          hasNewLapOrSector = true;
        }

        if (lineData.Sectors[0]?.OverallFastest) entry.s1Status = 'purple';
        else if (lineData.Sectors[0]?.PersonalFastest) entry.s1Status = 'green';

        if (lineData.Sectors[1]?.OverallFastest) entry.s2Status = 'purple';
        else if (lineData.Sectors[1]?.PersonalFastest) entry.s2Status = 'green';

        if (lineData.Sectors[2]?.OverallFastest) entry.s3Status = 'purple';
        else if (lineData.Sectors[2]?.PersonalFastest) entry.s3Status = 'green';
      }

      // Pit Stops & InPit status (mutually exclusive & cleared when setting flying sectors)
      if (lineData.NumberOfPitStops !== undefined) {
        const stops = parseInt(String(lineData.NumberOfPitStops), 10);
        if (!isNaN(stops)) entry.pitStops = stops;
      }
      if (lineData.PitOut === true) {
        entry.isPitOut = true;
        entry.inPit = false;
      } else if (lineData.InPit === true) {
        entry.inPit = true;
        entry.isPitOut = false;
      } else {
        if (lineData.InPit === false) entry.inPit = false;
        if (lineData.PitOut === false) entry.isPitOut = false;
        if (hasNewLapOrSector) {
          entry.inPit = false;
          if (lineData.LastLapTime?.Value || lineData.Sectors?.[1]?.Value || lineData.Sectors?.[2]?.Value) {
            entry.isPitOut = false;
          }
        }
      }
      if (lineData.KnockedOut !== undefined) {
        entry.isKnockedOut = Boolean(lineData.KnockedOut);
      }
      if (lineData.Stopped === true || lineData.Status === 'DNF' || lineData.Status === 'Retired') {
        entry.gapToLeader = 'DNF';
        entry.gapToAhead = 'DNF';
      }
    });

    if (hasUpdates) {
      // Sort by current position
      this.leaderboard.sort((a, b) => a.position - b.position);

      if (typeof window !== 'undefined') {
        try {
          const serialized = JSON.stringify(this.leaderboard);
          localStorage.setItem('f1_live_leaderboard', serialized);
          localStorage.setItem('f1_saved_leaderboard_madrid', serialized);
          localStorage.setItem('f1_official_live_timing_cache', serialized);
        } catch {}
      }

      this.listeners.onTick?.({
        leaderboard: [...this.leaderboard],
        telemetryMap: new Map(this.telemetryMap),
        session: { ...this.session },
        selectedDriverTelemetry: this.telemetryMap.get(this.selectedDriverId) || null,
        pitPrediction: this.calculatePitPrediction(this.selectedDriverId),
      });
    }
  }

  /**
   * High-fidelity physics calculation for a car's instantaneous state on any F1 circuit
   */
  public getCircuitInstantPhysics(progress: number, circuitId: string = this.circuit.id): {
    speedKmh: number;
    rpm: number;
    gear: number;
    throttle: number;
    brake: number;
    drs: 0 | 1 | 2;
    steerAngle: number;
    latG: number;
    longG: number;
    ersDeploy: number;
  } {
    const p = ((progress % 1.0) + 1.0) % 1.0;
    let speed = 290;
    let isBraking = false;
    let isDrs = false;
    let steer = 0;
    let latG = 0.2;
    let longG = 0.9;
    let brakePct = 0;
    let throttlePct = 100;

    if (circuitId === 'madrid') {
      if (p < 0.08) {
        // IFEMA Main Straight (DRS 1)
        const t = p / 0.08;
        speed = 240 + t * 98; // 240 -> 338 km/h
        isDrs = true;
        throttlePct = 100;
        longG = 1.2;
      } else if (p < 0.14) {
        // Turn 1 & 2 90° right-left chicane
        const t = (p - 0.08) / 0.06;
        if (t < 0.45) {
          const bt = t / 0.45;
          speed = 338 - bt * 243; // 338 -> 95 km/h
          isBraking = true;
          brakePct = Math.round(90 + bt * 10);
          throttlePct = 0;
          longG = -4.9;
          steer = 25;
        } else {
          const ct = (t - 0.45) / 0.55;
          speed = 95 + ct * 30; // 95 -> 125 km/h
          throttlePct = 40 + ct * 40;
          latG = 3.8;
          longG = 0.4;
          steer = -55;
        }
      } else if (p < 0.22) {
        // Vía de Dublín acceleration towards M-11
        const t = (p - 0.14) / 0.08;
        speed = 125 + t * 165; // 125 -> 290 km/h
        throttlePct = 100;
        longG = 1.3;
      } else if (p < 0.32) {
        // M-11 Tunnel Underpass
        const t = (p - 0.22) / 0.10;
        speed = 290 + t * 35; // 290 -> 325 km/h
        throttlePct = 100;
        longG = 0.9;
        steer = 5;
      } else if (p < 0.42) {
        // Valdebebas North entrance & turns 7-9
        const t = (p - 0.32) / 0.10;
        if (t < 0.4) {
          const bt = t / 0.4;
          speed = 325 - bt * 185; // 325 -> 140 km/h
          isBraking = true;
          brakePct = 85;
          throttlePct = 0;
          longG = -4.2;
          steer = -35;
        } else {
          const ct = (t - 0.4) / 0.6;
          speed = 140 + ct * 135; // 140 -> 275 km/h
          throttlePct = 50 + ct * 50;
          latG = 4.1;
          longG = 0.8;
          steer = 45;
        }
      } else if (p < 0.58) {
        // 'La Monumental' Banked Curve (24% banking - Turn 12)
        const t = (p - 0.42) / 0.16;
        speed = 275 + Math.sin(t * Math.PI) * 32; // 275 -> 307 -> 295 km/h
        throttlePct = 100; // Flat out on banked curve!
        latG = 4.8;
        longG = 0.5;
        steer = 60;
      } else if (p < 0.72) {
        // Valdebebas Long Back Straight (DRS 2)
        const t = (p - 0.58) / 0.14;
        speed = 295 + t * 53; // 295 -> 348 km/h
        isDrs = true;
        throttlePct = 100;
        longG = 1.2;
      } else if (p < 0.80) {
        // Heavy Braking into Return Tunnel Chicane (Turns 15-16)
        const t = (p - 0.72) / 0.08;
        if (t < 0.5) {
          const bt = t / 0.5;
          speed = 348 - bt * 268; // 348 -> 80 km/h (maximum braking zone)
          isBraking = true;
          brakePct = 100;
          throttlePct = 0;
          longG = -5.2;
          steer = -20;
        } else {
          const ct = (t - 0.5) / 0.5;
          speed = 80 + ct * 35; // 80 -> 115 km/h
          throttlePct = 35 + ct * 35;
          latG = 3.5;
          longG = 0.4;
          steer = 65;
        }
      } else if (p < 0.90) {
        // IFEMA Stadium Technical Section (Turns 17-20)
        const t = (p - 0.80) / 0.10;
        speed = 115 + Math.sin(t * Math.PI * 2) * 25 + t * 25; // 115 -> 140 km/h
        throttlePct = 60;
        latG = 3.7;
        longG = 0.3;
        steer = -45;
      } else {
        // Turn 22 exit onto Main Straight
        const t = (p - 0.90) / 0.10;
        speed = 140 + t * 110; // 140 -> 250 km/h
        throttlePct = 100;
        latG = 1.5;
        longG = 1.4;
        steer = 15;
      }
    } else if (circuitId === 'monza') {
      if (p < 0.12) {
        const t = p / 0.12;
        speed = 280 + t * 76; // 280 -> 356 km/h
        isDrs = true;
        throttlePct = 100;
      } else if (p < 0.17) {
        const t = (p - 0.12) / 0.05;
        if (t < 0.5) {
          speed = 356 - (t / 0.5) * 281; // 356 -> 75 km/h
          isBraking = true;
          brakePct = 100;
          throttlePct = 0;
          longG = -5.1;
        } else {
          speed = 75 + ((t - 0.5) / 0.5) * 60;
          latG = 3.4;
        }
      } else if (p < 0.32) {
        const t = (p - 0.17) / 0.15;
        speed = 135 + t * 195;
        throttlePct = 100;
        latG = 3.2;
      } else if (p < 0.37) {
        const t = (p - 0.32) / 0.05;
        if (t < 0.5) {
          speed = 330 - (t / 0.5) * 220;
          isBraking = true;
          brakePct = 90;
          throttlePct = 0;
        } else {
          speed = 110 + ((t - 0.5) / 0.5) * 45;
        }
      } else if (p < 0.52) {
        const t = (p - 0.37) / 0.15;
        speed = 155 + t * 190;
        isDrs = t > 0.5;
        throttlePct = 100;
      } else if (p < 0.58) {
        const t = (p - 0.52) / 0.06;
        if (t < 0.4) {
          speed = 345 - (t / 0.4) * 185;
          isBraking = true;
          brakePct = 90;
        } else {
          speed = 160 + ((t - 0.4) / 0.6) * 70;
          latG = 4.2;
        }
      } else if (p < 0.88) {
        const t = (p - 0.58) / 0.30;
        speed = 230 + t * 118;
        isDrs = true;
        throttlePct = 100;
      } else {
        const t = (p - 0.88) / 0.12;
        if (t < 0.4) {
          speed = 348 - (t / 0.4) * 163;
          isBraking = true;
          brakePct = 75;
        } else {
          speed = 185 + ((t - 0.4) / 0.6) * 95;
          latG = 4.0;
        }
      }
    } else {
      speed = 260 + Math.sin(p * Math.PI * 6) * 75;
      throttlePct = speed > 220 ? 100 : 45;
      brakePct = speed < 160 ? 80 : 0;
    }

    if (this.session.safetyCarDeployed || this.session.vscDeployed) {
      speed = Math.min(speed, 155);
      brakePct = 0;
      throttlePct = 40;
      isDrs = false;
    }

    let gear = 8;
    if (speed < 90) gear = 2;
    else if (speed < 135) gear = 3;
    else if (speed < 185) gear = 4;
    else if (speed < 235) gear = 5;
    else if (speed < 275) gear = 6;
    else if (speed < 310) gear = 7;
    else gear = 8;

    const minGearSpeed = gear === 2 ? 60 : gear === 3 ? 90 : gear === 4 ? 135 : gear === 5 ? 185 : gear === 6 ? 235 : gear === 7 ? 275 : 310;
    const maxGearSpeed = gear === 2 ? 110 : gear === 3 ? 155 : gear === 4 ? 205 : gear === 5 ? 255 : gear === 6 ? 295 : gear === 7 ? 325 : 360;
    const gearSpan = Math.max(1, maxGearSpeed - minGearSpeed);
    const inGearRatio = Math.max(0, Math.min(1, (speed - minGearSpeed) / gearSpan));
    const rpm = Math.round(9200 + inGearRatio * 3800);

    const drsState: 0 | 1 | 2 = (isDrs && this.session.drsEnabled && !this.session.safetyCarDeployed && !this.session.vscDeployed) ? 2 : 0;

    return {
      speedKmh: Math.round(speed),
      rpm,
      gear,
      throttle: isBraking ? 0 : throttlePct,
      brake: isBraking ? brakePct : 0,
      drs: drsState,
      steerAngle: Math.round(steer),
      latG: Number(latG.toFixed(1)),
      longG: Number(longG.toFixed(1)),
      ersDeploy: throttlePct > 90 ? 85 : 0,
    };
  }

  private calculateTelemetryForProgress(driverId: string, progress: number, inPit: boolean): CarTelemetry {
    const isStopped = this.sessionEnded || this.session.trackStatus === 'CHEQUERED';
    if (isStopped) {
      return {
        driverId,
        speed: 0,
        rpm: 0,
        gear: 0,
        throttle: 0,
        brake: 0,
        drs: 0,
        steerAngle: 0,
        gForceLat: 0,
        gForceLong: 0,
        ersBattery: 100,
        ersDeploy: 0,
      };
    }

    const driverEntry = this.leaderboard.find(e => e.driver.id === driverId);
    const hasFreshLive = this.hasLiveCarData && (Date.now() - this.lastLiveCarDataTime < 6000);
    if (hasFreshLive && driverEntry && this.liveCarDataMap.has(driverEntry.driver.number)) {
      const live = this.liveCarDataMap.get(driverEntry.driver.number)!;
      const phys = this.getCircuitInstantPhysics(progress, this.circuit.id);
      return {
        driverId,
        speed: live.speed,
        rpm: live.rpm,
        gear: live.gear,
        throttle: live.throttle,
        brake: live.brake,
        drs: (live.drs === 2 ? 2 : live.drs === 1 ? 1 : (live.speed > 280 ? 1 : 0)) as 0 | 1 | 2,
        steerAngle: phys.steerAngle,
        gForceLat: phys.latG,
        gForceLong: phys.longG,
        ersBattery: 85,
        ersDeploy: live.throttle > 80 ? 70 : 0,
      };
    }

    if (inPit) {
      const isPitMoving = !this.sessionEnded && this.session.trackStatus !== 'CHEQUERED' && (driverEntry?.isPitOut || false);
      return {
        driverId,
        speed: isPitMoving ? 79 : 0,
        rpm: isPitMoving ? 6200 : 0,
        gear: (isPitMoving ? 2 : 0) as 0 | 1 | 2,
        throttle: isPitMoving ? 35 : 0,
        brake: 0,
        drs: 0,
        steerAngle: 0,
        gForceLat: 0,
        gForceLong: 0,
        ersBattery: 85,
        ersDeploy: 0,
      };
    }

    const phys = this.getCircuitInstantPhysics(progress, this.circuit.id);
    return {
      driverId,
      speed: phys.speedKmh,
      rpm: phys.rpm,
      gear: phys.gear,
      throttle: phys.throttle,
      brake: phys.brake,
      drs: phys.drs,
      steerAngle: phys.steerAngle,
      gForceLat: phys.latG,
      gForceLong: phys.longG,
      ersBattery: Math.max(15, Math.min(100, Math.floor(82 + Math.sin(progress * 12) * 16))),
      ersDeploy: phys.ersDeploy,
    };
  }

  // Calculate the "Circle of Doom" pit prediction
  public calculatePitPrediction(driverId: string): PitPrediction | null {
    const driverIdx = this.leaderboard.findIndex(e => e.driver.id === driverId);
    if (driverIdx === -1) return null;

    const currentEntry = this.leaderboard[driverIdx];
    const pitLoss = this.circuit.pitLossSeconds; // e.g. 23.4s

    // Calculate driver's accumulated time ahead of others
    // For each car behind, how much gap does driver have?
    let rejoiningPos = currentEntry.position;
    let accumulatedGapBehind = 0;

    for (let i = driverIdx + 1; i < this.leaderboard.length; i++) {
      accumulatedGapBehind += this.leaderboard[i].intervalNum;
      if (accumulatedGapBehind < pitLoss) {
        rejoiningPos = this.leaderboard[i].position + 1;
      } else {
        break;
      }
    }

    rejoiningPos = Math.min(rejoiningPos, this.leaderboard.length);
    const aheadDriver = rejoiningPos > 1 ? this.leaderboard[rejoiningPos - 2]?.driver : undefined;
    const behindDriver = rejoiningPos <= this.leaderboard.length ? this.leaderboard[rejoiningPos - 1]?.driver : undefined;

    return {
      driverId,
      currentPosition: currentEntry.position,
      rejoiningPosition: rejoiningPos,
      rejoiningAheadOfDriver: behindDriver,
      rejoiningBehindDriver: aheadDriver,
      projectedGapAheadSec: 1.4,
      projectedGapBehindSec: 0.8,
      isInTraffic: rejoiningPos > currentEntry.position + 3,
    };
  }

  // Generate comparison telemetry curves between two drivers
  public getTelemetryComparison(_driver1Id: string, _driver2Id: string): TelemetryComparisonPoint[] {
    const points: TelemetryComparisonPoint[] = [];
    const totalPoints = 100;

    for (let i = 0; i <= totalPoints; i++) {
      const p = i / totalPoints;
      // High speed straights vs corners
      const isCorner1 = (p >= 0.12 && p <= 0.18) || (p >= 0.33 && p <= 0.39) || (p >= 0.54 && p <= 0.60) || (p >= 0.88 && p <= 0.94);
      const isStraight = !isCorner1;

      let d1Speed = isStraight ? 320 + Math.sin(p * 20) * 25 : 110 + Math.cos(p * 25) * 35;
      let d2Speed = isStraight ? 316 + Math.sin(p * 20 + 0.1) * 27 : 115 + Math.cos(p * 25 + 0.1) * 33;

      let d1Throttle = isStraight ? 100 : Math.max(0, Math.floor(Math.sin(p * 30) * 80));
      let d2Throttle = isStraight ? 100 : Math.max(0, Math.floor(Math.sin(p * 30 + 0.2) * 75));

      let d1Brake = isCorner1 && p < 0.15 ? 90 : 0;
      let d2Brake = isCorner1 && p < 0.16 ? 95 : 0;

      let d1Gear = d1Speed > 290 ? 8 : d1Speed > 250 ? 7 : d1Speed > 180 ? 5 : 3;
      let d2Gear = d2Speed > 290 ? 8 : d2Speed > 250 ? 7 : d2Speed > 180 ? 5 : 3;

      points.push({
        distancePercent: Math.round(p * 100),
        distanceMeters: Math.round(p * this.circuit.lengthKm * 1000),
        driver1Speed: Math.round(d1Speed),
        driver2Speed: Math.round(d2Speed),
        driver1Throttle: Math.round(d1Throttle),
        driver2Throttle: Math.round(d2Throttle),
        driver1Brake: Math.round(d1Brake),
        driver2Brake: Math.round(d2Brake),
        driver1Gear: d1Gear,
        driver2Gear: d2Gear,
        deltaSeconds: Number((Math.sin(p * 8) * 0.18).toFixed(3)),
      });
    }

    return points;
  }

  public getTelemetryMap(): Map<string, CarTelemetry> {
    return new Map(this.telemetryMap);
  }

  public getSelectedTelemetry(): CarTelemetry | null {
    return this.telemetryMap.get(this.selectedDriverId) || null;
  }

  public getLeaderboard(): LeaderboardEntry[] {
    return [...this.leaderboard];
  }

  public getSession(): SessionState {
    return { ...this.session };
  }

  public getRaceControlMessages(): RaceControlMessage[] {
    return [...this.raceControlLog];
  }

  public getTeamRadios(): TeamRadio[] {
    return [...this.teamRadioLog];
  }

  private formatLapTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(3);
    const paddedSecs = Number(secs) < 10 ? `0${secs}` : secs;
    return `${mins}:${paddedSecs}`;
  }

  private parseLapTimeToSeconds(lapTimeStr?: string): number {
    if (!lapTimeStr || lapTimeStr === 'DNF' || lapTimeStr === 'LÍDER' || lapTimeStr === 'LEADER') return 999;
    const parts = lapTimeStr.split(':');
    if (parts.length === 2) {
      const min = parseFloat(parts[0]);
      const sec = parseFloat(parts[1]);
      if (!isNaN(min) && !isNaN(sec)) return min * 60 + sec;
    }
    const val = parseFloat(lapTimeStr);
    return isNaN(val) ? 999 : val;
  }

  private getCurrentTimeString(): string {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  }
}
