import React from 'react';
import { AlertTriangle, Flag, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { RaceControlMessage } from '../types/telemetry';

interface TrackFlagIndicatorProps {
  trackStatus: string; // 'GREEN' | 'YELLOW' | 'RED' | 'SC' | 'VSC' | 'CHEQUERED'
  messages?: RaceControlMessage[];
}

export const TrackFlagIndicator: React.FC<TrackFlagIndicatorProps> = ({
  trackStatus,
  messages = [],
}) => {
  // Check latest flag message to detect sector details
  const latestFlagMsg = messages.find(m => 
    m.flag === 'YELLOW' || 
    m.flag === 'DOUBLE_YELLOW' || 
    m.flag === 'RED' || 
    m.category === 'FLAG' ||
    m.category === 'SAFETY_CAR'
  );

  // Determine active flag state
  let flagType: 'GREEN' | 'YELLOW' | 'DOUBLE_YELLOW' | 'RED' | 'SC' | 'VSC' | 'CHEQUERED' = 'GREEN';
  let sectorDetail = '';

  if (trackStatus === 'RED' || latestFlagMsg?.flag === 'RED') {
    flagType = 'RED';
    sectorDetail = 'SESIÓN DETENIDA';
  } else if (trackStatus === 'SC' || latestFlagMsg?.category === 'SAFETY_CAR') {
    flagType = 'SC';
    sectorDetail = 'SAFETY CAR';
  } else if (trackStatus === 'VSC') {
    flagType = 'VSC';
    sectorDetail = 'VIRTUAL SAFETY CAR';
  } else if (trackStatus === 'CHEQUERED') {
    flagType = 'CHEQUERED';
    sectorDetail = 'SESIÓN FINALIZADA';
  } else if (trackStatus === 'YELLOW' || latestFlagMsg?.flag === 'YELLOW' || latestFlagMsg?.flag === 'DOUBLE_YELLOW') {
    flagType = latestFlagMsg?.flag === 'DOUBLE_YELLOW' ? 'DOUBLE_YELLOW' : 'YELLOW';
    if (latestFlagMsg?.scope && latestFlagMsg.scope.toLowerCase().includes('sector')) {
      sectorDetail = latestFlagMsg.scope.toUpperCase();
    } else if (latestFlagMsg?.messageEn && latestFlagMsg.messageEn.toLowerCase().includes('sector')) {
      const match = latestFlagMsg.messageEn.match(/sector\s*([0-9]+)/i);
      sectorDetail = match ? `SEC ${match[1]}` : 'SEC 2';
    } else {
      sectorDetail = 'SEC 2';
    }
  } else {
    flagType = 'GREEN';
    sectorDetail = 'PISTA DESPEJADA';
  }

  const isYellow = flagType === 'YELLOW' || flagType === 'DOUBLE_YELLOW';

  // Detect which sector(s) specifically have a yellow flag
  const yellowSectors: number[] = [];
  if (isYellow) {
    // Check if sector 1, 2, or 3 is indicated
    const msgText = ((latestFlagMsg?.messageEn || '') + ' ' + (latestFlagMsg?.messageEs || '') + ' ' + sectorDetail).toLowerCase();
    const sectorMatch = msgText.match(/sector\s*([0-9]+)/);
    if (sectorMatch) {
      const secNum = parseInt(sectorMatch[1], 10);
      if (secNum <= 3) {
        yellowSectors.push(secNum);
      } else {
        // Map marshal sectors (e.g. 1-8 -> S1, 9-16 -> S2, 17-24 -> S3)
        if (secNum <= 8) yellowSectors.push(1);
        else if (secNum <= 16) yellowSectors.push(2);
        else yellowSectors.push(3);
      }
    } else {
      yellowSectors.push(2); // fallback to sector 2
    }
  }

  const flagColor = flagType === 'RED'
    ? '#fca5a5'
    : isYellow
    ? '#fde047'
    : flagType === 'SC' || flagType === 'VSC'
    ? '#fef08a'
    : flagType === 'CHEQUERED'
    ? '#ffffff'
    : '#6ee7b7';

  const flagTitle = flagType === 'RED'
    ? 'BANDERA ROJA'
    : flagType === 'DOUBLE_YELLOW'
    ? 'DOBLE AMARILLA'
    : flagType === 'YELLOW'
    ? 'BANDERA AMARILLA'
    : flagType === 'SC'
    ? 'SAFETY CAR'
    : flagType === 'VSC'
    ? 'VSC'
    : flagType === 'CHEQUERED'
    ? 'BANDERA A CUADROS'
    : 'BANDERA VERDE';

  return (
    <div 
      className="header-flag-pill"
      title={`${flagTitle}${yellowSectors.length > 0 ? ` • Sector ${yellowSectors.join(', ')}` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '4px 10px',
        borderRadius: '20px',
        height: '32px',
        boxSizing: 'border-box',
        transition: 'all 0.3s ease',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        ...(flagType === 'RED'
          ? {
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.35) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.6)',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
            }
          : isYellow
          ? {
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.3) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.6)',
              boxShadow: '0 0 10px rgba(245, 158, 11, 0.25)',
            }
          : flagType === 'SC' || flagType === 'VSC'
          ? {
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(234, 88, 12, 0.25) 100%)',
              border: '1px solid rgba(251, 191, 36, 0.5)',
            }
          : flagType === 'CHEQUERED'
          ? {
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.10) 0%, rgba(25, 25, 30, 0.85) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }
          : {
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }),
      }}
    >
      {/* Flag Icon */}
      {flagType === 'RED' ? (
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          background: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          flexShrink: 0,
        }}>
          <Flag size={10} />
        </div>
      ) : isYellow ? (
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          background: '#f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000',
          flexShrink: 0,
        }}>
          <AlertTriangle size={10} />
        </div>
      ) : flagType === 'SC' || flagType === 'VSC' ? (
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          background: '#fbbf24',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000',
          flexShrink: 0,
        }}>
          <ShieldAlert size={10} />
        </div>
      ) : flagType === 'CHEQUERED' ? (
        <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>🏁</span>
      ) : (
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          background: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          flexShrink: 0,
        }}>
          <CheckCircle2 size={10} />
        </div>
      )}

      {/* Flag Title */}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.70rem',
        fontWeight: 800,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        color: flagColor,
        whiteSpace: 'nowrap',
      }}>
        {flagTitle}
      </span>

      {/* SOLO se muestran los sectores cuando hay bandera amarilla en ese sector */}
      {isYellow && yellowSectors.length > 0 && (
        <>
          <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            {yellowSectors.map(sec => (
              <span
                key={sec}
                style={{
                  fontSize: '0.58rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: '#f59e0b',
                  color: '#000',
                  border: '1px solid #fbbf24',
                  whiteSpace: 'nowrap',
                }}
              >
                SEC {sec}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
