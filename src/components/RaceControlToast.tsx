import React, { useState, useEffect, useRef } from 'react';
import { 
  Flag, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle2, 
  Car, 
  Ban, 
  Disc, 
  CloudRain, 
  Info, 
  X 
} from 'lucide-react';
import type { RaceControlMessage } from '../types/telemetry';
import { useLanguage } from '../context/LanguageContext';

interface RaceControlToastProps {
  messages: RaceControlMessage[];
}

interface ActiveToast {
  id: string;
  message: RaceControlMessage;
  addedAt: number;
}

const TOAST_DURATION_MS = 5500;

export const RaceControlToast: React.FC<RaceControlToastProps> = ({ messages }) => {
  const { language } = useLanguage();
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isInitialMount = useRef<boolean>(true);

  // Helper to clean message text if any raw JSON or formatting slipped in
  const cleanText = (txt?: string): string => {
    if (!txt) return '';
    const trimmed = txt.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          if (parsed.Message) return String(parsed.Message);
          if (parsed.messageEn) return String(parsed.messageEn);
          const firstVal = Object.values(parsed)[0] as any;
          if (typeof firstVal === 'string') return firstVal;
          if (firstVal && typeof firstVal === 'object' && (firstVal.Message || firstVal.messageEn)) {
            return String(firstVal.Message || firstVal.messageEn);
          }
        }
      } catch {}
    }
    return txt;
  };

  // Listen to new messages
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    if (isInitialMount.current) {
      // On initial page load, record all existing messages so we don't trigger 20 historical toasts
      messages.forEach(m => seenIdsRef.current.add(m.id));
      isInitialMount.current = false;
      return;
    }

    // Find genuinely new messages that arrived after mount
    const newItems: RaceControlMessage[] = [];
    for (const msg of messages) {
      if (!seenIdsRef.current.has(msg.id)) {
        seenIdsRef.current.add(msg.id);
        newItems.push(msg);
      }
    }

    if (newItems.length > 0) {
      // Add up to 3 most recent new toasts
      const toAdd: ActiveToast[] = newItems.slice(0, 3).map(m => ({
        id: m.id,
        message: m,
        addedAt: Date.now(),
      }));

      setToasts(prev => {
        const combined = [...toAdd, ...prev];
        return combined.slice(0, 4); // Max 4 on screen at once
      });
    }
  }, [messages]);

  // Dismiss toast handler
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Auto-dismiss ticker
  useEffect(() => {
    if (toasts.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.addedAt < TOAST_DURATION_MS));
    }, 300);

    return () => clearInterval(interval);
  }, [toasts]);

  // Style resolver based on message type, category and content
  const getToastConfig = (msg: RaceControlMessage) => {
    const rawEn = cleanText(msg.messageEn).toUpperCase();
    const rawEs = cleanText(msg.messageEs).toUpperCase();
    const combined = `${rawEn} ${rawEs}`;
    const flag = msg.flag;

    // 1. Red Flag
    if (flag === 'RED' || combined.includes('RED FLAG') || combined.includes('BANDERA ROJA')) {
      return {
        title: 'BANDERA ROJA',
        subtitle: 'SESIÓN DETENIDA',
        icon: AlertOctagon,
        borderColor: '#ef4444',
        glowColor: 'rgba(239, 68, 68, 0.45)',
        bgGradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.28) 0%, rgba(15, 17, 23, 0.98) 100%)',
        accentColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.25)',
        badgeText: '#ef4444',
        pulse: true,
      };
    }

    // 2. Safety Car / VSC
    if (msg.category === 'SAFETY_CAR' || combined.includes('SAFETY CAR') || combined.includes('VSC') || combined.includes('VIRTUAL SAFETY CAR')) {
      const isVsc = combined.includes('VSC') || combined.includes('VIRTUAL');
      const isEnding = combined.includes('ENDING') || combined.includes('FINALIZANDO') || combined.includes('IN THIS LAP');
      return {
        title: isVsc ? 'VIRTUAL SAFETY CAR' : 'SAFETY CAR',
        subtitle: isEnding ? 'ENTRANDO EN BOXES' : 'DESPLEGADO EN PISTA',
        icon: Car,
        borderColor: '#facc15',
        glowColor: 'rgba(250, 204, 21, 0.40)',
        bgGradient: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(15, 17, 23, 0.98) 100%)',
        accentColor: '#facc15',
        badgeBg: 'rgba(250, 204, 21, 0.24)',
        badgeText: '#facc15',
        pulse: !isEnding,
      };
    }

    // 3. Double Yellow Flag
    if (flag === 'DOUBLE_YELLOW' || combined.includes('DOUBLE YELLOW') || combined.includes('DOBLE BANDERA AMARILLA') || combined.includes('DOBLE AMARILLA')) {
      return {
        title: 'DOBLE BANDERA AMARILLA',
        subtitle: msg.sector ? `SECTOR ${msg.sector}` : 'PELIGRO MÁXIMO',
        icon: AlertTriangle,
        borderColor: '#f59e0b',
        glowColor: 'rgba(245, 158, 11, 0.38)',
        bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.24) 0%, rgba(15, 17, 23, 0.98) 100%)',
        accentColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.24)',
        badgeText: '#f59e0b',
        pulse: true,
      };
    }

    // 4. Yellow Flag
    if (flag === 'YELLOW' || combined.includes('YELLOW') || combined.includes('AMARILLA')) {
      return {
        title: 'BANDERA AMARILLA',
        subtitle: msg.sector ? `SECTOR ${msg.sector}` : 'PELIGRO EN PISTA',
        icon: Flag,
        borderColor: '#fbbf24',
        glowColor: 'rgba(251, 191, 36, 0.35)',
        bgGradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.20) 0%, rgba(15, 17, 23, 0.98) 100%)',
        accentColor: '#fbbf24',
        badgeBg: 'rgba(251, 191, 36, 0.22)',
        badgeText: '#fbbf24',
        pulse: false,
      };
    }

    // 5. Track Clear / Green Flag
    if (flag === 'GREEN' || combined.includes('CLEAR') || combined.includes('DESPEJADA') || combined.includes('GREEN FLAG') || combined.includes('BANDERA VERDE')) {
      return {
        title: 'PISTA DESPEJADA',
        subtitle: msg.sector ? `SECTOR ${msg.sector}` : 'BANDERA VERDE',
        icon: CheckCircle2,
        borderColor: '#00e676',
        glowColor: 'rgba(0, 230, 118, 0.35)',
        bgGradient: 'linear-gradient(135deg, rgba(0, 230, 118, 0.18) 0%, rgba(15, 17, 23, 0.98) 100%)',
        accentColor: '#00e676',
        badgeBg: 'rgba(0, 230, 118, 0.20)',
        badgeText: '#00e676',
        pulse: false,
      };
    }

    // 6. Chequered Flag
    if (flag === 'CHEQUERED' || combined.includes('CHEQUERED') || combined.includes('A CUADROS') || combined.includes('FINALIZADA')) {
      return {
        title: 'BANDERA A CUADROS',
        subtitle: 'SESIÓN FINALIZADA',
        icon: Flag,
        borderColor: '#f8fafc',
        glowColor: 'rgba(255, 255, 255, 0.35)',
        bgGradient: 'linear-gradient(135deg, rgba(255, 255, 255, 0.20) 0%, rgba(15, 17, 23, 0.98) 100%)',
        accentColor: '#f8fafc',
        badgeBg: 'rgba(255, 255, 255, 0.22)',
        badgeText: '#f8fafc',
        pulse: false,
      };
    }

    // 7. Track Limits / Lap Deleted / Penalty
    if (combined.includes('TRACK LIMITS') || combined.includes('LAP DELETED') || combined.includes('VUELTA ANULADA') || combined.includes('LÍMITES DE PISTA') || combined.includes('PENALTY') || combined.includes('SANCIÓN')) {
      return {
        title: 'LÍMITES DE PISTA',
        subtitle: 'VUELTA ANULADA',
        icon: Ban,
        borderColor: '#f97316',
        glowColor: 'rgba(249, 115, 22, 0.40)',
        bgGradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.20) 0%, rgba(15, 17, 23, 0.98) 100%)',
        accentColor: '#f97316',
        badgeBg: 'rgba(249, 115, 22, 0.22)',
        badgeText: '#f97316',
        pulse: false,
      };
    }

    // 8. Pit Lane
    if (combined.includes('PIT') || msg.category === 'PIT_LANE') {
      return {
        title: 'PIT LANE',
        subtitle: combined.includes('OPEN') || combined.includes('ABIERTA') ? 'SALIDA ABIERTA' : 'AVISO PIT',
        icon: Disc,
        borderColor: '#0095ff',
        glowColor: 'rgba(0, 149, 255, 0.35)',
        bgGradient: 'linear-gradient(135deg, rgba(0, 149, 255, 0.20) 0%, rgba(15, 17, 23, 0.98) 100%)',
        accentColor: '#0095ff',
        badgeBg: 'rgba(0, 149, 255, 0.22)',
        badgeText: '#0095ff',
        pulse: false,
      };
    }

    // 9. Weather / Rain
    if (combined.includes('RAIN') || combined.includes('LLUVIA') || combined.includes('WEATHER') || msg.category === 'WEATHER') {
      return {
        title: 'CLIMA',
        subtitle: 'METEOROLOGÍA',
        icon: CloudRain,
        borderColor: '#38bdf8',
        glowColor: 'rgba(56, 189, 248, 0.35)',
        bgGradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.20) 0%, rgba(15, 17, 23, 0.98) 100%)',
        accentColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.22)',
        badgeText: '#38bdf8',
        pulse: false,
      };
    }

    // 10. Default / Info
    return {
      title: 'DIRECCIÓN DE CARRERA',
      subtitle: 'INFORMACIÓN',
      icon: Info,
      borderColor: '#a855f7',
      glowColor: 'rgba(168, 85, 247, 0.35)',
      bgGradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.20) 0%, rgba(15, 17, 23, 0.98) 100%)',
      accentColor: '#c084fc',
      badgeBg: 'rgba(168, 85, 247, 0.22)',
      badgeText: '#c084fc',
      pulse: false,
    };
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '10px',
        maxWidth: '380px',
        width: 'calc(100vw - 40px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => {
        const msg = toast.message;
        const config = getToastConfig(msg);
        const IconComp = config.icon;
        const mainText = language === 'en'
          ? cleanText(msg.messageEn)
          : (cleanText(msg.messageEs) || cleanText(msg.messageEn));

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              background: config.bgGradient,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderLeft: `5px solid ${config.borderColor}`,
              borderRadius: '8px',
              padding: '10px 12px',
              boxShadow: `0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px ${config.glowColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              backdropFilter: 'blur(16px)',
              position: 'relative',
              overflow: 'hidden',
              animation: 'f1ToastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {/* Top Bar: Icon + Title Badge + Timestamp + Close Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: config.badgeBg,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  border: `1px solid ${config.borderColor}40`,
                }}>
                  <IconComp size={13} color={config.accentColor} style={{ flexShrink: 0 }} />
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: '0.70rem',
                    color: config.accentColor,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    {config.title}
                  </span>
                </div>

                <span style={{
                  fontSize: '0.62rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontWeight: 600,
                }}>
                  {config.subtitle}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: '#94a3b8',
                  fontWeight: 700,
                }}>
                  {msg.timestamp || 'NOW'}
                </span>

                <button
                  onClick={() => dismissToast(toast.id)}
                  title="Cerrar"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.6)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '3px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)')}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Message Body */}
            <div style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.80rem',
              fontWeight: 700,
              color: '#f8fafc',
              lineHeight: 1.35,
              paddingLeft: '2px',
              letterSpacing: '0.01em',
            }}>
              {mainText}
            </div>

            {/* Secondary English text if Spanish is shown */}
            {language !== 'en' && msg.messageEs && msg.messageEn && cleanText(msg.messageEs) !== cleanText(msg.messageEn) && (
              <div style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.65rem',
                color: '#94a3b8',
                fontStyle: 'italic',
                paddingLeft: '2px',
              }}>
                "{cleanText(msg.messageEn)}"
              </div>
            )}

            {/* Auto-dismiss progress countdown line */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '2.5px',
                background: config.borderColor,
                boxShadow: `0 0 8px ${config.borderColor}`,
                width: '100%',
                animation: `f1ToastCountdown ${TOAST_DURATION_MS}ms linear forwards`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
