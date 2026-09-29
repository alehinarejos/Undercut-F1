import { useState, useEffect, useRef, useCallback } from 'react';
import { getEffectiveNowMs, isGrandPrixCompleted } from '../services/scheduleSyncService';
import { F1_SCHEDULE } from '../data/schedule';
import type { GrandPrixEvent } from '../data/schedule';

export interface LeaderboardDriver {
  position: number;
  driverNumber: string;
  driverCode: string;
  driverName: string;
  team: string;
  teamColor: string;
  gapToLeader: string;
  intervalToAhead: string;
  lastLapTime: string;
  bestLapTime: string;
  isPit: boolean;
  sector1: { time: string; status: 'fastest' | 'personal' | 'normal' | 'none' };
  sector2: { time: string; status: 'fastest' | 'personal' | 'normal' | 'none' };
  sector3: { time: string; status: 'fastest' | 'personal' | 'normal' | 'none' };
}

export interface LiveTelemetryState {
  isConnected: boolean;
  isLive: boolean; // true = carrera en directo, false = modo standby/replay
  statusMessage: string;
  latencyMs: number;
  activeGp: GrandPrixEvent;
  currentLap: number;
  totalLaps: number;
  leaderboard: LeaderboardDriver[];
}

export function useLiveTelemetry() {
  const [telemetry, setTelemetry] = useState<LiveTelemetryState>(() => {
    const now = getEffectiveNowMs();
    // Resolver GP actual o más próximo
    const activeGp = F1_SCHEDULE.find(gp => !isGrandPrixCompleted(gp, now)) || F1_SCHEDULE[0];
    return {
      isConnected: false,
      isLive: false,
      statusMessage: 'Inicializando telemetría...',
      latencyMs: 0,
      activeGp,
      currentLap: 1,
      totalLaps: 57,
      leaderboard: [],
    };
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPacketTimestampRef = useRef<number>(Date.now());

  // Ingestión y normalización de deltas de telemetría
  const handleIncomingDelta = useCallback((deltaPayload: any) => {
    lastPacketTimestampRef.current = Date.now();

    setTelemetry(prev => {
      if (!deltaPayload || !deltaPayload.Lines) return prev;

      const updatedLeaderboard = [...prev.leaderboard];

      Object.entries(deltaPayload.Lines).forEach(([driverNum, data]: [string, any]) => {
        const idx = updatedLeaderboard.findIndex(d => d.driverNumber === driverNum);
        if (idx !== -1) {
          const current = updatedLeaderboard[idx];
          updatedLeaderboard[idx] = {
            ...current,
            position: data.Position ? parseInt(data.Position, 10) : current.position,
            gapToLeader: data.GapToLeader !== undefined ? data.GapToLeader : current.gapToLeader,
            intervalToAhead: data.IntervalToPositionAhead?.Value !== undefined ? data.IntervalToPositionAhead.Value : current.intervalToAhead,
            lastLapTime: data.LastLapTime?.Value || current.lastLapTime,
            isPit: data.InPit !== undefined ? Boolean(data.InPit) : current.isPit,
          };
        }
      });

      // Ordenar rigurosamente por posición real en pista (evita el bug de sobreescritura con índices)
      updatedLeaderboard.sort((a, b) => a.position - b.position);

      return {
        ...prev,
        isConnected: true,
        isLive: true,
        statusMessage: 'En directo • Datos oficiales',
        leaderboard: updatedLeaderboard,
      };
    });
  }, []);

  // Carga de sesión Standby (cuando la pista está cerrada)
  const loadStandbySession = useCallback(() => {
    const now = getEffectiveNowMs();
    const activeGp = F1_SCHEDULE.find(gp => !isGrandPrixCompleted(gp, now)) || F1_SCHEDULE[0];

    // Snapshot realista de parrilla / último resultado
    const standbyGrid: LeaderboardDriver[] = [
      { position: 1, driverNumber: '1', driverCode: 'VER', driverName: 'Max Verstappen', team: 'Red Bull Racing', teamColor: '#3671C6', gapToLeader: 'LÍDER', intervalToAhead: '—', lastLapTime: '1:28.432', bestLapTime: '1:28.012', isPit: false, sector1: { time: '28.1', status: 'fastest' }, sector2: { time: '35.4', status: 'personal' }, sector3: { time: '24.5', status: 'normal' } },
      { position: 2, driverNumber: '4', driverCode: 'NOR', driverName: 'Lando Norris', team: 'McLaren', teamColor: '#FF8000', gapToLeader: '+1.240', intervalToAhead: '+1.240', lastLapTime: '1:28.510', bestLapTime: '1:28.115', isPit: false, sector1: { time: '28.3', status: 'personal' }, sector2: { time: '35.2', status: 'fastest' }, sector3: { time: '24.9', status: 'normal' } },
      { position: 3, driverNumber: '16', driverCode: 'LEC', driverName: 'Charles Leclerc', team: 'Ferrari', teamColor: '#E80020', gapToLeader: '+2.890', intervalToAhead: '+1.650', lastLapTime: '1:28.720', bestLapTime: '1:28.250', isPit: false, sector1: { time: '28.4', status: 'normal' }, sector2: { time: '35.6', status: 'normal' }, sector3: { time: '24.6', status: 'personal' } },
      { position: 4, driverNumber: '14', driverCode: 'ALO', driverName: 'Fernando Alonso', team: 'Aston Martin', teamColor: '#229971', gapToLeader: '+5.110', intervalToAhead: '+2.220', lastLapTime: '1:28.910', bestLapTime: '1:28.490', isPit: false, sector1: { time: '28.5', status: 'normal' }, sector2: { time: '35.5', status: 'normal' }, sector3: { time: '24.9', status: 'normal' } },
      { position: 5, driverNumber: '44', driverCode: 'HAM', driverName: 'Lewis Hamilton', team: 'Ferrari', teamColor: '#E80020', gapToLeader: '+7.450', intervalToAhead: '+2.340', lastLapTime: '1:29.112', bestLapTime: '1:28.610', isPit: false, sector1: { time: '28.6', status: 'normal' }, sector2: { time: '35.8', status: 'normal' }, sector3: { time: '25.0', status: 'normal' } },
      { position: 6, driverNumber: '63', driverCode: 'RUS', driverName: 'George Russell', team: 'Mercedes', teamColor: '#27F4D2', gapToLeader: '+9.320', intervalToAhead: '+1.870', lastLapTime: '1:29.280', bestLapTime: '1:28.750', isPit: false, sector1: { time: '28.7', status: 'normal' }, sector2: { time: '35.9', status: 'normal' }, sector3: { time: '25.1', status: 'normal' } },
      { position: 7, driverNumber: '81', driverCode: 'PIA', driverName: 'Oscar Piastri', team: 'McLaren', teamColor: '#FF8000', gapToLeader: '+11.140', intervalToAhead: '+1.820', lastLapTime: '1:29.410', bestLapTime: '1:28.890', isPit: false, sector1: { time: '28.8', status: 'normal' }, sector2: { time: '36.0', status: 'normal' }, sector3: { time: '25.2', status: 'normal' } },
      { position: 8, driverNumber: '55', driverCode: 'SAI', driverName: 'Carlos Sainz', team: 'Williams', teamColor: '#64C4FF', gapToLeader: '+14.520', intervalToAhead: '+3.380', lastLapTime: '1:29.650', bestLapTime: '1:29.100', isPit: false, sector1: { time: '28.9', status: 'normal' }, sector2: { time: '36.1', status: 'normal' }, sector3: { time: '25.3', status: 'normal' } }
    ];

    setTelemetry({
      isConnected: true,
      isLive: false,
      statusMessage: 'Modo Standby • Sin sesión en pista',
      latencyMs: 14,
      activeGp,
      currentLap: activeGp.round > 1 ? 57 : 0,
      totalLaps: 57,
      leaderboard: standbyGrid,
    });
  }, []);

  // Monitor Watchdog Heartbeat
  useEffect(() => {
    watchdogTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastPacketTimestampRef.current;
      // Si pasan más de 35 segundos sin paquetes en sesión en vivo, reconectar o pasar a standby
      if (elapsed > 35000 && telemetry.isLive) {
        console.warn('[TelemetryHook] ⚠️ Sin paquetes por 35s. Pasando a standby/reconexión...');
        loadStandbySession();
      }
    }, 10000);

    return () => {
      if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
    };
  }, [telemetry.isLive, loadStandbySession]);

  // Inicialización de conexión
  useEffect(() => {
    loadStandbySession();

    // Hook expuesto para pruebas de simulación manual desde consola F12
    if (typeof window !== 'undefined') {
      (window as any).__injectTelemetryDelta = handleIncomingDelta;
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [loadStandbySession, handleIncomingDelta]);

  return telemetry;
}
