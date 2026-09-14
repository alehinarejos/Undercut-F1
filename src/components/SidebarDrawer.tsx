import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  LayoutDashboard, 
  Gauge, 
  Trophy, 
  Calendar, 
  ChevronRight, 
  Radio, 
  Flag,
  Clock
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { SessionState } from '../types/telemetry';
import { 
  scheduleSyncService, 
  getNextUpcomingGrandPrix, 
  getRaceTargetTimestamp, 
  getTimeRemaining 
} from '../services/scheduleSyncService';
import { getPathnameForRoute } from '../utils/seoManager';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'home' | 'timing' | 'leaderboard' | 'schedule';
  setActiveTab: (tab: 'home' | 'timing' | 'leaderboard' | 'schedule') => void;
  session?: SessionState;
  isOfficialLive?: boolean;
  isLiveActive?: boolean;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  session,
  isOfficialLive,
  isLiveActive = false,
}) => {
  const { t } = useLanguage();

  const schedule = scheduleSyncService.getState().schedule;
  const upcomingGp = getNextUpcomingGrandPrix(schedule);
  const raceTarget = getRaceTargetTimestamp(upcomingGp);
  const cd = getTimeRemaining(raceTarget);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);


  const navItems = [
    {
      id: 'home' as const,
      label: t('tab_dashboard'),
      description: t('sidebar_home_desc'),
      icon: LayoutDashboard,
      color: '#38bdf8',
    },
    {
      id: 'timing' as const,
      label: t('tab_telemetry'),
      description: t('sidebar_timing_desc'),
      icon: Gauge,
      color: '#10b981',
      isLive: isLiveActive,
    },
    {
      id: 'leaderboard' as const,
      label: t('tab_leaderboard'),
      description: t('sidebar_leaderboard_desc'),
      icon: Trophy,
      color: '#ffd700',
    },
    {
      id: 'schedule' as const,
      label: t('tab_schedule'),
      description: t('sidebar_schedule_desc'),
      icon: Calendar,
      color: '#a855f7',
    },
  ];

  const handleSelectTab = (tabId: 'home' | 'timing' | 'leaderboard' | 'schedule') => {
    setActiveTab(tabId);
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={`sidebar-drawer-root ${isOpen ? 'open' : ''}`}>
      {/* Backdrop overlay */}
      <div 
        className="sidebar-backdrop" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside className="sidebar-drawer-panel" aria-label="Menú principal de navegación">
        {/* Drawer Header */}
        <div className="sidebar-drawer-header">
          <div className="sidebar-brand-group">
            <span className="sidebar-brand-title">
              UNDERCUT <span className="sidebar-brand-f1">F1</span>
            </span>
            <span className="sidebar-brand-sub">LIVE TIMING & STRATEGY</span>
          </div>

          <button 
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="sidebar-drawer-content">
          <div className="sidebar-section-title">
            <span>{t('sidebar_main_nav')}</span>
          </div>

          <nav className="sidebar-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <a
                  key={item.id}
                  href={getPathnameForRoute(item.id)}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSelectTab(item.id);
                  }}
                  title={item.label}
                >
                  <div 
                    className="sidebar-item-icon-box"
                    style={{ 
                      backgroundColor: isActive ? 'rgba(225, 6, 0, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      color: isActive ? 'var(--f1-red)' : item.color 
                    }}
                  >
                    <Icon size={18} />
                  </div>

                  <div className="sidebar-item-text">
                    <div className="sidebar-item-title-row">
                      <span className="sidebar-item-title">{item.label}</span>
                      {item.isLive && (
                        <span className="sidebar-live-pill">
                          <Radio size={9} /> {t('live')}
                        </span>
                      )}
                    </div>
                    <span className="sidebar-item-desc">{item.description}</span>
                  </div>

                  <ChevronRight size={14} className="sidebar-chevron" />
                </a>
              );
            })}
          </nav>

          {/* Quick Session Status Card in Drawer */}
          {isLiveActive && session ? (
            <div className="sidebar-session-card">
              <div className="sidebar-card-top">
                <span className="sidebar-session-badge">
                  <Flag size={11} />
                  {t('live')}
                </span>
                {isOfficialLive && (
                  <span className="sidebar-live-tag">
                    <Radio size={10} /> {t('live')}
                  </span>
                )}
              </div>

              <div className="sidebar-gp-name">
                {session.circuit?.name || 'Circuito de F1'}
              </div>

              <div className="sidebar-session-meta">
                <span className="sidebar-session-type-name">
                  {session.name || session.type || 'F1 Gran Premio'}
                </span>
                {session.trackStatus && (
                  <span className={`sidebar-track-status status-${session.trackStatus.toLowerCase()}`}>
                    {session.trackStatus}
                  </span>
                )}
              </div>

              {session.currentLap > 0 && session.totalLaps > 0 && (
                <div className="sidebar-lap-progress">
                  <div className="sidebar-lap-row">
                    <span className="sidebar-lap-lbl">{t('sidebar_laps')}</span>
                    <span className="sidebar-lap-val">{session.currentLap} / {session.totalLaps}</span>
                  </div>
                  <div className="sidebar-lap-bar-track">
                    <div 
                      className="sidebar-lap-bar-fill" 
                      style={{ width: `${Math.min(100, (session.currentLap / session.totalLaps) * 100)}%` }} 
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="sidebar-session-card" style={{ border: '1px solid rgba(0, 215, 182, 0.2)' }}>
              <div className="sidebar-card-top">
                <span className="sidebar-session-badge" style={{ color: '#00D7B6', background: 'rgba(0, 215, 182, 0.1)', borderColor: 'rgba(0, 215, 182, 0.25)' }}>
                  <Clock size={11} />
                  {t('sidebar_next_race')}
                </span>
                <span className="sidebar-standby-tag" style={{ fontSize: '0.62rem', color: '#94A3B8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {t('waiting')}
                </span>
              </div>

              <div className="sidebar-gp-name">
                {upcomingGp.flag} {upcomingGp.name} 2026
              </div>

              <div className="sidebar-session-meta">
                <span className="sidebar-session-type-name">
                  {upcomingGp.circuitName}
                </span>
                <span className="sidebar-track-status" style={{ color: '#00D7B6', borderColor: 'rgba(0, 215, 182, 0.35)', background: 'rgba(0, 215, 182, 0.08)' }}>
                  {t('sidebar_in_time')} {cd.days > 0 ? `${cd.days}d ` : ''}{cd.hours}h {cd.minutes}m
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="sidebar-drawer-footer">
          <div className="sidebar-footer-info">
            <span className="sidebar-footer-brand">UNDERCUT F1 TELEMETRY</span>
            <span className="sidebar-footer-version">v2.4 • {t('sidebar_feed_official')}</span>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
};
