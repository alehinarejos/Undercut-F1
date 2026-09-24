import { decode, encode } from 'cbor-x';
import { inflateRaw } from 'pako';
import type { LeaderboardEntry, SectorStatus, TyreCompound, RaceControlMessage } from '../types/telemetry';
import { DRIVERS } from '../data/drivers';
import { standingsSyncService } from './standingsSyncService';
import { scheduleSyncService } from './scheduleSyncService';

export interface LiveCarTelemetry {
  driverNumber: number;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs?: number;
}

export const STORAGE_LIVE_LEADERBOARD_KEY = 'f1_live_leaderboard';

export interface RawF1TimingLine {
  Position?: string;
  Line?: number;
  RacingNumber?: string;
  BestLapTime?: {
    Value?: string;
    Lap?: number;
  };
  LastLapTime?: {
    Value?: string;
    OverallFastest?: boolean;
    PersonalFastest?: boolean;
  };
  TimeDiffToFastest?: string;
  TimeDiffToPositionAhead?: string;
  GapToLeader?: string;
  IntervalToPositionAhead?: {
    Value?: string;
    Catching?: boolean;
  };
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
    Segments?: Array<{ Status?: number }> | Record<string, { Status?: number }>;
  }> | Record<string, {
    Value?: string;
    PreviousValue?: string;
    Status?: number;
    OverallFastest?: boolean;
    PersonalFastest?: boolean;
    Segments?: Array<{ Status?: number }> | Record<string, { Status?: number }>;
  }>;
  Speeds?: {
    ST?: { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean };
    I1?: { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean };
    I2?: { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean };
    FL?: { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean };
  };
}

export interface RawF1DriverItem {
  RacingNumber?: string;
  BroadcastName?: string;
  FullName?: string;
  Tla?: string;
  Line?: number;
  TeamName?: string;
  TeamColour?: string;
  FirstName?: string;
  LastName?: string;
  HeadshotUrl?: string;
}

export interface RawF1StintItem {
  Compound?: string;
  TotalLaps?: number;
  New?: string;
  LapTime?: string;
  LapNumber?: number;
}

export interface RawF1TimingAppDataLine {
  RacingNumber?: string;
  Line?: number;
  Stints?: RawF1StintItem[];
}

export interface F1LiveSessionStatus {
  sessionName?: string;
  sessionType?: string;
  sessionStatus?: 'Started' | 'Finished' | 'Inactive' | 'Aborted';
  remaining?: string;
  remainingSec?: number;
  isFinished: boolean;
  isChequered: boolean;
  isRedFlag?: boolean;
  isExtrapolating?: boolean;
  isStopped?: boolean;
  trackStatus?: string;
  safetyCar?: boolean;
  vsc?: boolean;
  finishedUtc?: string;
}

export class F1LiveWebSocketService {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private reconnectTimeout: number | null = null;
  private listeners = new Set<(entries: LeaderboardEntry[]) => void>();
  private sessionStatusListeners = new Set<(status: F1LiveSessionStatus) => void>();
  private carDataListeners = new Set<(carData: Map<number, LiveCarTelemetry>) => void>();
  private raceControlListeners = new Set<(msg: RaceControlMessage) => void>();

  // In-memory state cache
  private cachedTimingLines: Map<string, RawF1TimingLine> = new Map();
  private cachedDrivers: Map<string, RawF1DriverItem> = new Map();
  private cachedStints: Map<string, RawF1StintItem[]> = new Map();
  private currentLeaderboard: LeaderboardEntry[] = [];
  private currentCarData: Map<number, LiveCarTelemetry> = new Map();
  private lastEmitTime = 0;

  // Session lifecycle state
  private currentSessionStatus: F1LiveSessionStatus = {
    isFinished: false,
    isChequered: false,
  };

  constructor() {
    this.currentLeaderboard = this.loadFromStorage();
  }

  public getSessionStatus(): F1LiveSessionStatus {
    if (
      this.clockBaseRemainingSec !== null &&
      this.clockBaseUtcMs !== null &&
      this.currentSessionStatus.isExtrapolating !== false &&
      !this.currentSessionStatus.isStopped
    ) {
      const elapsedSec = Math.max(0, (Date.now() - this.clockBaseUtcMs) / 1000);
      const extrapolated = Math.max(0, Math.round(this.clockBaseRemainingSec - elapsedSec));
      return {
        ...this.currentSessionStatus,
        remainingSec: extrapolated,
      };
    }
    return { ...this.currentSessionStatus };
  }

  public subscribeSessionStatus(fn: (status: F1LiveSessionStatus) => void): () => void {
    this.sessionStatusListeners.add(fn);
    fn({ ...this.currentSessionStatus });
    return () => {
      this.sessionStatusListeners.delete(fn);
    };
  }

  public subscribeRaceControl(fn: (msg: RaceControlMessage) => void): () => void {
    this.raceControlListeners.add(fn);
    return () => {
      this.raceControlListeners.delete(fn);
    };
  }

  private notifySessionStatus(): void {
    const statusCopy = { ...this.currentSessionStatus };
    this.sessionStatusListeners.forEach(fn => fn(statusCopy));
  }

  public getCarData(): Map<number, LiveCarTelemetry> {
    return new Map(this.currentCarData);
  }

