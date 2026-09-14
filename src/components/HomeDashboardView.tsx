import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  scheduleSyncService, 
  isGrandPrixCompleted, 
  getNextUpcomingGrandPrix, 
  getRaceTargetTimestamp,
  getTimeRemaining,
} from '../services/scheduleSyncService';
import { OFFICIAL_DRIVER_STANDINGS, OFFICIAL_CONSTRUCTOR_STANDINGS } from '../data/officialStandings';
import { CIRCUITS } from '../data/circuits';
import { TeamLogo } from './TeamLogo';
import { 
  Calendar, 
  Timer, 
  LayoutDashboard, 
  Filter 
} from 'lucide-react';
import '../styles/home-dashboard.css';

interface HomeDashboardViewProps {
  onNavigate: (tab: 'home' | 'timing' | 'leaderboard' | 'schedule') => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const [scheduleState, setScheduleState] = useState(scheduleSyncService.getState());

  useEffect(() => {
    const unsub = scheduleSyncService.subscribe((state) => {
      setScheduleState({ ...state });
    });
    return () => unsub();
  }, []);

  // Upcoming Grand Prix (dynamically next uncompleted race)
  const schedule = scheduleState.schedule;
  const nextGp = getNextUpcomingGrandPrix(schedule);
  const completedCount = schedule.filter(gp => isGrandPrixCompleted(gp)).length;
  const seasonProgressPct = ((completedCount / schedule.length) * 100).toFixed(1);

  // Live countdown state targeting next race
  const [countdown, setCountdown] = useState(() => {
    const targetDate = getRaceTargetTimestamp(nextGp);
    return getTimeRemaining(targetDate);
  });

