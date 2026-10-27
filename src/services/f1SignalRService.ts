/**
 * F1 Live Timing SignalR Streaming Service (Real-Time Zero Latency Ingestion)
 *
 * Implements full negotiation, sticky cookie routing, WebSocket handshake,
 * and high-frequency stream processing for official F1 Live Timing:
 * - Hub: "Streaming"
 * - Topics: TimingData, TimingAppData, SessionData, Heartbeat
 * - Message protocol: SignalR Core JSON (record separator \x1e) & Legacy SignalR fallback
 */

import { mergeSectorDelta, type SegmentStatusType } from '../utils/microsectorParser';

export interface DriverSectorState {
  time?: string;
  previousTime?: string;
  status: 'purple' | 'green' | 'yellow' | 'none';
  segments: SegmentStatusType[];
}

export interface DriverLiveTimingState {
  driverNumber: string;
  position?: number;
  gapToLeader?: string;
  intervalToAhead?: string;
  bestLapTime?: string;
  lastLapTime?: string;
  inPit?: boolean;
  pitOut?: boolean;
  lapsCompleted?: number;
  sectors: [DriverSectorState, DriverSectorState, DriverSectorState]; // S1, S2, S3
  lastUpdated: number;
}

export type ConnectionState = 'disconnected' | 'negotiating' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface SignalRMessageListener {
  (drivers: Map<string, DriverLiveTimingState>, rawPayload: any): void;
}

export interface ConnectionStateListener {
  (state: ConnectionState, error?: string): void;
}

class F1SignalRService {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private connectionToken: string | null = null;
  private stickyCookie: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private watchdogTimer: any = null;
  private readonly watchdogTimeoutMs = 6000; // 6 seconds watchdog
  private isDisposed = false;

  // In-memory driver timing state map (keyed by driver number e.g. "1", "44", "16")
  private driversState = new Map<string, DriverLiveTimingState>();

  // Subscribers
  private messageListeners = new Set<SignalRMessageListener>();
  private stateListeners = new Set<ConnectionStateListener>();

  constructor() {
    this.initDefaultDrivers();
  }

