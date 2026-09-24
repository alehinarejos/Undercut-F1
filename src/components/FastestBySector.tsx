import React from 'react';
import { Zap, Award } from 'lucide-react';
import { TeamLogo } from './TeamLogo';
import type { LeaderboardEntry } from '../types/telemetry';

interface FastestBySectorProps {
  entries: LeaderboardEntry[];
}

export const FastestBySector: React.FC<FastestBySectorProps> = ({ entries }) => {
  const parseSec = (t?: string): number => {
    if (!t || t.includes('-') || t.trim() === '') return Infinity;
    const clean = t.replace('+', '').trim();
    const parts = clean.split(':');
    if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(clean) || Infinity;
  };

  const formatSec = (val: number): string => {
    if (val === Infinity || isNaN(val)) return '--.---';
    const mins = Math.floor(val / 60);
    const secs = (val % 60).toFixed(3);
    if (mins > 0) {
      return `${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
    }
    return secs;
  };

  // Find best driver for Sector 1 (using s1BestTime and s1Time)
  let s1BestVal = Infinity;
  let s1BestEntry: LeaderboardEntry | null = null;
  for (const e of entries) {
    const v = Math.min(parseSec(e.s1BestTime), parseSec(e.s1Time));
    if (v < s1BestVal) {
      s1BestVal = v;
      s1BestEntry = e;
    }
  }

  // Find best driver for Sector 2 (using s2BestTime and s2Time)
  let s2BestVal = Infinity;
  let s2BestEntry: LeaderboardEntry | null = null;
  for (const e of entries) {
    const v = Math.min(parseSec(e.s2BestTime), parseSec(e.s2Time));
    if (v < s2BestVal) {
      s2BestVal = v;
      s2BestEntry = e;
    }
  }

  // Find best driver for Sector 3 (using s3BestTime and s3Time)
  let s3BestVal = Infinity;
  let s3BestEntry: LeaderboardEntry | null = null;
  for (const e of entries) {
    const v = Math.min(parseSec(e.s3BestTime), parseSec(e.s3Time));
    if (v < s3BestVal) {
      s3BestVal = v;
      s3BestEntry = e;
    }
  }

  // Theoretical best lap
  const theoreticalSec = (s1BestVal !== Infinity && s2BestVal !== Infinity && s3BestVal !== Infinity)
    ? s1BestVal + s2BestVal + s3BestVal
    : null;

  return (
    <div className="f1-card fastest-by-sector-card" style={{
      background: 'rgba(10, 10, 12, 0.94)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '10px',
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        paddingBottom: '6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Zap size={15} color="#d354ff" />
          <span style={{
            fontSize: '0.80rem',
            fontWeight: 800,
            color: '#f8fafc',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.02em',
          }}>
            Fastest by Sector
          </span>
        </div>
        <span style={{
          fontSize: '0.58rem',
          fontFamily: 'var(--font-mono)',
          color: '#c084fc',
          background: 'rgba(211, 84, 255, 0.12)',
          border: '1px solid rgba(211, 84, 255, 0.25)',
          padding: '1px 6px',
          borderRadius: '3px',
          fontWeight: 700,
        }}>
          PURPLE SECTORS
        </span>
      </div>

      {/* Sector Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* S1 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          padding: '6px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.66rem',
              fontWeight: 800,
              color: '#94a3b8',
              width: '24px',
            }}>
              S1
            </span>
            {s1BestEntry && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TeamLogo team={s1BestEntry.driver.team} size={18} />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  color: '#f1f5f9',
                }}>
                  {s1BestEntry.driver.code}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                  {s1BestEntry.driver.lastName}
                </span>
              </div>
            )}
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            fontWeight: 900,
            color: '#d354ff',
            textShadow: '0 0 8px rgba(211, 84, 255, 0.4)',
          }}>
            {s1BestVal !== Infinity ? formatSec(s1BestVal) : (s1BestEntry?.s1BestTime || s1BestEntry?.s1Time || '35.840')}
          </span>
        </div>

        {/* S2 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          padding: '6px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.66rem',
              fontWeight: 800,
              color: '#94a3b8',
              width: '24px',
            }}>
              S2
            </span>
            {s2BestEntry && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TeamLogo team={s2BestEntry.driver.team} size={18} />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  color: '#f1f5f9',
                }}>
                  {s2BestEntry.driver.code}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                  {s2BestEntry.driver.lastName}
                </span>
              </div>
            )}
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            fontWeight: 900,
            color: '#d354ff',
            textShadow: '0 0 8px rgba(211, 84, 255, 0.4)',
          }}>
            {s2BestVal !== Infinity ? formatSec(s2BestVal) : (s2BestEntry?.s2BestTime || s2BestEntry?.s2Time || '41.120')}
          </span>
        </div>

        {/* S3 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          padding: '6px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.66rem',
              fontWeight: 800,
              color: '#94a3b8',
              width: '24px',
            }}>
              S3
            </span>
            {s3BestEntry && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TeamLogo team={s3BestEntry.driver.team} size={18} />
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  color: '#f1f5f9',
                }}>
                  {s3BestEntry.driver.code}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                  {s3BestEntry.driver.lastName}
                </span>
              </div>
            )}
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            fontWeight: 900,
            color: '#d354ff',
            textShadow: '0 0 8px rgba(211, 84, 255, 0.4)',
          }}>
            {s3BestVal !== Infinity ? formatSec(s3BestVal) : (s3BestEntry?.s3BestTime || s3BestEntry?.s3Time || '25.380')}
          </span>
        </div>
      </div>

      {/* Theoretical Best Lap */}
      {theoreticalSec !== null && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(211, 84, 255, 0.08)',
          border: '1px solid rgba(211, 84, 255, 0.25)',
          borderRadius: '6px',
          padding: '6px 10px',
          marginTop: '2px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={13} color="#d354ff" />
            <span style={{
              fontSize: '0.64rem',
              fontWeight: 700,
              color: '#e2e8f0',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
            }}>
              Optimal Theoretical Lap
            </span>
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.88rem',
            fontWeight: 900,
            color: '#f8fafc',
            letterSpacing: '0.02em',
          }}>
            {formatSec(theoreticalSec)}
          </span>
        </div>
      )}
    </div>
  );
};