  useEffect(() => {
    const targetDate = getRaceTargetTimestamp(nextGp);

    const tick = () => {
      setCountdown(getTimeRemaining(targetDate));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextGp]);

  // Circuit SVG outline for next GP
  const nextCircuit = CIRCUITS.find(c => c.id === nextGp.circuitId) || CIRCUITS[0];

  // Top 10 Drivers
  const top10Drivers = OFFICIAL_DRIVER_STANDINGS.slice(0, 10);
  const leaderPoints = top10Drivers[0]?.points || 267;

  // Top 10 Constructors
  const top10Constructors = OFFICIAL_CONSTRUCTOR_STANDINGS.slice(0, 10);
  const leaderConstPoints = top10Constructors[0]?.points || 468;

  // Multilingual News items for 2026 Stats & Records
  const newsItems = [
    {
      id: 1,
      title: language === 'es' 
        ? 'Cinco circuitos baten récord histórico de asistencia en la primera mitad de 2026'
        : language === 'fr'
        ? 'Cinq circuits battent des records d’affluence lors de la première moitié de 2026'
        : language === 'it'
        ? 'Cinque circuiti stabiliscono record di presenze nella prima metà del 2026'
        : 'Five circuits set attendance records in first half of 2026',
      desc: language === 'es'
        ? 'Australia, Canadá, Austria, Silverstone y Bélgica establecieron nuevos récords absolutos de asistencia en los primeros 11 Grandes Premios.'
        : language === 'fr'
        ? 'L’Australie, le Canada, l’Autriche, Silverstone et la Belgique ont tous établi de nouveaux records lors des 11 premières manches.'
        : language === 'it'
        ? 'Australia, Canada, Austria, Silverstone e Belgio hanno fatto segnare nuovi record nelle prime 11 tappe della stagione.'
        : 'Australia, Canada, Austria, Silverstone and Belgium all established new circuit attendance records during the first 11 rounds of the 2026 season.',
      tag: t('news_race_tag'),
      tagClass: 'f1-tag-race',
      date: language === 'es' ? '29 de julio de 2026' : language === 'fr' ? '29 juillet 2026' : language === 'it' ? '29 luglio 2026' : '29 July 2026',
    },
    {
      id: 2,
      title: language === 'es'
        ? 'Oscar Piastri abandona cuando luchaba por la victoria en el GP de Hungría'
        : language === 'fr'
        ? 'Oscar Piastri abandonne alors qu’il menait la bataille au Grand Prix de Hongrie'
        : language === 'it'
        ? 'Oscar Piastri si ritira mentre lottava per la vittoria nel Gran Premio d’Ungheria'
        : 'Oscar Piastri retires from Hungarian Grand Prix lead fight',
      desc: language === 'es'
        ? 'Piastri lideró las primeras vueltas en Hungaroring antes de un contacto con Carlos Sainz y un fallo mecánico en la caja de cambios.'
        : language === 'fr'
        ? 'Piastri a mené les premiers tours en Hongrie avant un contact avec Carlos Sainz et une panne de boîte de vitesses à 15 tours de la fin.'
        : language === 'it'
        ? 'Piastri ha guidato le prime fasi in Ungheria prima del contatto con Sainz e un problema al cambio a 15 giri dal termine.'
        : 'Piastri led the early stages in Hungary before contact with Carlos Sainz and an apparent gearbox failure ended his race with 15 laps remaining.',
      tag: t('news_driver_tag'),
      tagClass: 'f1-tag-driver',
      date: language === 'es' ? '26 de julio de 2026' : language === 'fr' ? '26 juillet 2026' : language === 'it' ? '26 luglio 2026' : '26 July 2026',
    },
    {
      id: 3,
      title: language === 'es'
        ? 'Nico Hülkenberg suma los primeros puntos de la temporada 2026 para Audi'
        : language === 'fr'
        ? 'Nico Hülkenberg inscrit les premiers points de la saison 2026 pour Audi'
        : language === 'it'
        ? 'Nico Hülkenberg conquista i primi punti della stagione 2026 per Audi'
        : 'Nico Hulkenberg scores first points of 2026 season',
      desc: language === 'es'
        ? 'El piloto alemán finalizó noveno con una sólida estrategia de neumáticos para inaugurar el casillero de Audi F1.'
        : language === 'fr'
        ? 'Le pilote allemand a terminé neuvième pour Audi en Hongrie afin d’enregistrer ses premiers points de la campagne 2026.'
        : language === 'it'
        ? 'Il pilota tedesco ha chiuso al nono posto per l’Audi in Ungheria, registrando i suoi primi punti stagionali.'
        : 'Hulkenberg finished ninth for Audi in Hungary to register his first points of the 2026 campaign.',
      tag: t('news_driver_tag'),
      tagClass: 'f1-tag-driver',
      date: language === 'es' ? '26 de julio de 2026' : language === 'fr' ? '26 juillet 2026' : language === 'it' ? '26 luglio 2026' : '26 July 2026',
    },
    {
      id: 4,
      title: language === 'es'
        ? 'Kimi Antonelli logra una histórica victoria en Monza ante los Tifosi'
        : language === 'fr'
        ? 'Kimi Antonelli remporte une victoire historique à Monza devant les Tifosi'
        : language === 'it'
        ? 'Kimi Antonelli conquista una storica vittoria a Monza davanti ai Tifosi'
        : 'Kimi Antonelli takes historic Monza victory on home soil',
      desc: language === 'es'
        ? 'El joven piloto dominó la carrera de principio a fin desde la pole position sumando su 7ª victoria en el templo de la velocidad.'
        : language === 'fr'
        ? 'Le jeune pilote a réalisé une course sans faute depuis la pole position pour décrocher son 7e succès de la campagne 2026.'
        : language === 'it'
        ? 'Il giovane pilota ha condotto una gara impeccabile dalla pole conquistando la sua 7ª vittoria stagionale a Monza.'
        : 'The rookie drove a flawless race from pole position to claim his 7th win of the 2026 campaign in front of the Tifosi.',
      tag: t('news_race_tag'),
      tagClass: 'f1-tag-race',
      date: language === 'es' ? '6 de septiembre de 2026' : language === 'fr' ? '6 septembre 2026' : language === 'it' ? '6 settembre 2026' : '6 September 2026',
    },
    {
      id: 5,
      title: language === 'es'
        ? 'El Circuito Urbano de Madrid recibe la homologación oficial de la FIA'
        : language === 'fr'
        ? 'Le Circuit Urbain de Madrid est homologué pour le GP d’Espagne'
        : language === 'it'
        ? 'Il Circuito Cittadino di Madrid omologato per il GP di Spagna'
        : 'Madrid Street Circuit homologated for Spanish GP',
      desc: language === 'es'
        ? 'El trazado semiurbano de IFEMA Madrid superó con honores todas las inspecciones de seguridad y grado 1 de la FIA.'
        : language === 'fr'
        ? 'Le tout nouveau circuit hybride d’IFEMA Madrid a passé toutes les inspections de la FIA avec des retours très positifs.'
        : language === 'it'
        ? 'Il nuovo tracciato ibrido di IFEMA Madrid ha superato tutte le ispezioni FIA con pareri molto positivi.'
        : 'The brand new IFEMA Madrid hybrid street circuit completed all FIA inspections with positive feedback from drivers.',
      tag: t('news_circuit_tag'),
      tagClass: 'f1-tag-circuit',
      date: language === 'es' ? '10 de septiembre de 2026' : language === 'fr' ? '10 septembre 2026' : language === 'it' ? '10 settembre 2026' : '10 September 2026',
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
          <span>{t('tab_dashboard')}</span>
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
          title={t('tab_telemetry')}
        >
          <div className="f1-countdown-tag-row">
            <span className="f1-countdown-pill">R{nextGp.round}</span>
            <span className="f1-countdown-title">{nextGp.country || nextGp.name}: {t('news_race_tag')}</span>
          </div>

          <div className="f1-countdown-grid">
            <div className="f1-digit-block">
              <span className="f1-digit-value">{String(countdown.days).padStart(2, '0')}</span>
              <span className="f1-digit-label">{t('days_short')}</span>
            </div>
            <div className="f1-digit-block">
              <span className="f1-digit-value">{String(countdown.hours).padStart(2, '0')}</span>
              <span className="f1-digit-label">{t('hours_short')}</span>
            </div>
            <div className="f1-digit-block">
              <span className="f1-digit-value">{String(countdown.minutes).padStart(2, '0')}</span>
              <span className="f1-digit-label">{t('mins_short')}</span>
            </div>
            <div className="f1-digit-block">
              <span className="f1-digit-value">{String(countdown.seconds).padStart(2, '0')}</span>
              <span className="f1-digit-label">{t('secs_short')}</span>
            </div>
          </div>
        </div>

        {/* Card 2: 2026 Schedule Card */}
        <div 
          className="f1-schedule-card"
          onClick={() => onNavigate('schedule')}
          title={t('view_full_schedule')}
        >
          <div className="f1-schedule-info">
            <span className="f1-card-subtitle">{t('schedule_card_title')}</span>
            <div className="f1-schedule-country">
              <span>{nextGp.flag}</span>
              <span>{nextGp.country}</span>
            </div>
            <span className="f1-schedule-progress">{t('season_completed_label', { pct: seasonProgressPct })}</span>
          </div>

          <div className="f1-schedule-track-preview">
            <svg viewBox={nextCircuit.viewBox || "0 0 850 520"}>
              <path 
                d={nextCircuit.svgPath} 
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
            <span>Lindblad - {t('round')} 11  🇭🇺 {language === 'es' ? 'Hungría' : language === 'fr' ? 'Hongrie' : language === 'it' ? 'Ungheria' : 'Hungary'}</span>
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
                  <th className="f1-th-pos">{t('col_pos')}</th>
                  <th>{t('col_driver')}</th>
                  <th className="f1-th-pts">{t('col_points')}</th>
                  <th className="f1-th-evo">{t('col_evo')}</th>
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
                  <th className="f1-th-pos">{t('col_pos')}</th>
                  <th>{t('col_constructor')}</th>
                  <th className="f1-th-pts">{t('col_points')}</th>
                  <th className="f1-th-evo">{t('col_evo')}</th>
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
