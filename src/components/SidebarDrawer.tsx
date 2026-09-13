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
  Flag
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { SessionState } from '../types/telemetry';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'home' | 'timing' | 'leaderboard' | 'schedule';
  setActiveTab: (tab: 'home' | 'timing' | 'leaderboard' | 'schedule') => void;
  session?: SessionState;
  isOfficialLive?: boolean;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  session,
  isOfficialLive,
}) => {
  const { t } = useLanguage();

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
      label: t('tab_dashboard') || 'Dashboard / Inicio',
      description: 'Resumen de pista, circuito y vista rápida',
      icon: LayoutDashboard,
      color: '#38bdf8',
    },
    {
      id: 'timing' as const,
      label: t('tab_telemetry') || 'Telemetría y Tiempos',
      description: 'Live timing oficial, 25 microsectores y estrategia',
      icon: Gauge,
      color: '#10b981',
      isLive: isOfficialLive || !!session?.trackStatus,
    },
    {
      id: 'leaderboard' as const,
      label: t('tab_leaderboard') || 'Clasificación Mundial',
      description: 'Campeonato Mundial de Pilotos y Constructores FIA',
      icon: Trophy,
      color: '#ffd700',
    },
    {
      id: 'schedule' as const,
      label: t('tab_schedule') || 'Calendario F1 2026',
      description: 'Horarios oficiales y 24 Grandes Premios de la temporada',
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
            <span>NAVEGACIÓN PRINCIPAL</span>
          </div>

          <nav className="sidebar-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectTab(item.id)}
                >
                  <div 
                    className="sidebar-item-icon-box"
                    style={{
                      color: isActive ? '#fff' : item.color,
                      backgroundColor: isActive ? 'var(--f1-red)' : 'rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <Icon size={18} />
                  </div>

                  <div className="sidebar-item-text">
                    <div className="sidebar-item-title-row">
                      <span className="sidebar-item-title">{item.label}</span>
                      {item.isLive && (
                        <span className="sidebar-live-pill">
                          <span className="live-dot-ping" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <span className="sidebar-item-desc">{item.description}</span>
                  </div>

                  <ChevronRight size={14} className="sidebar-chevron" />
                </button>
              );
            })}
          </nav>

          {/* Quick Session Status Card in Drawer */}
          {session && (
            <div className="sidebar-session-card">
              <div className="sidebar-card-top">
                <span className="sidebar-session-badge">
                  <Flag size={11} />
                  SESIÓN EN CURSO
                </span>
                {isOfficialLive && (
                  <span className="sidebar-live-tag">
                    <Radio size={10} /> EN DIRECTO
                  </span>
                )}
              </div>

              <div className="sidebar-gp-name">
                {session.circuit?.name || 'Circuito de Madrid'}
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
                    <span className="sidebar-lap-lbl">VUELTAS</span>
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
          )}
        </div>

        {/* Drawer Footer */}
        <div className="sidebar-drawer-footer">
          <div className="sidebar-footer-info">
            <span className="sidebar-footer-brand">UNDERCUT F1 TELEMETRY</span>
            <span className="sidebar-footer-version">v2.4 • Feed Oficial FIA & Formula 1</span>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
};