  private initDefaultDrivers() {
    // Initialize empty 3-sector structure for standard F1 grid
    const driverNumbers = ['1', '3', '4', '5', '6', '10', '11', '12', '14', '16', '18', '22', '23', '27', '30', '31', '40', '43', '44', '55', '63', '77', '81', '87'];
    for (const num of driverNumbers) {
      this.driversState.set(num, {
        driverNumber: num,
        sectors: [
          { status: 'none', segments: Array(8).fill('pending') },
          { status: 'none', segments: Array(8).fill('pending') },
          { status: 'none', segments: Array(9).fill('pending') },
        ],
        lastUpdated: Date.now(),
      });
    }
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getConnectionToken(): string | null {
    return this.connectionToken;
  }

  public getStickyCookie(): string | null {
    return this.stickyCookie;
  }

  public getDriverState(driverNumber: string | number): DriverLiveTimingState | undefined {
    return this.driversState.get(String(driverNumber));
  }

  public getAllDriversState(): Map<string, DriverLiveTimingState> {
    return this.driversState;
  }

  public subscribeTimingData(listener: SignalRMessageListener): () => void {
    this.messageListeners.add(listener);
    if (this.driversState.size > 0) {
      listener(this.driversState, null);
    }
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  public subscribeConnectionState(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.connectionState);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private setConnectionState(state: ConnectionState, error?: string) {
    this.connectionState = state;
    for (const listener of this.stateListeners) {
      listener(state, error);
    }
  }

  /**
   * Step 1: Negotiate HTTP connection with F1 Live Timing backend
   * Handles CORS proxy in Vite dev server and captures AWS ALB sticky cookies.
   */
  public async negotiate(): Promise<{ token: string; cookie: string }> {
    this.setConnectionState('negotiating');

    // In browser environment, check if Vite dev proxy /f1-signalr is available
    const isBrowser = typeof window !== 'undefined';
    const negotiateUrls = isBrowser
      ? ['/f1-signalr/negotiate?negotiateVersion=1', 'https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1']
      : ['https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1'];

    let lastError: any = null;

    for (const url of negotiateUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'User-Agent': 'BestHTTP',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from negotiate endpoint`);
        }

        // Extract AWS sticky session cookie if available
        let cookieHeader = '';
        if (typeof (response.headers as any).getSetCookie === 'function') {
          const raw = (response.headers as any).getSetCookie();
          if (Array.isArray(raw)) {
            cookieHeader = raw.map((c: string) => c.split(';')[0]).join('; ');
          }
        } else {
          const single = response.headers.get('set-cookie');
          if (single) cookieHeader = single.split(';')[0];
        }

        const data = await response.json();
        const token = data.connectionToken || data.connectionId;
        if (!token) {
          throw new Error('No connectionToken or connectionId in negotiation response');
        }

        this.connectionToken = token;
        this.stickyCookie = cookieHeader;
        return { token, cookie: cookieHeader };
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('Negotiation failed for all candidate URLs');
  }

  /**
   * Step 2 & 3: Establish WebSocket Handshake and Subscribe to Hub
   */
  public async connect(): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.isDisposed = false;

    try {
      const { token, cookie } = await this.negotiate();
      this.setConnectionState('connecting');

      const isBrowser = typeof window !== 'undefined';
      // In browser with proxy or direct connection
      let wsUrl = `wss://livetiming.formula1.com/signalrcore?id=${encodeURIComponent(token)}`;

      if (isBrowser && window.location.protocol === 'http:' && window.location.port === '5173') {
        // Use Vite dev server WebSocket proxy if active
        wsUrl = `ws://${window.location.host}/f1-signalr?id=${encodeURIComponent(token)}`;
      }

      // Check if Node.js or Browser WebSocket
      let socket: WebSocket;
      if (!isBrowser) {
        // Node.js environment: dynamically use 'ws' to include Cookie and User-Agent headers
        try {
          const WebSocketModule = (await import('ws')).default;
          socket = new (WebSocketModule as any)(wsUrl, {
            headers: {
              'User-Agent': 'BestHTTP',
              'Cookie': cookie,
            },
          });
        } catch {
          // Fallback to global WebSocket
          socket = new WebSocket(wsUrl);
        }
      } else {
        // Browser environment
        socket = new WebSocket(wsUrl);
      }

      this.ws = socket;

      socket.onopen = () => {
        this.setConnectionState('connected');
        this.reconnectAttempts = 0;

        // Protocol handshake: SignalR Core JSON Protocol (Record Separator \x1e)
        const handshake = JSON.stringify({ protocol: 'json', version: 1 }) + '\x1e';
        socket.send(handshake);

        // Topic subscription
        const subscribeMessage = JSON.stringify({
          type: 1,
          target: 'Subscribe',
          arguments: [['TimingData', 'TimingAppData', 'SessionData', 'Heartbeat']],
        }) + '\x1e';
        socket.send(subscribeMessage);

        // Start ping/heartbeat to maintain connection alive
        this.startHeartbeat();
        this.resetWatchdog();
      };

      socket.onmessage = (event: MessageEvent) => {
        this.resetWatchdog();
        this.handleSocketMessage(event.data);
      };

      socket.onerror = (err) => {
        console.warn('[F1SignalR] WebSocket error:', err);
      };

      socket.onclose = (event: CloseEvent) => {
        this.stopHeartbeat();
        this.stopWatchdog();
        this.ws = null;
        if (!this.isDisposed) {
          this.setConnectionState('reconnecting', `Closed with code ${event.code}`);
          this.scheduleReconnect();
        } else {
          this.setConnectionState('disconnected');
        }
      };
    } catch (err: any) {
      console.warn('[F1SignalR] Connection failed:', err?.message || err);
      this.setConnectionState('error', err?.message);
      this.scheduleReconnect();
    }
  }

  /**
   * Watchdog timer to detect silent disconnects (no packet/heartbeat in 6s)
   */
  private resetWatchdog() {
    this.stopWatchdog();
    this.watchdogTimer = setTimeout(() => {
      if (this.isDisposed) return;
      console.warn(`[F1SignalR] Watchdog timeout: No message received in ${this.watchdogTimeoutMs}ms. Silent drop detected, force reconnecting...`);
      if (this.ws) {
        try {
          this.ws.close();
        } catch {}
        this.ws = null;
      }
      this.setConnectionState('reconnecting', 'Watchdog timeout');
      this.scheduleReconnect();
    }, this.watchdogTimeoutMs);
  }

  private stopWatchdog() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /**
   * Processes incoming SignalR framed messages
   */
  private handleSocketMessage(rawData: any) {
    if (typeof rawData !== 'string') return;

    try {
      // Split messages by ASCII 30 Record Separator (\x1e)
      const messages = rawData.split('\x1e');
      for (const msgStr of messages) {
        const trimmed = msgStr.trim();
        if (!trimmed || trimmed === '{}') continue;

        try {
          const parsed = JSON.parse(trimmed);

          // SignalR Core Feed payload
          if (parsed.type === 1 && parsed.target === 'feed' && Array.isArray(parsed.arguments)) {
            const topic = parsed.arguments[0];
            const payload = parsed.arguments[1];

            if (topic === 'TimingData' && payload && payload.Lines) {
              this.processTimingDataDelta(payload.Lines);
              // Notify subscribers with a fresh immutable Map copy
              const freshMap = new Map(this.driversState);
              for (const listener of this.messageListeners) {
                listener(freshMap, payload);
              }
            }
          }
        } catch {
          // Ignore individual unparseable frames
        }
      }
    } catch (e) {
      console.warn('[F1SignalR] Error handling socket message:', e);
    }
  }

  /**
   * Step 2: Decodes F1 TimingData Lines[driverNumber].Sectors[sIdx].Segments[segIdx]
   * Updates state with immutability guarantees.
   */
  public processTimingDataDelta(lines: Record<string, any>) {
    const now = Date.now();

    for (const [driverNum, lineData] of Object.entries(lines)) {
      const prevDriver = this.driversState.get(driverNum) || {
        driverNumber: driverNum,
        sectors: [
          { status: 'none', segments: Array(8).fill('pending') },
          { status: 'none', segments: Array(8).fill('pending') },
          { status: 'none', segments: Array(9).fill('pending') },
        ] as [DriverSectorState, DriverSectorState, DriverSectorState],
        lastUpdated: now,
      };

      const updatedSectors: [DriverSectorState, DriverSectorState, DriverSectorState] = [
        { ...prevDriver.sectors[0], segments: [...prevDriver.sectors[0].segments] },
        { ...prevDriver.sectors[1], segments: [...prevDriver.sectors[1].segments] },
        { ...prevDriver.sectors[2], segments: [...prevDriver.sectors[2].segments] },
      ];

      // Sectors & Microsectors
      if (lineData.Sectors) {
        const sectors = lineData.Sectors;
        const targetCounts = [8, 8, 9];

        const sectorEntries = Array.isArray(sectors)
          ? sectors.map((s, idx) => [String(idx), s] as const)
          : Object.entries(sectors);

        for (const [sKey, sData] of sectorEntries) {
          const sIdx = parseInt(sKey, 10);
          if (isNaN(sIdx) || sIdx < 0 || sIdx > 2) continue;

          const sector = updatedSectors[sIdx];
          const targetCount = targetCounts[sIdx];

          if (sData.Value) {
            sector.time = sData.Value;
          }
          if (sData.PreviousValue) {
            sector.previousTime = sData.PreviousValue;
          }

          if (sData.OverallFastest) {
            sector.status = 'purple';
          } else if (sData.PersonalFastest) {
            sector.status = 'green';
          } else if (sData.Value && sector.status === 'none') {
            sector.status = 'yellow';
          }

          if (sData.Segments) {
            sector.segments = mergeSectorDelta(sector.segments, sData.Segments, targetCount);
          }
        }
      }

      const updatedDriver: DriverLiveTimingState = {
        ...prevDriver,
        lastUpdated: now,
        inPit: lineData.InPit !== undefined ? Boolean(lineData.InPit) : prevDriver.inPit,
        pitOut: lineData.PitOut !== undefined ? Boolean(lineData.PitOut) : prevDriver.pitOut,
        lapsCompleted: lineData.NumberOfLaps !== undefined ? Number(lineData.NumberOfLaps) : prevDriver.lapsCompleted,
        bestLapTime: lineData.BestLapTime?.Value || prevDriver.bestLapTime,
        lastLapTime: lineData.LastLapTime?.Value || prevDriver.lastLapTime,
        gapToLeader: lineData.GapToLeader || prevDriver.gapToLeader,
        intervalToAhead: lineData.IntervalToPositionAhead?.Value || prevDriver.intervalToAhead,
        sectors: updatedSectors,
      };

      this.driversState.set(driverNum, updatedDriver);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // SignalR Core ping: type 6
        this.ws.send(JSON.stringify({ type: 6 }) + '\x1e');
      }
    }, 5000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.isDisposed || this.reconnectTimer) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[F1SignalR] Maximum reconnect attempts reached.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  public disconnect() {
    this.isDisposed = true;
    this.stopHeartbeat();
    this.stopWatchdog();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState('disconnected');
  }
}

export const f1SignalRService = new F1SignalRService();
