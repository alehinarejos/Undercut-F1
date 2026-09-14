import React, { useState, useEffect } from 'react';
import type { SessionState, RaceControlMessage } from '../types/telemetry';
import type { SignalRConnectionStatus } from '../services/f1SignalRClient';
import { 
  scheduleSyncService, 
  getGrandPrixTimeline, 
  getNextUpcomingGrandPrix, 
  getRaceTargetTimestamp 
} from '../services/scheduleSyncService';
import type { ScheduleSyncState } from '../services/scheduleSyncService';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { 
  RotateCw,
  Radio,
  Wifi,
  Clock,
  Menu,
  CloudSun,
  Thermometer
} from 'lucide-react';
import { SidebarDrawer } from './SidebarDrawer';
import { TrackFlagIndicator } from './TrackFlagIndicator';

interface HeaderProps {
  session: SessionState;
  activeTab: 'home' | 'timing' | 'leaderboard' | 'schedule';
  setActiveTab: (tab: 'home' | 'timing' | 'leaderboard' | 'schedule') => void;
  isOfficialLive: boolean;
  signalRStatus?: SignalRConnectionStatus;
  signalRDetails?: string;
  onRefreshLive?: () => void;
  trackStatus?: string;
  raceControlMessages?: RaceControlMessage[];
}

