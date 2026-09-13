import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { scheduleSyncService } from '../services/scheduleSyncService';
import { OFFICIAL_DRIVER_STANDINGS, OFFICIAL_CONSTRUCTOR_STANDINGS } from '../data/officialStandings';
import { CIRCUITS } from '../data/circuits';
import { TeamLogo } from './TeamLogo';
import { 
  Calendar, 
  Timer, 
  Flame, 
  Settings2, 
  Wrench, 
  LayoutDashboard, 
  Filter 
} from 'lucide-react';
import '../styles/home-dashboard.css';

interface HomeDashboardViewProps {
  onNavigate: (tab: 'home' | 'timing' | 'leaderboard' | 'schedule') => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const [scheduleState, setScheduleState] = useState(scheduleSyncService.getState());

  useEffect(() => {
    const unsub = scheduleSyncService.subscribe((state) => {
      setScheduleState({ ...state });
    });
    return () => unsub();
  }, []);

  // Upcoming Grand Prix (Spain / Madrid or next uncompleted)
  const schedule = scheduleState.schedule;
  const nextGp = schedule.find(gp => !gp.completed) || schedule[15];

  // Live countdown state
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 25,
    seconds: 21,
  });

  useEffect(() => {
    const nextSession = nextGp.sessions.find(s => {
      const ts = new Date(s.startTimeUtc).getTime();
      return !isNaN(ts) && ts > Date.now();
    }) || nextGp.sessions[nextGp.sessions.length - 1];

    const targetIso = nextSession?.startTimeUtc || `${nextGp.startDate}T13:00:00Z`;
    const targetDate = new Date(targetIso).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, targetDate - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextGp]);

  // Circuit SVG outline for Spain / Madrid
  const spainCircuit = CIRCUITS.find(c => c.id === 'madrid') || CIRCUITS[0];

  // Top 10 Drivers
  const top10Drivers = OFFICIAL_DRIVER_STANDINGS.slice(0, 10);
  const leaderPoints = top10Drivers[0]?.points || 267;

  // Top 10 Constructors
  const top10Constructors = OFFICIAL_CONSTRUCTOR_STANDINGS.slice(0, 10);
  const leaderConstPoints = top10Constructors[0]?.points || 468;

  // News items for 2026 Stats & Records
  const newsItems = [
    {
      id: 1,
      title: 'Five circuits set attendance records in first half of 2026',
      desc: 'Australia, Canada, Austria, Silverstone and Belgium all established new circuit attendance records during the first 11 rounds of the 2026 season.',
      tag: 'RACE',
      tagClass: 'f1-tag-race',
      date: '29 July 2026',
    },
    {
      id: 2,
      title: 'Oscar Piastri retires from Hungarian Grand Prix lead fight',
      desc: 'Piastri led the early stages in Hungary before contact with Carlos Sainz and an apparent gearbox failure ended his race with 15 laps remaining.',
      tag: 'DRIVER',
      tagClass: 'f1-tag-driver',
      date: '26 July 2026',
    },
    {
      id: 3,
      title: 'Nico Hulkenberg scores first points of 2026 season',
      desc: 'Hulkenberg finished ninth for Audi in Hungary to register his first points of the 2026 campaign.',
      tag: 'DRIVER',
      tagClass: 'f1-tag-driver',
      date: '26 July 2026',
    },
    {
      id: 4,
      title: 'Kimi Antonelli takes historic Monza victory on home soil',
      desc: 'The Italian rookie drove a flawless race from pole position to claim his 7th win of the 2026 campaign in front of the Tifosi.',
      tag: 'RACE',
      tagClass: 'f1-tag-race',
      date: '6 September 2026',
    },
    {
      id: 5,
      title: 'Madrid Street Circuit homologated for Spanish GP',
      desc: 'The brand new IFEMA Madrid hybrid street circuit completed all FIA inspections with positive feedback from drivers.',
      tag: 'CIRCUIT',
      tagClass: 'f1-tag-circuit',
      date: '10 September 2026',
    },
  ];

  return (
    <div className="home-dashboard-container">
      {/* Sub Header / Breadcrumbs & Season */}
      <div className="home-sub-header">
        <div className="home-breadcrumb">
          <span className="home-breadcrumb-icon">
            <LayoutDashboard size={18} />
          </span>
          <span>Home</span>
        </div>

        <div className="home-season-badge">
          <Calendar size={15} />
          <span>{t('season_badge')}</span>
        </div>
      </div>

      {/* Row 1: 3 Hero Cards */}
      <div className="home-row-1">
        {/* Card 1: Solid Red Race Hero Countdown */}
        <div 
          className="f1-hero-countdown-card"
          onClick={() => onNavigate('timing')}
          title="Abrir Telemetría y Tiempos en Directo"
        >
          <div className="f1-countdown-tag-row">
            <span className="f1-countdown-pill">R14</span>
            <span className="f1-countdown-title">Spain: Race</span>
          </div>

          <div className="f1-countdown-grid">
            <div className="f1-digit-block">
              <span className="f1-digit-value">{String(countdown.days).padStart(2, '0')}</span>
              <span className="f1-digit-label">DAYS</span>
            </div>
            <div className="f1-digit-block">
              <span className="f1-digit-value">{String(countdown.hours).padStart(2, '0')}</span>
              <span className="f1-digit-label">HRS</span>
            </div>
            <div className="f1-digit-block">
              <span className="f1-digit-value">{String(countdown.minutes).padStart(2, '0')}</span>
              <span className="f1-digit-label">MINS</span>
            </div>
            <div className="f1-digit-block">
              <span className="f1-digit-value">{String(countdown.seconds).padStart(2, '0')}</span>
              <span className="f1-digit-label">SEC</span>
            </div>
          </div>
        </div>

        {/* Card 2: 2026 Schedule Card */}
        <div 
          className="f1-schedule-card"
          onClick={() => onNavigate('schedule')}
          title="Ver Calendario Completo 2026"
        >
          <div className="f1-schedule-info">
            <span className="f1-card-subtitle">{t('schedule_card_title')}</span>
            <div className="f1-schedule-country">
              <span>🇪🇸</span>
              <span>Spain</span>
            </div>
            <span className="f1-schedule-progress">56.5% of season completed</span>
          </div>

          <div className="f1-schedule-track-preview">
            <svg viewBox={spainCircuit.viewBox || "0 0 850 520"}>
              <path 
                d={spainCircuit.svgPath} 
                fill="none" 
                stroke="#FFFFFF" 
                strokeWidth="18" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </svg>
          </div>
        </div>

        {/* Card 3: 2026 Fastest Pit Stop */}
        <div className="f1-pitstop-card">
          <div className="f1-card-top-row">
            <span className="f1-card-subtitle">{t('fastest_pit_stop_title')}</span>
            <div className="f1-card-icon-bubble">
              <Timer size={16} />
            </div>
          </div>

          <div className="f1-pitstop-value">
            1.99 s
          </div>

          <div className="f1-pitstop-holder">
            <img src="/teams/racing_bulls.png" alt="RB" className="rb-icon" />
            <span>Lindblad - Round 11  🇭🇺 Hungary</span>
          </div>
        </div>
      </div>

      {/* Row 2: Metric Analytics Cards (3 Columns) */}
      <div className="home-row-2">
        {/* Card 4: Crash Damage */}
        <div className="f1-metric-card">
          <div className="f1-card-top-row">
            <span className="f1-card-subtitle">{t('crash_damage_title')}</span>
            <div className="f1-card-icon-bubble">
              <Flame size={16} />
            </div>
          </div>

          <div className="f1-metric-value">
            $16,090,000
          </div>

          <div className="f1-metric-trend trend-damage">
            <span>↗ $1,060,000 (+7.05%)</span>
            <span className="f1-trend-sub">{t('vs_previous_round')}</span>
          </div>
        </div>

        {/* Card 5: Total Used Elements */}
        <div className="f1-metric-card">
          <div className="f1-card-top-row">
            <span className="f1-card-subtitle">{t('used_elements_title')}</span>
            <div className="f1-card-icon-bubble">
              <Settings2 size={16} />
            </div>
          </div>

          <div className="f1-metric-value">
            540
          </div>

          <div className="f1-metric-trend trend-positive">
            <span>↗ 5 (+0.93%)</span>
            <span className="f1-trend-sub">{t('vs_previous_round')}</span>
          </div>
        </div>

        {/* Card 6: Total Tech Upgrades */}
        <div className="f1-metric-card">
          <div className="f1-card-top-row">
            <span className="f1-card-subtitle">{t('tech_upgrades_title')}</span>
            <div className="f1-card-icon-bubble">
              <Wrench size={16} />
            </div>
          </div>

          <div className="f1-metric-value">
            380
          </div>

          <div className="f1-metric-trend trend-positive">
            <span>↗ 10 (+2.63%)</span>
            <span className="f1-trend-sub">{t('vs_previous_round')}</span>
          </div>
        </div>
      </div>

      {/* Row 3: Banners (Purple Social Banner + New Liveries Card) */}
      <div className="home-row-3">
        {/* Social Media Engagement Banner */}
        <div className="f1-social-banner">
          <div className="f1-social-text">
            <strong>{t('stay_connected_title')}</strong> {t('stay_connected_desc')}
          </div>

          <div className="f1-social-icons-row">
            <div className="f1-social-btn" title="Instagram">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </div>
            <div className="f1-social-btn" title="X (Twitter)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <div className="f1-social-btn" title="Reddit">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="9" cy="11.5" r="1.5"/>
                <circle cx="15" cy="11.5" r="1.5"/>
                <path d="M8.5 15.5c1.5 1 5.5 1 7 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="f1-social-btn" title="Facebook">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* New Liveries Feature Card */}
        <div 
          className="f1-feature-card"
          onClick={() => onNavigate('leaderboard')}
          title="Ver Equipos y Monoplazas 2026"
        >
          <div className="f1-feature-info">
            <span className="f1-feature-tag">2026</span>
            <h3 className="f1-feature-title">{t('new_liveries_title')}</h3>
          </div>

          <div className="f1-feature-graphic">
            <svg viewBox="0 0 160 80" width="100%" height="100%">
              <defs>
                <linearGradient id="carGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E10600" />
                  <stop offset="50%" stopColor="#00D7B6" />
                  <stop offset="100%" stopColor="#F47600" />
                </linearGradient>
              </defs>
              <path 
                d="M 10,48 L 35,46 L 60,32 L 95,30 L 125,40 L 150,44 L 140,55 L 115,55 L 110,48 L 45,48 L 40,55 L 20,55 Z" 
                fill="url(#carGrad)" 
                opacity="0.9"
              />
              <circle cx="32" cy="54" r="11" fill="#0B0F19" stroke="#E2E8F0" strokeWidth="2" />
              <circle cx="122" cy="54" r="11" fill="#0B0F19" stroke="#E2E8F0" strokeWidth="2" />
              <path d="M 62,32 L 80,24 L 92,30 Z" fill="#FFFFFF" opacity="0.8" />
              <path d="M 120,38 L 148,32 L 145,44 Z" fill="#00D7B6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Row 4: 2026 Driver Standings, Constructor Standings & News Feed */}
      <div className="home-row-4">
        {/* Column 1: 2026 Driver Standings Widget */}
        <div className="f1-standings-widget">
          <div>
            <h3 className="f1-widget-header">{t('home_driver_standings')}</h3>
            <table className="f1-widget-table">
              <thead>
                <tr>
                  <th className="f1-th-pos">POS.</th>
                  <th>DRIVER</th>
                  <th className="f1-th-pts">POINTS</th>
                  <th className="f1-th-evo">EVO.</th>
                </tr>
              </thead>
              <tbody>
                {top10Drivers.map((driver, idx) => {
                  const evoDiff = idx === 0 ? '—' : `-${leaderPoints - driver.points}`;
                  return (
                    <tr key={driver.driverId}>
                      <td className="f1-td-pos">{driver.position}</td>
                      <td>
                        <div className="f1-td-entity">
                          <div className="f1-entity-logo">
                            <TeamLogo team={driver.team} size={18} />
                          </div>
                          <span>{driver.name.split(' ').slice(-1)[0]}</span>
                        </div>
                      </td>
                      <td className="f1-td-pts">{driver.points}</td>
                      <td className="f1-td-evo">{evoDiff}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button 
            className="f1-widget-cta-btn"
            onClick={() => onNavigate('leaderboard')}
          >
            <span>{t('full_driver_standings_btn')}</span>
          </button>
        </div>

        {/* Column 2: 2026 Constructor Standings Widget */}
        <div className="f1-standings-widget">
          <div>
            <h3 className="f1-widget-header">{t('home_constructor_standings')}</h3>
            <table className="f1-widget-table">
              <thead>
                <tr>
                  <th className="f1-th-pos">POS.</th>
                  <th>CONSTRUCTOR</th>
                  <th className="f1-th-pts">POINTS</th>
                  <th className="f1-th-evo">EVO.</th>
                </tr>
              </thead>
              <tbody>
                {top10Constructors.map((c, idx) => {
                  const evoDiff = idx === 0 ? '—' : `-${leaderConstPoints - c.points}`;
                  return (
                    <tr key={c.team}>
                      <td className="f1-td-pos">{c.position}</td>
                      <td>
                        <div className="f1-td-entity">
                          <div className="f1-entity-logo">
                            <TeamLogo team={c.team} size={18} />
                          </div>
                          <span>{c.team}</span>
                        </div>
                      </td>
                      <td className="f1-td-pts">{c.points}</td>
                      <td className="f1-td-evo">{evoDiff}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button 
            className="f1-widget-cta-btn"
            onClick={() => onNavigate('leaderboard')}
          >
            <span>{t('full_constructor_standings_btn')}</span>
          </button>
        </div>

        {/* Column 3: 2026 Stats & Records News Feed */}
        <div className="f1-news-widget">
          <div className="f1-news-top-row">
            <h3 className="f1-widget-header">{t('stats_and_records_title')}</h3>
            <div className="f1-filter-btn">
              <Filter size={12} />
              <span>{t('filter_all_badge')}</span>
            </div>
          </div>

          <div className="f1-news-feed">
            {newsItems.map((news) => (
              <div key={news.id} className="f1-news-card">
                <h4 className="f1-news-title">{news.title}</h4>
                <p className="f1-news-desc">{news.desc}</p>
                <div className="f1-news-meta">
                  <span className={`f1-tag-badge ${news.tagClass}`}>
                    {news.tag}
                  </span>
                  <span className="f1-news-date">
                    <Calendar size={12} />
                    {news.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
