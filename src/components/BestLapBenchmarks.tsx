import React from 'react';
import { Timer, HelpCircle, TrendingUp, TrendingDown, Zap, Trophy, Award } from 'lucide-react';
import { TeamLogo } from './TeamLogo';
import type { LeaderboardEntry, CircuitInfo } from '../types/telemetry';

interface BestLapBenchmarksProps {
  entries: LeaderboardEntry[];
  sessionName?: string;
  circuitName?: string;
  circuit?: CircuitInfo;
}

export const BestLapBenchmarks: React.FC<BestLapBenchmarksProps> = ({
  entries,
  sessionName = 'Practice 3',
  circuitName: _circuitName = 'Madrid',
  circuit,
}) => {
  // Helper to parse lap time to seconds
  const parseTimeToSec = (t?: string): number => {
    if (!t || t.includes('-') || t.includes('DNF') || t.trim() === '') return Infinity;
    const clean = t.replace('+', '').trim();
    const parts = clean.split(':');
    if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(clean) || Infinity;
  };

  // Format seconds to mm:ss.sss
  const formatSecToTime = (val: number): string => {
    if (val === Infinity || isNaN(val)) return '--:--.---';
    const mins = Math.floor(val / 60);
    const secs = (val % 60).toFixed(3);
    return `${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
  };

  // Find overall session best driver
  let sessionBestEntry: LeaderboardEntry | null = null;
  let minSec = Infinity;

  for (const entry of entries) {
    const s = parseTimeToSec(entry.bestLapTime);
    if (s < minSec) {
      minSec = s;
      sessionBestEntry = entry;
    }
  }

  // Circuit all-time record
  const circuitRecordTimeStr = circuit?.lapRecord?.time || '1:32.450';
  const circuitRecordSec = parseTimeToSec(circuitRecordTimeStr);
  const circuitRecordHolder = circuit?.lapRecord?.driver 
    ? `${circuit?.lapRecord.driver} (${circuit?.lapRecord.year || 2026})`
    : 'K. Antonelli, 2026';

  // Weekend fastest lap benchmark:
  // Base weekend benchmark (from earlier sessions like FP2 or Qualy)
  const baseWeekendSec = circuit?.id === 'monza' ? 80.520 : 92.890;
  // If current session is faster, weekend fastest is the current session fastest!
  const weekendFastestSec = minSec !== Infinity && minSec < baseWeekendSec ? minSec : baseWeekendSec;
  const isCurrentSessionWeekendFastest = minSec !== Infinity && minSec <= baseWeekendSec;
  const weekendDriverInfo = isCurrentSessionWeekendFastest && sessionBestEntry
    ? `${sessionBestEntry.driver.code} (${sessionName})`
    : (circuit?.id === 'monza' ? 'M. Verstappen (Practice 2)' : 'C. Leclerc (Practice 2)');

  // Format benchmark delta relative to session best
  const renderDeltaBadge = (benchmarkSec: number) => {
    if (minSec === Infinity) {
      return (
        <span style={{
          fontSize: '0.66rem',
          fontFamily: 'var(--font-mono)',
          color: '#94a3b8',
          background: 'rgba(255, 255, 255, 0.08)',
          padding: '2px 7px',
          borderRadius: '4px',
          fontWeight: 700,
        }}>
          +0.000s
        </span>
      );
    }
    const delta = minSec - benchmarkSec;
    const isSlower = delta > 0;
    const sign = isSlower ? '+' : '-';
    const text = `${sign}${Math.abs(delta).toFixed(3)}s`;

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize: '0.68rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: 800,
        padding: '2px 8px',
        borderRadius: '4px',
        color: isSlower ? '#f87171' : '#34d399',
        background: isSlower ? 'rgba(239, 68, 68, 0.16)' : 'rgba(16, 185, 129, 0.16)',
        border: `1px solid ${isSlower ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
      }}>
        {isSlower ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {text}
      </span>
    );
  };

  return (
    <div className="f1-card best-lap-benchmarks-card" style={{
      background: 'rgba(10, 10, 12, 0.94)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Timer size={18} color="#d354ff" />
          <span style={{
            fontSize: '0.90rem',
            fontWeight: 800,
            color: '#f8fafc',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.02em',
          }}>
            Best Lap Benchmarks
          </span>
        </div>
        <span title="Puntos de referencia de tiempos oficiales" style={{ display: 'inline-flex', cursor: 'pointer' }}>
          <HelpCircle size={15} color="#64748b" />
        </span>
      </div>

      {/* 1. MEJOR VUELTA DE ESA SESIÓN (Session Best - Morado) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(211, 84, 255, 0.14) 0%, rgba(147, 51, 234, 0.07) 100%)',
        border: '1.5px solid rgba(211, 84, 255, 0.35)',
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={13} color="#d354ff" />
            <span style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              color: '#d8b4fe',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              MEJOR VUELTA DE LA SESIÓN
            </span>
          </div>
          <span style={{
            fontSize: '0.62rem',
            fontWeight: 800,
            color: '#d354ff',
            background: 'rgba(211, 84, 255, 0.18)',
            padding: '1px 6px',
            borderRadius: '3px',
            fontFamily: 'var(--font-mono)',
          }}>
            P1 ACTUAL
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.65rem',
            fontWeight: 900,
            color: '#d354ff',
            letterSpacing: '0.02em',
            textShadow: '0 0 14px rgba(211, 84, 255, 0.5)',
            lineHeight: 1.1,
          }}>
            {sessionBestEntry?.bestLapTime || '1:34.284'}
          </span>

          {sessionBestEntry && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TeamLogo team={sessionBestEntry.driver.team} size={28} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.98rem',
                  fontWeight: 900,
                  color: '#f8fafc',
                  lineHeight: 1,
                }}>
                  {sessionBestEntry.driver.code}
                </span>
                <span style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                  {sessionBestEntry.driver.lastName}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. MEJOR VUELTA DE TODAS LAS SESIONES DE ESE FINDE (Weekend Fastest Lap) */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '9px',
        padding: '11px 15px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={13} color="#38bdf8" />
            <span style={{
              fontSize: '0.64rem',
              fontWeight: 800,
              color: '#94a3b8',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              MEJOR VUELTA DEL FIN DE SEMANA
            </span>
          </div>
          <span style={{
            fontSize: '0.58rem',
            fontFamily: 'var(--font-mono)',
            color: '#38bdf8',
            background: 'rgba(56, 189, 248, 0.12)',
            padding: '1px 5px',
            borderRadius: '3px',
            fontWeight: 700,
          }}>
            FINDE COMPLETO
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.12rem', fontWeight: 800, color: '#f1f5f9' }}>
            {formatSecToTime(weekendFastestSec)}
          </span>
          {renderDeltaBadge(weekendFastestSec)}
        </div>
        <span style={{ fontSize: '0.70rem', color: '#64748b' }}>
          {weekendDriverInfo}
        </span>
      </div>

      {/* 3. VUELTA MÁS RÁPIDA DE ESE CIRCUITO (Circuit All-Time Record) */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '9px',
        padding: '11px 15px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trophy size={13} color="#fbbf24" />
            <span style={{
              fontSize: '0.64rem',
              fontWeight: 800,
              color: '#94a3b8',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              RÉCORD HISTÓRICO DEL CIRCUITO
            </span>
          </div>
          <span style={{
            fontSize: '0.58rem',
            fontFamily: 'var(--font-mono)',
            color: '#fbbf24',
            background: 'rgba(251, 191, 36, 0.12)',
            padding: '1px 5px',
            borderRadius: '3px',
            fontWeight: 700,
          }}>
            HISTÓRICO
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.12rem', fontWeight: 800, color: '#f1f5f9' }}>
            {circuitRecordTimeStr}
          </span>
          {renderDeltaBadge(circuitRecordSec)}
        </div>
        <span style={{ fontSize: '0.70rem', color: '#64748b' }}>
          {circuitRecordHolder}
        </span>
      </div>
    </div>
  );
};