export const Header: React.FC<HeaderProps> = ({
  session,
  activeTab,
  setActiveTab,
  isOfficialLive,
  signalRStatus = 'connected',
  onRefreshLive,
  trackStatus,
  raceControlMessages = [],
}) => {
  const { t, language } = useLanguage();
  const isStreaming = signalRStatus === 'live_streaming' || isOfficialLive;
  const isConnected = signalRStatus === 'connected' || signalRStatus === 'live_streaming';

  // Collapsible sidebar menu state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Schedule subscription to get current / next GP and sessions
  const [scheduleState, setScheduleState] = useState<ScheduleSyncState>(scheduleSyncService.getState());

  useEffect(() => {
    const unsubscribe = scheduleSyncService.subscribe((state) => {
      setScheduleState({ ...state });
    });
    return () => unsubscribe();
  }, []);

  // Real-time second clock
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const upcomingGp = getNextUpcomingGrandPrix(scheduleState.schedule);
  const timeline = getGrandPrixTimeline(upcomingGp);

  const activeTimelineSession = timeline.activeSession;
  const lastFinishedSession = timeline.lastCompletedSession;
  const nextTargetSession = timeline.nextSession || upcomingGp.sessions.find(s => s.type === 'Race') || upcomingGp.sessions[0];

  const targetStartTime = nextTargetSession 
    ? (typeof nextTargetSession === 'object' && 'startTime' in nextTargetSession ? (nextTargetSession as any).startTime : new Date((nextTargetSession as any).startTimeUtc).getTime())
    : getRaceTargetTimestamp(upcomingGp);

  // Helper to format next session day and time
  const formatNextSessionInfo = (item: any): string => {
    if (!item) return '';
    const dateObj = item.startTimeUtc 
      ? new Date(item.startTimeUtc) 
      : item.startTime 
      ? new Date(item.startTime) 
      : item.session?.startTimeUtc 
      ? new Date(item.session.startTimeUtc) 
      : null;
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const dayNamesByLang: Record<string, string[]> = {
      es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
      it: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
    };
    const dayNames = dayNamesByLang[language] || dayNamesByLang.en;
    const day = dayNames[dateObj.getDay()];
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    return `${day} ${hours}:${minutes}h`;
  };

  // Helper to shorten overly long GP names so header elements fit comfortably
  const getCompactGpName = (name: string): string => {
    if (!name) return 'F1 GP';
    return name
      .replace(/^Gran Premio de /i, 'GP ')
      .replace(/^Grand Prix of /i, 'GP ')
      .replace(/\s*202[0-9]/, '');
  };

  // Maximum cooldown for Chequered Flag display: 90 minutes after session finish
  const isRecentFinish = session.finishedAtMs 
    ? (nowMs - session.finishedAtMs) < 90 * 60 * 1000
    : false;

  const isChequered = session.trackStatus === 'CHEQUERED' && isRecentFinish;

  const isLiveActive = !isChequered && (
    (activeTimelineSession != null && activeTimelineSession.status === 'live') ||
    (isOfficialLive && isStreaming && session.trackStatus !== 'CHEQUERED')
  );

  const remainingSec = (() => {
    if (session.timeRemainingSec > 0) return session.timeRemainingSec;
    if (activeTimelineSession) {
      if (session.trackStatus === 'RED') {
        return session.timeRemainingSec || 0;
      }
      return Math.max(0, Math.floor((activeTimelineSession.endTime - nowMs) / 1000));
    }
    return 0;
  })();

  // Live countdown to the next session
  const [sessionCountdown, setSessionCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    formattedText: '',
  });

  useEffect(() => {
    const targetTime = isNaN(targetStartTime) ? Date.now() : targetStartTime;

    const updateCountdown = () => {
      const diff = Math.max(0, targetTime - Date.now());
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      let formattedText = '';
      if (days > 0) {
        formattedText = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
      } else {
        formattedText = `${hours}h ${String(minutes).padStart(2, '0')}m`;
      }

      setSessionCountdown({ days, hours, minutes, seconds, formattedText });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetStartTime]);

  return (
    <header className="f1-header">
      <div className="header-top">
        {/* Brand with Collapsible Menu Toggle */}
        <div className="brand-section" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            className="sidebar-hamburger-btn"
            onClick={() => setIsSidebarOpen(true)}
            title="Abrir menú de navegación"
            aria-label="Abrir menú lateral"
          >
            <Menu size={16} />
            <span className="hamburger-text">MENÚ</span>
          </button>

          <a 
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('home');
            }}
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            title="Ir a Inicio / Dashboard"
          >
            <div className="f1-logo-badge" style={{ letterSpacing: '0.02em', padding: '3px 7px', fontSize: '0.92rem', fontWeight: 900 }}>
              UC
            </div>
            <div className="app-title-group">
              <span className="app-name" style={{ letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                UNDERCUT <span style={{ color: 'var(--f1-red)', fontSize: '0.82em', fontWeight: 900 }}>F1</span>
              </span>
              <span className="app-subtitle">{t('app_subtitle')}</span>
            </div>
          </a>
        </div>

        {/* Center Group: Session Pill & Compact Track Flag Indicator */}
        <div className="header-center-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div className="session-pill" style={{ padding: '4px 10px', gap: '8px' }}>
          {isChequered ? (
            // 🏁 1. Chequered Flag & Post-Session Cooldown: Shows GP + Dynamic Countdown to Next Session
            <>
              <div className="session-track-info">
                <span className="country-flag">{upcomingGp.flag}</span>
                <div>
                  <div className="circuit-title">{getCompactGpName(upcomingGp.name)}</div>
                  <div className="circuit-session-type" style={{ color: '#a0aec0', fontWeight: 700, fontSize: '0.68rem' }}>
                    {lastFinishedSession?.session.name || session.name || 'SESIÓN'} FINALIZADA
                  </div>
                </div>
              </div>

              <div className="session-divider" />

              {/* Dynamic Next Session Countdown */}
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title={nextTargetSession ? `Próxima sesión: ${(nextTargetSession as any).session?.name || (nextTargetSession as any).name} (${formatNextSessionInfo(nextTargetSession)})` : undefined}
              >
                <Clock size={13} color="#00D7B6" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', lineHeight: 1.1 }}>
                    {nextTargetSession ? `Próx: ${(nextTargetSession as any).session?.name || (nextTargetSession as any).name}` : 'Próxima:'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.80rem', color: '#fff', letterSpacing: '0.03em', lineHeight: 1.1 }}>
                    {sessionCountdown.days > 0 && `${sessionCountdown.days}d `}
                    {(sessionCountdown.days > 0 || sessionCountdown.hours > 0) && (
                      <>{sessionCountdown.days > 0 ? String(sessionCountdown.hours).padStart(2, '0') : sessionCountdown.hours}h </>
                    )}
                    {(sessionCountdown.days > 0 || sessionCountdown.hours > 0 || sessionCountdown.minutes > 0) && (
                      <>{(sessionCountdown.days > 0 || sessionCountdown.hours > 0) ? String(sessionCountdown.minutes).padStart(2, '0') : sessionCountdown.minutes}m </>
                    )}
                    <strong style={{ color: 'var(--f1-red)' }}>{String(sessionCountdown.seconds).padStart(2, '0')}s</strong>
                  </span>
                </div>
              </div>

              <div className="session-divider" />

              <span className="f1-badge" style={{ fontSize: '0.62rem', padding: '2px 6px', color: '#ffd700', border: '1px solid rgba(255, 215, 0, 0.4)', background: 'rgba(255, 215, 0, 0.1)' }}>
                FINALIZADA 🏁
              </span>
            </>
          ) : isLiveActive ? (
            // 🔴 2. Active Live Session Running on Track
            <>
              <div className="session-track-info">
                <span className="country-flag">{upcomingGp.flag}</span>
                <div>
                  <div className="circuit-title">{getCompactGpName(upcomingGp.name)}</div>
                  <div className="circuit-session-type" style={{ color: '#ff4d4d', fontWeight: 800, fontSize: '0.68rem' }}>
                    {activeTimelineSession ? `${activeTimelineSession.session.name}` : `${session.name || session.type || 'F1'}`}
                  </div>
                </div>
              </div>

              <div className="session-divider" />

              {session.type === 'RACE' || session.type === 'SPRINT' || (session.totalLaps && session.totalLaps > 0) ? (
                <div className="session-lap-counter">
                  <span className="lap-label">{t('lap_upper')}</span>
                  <span className="lap-value" style={{ fontSize: '0.94rem', fontWeight: 900, color: '#fff' }}>{session.currentLap || 18}</span>
                  <span className="lap-label">/ {session.totalLaps || 55}</span>
                </div>
              ) : (
                <div className="session-lap-counter">
                  <span className="lap-label">
                    {session.trackStatus === 'RED' ? 'DETENIDA' : t('remaining_upper')}
                  </span>
                  <span className="lap-value" style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 800, 
                    fontSize: '0.88rem',
                    color: session.trackStatus === 'RED' ? '#ff4d4d' : '#00D7B6', 
                    letterSpacing: '0.04em' 
                  }}>
                    {(() => {
                      const mins = Math.floor(remainingSec / 60);
                      const secs = Math.floor(remainingSec % 60);
                      return `${mins}:${secs.toString().padStart(2, '0')}`;
                    })()}
                  </span>
                  {session.trackStatus === 'RED' && (
                    <span style={{ fontSize: '0.60rem', color: '#ff4d4d', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                      ⏸ PARADA
                    </span>
                  )}
                </div>
              )}

              <div className="session-divider" />

              {session.safetyCarDeployed ? (
                <span className="f1-badge badge-sc" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>SC</span>
              ) : session.vscDeployed ? (
                <span className="f1-badge badge-vsc" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>VSC</span>
              ) : (
                <span className="f1-badge badge-green" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>{t('track_clear_green')}</span>
              )}

              <span className="f1-badge badge-live" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>🔴 {t('live')}</span>
            </>
          ) : (
            // ⏱️ 3. Standby / Pre-Event: Shows current GP + Next Session + Time Remaining
            <>
              <div className="session-track-info">
                <span className="country-flag" style={{ fontSize: '1.15rem' }}>{upcomingGp.flag}</span>
                <div>
                  <div className="circuit-title" style={{ fontSize: '0.80rem' }}>{getCompactGpName(upcomingGp.name)}</div>
                  <div className="circuit-session-type" style={{ color: '#00D7B6', fontWeight: 700, fontSize: '0.66rem' }}>
                    {(nextTargetSession as any)?.session?.name || (nextTargetSession as any)?.name || t('waiting')}
                  </div>
                </div>
              </div>

              <div className="session-divider" />

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={13} color="#00D7B6" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', lineHeight: 1.1 }}>
                    {t('next_event_in')}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.80rem', color: '#fff', letterSpacing: '0.03em', lineHeight: 1.1 }}>
                    {sessionCountdown.days > 0 && `${sessionCountdown.days}d `}
                    {(sessionCountdown.days > 0 || sessionCountdown.hours > 0) && (
                      <>{sessionCountdown.days > 0 ? String(sessionCountdown.hours).padStart(2, '0') : sessionCountdown.hours}h </>
                    )}
                    {(sessionCountdown.days > 0 || sessionCountdown.hours > 0 || sessionCountdown.minutes > 0) && (
                      <>{(sessionCountdown.days > 0 || sessionCountdown.hours > 0) ? String(sessionCountdown.minutes).padStart(2, '0') : sessionCountdown.minutes}m </>
                    )}
                    <strong style={{ color: 'var(--f1-red)' }}>{String(sessionCountdown.seconds).padStart(2, '0')}s</strong>
                  </span>
                </div>
              </div>

              <div className="session-divider" />

              <span className="f1-badge" style={{ fontSize: '0.62rem', padding: '2px 6px', color: 'var(--text-secondary)' }}>
                {t('waiting')}
              </span>
            </>
          )}
          </div>

          <TrackFlagIndicator
            trackStatus={isChequered ? 'CHEQUERED' : isLiveActive ? (session.trackStatus || trackStatus || 'GREEN') : 'GREEN'}
            messages={raceControlMessages}
          />
        </div>

        {/* Live Status Indicator, Weather Pill & Language Selector */}
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Weather & Asphalt Temperature Pill */}
          <div 
            className="header-weather-pill"
            title={`Pista: ${session.circuit?.name || 'Circuito de Madrid'} • Aire: ${session.airTemp || 24.8}°C • Asfalto: ${session.trackTemp || 37.5}°C • Viento: ${session.windSpeed || 12} km/h • Humedad: ${session.humidity || 45}%`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '4px 8px',
              borderRadius: '16px',
              cursor: 'default',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CloudSun size={13} color="#ffd700" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: '#f8fafc' }}>
                {session.airTemp || 24.8}°C
              </span>
            </div>

            <span style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: '0.65rem' }}>|</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Thermometer size={12} color="#ff9900" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: '#ff9900' }}>
                {session.trackTemp || 37.5}°C
              </span>
            </div>
          </div>

          <div 
            className="header-status-pill"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              borderRadius: '16px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: isLiveActive 
                ? 'rgba(225, 6, 0, 0.16)' 
                : isChequered
                ? 'rgba(255, 255, 255, 0.08)'
                : isConnected 
                ? 'rgba(0, 215, 182, 0.12)' 
                : 'rgba(255, 255, 255, 0.05)',
              border: isLiveActive 
                ? '1px solid rgba(225, 6, 0, 0.4)' 
                : isChequered
                ? '1px solid rgba(255, 255, 255, 0.25)'
                : isConnected 
                ? '1px solid rgba(0, 215, 182, 0.3)' 
                : '1px solid rgba(255, 255, 255, 0.1)',
            }}
            title={isChequered ? 'Bandera a cuadros' : t('official_f1_data')}
          >
            {isLiveActive ? (
              <Radio 
                size={13} 
                color="var(--f1-red)" 
                style={{ animation: 'pulse 1.2s infinite', flexShrink: 0 }}
              />
            ) : isChequered ? (
              <span style={{ fontSize: '0.78rem' }}>🏁</span>
            ) : (
              <Wifi 
                size={13} 
                color={isConnected ? '#00D7B6' : '#ffd700'} 
                style={{ flexShrink: 0 }}
              />
            )}
            
            <span className="status-pill-text-main" style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: '0.70rem', 
              fontWeight: 800, 
              color: isLiveActive ? '#ff4d4d' : isChequered ? '#ffffff' : isConnected ? '#00D7B6' : '#ffd700',
              letterSpacing: '0.04em'
            }}>
              {isLiveActive 
                ? t('live')
                : isChequered
                ? 'FINALIZADA'
                : isConnected 
                ? t('connected')
                : t('updating')}
            </span>

            {onRefreshLive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRefreshLive();
                }}
                className="f1-btn"
                style={{ padding: '2px', marginLeft: '1px', background: 'transparent', border: 'none' }}
                title={t('update_data')}
              >
                <RotateCw size={11} color="var(--text-secondary)" />
              </button>
            )}
          </div>

          {/* Multilingual Selector */}
          <LanguageSelector />
        </div>
      </div>

      {/* Collapsible Sidebar Navigation Drawer */}
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        isOfficialLive={isOfficialLive}
        isLiveActive={isLiveActive}
      />
    </header>
  );
};
