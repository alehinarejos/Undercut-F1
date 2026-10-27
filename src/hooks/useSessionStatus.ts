/**
 * useSessionStatus.ts - F1 Session Lifecycle Completion Evaluator
 *
 * Implements triple-level validation to definitively determine if an F1 session has FINISHED:
 * Level 1: Official F1 feed event (SessionStatus === 'Finished'|'Finalised' or TrackStatus === '4'|'CHEQUERED')
 * Level 2: Official UTC Time Window expiry (now > session.endTimeUtc + 5 min courtesy margin)
 * Level 3: Telemetry Inactivity Fallback (now >= session.endTimeUtc AND >3 min without new timing frames)
 */

import { useState, useEffect, useMemo } from 'react';
import type { TrackStatus } from '../types/telemetry';
import { getEffectiveNowMs } from '../services/scheduleSyncService';

export type SessionFinishReason = 
  | 'OFFICIAL_SIGNAL' 
  | 'UTC_WINDOW_EXPIRED' 
  | 'TELEMETRY_INACTIVITY' 
  | null;

export interface SessionLifecycleParams {
  sessionEndTimeUtc: string; // ISO 8601
  sessionStartTimeUtc?: string; // ISO 8601
  trackStatus?: TrackStatus | string;
  officialSessionStatus?: string; // 'Finished' | 'Finalised' | 'Started' | 'Inactive'
  lastTelemetryTimestampMs?: number;
  courtesyMarginMs?: number; // default: 5 minutes (300,000 ms)
  inactivityThresholdMs?: number; // default: 3 minutes (180,000 ms)
  currentTimeMs?: number;
}

export interface SessionLifecycleResult {
  status: 'LIVE' | 'FINISHED' | 'UPCOMING';
  isFinished: boolean;
  finishReason: SessionFinishReason;
  chequeredFlag: boolean;
  timeRemainingSec: number;
  isOverdue: boolean;
}

/**
 * Pure evaluation function for deterministic testing and zero-overhead invocation
 */
export function evaluateSessionLifecycle(params: SessionLifecycleParams): SessionLifecycleResult {
  const now = params.currentTimeMs ?? getEffectiveNowMs();
  const endMs = new Date(params.sessionEndTimeUtc).getTime();
  const startMs = params.sessionStartTimeUtc ? new Date(params.sessionStartTimeUtc).getTime() : NaN;
  const courtesyMarginMs = params.courtesyMarginMs ?? (5 * 60 * 1000);
  const inactivityThresholdMs = params.inactivityThresholdMs ?? (3 * 60 * 1000);

  // ── NIVEL 1: Tópico Oficial de F1 (SignalR / OpenF1 / Race Control) ──
  const isOfficialSessionFinished = 
    params.officialSessionStatus === 'Finished' || 
    params.officialSessionStatus === 'Finalised' ||
    params.officialSessionStatus === 'Ends';

  const isTrackChequered = 
    params.trackStatus === 'CHEQUERED' || 
    params.trackStatus === '4';

  if (isOfficialSessionFinished || isTrackChequered) {
    return {
      status: 'FINISHED',
      isFinished: true,
      finishReason: 'OFFICIAL_SIGNAL',
      chequeredFlag: true,
      timeRemainingSec: 0,
      isOverdue: true,
    };
  }

  // ── NIVEL 2: Fin de Ventana Horaria Oficial (Fallback por Tiempo UTC) ──
  const isOverdueByUtc = !isNaN(endMs) && (now > endMs + courtesyMarginMs);
  if (isOverdueByUtc) {
    return {
      status: 'FINISHED',
      isFinished: true,
      finishReason: 'UTC_WINDOW_EXPIRED',
      chequeredFlag: true,
      timeRemainingSec: 0,
      isOverdue: true,
    };
  }

  // ── NIVEL 3: Inactividad Prolongada de Telemetría tras Fin Teórico ──
  if (!isNaN(endMs) && now >= endMs) {
    const lastTele = params.lastTelemetryTimestampMs ?? 0;
    const isInactive = (now - lastTele) > inactivityThresholdMs;
    if (isInactive) {
      return {
        status: 'FINISHED',
        isFinished: true,
        finishReason: 'TELEMETRY_INACTIVITY',
        chequeredFlag: true,
        timeRemainingSec: 0,
        isOverdue: true,
      };
    }
  }

  // Session still before start
  if (!isNaN(startMs) && now < startMs) {
    const rem = Math.max(0, Math.floor((startMs - now) / 1000));
    return {
      status: 'UPCOMING',
      isFinished: false,
      finishReason: null,
      chequeredFlag: false,
      timeRemainingSec: rem,
      isOverdue: false,
    };
  }

  // Session currently within live window
  const remSec = !isNaN(endMs) ? Math.max(0, Math.floor((endMs - now) / 1000)) : 0;
  return {
    status: remSec > 0 ? 'LIVE' : 'FINISHED',
    isFinished: remSec <= 0,
    finishReason: remSec <= 0 ? 'UTC_WINDOW_EXPIRED' : null,
    chequeredFlag: remSec <= 0,
    timeRemainingSec: remSec,
    isOverdue: remSec <= 0,
  };
}

/**
 * React Hook: Continuously evaluates session lifecycle status with 1-second cadence
 */
export function useSessionStatus(params: SessionLifecycleParams): SessionLifecycleResult {
  const [tick, setTick] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const evalResult = useMemo(() => {
    // Reference tick so memo recalculates every second
    void tick;
    return evaluateSessionLifecycle(params);
  }, [
    tick,
    params.sessionEndTimeUtc,
    params.sessionStartTimeUtc,
    params.trackStatus,
    params.officialSessionStatus,
    params.lastTelemetryTimestampMs,
    params.courtesyMarginMs,
    params.inactivityThresholdMs,
    params.currentTimeMs,
  ]);

  return evalResult;
}
