import { inflate, inflateRaw } from 'pako';
import { standingsSyncService } from './standingsSyncService';
import { scheduleSyncService } from './scheduleSyncService';

export type SignalRConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'live_streaming' 
  | 'standby' 
  | 'error';

export interface F1TrackStatus {
  status: string; // '1' = Track Clear / Green, '2' = Yellow, '4' = SC, '5' = Red, '6' = VSC, '7' = VSC Ending
  message: string;
}

export interface F1WeatherData {
  airTemp: number;
  trackTemp: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  rainfall: boolean;
}

export interface F1SignalRListeners {
  onStatusChange?: (status: SignalRConnectionStatus, details?: string) => void;
  onCarData?: (carData: any) => void;
  onPositionData?: (positionData: any) => void;
  onTimingData?: (timingData: any) => void;
  onTrackStatus?: (trackStatus: F1TrackStatus) => void;
  onWeatherData?: (weather: F1WeatherData) => void;
  onRaceControl?: (message: any) => void;
  onSessionInfo?: (sessionInfo: any) => void;
  onClock?: (clockData: any) => void;
}

export class F1SignalRClient {
  private ws: WebSocket | null = null;
  private connectionStatus: SignalRConnectionStatus = 'disconnected';
  private listeners: F1SignalRListeners = {};
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;
  private watchdogInterval: number | null = null;
  private reconnectAttempts = 0;
  private messageBuffer = '';
  private lastStreamPacketTime = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      (window as any).__simulateSignalRTimingData = (timingData: any) => {
        console.info('[F1SignalR] 🧪 Simulating incoming TimingData event:', timingData);
        this.listeners.onTimingData?.(timingData);
      };
    }
  }

  public getLastStreamPacketTime(): number {
    return this.lastStreamPacketTime;
  }

  public setListeners(listeners: F1SignalRListeners) {
    this.listeners = { ...this.listeners, ...listeners };
  }

  public getStatus(): SignalRConnectionStatus {
    return this.connectionStatus;
  }

  private updateStatus(status: SignalRConnectionStatus, details?: string) {
    this.connectionStatus = status;
    if (this.listeners.onStatusChange) {
      this.listeners.onStatusChange(status, details);
    }
  }

  /**
   * Connect to the official F1 SignalR Core stream
   */
  public async connect(): Promise<void> {
    if (this.connectionStatus === 'connected' || this.connectionStatus === 'connecting') {
      return;
    }

    this.updateStatus('connecting', 'Conectando...');

    try {
      // 1. Negotiate via proxy (configured in Vite to bypass browser CORS)
      const negotiateUrl = '/f1-signalr/negotiate?negotiateVersion=1';
      const res = await fetch(negotiateUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Fallo en negociación: HTTP ${res.status}`);
      }

      const negotiateData = await res.json();
      const token = negotiateData.connectionToken || negotiateData.connectionId;

      if (!token) {
        throw new Error('Token de conexión no recibido');
      }

      // 2. Open WebSocket connection
      const wsUrl = `wss://livetiming.formula1.com/signalrcore?id=${encodeURIComponent(token)}`;
      this.updateStatus('connecting', 'Conectando...');

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // 3. Send SignalR Core Handshake
        // SignalR Core requires: {"protocol":"json","version":1} followed by record separator 0x1E
        const handshake = JSON.stringify({ protocol: 'json', version: 1 }) + '\x1e';
        this.ws?.send(handshake);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleIncomingRawMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.warn('F1 WebSocket error:', err);
        this.updateStatus('error', 'Reintentando...');
      };

      this.ws.onclose = (ev) => {
        console.log('F1 WebSocket cerrado:', ev.code, ev.reason);
        this.cleanup();
        this.updateStatus('disconnected', 'Desconectado');
        this.scheduleReconnect();
      };

    } catch (err: any) {
      console.warn('F1 Connection Error:', err);
      this.cleanup();
      this.updateStatus('error', 'Reintentando...');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(explicitDelayMs?: number) {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    
    // Exponential backoff with jitter: 2s -> 3.5s -> 6s -> 10s ... max 30s
    const baseDelay = 2000;
    const maxDelay = 30000;
    const factor = Math.min(maxDelay, baseDelay * Math.pow(1.6, this.reconnectAttempts));
    const jitter = Math.random() * 800;
    const delay = explicitDelayMs !== undefined ? explicitDelayMs : Math.round(factor + jitter);

    this.reconnectAttempts++;
    console.info(`[F1SignalR] Programada reconexión en ${(delay / 1000).toFixed(1)}s (intento #${this.reconnectAttempts})`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Process incoming SignalR Core packet chunks separated by record separator \x1E
   */
  private handleIncomingRawMessage(rawData: string) {
    this.lastStreamPacketTime = Date.now();
    this.messageBuffer += rawData;
    const parts = this.messageBuffer.split('\x1e');
    this.messageBuffer = parts.pop() || ''; // Keep incomplete trailing part

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Check if it's the handshake response
      if (trimmed === '{}') {
        this.onHandshakeConfirmed();
        continue;
      }

      try {
        const msg = JSON.parse(trimmed);
        this.handleParsedSignalRMessage(msg);
      } catch (err) {
        console.debug('Failed to parse SignalR frame:', err);
      }
    }
  }

  /**
   * Once handshake is accepted, subscribe to official streaming channels
   */
  private onHandshakeConfirmed() {
    this.reconnectAttempts = 0;
    this.updateStatus('connected', 'Conectado');
    this.startWatchdog();

    // Subscribe to all official streaming topics
    const subscribeMsg = JSON.stringify({
      type: 1, // Invocation
      target: 'Subscribe',
      arguments: [
        [
          'Heartbeat',
          'CarData.z',
          'Position.z',
          'TimingAppData',
          'TimingData',
          'TrackStatus',
          'WeatherData',
          'RaceControlMessages',
          'SessionInfo',
          'SessionData',
          'SessionClock',
          'ExtrapolatedClock',
          'DriverList',
          'TeamRadio',
          'LapCount',
        ],
      ],
    }) + '\x1e';

    this.ws?.send(subscribeMsg);

    // Setup periodic ping (keep-alive)
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('{"type":6}\x1e'); // SignalR Ping
      }
    }, 15000);
  }

  /**
   * Handle incoming parsed SignalR message invocation
   */
  private handleParsedSignalRMessage(msg: any) {
    // Type 1: Invocation from Hub
    if (msg.type === 1 && msg.target === 'feed' && Array.isArray(msg.arguments)) {
      const topic = msg.arguments[0];
      const payload = msg.arguments[1];

      this.lastStreamPacketTime = Date.now();
      if (this.connectionStatus !== 'live_streaming') {
        this.updateStatus('live_streaming', 'Transmitiendo telemetría oficial en directo');
      }

      this.processTopicPayload(topic, payload);
    } 
    // Type 6: Ping message
    else if (msg.type === 6) {
      // Respond or acknowledge ping
    }
  }

  /**
   * Process and decompress topics if needed
   */
  private processTopicPayload(topic: string, payload: any) {
    try {
      let data = payload;

      // Compressed topics end with .z (e.g., CarData.z, Position.z)
      if (topic.endsWith('.z') && typeof payload === 'string') {
        const decompressed = this.decompressPayload(payload);
        if (decompressed) {
          try {
            data = JSON.parse(decompressed);
          } catch {
            data = decompressed;
          }
        }
      }

      // Dispatch to registered listener
      switch (topic) {
        case 'CarData.z':
        case 'CarData':
          this.listeners.onCarData?.(data);
          break;

        case 'Position.z':
        case 'Position':
          this.listeners.onPositionData?.(data);
          break;

        case 'TimingData':
        case 'TimingAppData':
          this.listeners.onTimingData?.(data);
          break;

        case 'TrackStatus':
          this.handleTrackStatus(data);
          break;

        case 'WeatherData':
          this.handleWeatherData(data);
          break;

        case 'RaceControlMessages':
          if (typeof data === 'object') {
            const rawStr = JSON.stringify(data).toLowerCase();
            if (rawStr.includes('chequered flag') || rawStr.includes('session finished') || rawStr.includes('ended')) {
              standingsSyncService.triggerRaceFinished();
            }
          }
          this.handleRaceControl(data);
          break;

        case 'ExtrapolatedClock':
        case 'SessionClock':
          this.listeners.onClock?.(data);
          break;

        case 'SessionInfo':
          if (data?.ArchiveStatus?.Status === 'Complete' || data?.Status === 'Finalised' || data?.SessionStatus === 'Finished') {
            standingsSyncService.triggerRaceFinished();
          }
          scheduleSyncService.updateFromSignalRSessionInfo(data);
          this.listeners.onSessionInfo?.(data);
          break;

        default:
          break;
      }
    } catch (err) {
      console.warn(`Error processing topic ${topic}:`, err);
    }
  }

  /**
   * Decompress Base64 Deflate stream using pako
   */
  private decompressPayload(base64Str: string): string | null {
    try {
      const binary = atob(base64Str);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      try {
        return new TextDecoder().decode(inflate(bytes));
      } catch {
        return new TextDecoder().decode(inflateRaw(bytes));
      }
    } catch (err) {
      console.error('Failed to decompress F1 packet:', err);
      return null;
    }
  }

  private handleTrackStatus(data: any) {
    if (!data) return;
    const statusCode = String(data.Status || data.status || '1');
    const msgMap: Record<string, string> = {
      '1': 'PISTA VERDE',
      '2': 'BANDERA AMARILLA',
      '4': 'SAFETY CAR DESPLEGADO',
      '5': 'BANDERA ROJA',
      '6': 'VIRTUAL SAFETY CAR ACTIVO',
      '7': 'VSC TERMINANDO',
      '8': 'BANDERA A CUADROS (FINALIZADA)',
    };

    if (statusCode === '8' || data.Message?.toLowerCase().includes('finish') || data.Message?.toLowerCase().includes('chequered')) {
      standingsSyncService.triggerRaceFinished();
    }

    this.listeners.onTrackStatus?.({
      status: statusCode,
      message: msgMap[statusCode] || 'PISTA ACTIVA',
    });
  }

  private handleWeatherData(data: any) {
    if (!data) return;
    this.listeners.onWeatherData?.({
      airTemp: parseFloat(data.AirTemp || 25),
      trackTemp: parseFloat(data.TrackTemp || 38),
      humidity: parseFloat(data.Humidity || 50),
      pressure: parseFloat(data.Pressure || 1013),
      windSpeed: parseFloat(data.WindSpeed || 10),
      windDirection: parseFloat(data.WindDirection || 0),
      rainfall: Boolean(data.Rainfall === '1' || data.Rainfall === true),
    });
  }

  private handleRaceControl(data: any) {
    if (!data) return;
    const extractItems = (input: any): any[] => {
      if (!input || typeof input !== 'object') return [];
      if (Array.isArray(input)) return input;
      if (input.Messages) {
        if (Array.isArray(input.Messages)) return input.Messages;
        if (typeof input.Messages === 'object') return Object.values(input.Messages);
      }
      if (input.Message || input.messageEn) return [input];
      const values = Object.values(input);
      const flattened: any[] = [];
      for (const v of values) {
        if (v && typeof v === 'object') {
          const itemObj = v as any;
          if (itemObj.Message || itemObj.messageEn) {
            flattened.push(itemObj);
          } else {
            flattened.push(...extractItems(itemObj));
          }
        }
      }
      return flattened;
    };

    const rawList = extractItems(data);
    const seenKeys = new Set<string>();
    for (const item of rawList) {
      if (item && typeof item === 'object') {
        const rawText = String(item.Message || item.messageEn || '').trim();
        const key = `${item.Utc || ''}_${rawText}_${item.Sector || ''}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        this.listeners.onRaceControl?.(item);
      }
    }
  }

  private startWatchdog() {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    this.watchdogInterval = window.setInterval(() => {
      if (this.connectionStatus === 'connected' || this.connectionStatus === 'live_streaming') {
        const timeSinceLastPacket = Date.now() - this.lastStreamPacketTime;
        // If connected and no packet or heartbeat received for 35s, cleanly reconnect
        if (this.lastStreamPacketTime > 0 && timeSinceLastPacket > 35000) {
          console.warn(`[F1SignalR] Watchdog: No se recibieron paquetes durante ${(timeSinceLastPacket / 1000).toFixed(0)}s. Reconectando...`);
          this.cleanup();
          this.scheduleReconnect(1000);
        }
      }
    }, 10000);
  }

  public disconnect() {
    this.cleanup();
    this.updateStatus('disconnected', 'Desconectado manualmente');
  }

  private cleanup() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.messageBuffer = '';
  }
}

export const f1SignalR = new F1SignalRClient();
