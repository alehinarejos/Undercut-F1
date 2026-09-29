import { useState, useEffect, useRef, useCallback } from 'react';
import { getEffectiveNowMs, isGrandPrixCompleted } from '../services/scheduleSyncService';
import { F1_SCHEDULE } from '../data/schedule';
import type { GrandPrixEvent } from '../data/schedule';

export type TyreCompoundType = 'Soft' | 'Medium' | 'Hard' | 'Inter' | 'Wet';
export type DriverTrackStatus = 'ON_TRACK' | 'PIT' | 'OUT' | 'DNF' | 'DNS';
export type SectorFlagStatus = 'fastest' | 'personal' | 'normal' | 'none';

export interface SectorInfo {
  time: string;
  status: SectorFlagStatus;
}

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
  tyreCompound: TyreCompoundType;
  tyreAge: number;
  status: DriverTrackStatus;
  isPit: boolean;
  sector1: SectorInfo;
  sector2: SectorInfo;
  sector3: SectorInfo;
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

/**
 * Mock oficial realista de 20 pilotos con tiempos M:SS.mmm, sectores (Púrpura/Verde/Amarillo),
 * compuestos de neumáticos, edad de goma y estados de pista.
 */
export const MOCK_LIVE_GRID_20: LeaderboardDriver[] = [
  { position: 1, driverNumber: '12', driverCode: 'ANT', driverName: 'Kimi Antonelli', team: 'Mercedes', teamColor: '#00D2BE', gapToLeader: 'LÍDER', intervalToAhead: '—', lastLapTime: '1:28.104', bestLapTime: '1:27.912', tyreCompound: 'Medium', tyreAge: 14, status: 'ON_TRACK', isPit: false, sector1: { time: '28.041', status: 'fastest' }, sector2: { time: '35.210', status: 'personal' }, sector3: { time: '24.853', status: 'normal' } },
  { position: 2, driverNumber: '63', driverCode: 'RUS', driverName: 'George Russell', team: 'Mercedes', teamColor: '#00D2BE', gapToLeader: '+1.184', intervalToAhead: '+1.184', lastLapTime: '1:28.290', bestLapTime: '1:28.045', tyreCompound: 'Medium', tyreAge: 14, status: 'ON_TRACK', isPit: false, sector1: { time: '28.115', status: 'personal' }, sector2: { time: '35.188', status: 'fastest' }, sector3: { time: '24.987', status: 'normal' } },
  { position: 3, driverNumber: '44', driverCode: 'HAM', driverName: 'Lewis Hamilton', team: 'Ferrari', teamColor: '#E8002D', gapToLeader: '+2.642', intervalToAhead: '+1.458', lastLapTime: '1:28.412', bestLapTime: '1:28.180', tyreCompound: 'Hard', tyreAge: 18, status: 'ON_TRACK', isPit: false, sector1: { time: '28.190', status: 'normal' }, sector2: { time: '35.312', status: 'personal' }, sector3: { time: '24.910', status: 'personal' } },
  { position: 4, driverNumber: '1', driverCode: 'NOR', driverName: 'Lando Norris', team: 'McLaren', teamColor: '#FF8000', gapToLeader: '+3.915', intervalToAhead: '+1.273', lastLapTime: '1:28.505', bestLapTime: '1:28.210', tyreCompound: 'Medium', tyreAge: 15, status: 'ON_TRACK', isPit: false, sector1: { time: '28.220', status: 'normal' }, sector2: { time: '35.390', status: 'normal' }, sector3: { time: '24.895', status: 'fastest' } },
  { position: 5, driverNumber: '16', driverCode: 'LEC', driverName: 'Charles Leclerc', team: 'Ferrari', teamColor: '#E8002D', gapToLeader: '+5.128', intervalToAhead: '+1.213', lastLapTime: '1:28.640', bestLapTime: '1:28.330', tyreCompound: 'Hard', tyreAge: 19, status: 'ON_TRACK', isPit: false, sector1: { time: '28.280', status: 'normal' }, sector2: { time: '35.420', status: 'normal' }, sector3: { time: '24.940', status: 'normal' } },
  { position: 6, driverNumber: '3', driverCode: 'VER', driverName: 'Max Verstappen', team: 'Red Bull Racing', teamColor: '#17356D', gapToLeader: '+6.490', intervalToAhead: '+1.362', lastLapTime: '1:28.710', bestLapTime: '1:28.402', tyreCompound: 'Hard', tyreAge: 17, status: 'ON_TRACK', isPit: false, sector1: { time: '28.310', status: 'normal' }, sector2: { time: '35.450', status: 'normal' }, sector3: { time: '24.950', status: 'normal' } },
  { position: 7, driverNumber: '81', driverCode: 'PIA', driverName: 'Oscar Piastri', team: 'McLaren', teamColor: '#FF8000', gapToLeader: '+8.012', intervalToAhead: '+1.522', lastLapTime: '1:28.820', bestLapTime: '1:28.515', tyreCompound: 'Medium', tyreAge: 15, status: 'ON_TRACK', isPit: false, sector1: { time: '28.350', status: 'normal' }, sector2: { time: '35.490', status: 'personal' }, sector3: { time: '24.980', status: 'normal' } },
  { position: 8, driverNumber: '14', driverCode: 'ALO', driverName: 'Fernando Alonso', team: 'Aston Martin', teamColor: '#229971', gapToLeader: '+10.340', intervalToAhead: '+2.328', lastLapTime: '1:29.015', bestLapTime: '1:28.690', tyreCompound: 'Medium', tyreAge: 12, status: 'ON_TRACK', isPit: false, sector1: { time: '28.410', status: 'personal' }, sector2: { time: '35.580', status: 'normal' }, sector3: { time: '25.025', status: 'normal' } },
  { position: 9, driverNumber: '55', driverCode: 'SAI', driverName: 'Carlos Sainz', team: 'Williams', teamColor: '#38B6FF', gapToLeader: '+12.118', intervalToAhead: '+1.778', lastLapTime: '1:29.140', bestLapTime: '1:28.810', tyreCompound: 'Soft', tyreAge: 8, status: 'ON_TRACK', isPit: false, sector1: { time: '28.450', status: 'normal' }, sector2: { time: '35.620', status: 'normal' }, sector3: { time: '25.070', status: 'personal' } },
  { position: 10, driverNumber: '10', driverCode: 'GAS', driverName: 'Pierre Gasly', team: 'Alpine', teamColor: '#0085CA', gapToLeader: '+14.890', intervalToAhead: '+2.772', lastLapTime: '1:29.290', bestLapTime: '1:28.950', tyreCompound: 'Hard', tyreAge: 20, status: 'ON_TRACK', isPit: false, sector1: { time: '28.510', status: 'normal' }, sector2: { time: '35.680', status: 'normal' }, sector3: { time: '25.100', status: 'normal' } },
  { position: 11, driverNumber: '6', driverCode: 'HAD', driverName: 'Isack Hadjar', team: 'Red Bull Racing', teamColor: '#17356D', gapToLeader: '+16.420', intervalToAhead: '+1.530', lastLapTime: '1:29.380', bestLapTime: '1:29.020', tyreCompound: 'Medium', tyreAge: 16, status: 'ON_TRACK', isPit: false, sector1: { time: '28.540', status: 'normal' }, sector2: { time: '35.710', status: 'normal' }, sector3: { time: '25.130', status: 'normal' } },
  { position: 12, driverNumber: '30', driverCode: 'LAW', driverName: 'Liam Lawson', team: 'Racing Bulls', teamColor: '#6692FF', gapToLeader: '+18.105', intervalToAhead: '+1.685', lastLapTime: '1:29.450', bestLapTime: '1:29.110', tyreCompound: 'Hard', tyreAge: 21, status: 'ON_TRACK', isPit: false, sector1: { time: '28.570', status: 'normal' }, sector2: { time: '35.730', status: 'normal' }, sector3: { time: '25.150', status: 'normal' } },
  { position: 13, driverNumber: '23', driverCode: 'ALB', driverName: 'Alex Albon', team: 'Williams', teamColor: '#38B6FF', gapToLeader: '+20.890', intervalToAhead: '+2.785', lastLapTime: '1:29.590', bestLapTime: '1:29.240', tyreCompound: 'Medium', tyreAge: 14, status: 'ON_TRACK', isPit: false, sector1: { time: '28.610', status: 'normal' }, sector2: { time: '35.790', status: 'normal' }, sector3: { time: '25.190', status: 'normal' } },
  { position: 14, driverNumber: '27', driverCode: 'HUL', driverName: 'Nico Hülkenberg', team: 'Audi', teamColor: '#A6051A', gapToLeader: '+22.450', intervalToAhead: '+1.560', lastLapTime: '1:29.680', bestLapTime: '1:29.320', tyreCompound: 'Hard', tyreAge: 19, status: 'ON_TRACK', isPit: false, sector1: { time: '28.640', status: 'normal' }, sector2: { time: '35.820', status: 'normal' }, sector3: { time: '25.220', status: 'normal' } },
  { position: 15, driverNumber: '87', driverCode: 'BEA', driverName: 'Oliver Bearman', team: 'Haas', teamColor: '#B6BABD', gapToLeader: '+25.110', intervalToAhead: '+2.660', lastLapTime: '1:29.790', bestLapTime: '1:29.410', tyreCompound: 'Medium', tyreAge: 13, status: 'ON_TRACK', isPit: false, sector1: { time: '28.680', status: 'normal' }, sector2: { time: '35.860', status: 'normal' }, sector3: { time: '25.250', status: 'normal' } },
  { position: 16, driverNumber: '31', driverCode: 'OCO', driverName: 'Esteban Ocon', team: 'Haas', teamColor: '#B6BABD', gapToLeader: '+27.840', intervalToAhead: '+2.730', lastLapTime: '1:29.880', bestLapTime: '1:29.500', tyreCompound: 'Hard', tyreAge: 22, status: 'PIT', isPit: true, sector1: { time: '28.720', status: 'normal' }, sector2: { time: '35.910', status: 'normal' }, sector3: { time: '25.250', status: 'normal' } },
  { position: 17, driverNumber: '43', driverCode: 'COL', driverName: 'Franco Colapinto', team: 'Alpine', teamColor: '#0085CA', gapToLeader: '+29.320', intervalToAhead: '+1.480', lastLapTime: '1:29.960', bestLapTime: '1:29.590', tyreCompound: 'Soft', tyreAge: 7, status: 'ON_TRACK', isPit: false, sector1: { time: '28.750', status: 'normal' }, sector2: { time: '35.930', status: 'normal' }, sector3: { time: '25.280', status: 'normal' } },
  { position: 18, driverNumber: '5', driverCode: 'BOR', driverName: 'Gabriel Bortoleto', team: 'Audi', teamColor: '#A6051A', gapToLeader: '+31.780', intervalToAhead: '+2.460', lastLapTime: '1:30.080', bestLapTime: '1:29.680', tyreCompound: 'Medium', tyreAge: 15, status: 'ON_TRACK', isPit: false, sector1: { time: '28.790', status: 'normal' }, sector2: { time: '35.980', status: 'normal' }, sector3: { time: '25.310', status: 'normal' } },
  { position: 19, driverNumber: '18', driverCode: 'STR', driverName: 'Lance Stroll', team: 'Aston Martin', teamColor: '#229971', gapToLeader: '+35.120', intervalToAhead: '+3.340', lastLapTime: '1:30.250', bestLapTime: '1:29.820', tyreCompound: 'Hard', tyreAge: 20, status: 'ON_TRACK', isPit: false, sector1: { time: '28.840', status: 'normal' }, sector2: { time: '36.040', status: 'normal' }, sector3: { time: '25.370', status: 'normal' } },
  { position: 20, driverNumber: '77', driverCode: 'BOT', driverName: 'Valtteri Bottas', team: 'Cadillac', teamColor: '#C8A84E', gapToLeader: 'DNF', intervalToAhead: 'OUT', lastLapTime: '1:30.490', bestLapTime: '1:29.950', tyreCompound: 'Soft', tyreAge: 5, status: 'DNF', isPit: true, sector1: { time: '28.910', status: 'normal' }, sector2: { time: '36.120', status: 'normal' }, sector3: { time: '—', status: 'none' } },
];

