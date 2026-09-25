import React, { useState, useMemo } from 'react';
import type { RaceControlMessage, TeamRadio } from '../types/telemetry';
import { 
  Flag, 
  AlertTriangle, 
  Info, 
  CloudRain, 
  Volume2, 
  VolumeX, 
  Filter, 
  CheckCircle2, 
  Ban, 
  Car, 
  Zap, 
  Disc, 
  Radio, 
  ShieldAlert 
} from 'lucide-react';
import { soundFx } from '../services/soundFx';
import { useLanguage } from '../context/LanguageContext';

interface RaceControlProps {
  messages: RaceControlMessage[];
  radios: TeamRadio[];
}

type FilterCategory = 'all' | 'flags' | 'limits' | 'sc' | 'pit' | 'info';

interface BadgeMeta {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  categoryGroup: FilterCategory;
}

export const RaceControl: React.FC<RaceControlProps> = ({
  messages,
  radios,
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'rc' | 'radio'>('rc');
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all');
  const [showFilters, setShowFilters] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [playingRadioId, setPlayingRadioId] = useState<string | null>(null);

  const handlePlayRadio = (id: string) => {
    if (soundEnabled) {
      soundFx.playRadioIntro();
    }
    setPlayingRadioId(id);
    setTimeout(() => {
      setPlayingRadioId(null);
    }, 3800);
  };

  const toggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  const cleanMessageText = (txt?: string): string => {
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

  // Helper to extract category, badges and colors matching Formula1Dashboard exactly
  const getBadgeMeta = (msg: RaceControlMessage): BadgeMeta => {
    const cleaned = cleanMessageText(msg.messageEn);
    const rawEn = (cleaned || '').toUpperCase();
    const sectorMatch = rawEn.match(/(?:SECTOR|TRACK SECTOR)\s*(\d+)/i) || (msg.scope?.match(/Sector\s*(\d+)/i));
    const secNum = sectorMatch ? sectorMatch[1] : null;

    // 1. Double Yellow
    if (rawEn.includes('DOUBLE YELLOW') || msg.flag === 'DOUBLE_YELLOW') {
      return {
        title: secNum ? `Double Yellow (Sec. ${secNum})` : 'Double Yellow',
        icon: AlertTriangle,
        accentColor: '#f59e0b',
        borderColor: '#d97706',
        bgColor: 'rgba(217, 119, 6, 0.08)',
        categoryGroup: 'flags',
      };
    }

    // 2. Yellow Flag
    if (rawEn.includes('YELLOW') || msg.flag === 'YELLOW') {
      return {
        title: secNum ? `Yellow (Sec. ${secNum})` : 'Yellow Flag',
        icon: Flag,
        accentColor: '#fbbf24',
        borderColor: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.07)',
        categoryGroup: 'flags',
      };
    }

    // 3. Red Flag
    if (rawEn.includes('RED FLAG') || msg.flag === 'RED') {
      return {
        title: 'Red Flag',
        icon: Flag,
        accentColor: '#f87171',
        borderColor: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.10)',
        categoryGroup: 'flags',
      };
    }

    // 4. Safety Car / VSC
    if (rawEn.includes('SAFETY CAR') || msg.category === 'SAFETY_CAR') {
      const isVsc = rawEn.includes('VIRTUAL') || rawEn.includes('VSC');
      return {
        title: isVsc ? 'Virtual Safety Car' : 'Safety Car',
        icon: Car,
        accentColor: '#facc15',
        borderColor: '#eab308',
        bgColor: 'rgba(234, 179, 8, 0.09)',
        categoryGroup: 'sc',
      };
    }

    // 5. Track Limits / Lap Deleted
    if (rawEn.includes('TRACK LIMITS') || rawEn.includes('LAP DELETED') || msg.category === 'TRACK_LIMITS') {
      return {
        title: rawEn.includes('LAP DELETED') ? 'Lap Deleted' : 'Track Limits',
        icon: Ban,
        accentColor: '#fb7185',
        borderColor: '#f43f5e',
        bgColor: 'rgba(244, 63, 94, 0.07)',
        categoryGroup: 'limits',
      };
    }

    // 6. Pit Exit / Pit Lane
    if (rawEn.includes('PIT EXIT') || msg.scope === 'Pit Lane' || rawEn.includes('PIT LANE')) {
      const isClosed = rawEn.includes('CLOSED');
      return {
        title: rawEn.includes('OPEN') ? 'Pit Exit Open' : isClosed ? 'Pit Exit Closed' : 'Pit Lane',
        icon: Disc,
        accentColor: isClosed ? '#f87171' : '#34d399',
        borderColor: isClosed ? '#ef4444' : '#10b981',
        bgColor: isClosed ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.06)',
        categoryGroup: 'pit',
      };
    }

    // 7. Green / Track Clear
    if (rawEn.includes('CLEAR IN TRACK') || rawEn.includes('TRACK CLEAR') || msg.flag === 'GREEN') {
      return {
        title: secNum ? `Green (Sec. ${secNum})` : 'Green Flag',
        icon: CheckCircle2,
        accentColor: '#34d399',
        borderColor: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.06)',
        categoryGroup: 'flags',
      };
    }

    // 8. Weather / Rain
    if (rawEn.includes('RAIN') || rawEn.includes('WEATHER') || rawEn.includes('WET')) {
      return {
        title: rawEn.includes('RISK OF RAIN') ? 'Risk of Rain' : 'Weather',
        icon: CloudRain,
        accentColor: '#38bdf8',
        borderColor: '#0ea5e9',
        bgColor: 'rgba(14, 165, 233, 0.07)',
        categoryGroup: 'info',
      };
    }

    // 9. DRS
    if (rawEn.includes('DRS') || msg.category === 'DRS') {
      return {
        title: rawEn.includes('DISABLED') ? 'DRS Disabled' : 'DRS Enabled',
        icon: Zap,
        accentColor: rawEn.includes('DISABLED') ? '#fbbf24' : '#34d399',
        borderColor: rawEn.includes('DISABLED') ? '#f59e0b' : '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.06)',
        categoryGroup: 'info',
      };
    }

    // 10. Chequered Flag
    if (rawEn.includes('CHEQUERED') || msg.flag === 'CHEQUERED') {
      return {
        title: 'Chequered Flag',
        icon: Flag,
        accentColor: '#c084fc',
        borderColor: '#a855f7',
        bgColor: 'rgba(168, 85, 247, 0.08)',
        categoryGroup: 'flags',
      };
    }

    // Default: Info
    return {
      title: 'Info',
      icon: Info,
      accentColor: '#60a5fa',
      borderColor: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.06)',
      categoryGroup: 'info',
    };
  };

  // Filter messages
  const filteredMessages = useMemo(() => {
    if (selectedFilter === 'all') return messages;
    return messages.filter(msg => {
      const meta = getBadgeMeta(msg);
      return meta.categoryGroup === selectedFilter;
    });
  }, [messages, selectedFilter]);

  // Counts for filters
  const filterCounts = useMemo(() => {
    const counts: Record<FilterCategory, number> = {
      all: messages.length,
      flags: 0,
      limits: 0,
      sc: 0,
      pit: 0,
      info: 0,
    };
    messages.forEach(msg => {
      const meta = getBadgeMeta(msg);
      counts[meta.categoryGroup]++;
    });
    return counts;
  }, [messages]);

  return (
    <div className="f1-card race-control-container f1dash-style">
      {/* Unified Compact Header Bar: Tabs on the left, action buttons on the right */}
      <div className="f1dash-rc-header compact">
        {/* Left: Compact Segmented Tabs */}
        <div className="f1dash-tab-group-compact">
          <button
            className={`f1dash-tab-segment compact ${activeTab === 'rc' ? 'active' : ''}`}
            onClick={() => setActiveTab('rc')}
          >
            <ShieldAlert size={12} />
            <span>{t('race_control')}</span>
            <span className="f1dash-tab-cnt">{messages.length}</span>
          </button>

          <button
            className={`f1dash-tab-segment compact ${activeTab === 'radio' ? 'active' : ''}`}
            onClick={() => setActiveTab('radio')}
          >
            <Radio size={12} />
            <span>{t('team_radios')}</span>
            <span className="f1dash-tab-cnt">{radios.length}</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="f1dash-header-actions">
          {/* Filter Toggle Button */}
          {activeTab === 'rc' && (
            <button
              className={`f1dash-action-btn compact ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(prev => !prev)}
              title="Filtros"
            >
              <Filter size={11} />
            </button>
          )}

          {/* Audio Sound Toggle Button */}
          <button
            className={`f1dash-action-btn compact ${soundEnabled ? 'sound-on' : 'sound-off'}`}
            onClick={toggleSound}
            title={soundEnabled ? 'Silenciar notificaciones' : 'Activar sonido'}
          >
            {soundEnabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
          </button>
        </div>
      </div>


      {/* Filter Chips Bar (Collapsible / Formula1Dashboard style) */}
      {activeTab === 'rc' && showFilters && (
        <div className="f1dash-filter-chips-bar">
          <button
            className={`f1dash-chip ${selectedFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('all')}
          >
            {t('filter_all_badge')} <span className="chip-cnt">{filterCounts.all}</span>
          </button>
          <button
            className={`f1dash-chip chip-flags ${selectedFilter === 'flags' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('flags')}
          >
            {t('filter_flags')} <span className="chip-cnt">{filterCounts.flags}</span>
          </button>
          <button
            className={`f1dash-chip chip-limits ${selectedFilter === 'limits' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('limits')}
          >
            {t('filter_limits')} <span className="chip-cnt">{filterCounts.limits}</span>
          </button>
          <button
            className={`f1dash-chip chip-sc ${selectedFilter === 'sc' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('sc')}
          >
            {t('filter_sc')} <span className="chip-cnt">{filterCounts.sc}</span>
          </button>
          <button
            className={`f1dash-chip chip-pit ${selectedFilter === 'pit' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('pit')}
          >
            {t('filter_pit')} <span className="chip-cnt">{filterCounts.pit}</span>
          </button>
          <button
            className={`f1dash-chip chip-info ${selectedFilter === 'info' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('info')}
          >
            {t('filter_info')} <span className="chip-cnt">{filterCounts.info}</span>
          </button>
        </div>
      )}

      {/* Feed List */}
      <div className="feed-list f1dash-feed-list">
        {activeTab === 'rc' ? (
          filteredMessages.length === 0 ? (
            <div className="f1dash-empty-state">
              <Info size={18} opacity={0.5} />
              <span>{t('no_rc_messages')}</span>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const meta = getBadgeMeta(msg);
              const IconComp = meta.icon;

              return (
                <div 
                  key={msg.id} 
                  className="f1dash-card"
                  style={{
                    borderLeftColor: meta.borderColor,
                    backgroundColor: meta.bgColor,
                  }}
                >
                  {/* Top Bar: Icon + Event Title (Left) and Monospace Timestamp (Right) */}
                  <div className="f1dash-card-header">
                    <div 
                      className="f1dash-card-tag"
                      style={{ color: meta.accentColor }}
                    >
                      <IconComp size={13} style={{ flexShrink: 0 }} />
                      <span className="f1dash-tag-text">{meta.title}</span>
                    </div>

                    <span className="f1dash-timestamp">
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Body Message */}
                  <div className="f1dash-card-body">
                    {cleanMessageText(msg.messageEn)}
                  </div>

                  {/* Spanish translation if active */}
                  {language !== 'en' && msg.messageEs && msg.messageEs !== msg.messageEn && (
                    <div className="f1dash-card-translation">
                      {cleanMessageText(msg.messageEs)}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          /* Team Radios Feed */
          radios.length === 0 ? (
            <div className="f1dash-empty-state">
              <Radio size={18} opacity={0.5} />
              <span>{t('no_radios_available')}</span>
            </div>
          ) : (
            radios.map((radio) => {
              const isPlaying = playingRadioId === radio.id;
              const teamCol = radio.driver.teamColor || '#38bdf8';

              return (
                <div 
                  key={radio.id} 
                  className="f1dash-radio-card"
                  style={{
                    borderLeftColor: teamCol,
                  }}
                >
                  <div className="f1dash-card-header">
                    <div className="f1dash-radio-driver">
                      <span className="f1dash-driver-flag">{radio.driver.flag}</span>
                      <strong style={{ color: teamCol }}>
                        {radio.driver.code} #{radio.driver.number}
                      </strong>
                      <span className="f1dash-radio-speaker">
                        [{radio.speaker === 'Driver' ? t('speaker_driver') : t('speaker_engineer')}]
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="f1dash-timestamp">
                        {radio.timestamp}
                      </span>
                      <button
                        className={`f1dash-radio-play-btn ${isPlaying ? 'playing' : ''}`}
                        onClick={() => handlePlayRadio(radio.id)}
                        title={t('play_radio')}
                      >
                        {isPlaying ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      </button>
                    </div>
                  </div>

                  <div className="f1dash-radio-text">
                    "{radio.messageEn}"
                  </div>

                  {language !== 'en' && radio.messageEs && (
                    <div className="f1dash-card-translation">
                      "{radio.messageEs}"
                    </div>
                  )}

                  {isPlaying && (
                    <div className="f1dash-waveform-bar">
                      <div className="wave-bars">
                        {Array.from({ length: 16 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="wave-bar" 
                            style={{ 
                              animationDelay: `${(i % 5) * 0.1}s`,
                              backgroundColor: teamCol 
                            }} 
                          />
                        ))}
                      </div>
                      <span className="f1dash-audio-live-tag">
                        {t('audio_broadcasting')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
};
