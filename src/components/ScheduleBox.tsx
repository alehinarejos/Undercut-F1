import React, { useState, useEffect } from 'react';
import { 
  scheduleSyncService, 
  getGrandPrixTimeline, 
  getNextUpcomingGrandPrix, 
  isGrandPrixCompleted, 
  getRaceTargetTimestamp 
} from '../services/scheduleSyncService';
import type { ScheduleSyncState } from '../services/scheduleSyncService';
import { useLanguage } from '../context/LanguageContext';
import { RaceResultsModal } from './RaceResultsModal';
import { Calendar, Clock, ChevronRight, Trophy, Sparkles, Flag, CheckCircle } from 'lucide-react';

interface ScheduleBoxProps {
  onOpenFullSchedule: () => void;
}

export const ScheduleBox: React.FC<ScheduleBoxProps> = ({ onOpenFullSchedule }) => {
  const { t } = useLanguage();
  const [syncState, setSyncState] = useState<ScheduleSyncState>(scheduleSyncService.getState());
  const [modalRound, setModalRound] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = scheduleSyncService.subscribe((state) => {
      setSyncState({ ...state });
    });
    return () => unsubscribe();
  }, []);

  const schedule = syncState.schedule;
  const nextGp = getNextUpcomingGrandPrix(schedule);
  const completedGps = schedule.filter(gp => isGrandPrixCompleted(gp));
  const lastCompletedGp = completedGps[completedGps.length - 1];

  const timeline = getGrandPrixTimeline(nextGp);
  const nextTargetSession = timeline.nextSession;
  const lastFinished = timeline.lastCompletedSession;
  const activeSession = timeline.activeSession;

  const targetDateMs = nextTargetSession 
    ? nextTargetSession.startTime 
    : getRaceTargetTimestamp(nextGp);

  // Live countdown to next race/session
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const targetDate = isNaN(targetDateMs) ? Date.now() : targetDateMs;

    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, targetDate - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDateMs]);

  return (
    <div className="schedule-card">
      {/* Top Header */}
      <div className="schedule-header">
        <div className="schedule-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar color="var(--f1-red)" size={18} />
            <span className="schedule-title-main">{t('schedule_title')}</span>
          </div>
          <span className="schedule-badge-hours">
            <Sparkles size={10} />
            <span>{t('official_hours')}</span>
          </span>
        </div>

        <div className="schedule-header-actions">
          {lastCompletedGp && (
            <button
              onClick={() => setModalRound(lastCompletedGp.round)}
              className="f1-btn schedule-action-btn-results"
              title="Ver resultados oficiales de la última carrera"
            >
              <Trophy size={12} color="#ffd700" />
              <span>{t('results_r15')}</span>
            </button>
          )}

          <button 
            onClick={onOpenFullSchedule}
            className="f1-btn f1-btn-active schedule-action-btn-full" 
          >
            <span>{t('view_full_schedule')}</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minWidth: 0 }}>
        {/* Next GP Info + Countdown to the right of GP name */}
        <div className="schedule-gp-hero">
          <div className="schedule-gp-details">
            <span className="next-gp-flag" style={{ fontSize: '2.2rem', lineHeight: 1, flexShrink: 0 }}>{nextGp.flag}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--f1-red)', fontWeight: 800 }}>
                  {t('round').toUpperCase()} {nextGp.round} • {t('next_gp')}
                </span>
                <span style={{ 
                  fontSize: '0.64rem', 
                  color: '#00D7B6', 
                  background: 'rgba(0, 215, 182, 0.12)', 
                  padding: '1px 6px', 
                  borderRadius: '4px', 
                  fontFamily: 'var(--font-mono)', 
                  fontWeight: 600 
                }}>
                  {t('official_f1_data').toUpperCase()}
                </span>
              </div>

              {/* GP Name with Countdown directly to the right or wrapped */}
              <div className="schedule-gp-title-row">
                <span className="next-gp-name" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.2rem', color: '#fff' }}>
                  {nextGp.name} 2026
                </span>

                {/* Countdown Box */}
                <div className="schedule-countdown-box">
                  <Clock size={12} color={activeSession ? 'var(--f1-red)' : '#00D7B6'} />
                  <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                    {activeSession 
                      ? `${t('live')}:` 
                      : lastFinished && nextTargetSession 
                      ? `${t('session_next')} (${nextTargetSession.session.name.toUpperCase()}):` 
                      : `${t('next_event_in').toUpperCase()}`}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.88rem', color: '#fff', letterSpacing: '0.04em' }}>
                    {timeLeft.days > 0 && `${timeLeft.days}d `}
                    {(timeLeft.days > 0 || timeLeft.hours > 0) && (
                      <>{timeLeft.days > 0 ? String(timeLeft.hours).padStart(2, '0') : timeLeft.hours}h </>
                    )}
                    {(timeLeft.days > 0 || timeLeft.hours > 0 || timeLeft.minutes > 0) && (
                      <>{(timeLeft.days > 0 || timeLeft.hours > 0) ? String(timeLeft.minutes).padStart(2, '0') : timeLeft.minutes}m </>
                    )}
                    <strong style={{ color: 'var(--f1-red)' }}>{String(timeLeft.seconds).padStart(2, '0')}s</strong>
                  </span>
                </div>
              </div>

              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nextGp.circuitName} • {nextGp.startDate} {t('date_to')} {nextGp.endDate}
              </span>
            </div>
          </div>
        </div>

        {/* Sessions list underneath with live status */}
        <div className="schedule-sessions-strip">
          {timeline.sessions.map((sessInfo, idx) => {
            const isRace = sessInfo.session.type === 'Race';
            const isCompleted = sessInfo.status === 'completed';
            const isLive = sessInfo.status === 'live';
            const isNext = sessInfo.status === 'next';
            const isNoTime = sessInfo.formattedTime === 'n/d';

            return (
              <div 
                key={idx} 
                className={`schedule-session-card ${isLive ? 'is-live' : isNext ? 'is-next' : isRace ? 'is-race' : isCompleted ? 'is-completed' : ''}`}
              >
                <div className="session-card-top">
                  <div className="session-card-name-group">
                    {isLive ? (
                      <span className="live-pulse-dot" />
                    ) : isCompleted ? (
                      <CheckCircle size={12} color="#00D7B6" />
                    ) : isRace ? (
                      <Flag size={12} color="var(--f1-red)" />
                    ) : (
                      <Clock size={11} color="var(--text-muted)" />
                    )}
                    <span className="session-card-name" title={sessInfo.session.name}>{sessInfo.session.name}</span>
                  </div>

                  {isLive && (
                    <span className="session-badge-live">
                      {t('session_live')}
                    </span>
                  )}
                  {isCompleted && (
                    <span className="session-badge-fin">
                      {t('session_fin')}
                    </span>
                  )}
                  {isNext && (
                    <span className="session-badge-next">
                      {t('session_next')}
                    </span>
                  )}
                </div>

                <div className="session-card-bottom">
                  <span className="session-card-date">
                    {sessInfo.formattedDate}
                  </span>
                  <span className={`session-card-time ${isCompleted ? 'time-completed' : isNoTime ? 'time-notime' : isRace ? 'time-race' : 'time-active'}`}>
                    {sessInfo.formattedTime}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalRound !== null && (
        <RaceResultsModal
          round={modalRound}
          onClose={() => setModalRound(null)}
          onSelectRound={(r) => setModalRound(r)}
        />
      )}
    </div>
  );
};
