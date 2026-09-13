export type SessionType = 'PRACTICE' | 'QUALIFYING' | 'RACE' | 'SPRINT';
export type TrackStatus = 'GREEN' | 'YELLOW' | 'SC' | 'VSC' | 'RED' | 'CHEQUERED';
export type SectorStatus = 'purple' | 'green' | 'yellow' | 'pit' | 'none';
export type TyreCompound = 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET';

export interface DriverInfo {
  id: string;
  code: string;
  number: number;
  firstName: string;
  lastName: string;
  team: string;
  teamColor: string;
  country: string;
  flag: string;
  carImage?: string;
  headshot?: string;
}

export interface TyreInfo {
  compound: TyreCompound;
  age: number; // in laps
  used: boolean;
}

export interface LeaderboardEntry {
  position: number;
  previousPosition: number;
  driver: DriverInfo;
  gapToLeader: string;
  gapToAhead: string;
  intervalNum: number; // in seconds
  currentLapTime: string;
  bestLapTime: string;
  lastLapTime?: string;
  s1Time: string;
  s2Time: string;
  s3Time: string;
  s1BestTime?: string;
  s2BestTime?: string;
  s3BestTime?: string;
  s1Status: SectorStatus;
  s2Status: SectorStatus;
  s3Status: SectorStatus;
  s1Segments?: SectorStatus[];
  s2Segments?: SectorStatus[];
  s3Segments?: SectorStatus[];
  tyre: TyreInfo;
  pitStops: number;
  inPit: boolean;
  isPitOut: boolean;
  isKnockedOut?: boolean;
  isEliminationRisk?: boolean; // For Quali Q1/Q2 cutoffs
  speedTrap: number; // km/h
  lastLapTimeNum: number; // in seconds
  trackProgress: number; // 0 to 1 along circuit
  lapsCompleted?: number; // total laps completed by driver
}

export interface CarTelemetry {
  driverId: string;
  speed: number;       // km/h (0 - 365)
  rpm: number;         // 0 - 15000
  gear: number;        // 0 = N, 1-8
  throttle: number;    // 0 - 100 (%)
  brake: number;       // 0 - 100 (%)
  drs: 0 | 1 | 2;      // 0: Off, 1: Available, 2: Active
  steerAngle: number;  // -180 to 180 deg
  gForceLat: number;   // lateral G
  gForceLong: number;  // longitudinal G (braking / acceleration)
  ersBattery: number;  // 0 - 100 (%)
  ersDeploy: number;   // kW or %
}

export interface CircuitInfo {
  id: string;
  name: string;
  country: string;
  city: string;
  lengthKm: number;
  laps: number;
  lapRecord: {
    time: string;
    driver: string;
    year: number;
  };
  svgPath: string;
  viewBox: string;
  sectors: {
    s1EndProgress: number; // e.g. 0.31
    s2EndProgress: number; // e.g. 0.68
  };
  drsZones: Array<{
    startProgress: number;
    endProgress: number;
  }>;
  pitLossSeconds: number; // typical pit stop time loss (~22-24s)
}

export interface SessionState {
  id: string;
  circuit: CircuitInfo;
  type: SessionType;
  name: string;
  trackStatus: TrackStatus;
  currentLap: number;
  totalLaps: number;
  timeRemainingSec: number;
  airTemp: number;     // °C
  trackTemp: number;   // °C
  humidity: number;    // %
  rainProbability: number; // %
  windSpeed: number;   // km/h
  windDirection: string;
  safetyCarDeployed: boolean;
  vscDeployed: boolean;
  redFlagDeployed: boolean;
  drsEnabled: boolean;
  finishedAtMs?: number;
}

export interface RaceControlMessage {
  id: string;
  timestamp: string;
  flag?: 'GREEN' | 'YELLOW' | 'DOUBLE_YELLOW' | 'RED' | 'BLACK_WHITE' | 'CHEQUERED';
  sector?: number;
  driverNumber?: number;
  scope: 'Track' | 'Sector 1' | 'Sector 2' | 'Sector 3' | 'Pit Lane' | 'Driver' | string;
  messageEn: string;
  messageEs: string;
  category: 'FLAG' | 'SAFETY_CAR' | 'INVESTIGATION' | 'PENALTY' | 'DRS' | 'TRACK_LIMITS' | 'SYSTEM' | 'INCIDENT' | 'PIT_LANE' | 'WEATHER';
  lap?: number;
}

export interface TeamRadio {
  id: string;
  timestamp: string;
  driver: DriverInfo;
  speaker: 'Driver' | 'Race Engineer';
  messageEn: string;
  messageEs: string;
  audioToneType: 'calm' | 'urgent' | 'celebration' | 'frustration';
  durationSec: number;
}

export interface PitPrediction {
  driverId: string;
  currentPosition: number;
  rejoiningPosition: number;
  rejoiningAheadOfDriver?: DriverInfo;
  rejoiningBehindDriver?: DriverInfo;
  projectedGapAheadSec: number;
  projectedGapBehindSec: number;
  isInTraffic: boolean;
}

export interface TelemetryComparisonPoint {
  distancePercent: number; // 0 to 100% of lap
  distanceMeters: number;
  driver1Speed: number;
  driver2Speed: number;
  driver1Throttle: number;
  driver2Throttle: number;
  driver1Brake: number;
  driver2Brake: number;
  driver1Gear: number;
  driver2Gear: number;
  deltaSeconds: number; // + = driver1 ahead, - = driver2 ahead
}