export function useLiveTelemetry() {
  const [telemetry, setTelemetry] = useState<LiveTelemetryState>(() => {
    const now = getEffectiveNowMs();
    const activeGp = F1_SCHEDULE.find(gp => !isGrandPrixCompleted(gp, now)) || F1_SCHEDULE[0];
    return {
      isConnected: true,
      isLive: false,
      statusMessage: 'Modo Dual • Telemetría Activa',
      latencyMs: 12,
      activeGp,
      currentLap: 14,
      totalLaps: 57,
      leaderboard: MOCK_LIVE_GRID_20,
    };
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPacketTimestampRef = useRef<number>(Date.now());

  // Ingestión y normalización de deltas de telemetría (soporta diccionarios C# y arrays)
  const handleIncomingDelta = useCallback((deltaPayload: any) => {
    lastPacketTimestampRef.current = Date.now();

    setTelemetry(prev => {
      if (!deltaPayload || !deltaPayload.Lines) return prev;

      const updatedLeaderboard = [...prev.leaderboard];

      Object.entries(deltaPayload.Lines).forEach(([driverNum, data]: [string, any]) => {
        const idx = updatedLeaderboard.findIndex(
          d => d.driverNumber === driverNum || d.driverCode === driverNum
        );
        if (idx !== -1) {
          const current = updatedLeaderboard[idx];
          const inPit = data.InPit !== undefined ? Boolean(data.InPit) : current.isPit;
          const status: DriverTrackStatus = data.Retired
            ? 'DNF'
            : inPit
            ? 'PIT'
            : current.status;

          updatedLeaderboard[idx] = {
            ...current,
            position: data.Position ? parseInt(data.Position, 10) : current.position,
            gapToLeader: data.GapToLeader !== undefined ? data.GapToLeader : current.gapToLeader,
            intervalToAhead: data.IntervalToPositionAhead?.Value !== undefined ? data.IntervalToPositionAhead.Value : current.intervalToAhead,
            lastLapTime: data.LastLapTime?.Value || current.lastLapTime,
            bestLapTime: data.BestLapTime?.Value || current.bestLapTime,
            isPit: inPit,
            status,
          };
        }
      });

      // Ordenar rigurosamente por posición real en pista
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

  // Carga de sesión Standby / Dual Mode (cuando la pista está cerrada)
  const loadStandbySession = useCallback(() => {
    const now = getEffectiveNowMs();
    const activeGp = F1_SCHEDULE.find(gp => !isGrandPrixCompleted(gp, now)) || F1_SCHEDULE[0];

    setTelemetry({
      isConnected: true,
      isLive: false,
      statusMessage: 'Modo Dual • Telemetría Activa',
      latencyMs: 14,
      activeGp,
      currentLap: 14,
      totalLaps: 57,
      leaderboard: MOCK_LIVE_GRID_20,
    });
  }, []);

  // Monitor Watchdog Heartbeat
  useEffect(() => {
    watchdogTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastPacketTimestampRef.current;
      if (elapsed > 35000 && telemetry.isLive) {
        console.warn('[TelemetryHook] ⚠️ Sin paquetes por 35s. Conmutando a Modo Dual...');
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

    // Hooks expuestos para pruebas de simulación manual desde consola F12
    if (typeof window !== 'undefined') {
      (window as any).__injectTelemetryDelta = handleIncomingDelta;
      (window as any).__MOCK_LIVE_GRID_20 = MOCK_LIVE_GRID_20;
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [loadStandbySession, handleIncomingDelta]);

  return telemetry;
}