  public subscribeCarData(fn: (carData: Map<number, LiveCarTelemetry>) => void): () => void {
    this.carDataListeners.add(fn);
    if (this.currentCarData.size > 0) {
      fn(new Map(this.currentCarData));
    }
    this.startConnection();
    return () => {
      this.carDataListeners.delete(fn);
      if (this.listeners.size === 0 && this.sessionStatusListeners.size === 0 && this.carDataListeners.size === 0) {
        this.stopConnection();
      }
    };
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
    this.startConnection();
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0 && this.sessionStatusListeners.size === 0 && this.carDataListeners.size === 0) {
        this.stopConnection();
      }
    };
  }

  public startConnection(): void {
    if (this.ws || this.isConnecting) return;
    this.attemptConnect();
  }

  public stopConnection(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.isConnecting = false;
  }

  private attemptConnect(useProxy = false): void {
    this.isConnecting = true;

    const wsUrl = useProxy && typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/f1-live-ws`
      : 'wss://api.f1telemetry.com/';

    try {
      console.info(`[F1LiveWS] Connecting to ${wsUrl}...`);
      const socket = new WebSocket(wsUrl);
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        console.info(`[F1LiveWS] Connected successfully to ${wsUrl}`);
        this.ws = socket;
        this.isConnecting = false;
        try {
          socket.send(encode({ type: 'get:state' }));
        } catch (e) {
          console.warn('[F1LiveWS] Failed to send get:state:', e);
        }
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          if (!(event.data instanceof ArrayBuffer)) return;
          const u8 = new Uint8Array(event.data);
          const decoded = decode(u8) as any;
          this.handleDecodedMessage(decoded);
        } catch (e) {
          console.warn('[F1LiveWS] Message processing error:', e);
        }
      };

      socket.onerror = (err) => {
        console.warn('[F1LiveWS] WebSocket error:', err);
      };

      socket.onclose = () => {
        console.info('[F1LiveWS] WebSocket closed');
        this.ws = null;
        this.isConnecting = false;
        // Reconnect after 3s (switch to proxy if direct failed, or retry)
        this.reconnectTimeout = window.setTimeout(() => {
          this.attemptConnect(!useProxy);
        }, 3000);
      };
    } catch (err) {
      console.warn('[F1LiveWS] Connection attempt failed:', err);
      this.isConnecting = false;
      this.reconnectTimeout = window.setTimeout(() => {
        this.attemptConnect(!useProxy);
      }, 4000);
    }
  }

  private handleDecodedMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;

    let hasTimingUpdate = false;

    // 1. Initial snapshot in R
    if (msg.R && typeof msg.R === 'object') {
      if (msg.R.SessionInfo) {
        this.processSessionInfo(msg.R.SessionInfo);
      }
      if (msg.R.SessionData) {
        this.processSessionData(msg.R.SessionData);
      }
      if (msg.R.ExtrapolatedClock) {
        this.processExtrapolatedClock(msg.R.ExtrapolatedClock);
      }
      if (msg.R.TrackStatus) {
        this.processTrackStatus(msg.R.TrackStatus);
      }
      if (msg.R.RaceControlMessages) {
        this.processRaceControlMessages(msg.R.RaceControlMessages);
      }
      if (msg.R.DriverList) {
        this.processDriverList(msg.R.DriverList);
      }
      if (msg.R.TimingAppData) {
        this.processTimingAppData(msg.R.TimingAppData);
      }
      if (msg.R.TimingData) {
        this.processTimingData(msg.R.TimingData);
        hasTimingUpdate = true;
      }
      if (msg.R['CarData.z'] || msg.R.CarData) {
        this.processCarDataZ(msg.R['CarData.z'] || msg.R.CarData);
      }
    }

    // 2. Real-time streaming updates in M (feed)
    if (Array.isArray(msg.M)) {
      for (const item of msg.M) {
        if (!item || !Array.isArray(item.A)) continue;
        const topic = item.A[0];
        const data = item.A[1];
        if (topic === 'TimingData') {
          this.processTimingData(data);
          hasTimingUpdate = true;
        } else if (topic === 'TimingAppData') {
          this.processTimingAppData(data);
          hasTimingUpdate = true;
        } else if (topic === 'DriverList') {
          this.processDriverList(data);
        } else if (topic === 'SessionData') {
          this.processSessionData(data);
        } else if (topic === 'ExtrapolatedClock') {
          this.processExtrapolatedClock(data);
        } else if (topic === 'SessionInfo') {
          this.processSessionInfo(data);
        } else if (topic === 'TrackStatus') {
          this.processTrackStatus(data);
        } else if (topic === 'RaceControlMessages') {
          this.processRaceControlMessages(data);
        } else if (topic === 'CarData.z' || topic === 'CarData') {
          this.processCarDataZ(data);
        }
      }
    }

    if (hasTimingUpdate) {
      this.throttleEmitLeaderboard();
    }
  }

  private decodeBase64ToUint8(b64: string): Uint8Array {
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return bytes;
    }
    return new Uint8Array();
  }

  private processCarDataZ(raw: any): void {
    if (!raw) return;
    try {
      let json: any = null;
      if (typeof raw === 'object' && raw !== null && !(raw instanceof Uint8Array)) {
        json = raw;
      } else {
        let bytes: Uint8Array;
        if (typeof raw === 'string') {
          bytes = this.decodeBase64ToUint8(raw);
        } else if (raw instanceof Uint8Array) {
          bytes = raw;
        } else {
          return;
        }

        const inflated = inflateRaw(bytes);
        const text = new TextDecoder().decode(inflated);
        json = JSON.parse(text);
      }

      if (!json || !Array.isArray(json.Entries)) return;

      let hasUpdates = false;
      for (const entry of json.Entries) {
        if (!entry || !entry.Cars || typeof entry.Cars !== 'object') continue;
        for (const [driverNumStr, carObj] of Object.entries(entry.Cars)) {
          const driverNum = parseInt(driverNumStr, 10);
          if (isNaN(driverNum)) continue;
          const channels = (carObj as any)?.Channels;
          if (!channels || typeof channels !== 'object') continue;

          // Channel 0 = RPM
          // Channel 2 = Speed (km/h)
          // Channel 3 = Gear (0 = N)
          // Channel 4 = Throttle (0-104 scale)
          // Channel 5 = Brake (0-104 scale)
          const rpm = Number(channels['0'] ?? 0);
          const speed = Number(channels['2'] ?? 0);
          const gear = Number(channels['3'] ?? 0);
          const rawThrottle = Number(channels['4'] ?? 0);
          const rawBrake = Number(channels['5'] ?? 0);

          const throttle = Math.min(100, Math.max(0, Math.round((rawThrottle / 104) * 100)));
          const brake = Math.min(100, Math.max(0, Math.round((rawBrake / 104) * 100)));

          this.currentCarData.set(driverNum, {
            driverNumber: driverNum,
            speed,
            rpm,
            gear,
            throttle,
            brake,
          });
          hasUpdates = true;
        }
      }

      if (hasUpdates && this.carDataListeners.size > 0) {
        const copy = new Map(this.currentCarData);
        this.carDataListeners.forEach(fn => fn(copy));
      }
    } catch (e) {
      console.debug('[F1LiveWS] CarData.z parse error/notice:', e);
    }
  }

  private sessionEndUtcMs: number | null = null;
  private clockBaseRemainingSec: number | null = null;
  private clockBaseUtcMs: number | null = null;

  private processSessionInfo(data: any): void {
    if (!data || typeof data !== 'object') return;

    // Sync official start/end times to scheduleSyncService immediately
    scheduleSyncService.updateFromSignalRSessionInfo(data);

    // Parse EndDate + GmtOffset to calculate fallback remaining time
    if (data.EndDate) {
      const endDateStr = String(data.EndDate);
      const gmtOffset = data.GmtOffset ? String(data.GmtOffset).trim() : '';
      let endIso = endDateStr.endsWith('Z') ? endDateStr : `${endDateStr}Z`;
      if (!endDateStr.endsWith('Z') && gmtOffset) {
        const sign = gmtOffset.startsWith('-') ? '-' : '+';
        const parts = gmtOffset.replace(/^[+-]/, '').split(':');
        if (parts.length >= 2) {
          endIso = `${endDateStr}${sign}${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        }
      }
      const parsedEnd = new Date(endIso).getTime();
      if (!isNaN(parsedEnd)) {
        this.sessionEndUtcMs = parsedEnd;
      }
    }

    let fallbackRemainingSec = this.currentSessionStatus.remainingSec;
    let isAlreadyEndedByClock = false;
    if (this.sessionEndUtcMs) {
      const diffSec = Math.floor((this.sessionEndUtcMs - Date.now()) / 1000);
      if (diffSec <= 0) {
        isAlreadyEndedByClock = true;
        fallbackRemainingSec = 0;
        scheduleSyncService.markSessionFinished(data.Name || data.Type, new Date(this.sessionEndUtcMs).toISOString());
      } else if ((fallbackRemainingSec === undefined || fallbackRemainingSec <= 0) && !this.currentSessionStatus.isFinished && diffSec <= 4 * 3600) {
        fallbackRemainingSec = diffSec;
      }
    }

    this.currentSessionStatus = {
      ...this.currentSessionStatus,
      sessionName: data.Name || this.currentSessionStatus.sessionName,
      sessionType: data.Type || this.currentSessionStatus.sessionType,
      remainingSec: fallbackRemainingSec,
      isFinished: this.currentSessionStatus.isFinished || isAlreadyEndedByClock,
      isChequered: this.currentSessionStatus.isChequered || isAlreadyEndedByClock,
    };
    this.notifySessionStatus();
  }

  private processSessionData(data: any): void {
    if (!data || typeof data !== 'object') return;
    let status: string | undefined = undefined;
    let finishedUtc: string | undefined = undefined;

    if (Array.isArray(data.StatusSeries)) {
      for (let i = data.StatusSeries.length - 1; i >= 0; i--) {
        const item = data.StatusSeries[i];
        if (item && item.SessionStatus) {
          status = item.SessionStatus;
          if (status === 'Finished' || status === 'Finalised' || status === 'Ends') {
            finishedUtc = item.Utc;
          }
          break;
        }
      }
    } else if (data.SessionStatus) {
      status = data.SessionStatus;
    }

    if (status) {
      const isFinished =
        status === 'Finished' ||
        status === 'Finalised' ||
        status === 'Ends' ||
        status === 'Aborted';

      if (isFinished) {
        this.clockBaseRemainingSec = 0;
        scheduleSyncService.markSessionFinished(
          this.currentSessionStatus.sessionName || this.currentSessionStatus.sessionType,
          finishedUtc
        );
      }

      this.currentSessionStatus = {
        ...this.currentSessionStatus,
        sessionStatus: (isFinished ? 'Finished' : status) as any,
        finishedUtc: finishedUtc || this.currentSessionStatus.finishedUtc,
        remainingSec: isFinished ? 0 : this.currentSessionStatus.remainingSec,
        remaining: isFinished ? '00:00:00' : this.currentSessionStatus.remaining,
        isFinished,
        isChequered: isFinished,
      };

      if (isFinished && !this.currentSessionStatus.isFinished) {
        standingsSyncService.triggerRaceFinished();
      }
      this.notifySessionStatus();
    }
  }

  private processExtrapolatedClock(data: any): void {
    if (!data || typeof data !== 'object') return;
    const remainingStr = data.Remaining;
    const isExtrapolating = data.Extrapolating !== false;
    let baseRemainingSec = 0;
    if (remainingStr && typeof remainingStr === 'string') {
      const parts = remainingStr.split(':').map(Number);
      if (parts.length === 3) {
        baseRemainingSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        baseRemainingSec = parts[0] * 60 + parts[1];
      }
    }

    let remainingSec = baseRemainingSec;
    if (isExtrapolating && data.Utc) {
      const clockUtcMs = new Date(data.Utc).getTime();
      if (!isNaN(clockUtcMs)) {
        const elapsedSec = Math.max(0, (Date.now() - clockUtcMs) / 1000);
        remainingSec = Math.max(0, Math.round(baseRemainingSec - elapsedSec));
        this.clockBaseRemainingSec = baseRemainingSec;
        this.clockBaseUtcMs = clockUtcMs;
      }
    } else {
      this.clockBaseRemainingSec = baseRemainingSec;
      this.clockBaseUtcMs = Date.now();
    }

    const clockReachedZero =
      remainingStr === '00:00:00' ||
      remainingStr === '00:00' ||
      (baseRemainingSec > 0 && remainingSec === 0);

    const isFinished =
      this.currentSessionStatus.sessionStatus === 'Finished' ||
      this.currentSessionStatus.isFinished ||
      clockReachedZero;

    if (isFinished) {
      remainingSec = 0;
      this.clockBaseRemainingSec = 0;
      scheduleSyncService.markSessionFinished(
        this.currentSessionStatus.sessionName || this.currentSessionStatus.sessionType
      );
    }

    const isRedFlag = this.currentSessionStatus.trackStatus === '5';
    const isStopped = !isExtrapolating || isRedFlag || isFinished;
    this.currentSessionStatus = {
      ...this.currentSessionStatus,
      remaining: isFinished ? '00:00:00' : remainingStr,
      remainingSec,
      isExtrapolating: isFinished ? false : isExtrapolating,
      isStopped,
      isFinished,
      isChequered: isFinished,
    };
    this.notifySessionStatus();
  }

  private processTrackStatus(data: any): void {
    if (!data || typeof data !== 'object') return;
    const code = String(data.Status || '');
    const isRedFlag = code === '5';
    this.currentSessionStatus = {
      ...this.currentSessionStatus,
      trackStatus: code,
      safetyCar: code === '4',
      vsc: code === '6',
      isRedFlag,
      isStopped: isRedFlag || (this.currentSessionStatus.isExtrapolating === false),
    };
    this.notifySessionStatus();
  }

  private translateRaceControlMessage(text: string): string {
    const t = text.toUpperCase();
    if (t.includes('CLEAR IN TRACK SECTOR')) {
      return text.replace(/CLEAR IN TRACK SECTOR\s*([0-9]+)/i, 'PISTA DESPEJADA EN SECTOR $1');
    }
    if (t.includes('DOUBLE YELLOW IN TRACK SECTOR')) {
      return text.replace(/DOUBLE YELLOW IN TRACK SECTOR\s*([0-9]+)/i, 'DOBLE BANDERA AMARILLA EN SECTOR $1');
    }
    if (t.includes('YELLOW IN TRACK SECTOR')) {
      return text.replace(/YELLOW IN TRACK SECTOR\s*([0-9]+)/i, 'BANDERA AMARILLA EN SECTOR $1');
    }
    if (t.includes('TRACK LIMITS')) {
      return text.replace(/LAP DELETED - TRACK LIMITS AT TURN\s*([0-9]+)/i, 'VUELTA ANULADA - LÍMITES DE PISTA EN CURVA $1')
                 .replace(/TRACK LIMITS AT TURN\s*([0-9]+)/i, 'LÍMITES DE PISTA EN CURVA $1');
    }
    if (t.includes('SAFETY CAR DEPLOYED')) return 'SAFETY CAR DESPLEGADO EN PISTA';
    if (t.includes('VIRTUAL SAFETY CAR DEPLOYED')) return 'SAFETY CAR VIRTUAL DESPLEGADO';
    if (t.includes('VIRTUAL SAFETY CAR ENDING')) return 'SAFETY CAR VIRTUAL FINALIZANDO';
    if (t.includes('RED FLAG')) return 'BANDERA ROJA - SESIÓN DETENIDA';
    if (t.includes('CHEQUERED FLAG')) return 'BANDERA A CUADROS - SESIÓN FINALIZADA';
    if (t.includes('PIT EXIT OPEN')) return 'SALIDA DE PIT LANE ABIERTA';
    if (t.includes('PIT ENTRY CLOSED')) return 'ENTRADA DE PIT LANE CERRADA';
    if (t.includes('DRS ENABLED')) return 'DRS ACTIVADO';
    if (t.includes('DRS DISABLED')) return 'DRS DESACTIVADO';
    return text;
  }

  private processRaceControlMessages(data: any): void {
    if (!data) return;
    const rawList: any[] = Array.isArray(data.Messages) 
      ? data.Messages 
      : Array.isArray(data) 
      ? data 
      : typeof data === 'object' 
      ? Object.values(data) 
      : [];

    for (const item of rawList) {
      if (!item || typeof item !== 'object' || !item.Message) continue;
      const rawText = String(item.Message || '');
      const flagStr = String(item.Flag || '').toUpperCase();
      const catStr = String(item.Category || 'Flag');

      let flag: RaceControlMessage['flag'] = 'GREEN';
      if (flagStr.includes('DOUBLE') || rawText.toUpperCase().includes('DOUBLE YELLOW')) {
        flag = 'DOUBLE_YELLOW';
      } else if (flagStr.includes('YELLOW') || rawText.toUpperCase().includes('YELLOW')) {
        flag = 'YELLOW';
      } else if (flagStr.includes('RED') || rawText.toUpperCase().includes('RED FLAG')) {
        flag = 'RED';
      } else if (flagStr.includes('CHEQUERED') || rawText.toUpperCase().includes('CHEQUERED')) {
        flag = 'CHEQUERED';
      } else if (flagStr.includes('CLEAR') || rawText.toUpperCase().includes('CLEAR')) {
        flag = 'GREEN';
      }

      let category: RaceControlMessage['category'] = 'FLAG';
      const upper = rawText.toUpperCase();
      if (upper.includes('SAFETY CAR') || catStr === 'SafetyCar') category = 'SAFETY_CAR';
      else if (upper.includes('DELETED') || upper.includes('TRACK LIMITS')) category = 'INCIDENT';
      else if (upper.includes('PIT')) category = 'PIT_LANE';
      else if (upper.includes('RAIN') || upper.includes('WEATHER')) category = 'WEATHER';

      const timeStr = item.Utc 
        ? new Date(item.Utc).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const parsed: RaceControlMessage = {
        id: `rc-ws-${item.Utc || Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: timeStr,
        flag,
        scope: item.Scope || 'Track',
        sector: item.Sector ? Number(item.Sector) : undefined,
        driverNumber: item.RacingNumber ? Number(item.RacingNumber) : undefined,
        messageEn: rawText,
        messageEs: this.translateRaceControlMessage(rawText),
        category,
      };

      // Notify immediately!
      this.raceControlListeners.forEach(fn => fn(parsed));
    }
  }

  private processDriverList(data: any): void {
    if (!data) return;
    const entries = data.Lines ? Object.entries(data.Lines) : Object.entries(data);
    for (const [key, val] of entries) {
      if (key === '_kf' || !val || typeof val !== 'object') continue;
      const numStr = (val as any).RacingNumber || key;
      this.cachedDrivers.set(String(numStr), val as RawF1DriverItem);
    }
  }

  private processTimingAppData(data: any): void {
    if (!data || !data.Lines) return;
    for (const [key, val] of Object.entries(data.Lines)) {
      if (key === '_kf' || !val || typeof val !== 'object') continue;
      const appData = val as any;
      const numStr = appData.RacingNumber || key;
      const rawStints = appData.Stints;
      if (rawStints) {
        let stintsList: RawF1StintItem[] = [];
        if (Array.isArray(rawStints)) {
          stintsList = rawStints.filter(Boolean);
        } else if (typeof rawStints === 'object') {
          stintsList = Object.keys(rawStints)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => rawStints[k])
            .filter(Boolean);
        }
        if (stintsList.length > 0) {
          const existing = this.cachedStints.get(String(numStr)) || [];
          stintsList.forEach((s, idx) => {
            existing[idx] = { ...(existing[idx] || {}), ...s };
          });
          this.cachedStints.set(String(numStr), existing);
        }
      }
    }
  }

  private processTimingData(data: any): void {
    if (!data || !data.Lines) return;
    for (const [key, val] of Object.entries(data.Lines)) {
      if (key === '_kf' || !val || typeof val !== 'object') continue;
      const numStr = (val as any).RacingNumber || key;
      const existing = this.cachedTimingLines.get(String(numStr)) || {};
      const merged = this.mergeTimingLine(existing, val as RawF1TimingLine);
      this.cachedTimingLines.set(String(numStr), merged);
    }
  }

  private mergeTimingLine(existing: RawF1TimingLine, delta: RawF1TimingLine): RawF1TimingLine {
    const res: RawF1TimingLine = { ...existing, ...delta };

    // Explicitly synchronize mutually exclusive Pit states when delta arrives
    if (delta.PitOut === true) {
      res.InPit = false;
      res.PitOut = true;
    } else if (delta.InPit === true) {
      res.InPit = true;
      res.PitOut = false;
    } else if (delta.InPit === false) {
      res.InPit = false;
    }

    let hasActiveOnTrackSector = false;
    let hasCompletedSector1OrLater = false;
    let hasPitSegment = false;

    // Deep merge Sectors
    if (delta.Sectors) {
      const existingSectors = Array.isArray(existing.Sectors)
        ? [...existing.Sectors]
        : existing.Sectors ? Object.values(existing.Sectors) : [];

      const deltaSectors = delta.Sectors;
      const sectorEntries = Array.isArray(deltaSectors)
        ? deltaSectors.entries()
        : Object.entries(deltaSectors).map(([k, v]) => [Number(k), v] as [number, any]);

      for (const [idx, deltaSec] of sectorEntries) {
        if (!deltaSec) continue;
        const curSec = existingSectors[idx] || {};
        const mergedSec = { ...curSec, ...deltaSec };

        if (deltaSec.Value && String(deltaSec.Value).trim() !== '') {
          hasActiveOnTrackSector = true;
          if (idx >= 0) {
            hasCompletedSector1OrLater = true;
          }
        }

        // Deep merge Segments
        if (deltaSec.Segments) {
          const curSegs = Array.isArray(curSec.Segments)
            ? [...curSec.Segments]
            : curSec.Segments ? Object.values(curSec.Segments) : [];

          let maxActiveDeltaIdx = -1;
          if (Array.isArray(deltaSec.Segments)) {
            mergedSec.Segments = deltaSec.Segments;
            deltaSec.Segments.forEach((seg: any, sIdx: number) => {
              const st = seg && typeof seg === 'object' ? seg.Status : seg;
              if (st === 2048 || st === 2049 || st === 2051 || st === 2064) {
                maxActiveDeltaIdx = Math.max(maxActiveDeltaIdx, sIdx);
              }
            });
          } else if (typeof deltaSec.Segments === 'object') {
            for (const [segIdx, segVal] of Object.entries(deltaSec.Segments)) {
              const sNum = Number(segIdx);
              if (Number.isFinite(sNum)) {
                curSegs[sNum] = segVal as any;
                const st = segVal && typeof segVal === 'object' ? (segVal as any).Status : segVal;
                if (st === 2048 || st === 2049 || st === 2051 || st === 2064) {
                  maxActiveDeltaIdx = Math.max(maxActiveDeltaIdx, sNum);
                }
              }
            }
            // Clear trailing segments from previous lap in this sector
            if (maxActiveDeltaIdx >= 0) {
              for (let clearIdx = maxActiveDeltaIdx + 1; clearIdx < curSegs.length; clearIdx++) {
                curSegs[clearIdx] = { Status: 0 };
              }
            }
            mergedSec.Segments = curSegs;
          }

          // When starting a new lap in S1 (microsectors 0..2), clear S2 and S3 from previous lap
          const dSectors = delta.Sectors as any;
          if (idx === 0 && maxActiveDeltaIdx >= 0 && maxActiveDeltaIdx <= 2 && !dSectors?.[1]?.Segments && !dSectors?.[2]?.Segments) {
            if (existingSectors[1]) {
              existingSectors[1] = { ...existingSectors[1], Value: '', Segments: [] };
            }
            if (existingSectors[2]) {
              existingSectors[2] = { ...existingSectors[2], Value: '', Segments: [] };
            }
            mergedSec.Value = deltaSec.Value ?? '';
          } else if (idx === 1 && maxActiveDeltaIdx >= 0 && maxActiveDeltaIdx <= 2 && !dSectors?.[2]?.Segments) {
            if (existingSectors[2]) {
              existingSectors[2] = { ...existingSectors[2], Value: '', Segments: [] };
            }
            mergedSec.Value = deltaSec.Value ?? '';
          } else if (idx === 2 && maxActiveDeltaIdx >= 0 && maxActiveDeltaIdx <= 2 && !deltaSec.Value) {
            mergedSec.Value = '';
          }

          const deltaSegValues = Array.isArray(deltaSec.Segments)
            ? deltaSec.Segments
            : Object.values(deltaSec.Segments);
          for (const seg of deltaSegValues) {
            const st = seg && typeof seg === 'object' ? seg.Status : seg;
            if (st === 2048 || st === 2049 || st === 2051) {
              hasActiveOnTrackSector = true;
              if (idx >= 1) {
                hasCompletedSector1OrLater = true;
              }
            } else if (st === 2064) {
              hasPitSegment = true;
            }
          }
        }
        existingSectors[idx] = mergedSec;
      }
      res.Sectors = existingSectors;
    }

    if (delta.BestLapTime) {
      res.BestLapTime = { ...(existing.BestLapTime || {}), ...delta.BestLapTime };
      if (delta.BestLapTime.Value) {
        hasActiveOnTrackSector = true;
        hasCompletedSector1OrLater = true;
      }
    }
    if (delta.LastLapTime) {
      res.LastLapTime = { ...(existing.LastLapTime || {}), ...delta.LastLapTime };
      if (delta.LastLapTime.Value) {
        hasActiveOnTrackSector = true;
        hasCompletedSector1OrLater = true;
      }
    }
    if (delta.IntervalToPositionAhead) {
      res.IntervalToPositionAhead = { ...(existing.IntervalToPositionAhead || {}), ...delta.IntervalToPositionAhead };
    }

    // Clear stale InPit / PitOut when car is actively setting on-track sectors/laps
    if (hasActiveOnTrackSector && !hasPitSegment && delta.InPit !== true) {
      res.InPit = false;
      if (hasCompletedSector1OrLater && delta.PitOut !== true) {
        res.PitOut = false;
      }
    } else if (hasPitSegment && delta.PitOut !== true && delta.InPit !== false) {
      res.InPit = true;
      res.PitOut = false;
    }

    return res;
  }

  private throttleEmitLeaderboard(): void {
    const now = Date.now();
    if (now - this.lastEmitTime < 250) return; // throttle to max 4 updates per sec for silky stable UI
    this.lastEmitTime = now;
    this.buildAndEmitLeaderboard();
  }

  private buildAndEmitLeaderboard(): void {
    const entries: LeaderboardEntry[] = [];

    // Map cached entries
    const hasHadjarLine = this.cachedTimingLines.has('6');
    for (const [numStr, line] of this.cachedTimingLines.entries()) {
      const driverMeta = this.cachedDrivers.get(numStr);
      const stints = this.cachedStints.get(numStr) || [];
      const currentStint = stints[stints.length - 1];

      const driverNum = parseInt(numStr, 10);
      if (driverNum === 22 || driverMeta?.Tla === 'TSU') {
        if (hasHadjarLine) continue;
      }
      const driver = this.resolveDriver(driverNum, driverMeta);

      const pos = parseInt(line.Position || '99', 10);

      // Best lap & last lap
      const bestLap = line.BestLapTime?.Value || '';
      const lastLap = line.LastLapTime?.Value || '';

      // Sectors
      const sectors = Array.isArray(line.Sectors) ? line.Sectors : line.Sectors ? Object.values(line.Sectors) : [];
      const s1 = sectors[0];
      const s2 = sectors[1];
      const s3 = sectors[2];

      const s1Time = s1?.Value || '';
      const s2Time = s2?.Value || '';
      const s3Time = s3?.Value || '';

      // Resolve accurate pit state combining line flags, microsectors, and live telemetry speed
      let resolvedInPit = Boolean(line.InPit);
      let resolvedPitOut = Boolean(line.PitOut);

      if (resolvedPitOut) {
        resolvedInPit = false;
      }

      const liveCar = this.currentCarData.get(driverNum);
      if (liveCar && liveCar.speed > 85) {
        // Pit lane speed limit is 80 km/h — car > 85 km/h is definitely on track
        resolvedInPit = false;
        if (liveCar.speed > 175 && (s1Time || s2Time)) {
          resolvedPitOut = false;
        }
      }

      const s1Status = this.resolveSectorStatus(s1, resolvedInPit);
      const s2Status = this.resolveSectorStatus(s2, resolvedInPit);
      const s3Status = this.resolveSectorStatus(s3, resolvedInPit);

      const s1Segments = this.resolveSegments(s1?.Segments, s1Status, 8, Boolean(s1Time));
      const s2Segments = this.resolveSegments(s2?.Segments, s2Status, 8, Boolean(s2Time));
      const s3Segments = this.resolveSegments(s3?.Segments, s3Status, 9, Boolean(s3Time));

      // Check latest microsector across all sectors
      const allActiveSegs = [...s1Segments, ...s2Segments, ...s3Segments].filter(s => s !== 'none');
      const lastActiveSeg = allActiveSegs.length > 0 ? allActiveSegs[allActiveSegs.length - 1] : null;
      if (lastActiveSeg && lastActiveSeg !== 'pit' && (s1Time || s2Time || s3Time)) {
        resolvedInPit = false;
        if (s2Segments.some(s => s !== 'none' && s !== 'pit') || s3Segments.some(s => s !== 'none' && s !== 'pit')) {
          resolvedPitOut = false;
        }
      }

      // Gaps
      const gapToLeader = line.GapToLeader || line.TimeDiffToFastest || '';
      const gapToAhead = line.IntervalToPositionAhead?.Value || line.TimeDiffToPositionAhead || line.TimeDiffToFastest || '';

      // Existing entry for trackProgress preservation
      const existingEntry = this.currentLeaderboard.find(e => e.driver.number === driverNum || e.driver.id === driver.id);

      // Compound & Tyres
      const rawComp = (currentStint?.Compound || (line as any).StintCompound || '').toUpperCase();
      const compound: TyreCompound = (['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].includes(rawComp)
        ? rawComp
        : existingEntry?.tyre?.compound || (pos % 2 === 0 ? 'MEDIUM' : 'SOFT')) as TyreCompound;
      const tyreAge = currentStint?.TotalLaps !== undefined 
        ? currentStint.TotalLaps 
        : (existingEntry?.tyre?.age !== undefined ? existingEntry.tyre.age : (line.NumberOfLaps !== undefined ? Math.max(1, Math.min(line.NumberOfLaps, 15)) : 2));
      const tyreUsed = currentStint?.New === 'false' || tyreAge > 1;

      entries.push({
        position: pos,
        previousPosition: existingEntry?.previousPosition || pos,
        driver,
        gapToLeader: pos === 1 ? '' : (gapToLeader ? (gapToLeader.startsWith('+') ? gapToLeader : `+${gapToLeader}`) : ''),
        gapToAhead: pos === 1 ? '' : (gapToAhead ? (gapToAhead.startsWith('+') ? gapToAhead : `+${gapToAhead}`) : ''),
        intervalNum: this.parseLapTimeToSeconds(gapToAhead),
        currentLapTime: lastLap || bestLap || '--:--.---',
        bestLapTime: bestLap || lastLap || '--:--.---',
        lastLapTime: lastLap || '--:--.---',
        s1Time,
        s2Time,
        s3Time,
        s1Status,
        s2Status,
        s3Status,
        s1Segments,
        s2Segments,
        s3Segments,
        tyre: {
          compound,
          age: tyreAge,
          used: tyreUsed,
        },
        pitStops: line.NumberOfPitStops !== undefined ? line.NumberOfPitStops : (existingEntry?.pitStops || 0),
        inPit: resolvedInPit,
        isPitOut: resolvedPitOut,
        speedTrap: parseFloat(line.Speeds?.ST?.Value || '0') || (existingEntry?.speedTrap || 315),
        lastLapTimeNum: this.parseLapTimeToSeconds(lastLap || bestLap),
        trackProgress: existingEntry ? existingEntry.trackProgress : (1 - (pos - 1) * 0.045 + 1) % 1,
        lapsCompleted: line.NumberOfLaps !== undefined ? line.NumberOfLaps : existingEntry?.lapsCompleted,
      });
    }

    if (entries.length === 0) return;

    // Sort by position ascending with driver number tiebreaker for rock-solid stability
    entries.sort((a, b) => a.position - b.position || a.driver.number - b.driver.number);

    // Re-verify position numbering
    entries.forEach((e, idx) => {
      if (e.position > 50) e.position = idx + 1;
    });

    this.currentLeaderboard = entries;
    this.saveToStorage(entries);
    this.listeners.forEach(fn => fn(entries));
  }

  private resolveDriver(num: number, raw?: RawF1DriverItem): any {
    if (num === 22 || raw?.Tla === 'TSU') {
      const had = DRIVERS.find(d => d.code === 'HAD');
      if (had) return { ...had };
    }
    const matched = DRIVERS.find(d => d.number === num || (raw?.Tla && d.code === raw.Tla));
    if (matched) {
      return {
        ...matched,
        number: num,
        teamColor: raw?.TeamColour ? `#${raw.TeamColour}` : matched.teamColor,
        team: raw?.TeamName || matched.team,
      };
    }

    // Construct dynamically if not in local DRIVERS array
    const code = raw?.Tla || `D${num}`;
    const lastName = raw?.LastName || raw?.BroadcastName || `Piloto ${num}`;
    const firstName = raw?.FirstName || '';
    const team = raw?.TeamName || 'F1 Team';
    const teamColor = raw?.TeamColour ? `#${raw.TeamColour}` : '#00D7B6';

    return {
      id: code.toLowerCase(),
      code,
      number: num,
      firstName,
      lastName,
      team,
      teamColor,
      country: 'ES',
      flag: '🏁',
    };
  }

  private resolveSectorStatus(sec?: any, inPit = false): SectorStatus {
    if (!sec) return inPit ? 'pit' : 'none';
    if (sec.OverallFastest || sec.Status === 2051) return 'purple';
    if (sec.PersonalFastest || sec.Status === 2049) return 'green';
    if (sec.Value || sec.Status === 2048) return 'yellow';
    if (inPit) return 'pit';
    return 'none';
  }

  private resolveSegments(rawSegs: any, fallback?: SectorStatus, targetCount = 8, isCompleted = false): SectorStatus[] {
    if (!rawSegs) {
      if (isCompleted && fallback && fallback !== 'none') {
        return Array(targetCount).fill(fallback);
      }
      return Array(targetCount).fill('none');
    }
    const segList: any[] = Array.isArray(rawSegs) ? rawSegs : Object.values(rawSegs);
    if (segList.length === 0) {
      if (isCompleted && fallback && fallback !== 'none') {
        return Array(targetCount).fill(fallback);
      }
      return Array(targetCount).fill('none');
    }

    const mapped: SectorStatus[] = segList.map(s => {
      const code = s && typeof s === 'object' ? s.Status : s;
      if (code === 2051 || s === 'purple') return 'purple' as SectorStatus;
      if (code === 2049 || s === 'green') return 'green' as SectorStatus;
      if (code === 2048 || s === 'yellow') return 'yellow' as SectorStatus;
      if (code === 2064 || s === 'pit') return 'pit' as SectorStatus;
      return 'none' as SectorStatus;
    });

    const result: SectorStatus[] = [];
    const allActive = mapped.every(m => m !== 'none');
    for (let i = 0; i < targetCount; i++) {
      if (i < mapped.length) {
        result.push(mapped[i]);
      } else if (isCompleted && allActive && mapped.length > 0) {
        result.push(mapped[mapped.length - 1]);
      } else {
        result.push('none');
      }
    }

    return result;
  }

  private parseLapTimeToSeconds(timeStr?: string): number {
    if (!timeStr) return 0;
    const clean = timeStr.trim().replace(/^\+/, '');
    if (clean.includes(':')) {
      const [minStr, secStr] = clean.split(':');
      return (parseFloat(minStr) || 0) * 60 + (parseFloat(secStr) || 0);
    }
    return parseFloat(clean) || 0;
  }

  public loadFromStorage(): LeaderboardEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_LIVE_LEADERBOARD_KEY) ||
                  localStorage.getItem('f1_saved_leaderboard_madrid') ||
                  localStorage.getItem('f1_official_live_timing_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasHadjar = parsed.some((e: any) => e?.driver && (e.driver.code === 'HAD' || e.driver.number === 6));
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
          let modified = false;
          const cleaned: LeaderboardEntry[] = [];
          for (const e of parsed) {
            if (!e || !e.driver) continue;
            const isTsu = e.driver.code === 'TSU' || e.driver.id === 'tsu' || e.driver.number === 22 ||
              (e.driver.lastName && String(e.driver.lastName).toLowerCase().includes('tsunoda'));
            if (isTsu) {
              modified = true;
              if (!hasHadjar) {
                cleaned.push({ ...e, driver: { ...hadjarDriver } });
              }
              continue;
            }
            cleaned.push(e);
          }
          const inPitCount = cleaned.filter((e: any) => e && e.inPit).length;
          if (inPitCount > 8) {
            modified = true;
            cleaned.forEach((e: any, idx: number) => {
              if (e) {
                e.inPit = idx >= 18;
                e.isPitOut = false;
              }
            });
          }
          if (modified) {
            cleaned.forEach((e, idx) => { e.position = idx + 1; });
            this.saveToStorage(cleaned);
          }
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('[F1LiveWS] Failed reading localStorage:', e);
    }
    return [];
  }

  public saveToStorage(entries: LeaderboardEntry[]): void {
    if (typeof window === 'undefined' || !entries || entries.length === 0) return;
    try {
      const json = JSON.stringify(entries);
      localStorage.setItem(STORAGE_LIVE_LEADERBOARD_KEY, json);
      localStorage.setItem('f1_saved_leaderboard_madrid', json);
      localStorage.setItem('f1_official_live_timing_cache', json);
    } catch (e) {
      console.warn('[F1LiveWS] Failed writing localStorage:', e);
    }
  }
}

export const f1LiveWebSocketService = new F1LiveWebSocketService();
