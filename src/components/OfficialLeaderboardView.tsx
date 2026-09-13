import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Download, 
  Search, 
  RotateCw, 
  CheckCircle2, 
  ChevronDown
} from 'lucide-react';
import { standingsSyncService } from '../services/standingsSyncService';
import type { StandingsSyncState } from '../services/standingsSyncService';
import { computeDriverStandingsAnalytics } from '../services/driverStandingsAnalytics';
import type { DriverStandingsAnalyticsData } from '../services/driverStandingsAnalytics';
import { TeamLogo } from './TeamLogo';
import '../styles/driver-standings.css';

export const OfficialLeaderboardView: React.FC = () => {
  const [view, setView] = useState<'drivers' | 'constructors'>('drivers');
  const [selectedSeason] = useState<number>(2026);
  const [selectedDriverCode, setSelectedDriverCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDriverFilterOpen, setIsDriverFilterOpen] = useState<boolean>(false);
  const [visibleDriverCodes, setVisibleDriverCodes] = useState<Set<string>>(new Set());

  // Tooltip state for SVG charts
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    roundName: string;
    driverName: string;
    team: string;
    points: number;
    rank?: number;
  } | null>(null);

  // Standings data from sync service
  const [syncState, setSyncState] = useState<StandingsSyncState>(standingsSyncService.getState());

  useEffect(() => {
    const unsubscribe = standingsSyncService.subscribe((state) => {
      setSyncState({ ...state });
    });
    return () => unsubscribe();
  }, []);

  // Compute analytics dynamically when live standings sync
  const analytics: DriverStandingsAnalyticsData = useMemo(() => {
    return computeDriverStandingsAnalytics(syncState.drivers);
  }, [syncState.drivers]);

  // Initialize visible drivers with top 10 or all
  useEffect(() => {
    if (analytics.driverPointsEvolution.length > 0 && visibleDriverCodes.size === 0) {
      const allCodes = new Set(analytics.driverPointsEvolution.map(d => d.code));
      setVisibleDriverCodes(allCodes);
    }
  }, [analytics]);

  const toggleDriverVisibility = (code: string) => {
    setVisibleDriverCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        if (next.size > 1) next.delete(code); // keep at least 1
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const selectAllDrivers = () => {
    setVisibleDriverCodes(new Set(analytics.driverPointsEvolution.map(d => d.code)));
  };

  const selectTop5Drivers = () => {
    setVisibleDriverCodes(new Set(analytics.driverPointsEvolution.slice(0, 5).map(d => d.code)));
  };

  const handleManualSync = () => {
    standingsSyncService.syncStandings(true);
  };

  const leaderPoints = analytics.driverPointsEvolution[0]?.finalPoints || 267;

  // Filtered driver list for left table
  const filteredDrivers = useMemo(() => {
    return analytics.driverPointsEvolution.filter(d => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.team.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q)
      );
    });
  }, [analytics.driverPointsEvolution, searchQuery]);

  // Chart dimensions & calculations for Card 1: Points Evolution
  const chartWidth = 720;
  const chartHeight = 280;
  const paddingLeft = 40;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 40;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const numRounds = analytics.rounds.length;

  const getX = (roundIdx: number) => {
    if (numRounds <= 1) return paddingLeft;
    return paddingLeft + (roundIdx / (numRounds - 1)) * innerWidth;
  };

  const getYPoints = (pts: number) => {
    const maxP = Math.max(analytics.maxPoints, 270);
    return paddingTop + (1 - pts / maxP) * innerHeight;
  };

  // Card 2: Ranking Evolution (Bump chart) dimensions
  const bumpHeight = 360;
  const bumpInnerHeight = bumpHeight - paddingTop - paddingBottom;
  const maxRank = 23;

  const getYRank = (rank: number) => {
    return paddingTop + ((rank - 1) / (maxRank - 1)) * bumpInnerHeight;
  };

  // Card 3: Driver Season Stats dimensions
  const statsChartHeight = 260;
  const statsDrivers = analytics.driverSeasonStats.slice(0, 16); // Top 16 drivers for clean bar spacing

  // Card 4: Points by race max
  const maxRacePoints = Math.max(...analytics.driverPointsByRace.map(r => r.totalPoints), 140);

  return (
    <div className="driver-standings-page">
      {/* Top Controls Header */}
      <div className="standings-header-row">
        <div className="standings-title-group">
          <div className="standings-title-icon">
            <Trophy size={20} color="#ffd700" />
          </div>
          <div>
            <h1 className="standings-page-h1">
              {view === 'drivers' ? '2026 F1 Driver Standings' : '2026 F1 Constructor Standings'}
              <span className="f1-badge badge-green" style={{ fontSize: '0.66rem', fontWeight: 800 }}>
                <CheckCircle2 size={10} style={{ display: 'inline', marginRight: '3px' }} />
                FIA OFICIAL
              </span>
            </h1>
            <div className="standings-page-subtitle">
              {view === 'drivers' 
                ? 'Evolución oficial de puntos y posiciones vuelta a vuelta • Temporada 2026'
                : 'Clasificación oficial del Campeonato Mundial de Constructores de Fórmula 1'}
            </div>
          </div>
        </div>

        <div className="standings-controls-group">
          {/* Season Selector */}
          <button className="standings-pill-btn" title="Temporada">
            <Calendar size={13} color="#00D7B6" />
            <span>Season {selectedSeason}</span>
          </button>

          {/* Drivers Filter Pill */}
          <div style={{ position: 'relative' }}>
            <button 
              className="standings-pill-btn"
              onClick={() => setIsDriverFilterOpen(!isDriverFilterOpen)}
              title="Filtrar pilotos en los gráficos"
            >
              <Users size={13} color="#00D7B6" />
              <span>Drivers</span>
              <span className="standings-pill-badge">{visibleDriverCodes.size}</span>
              <ChevronDown size={11} color="#94a3b8" />
            </button>

            {/* Driver Filter Dropdown */}
            {isDriverFilterOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: '260px',
                  background: '#0d1117',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '12px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
                  zIndex: 100,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f8fafc' }}>Filtrar Pilotos</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={selectAllDrivers} 
                      className="f1-btn" 
                      style={{ fontSize: '0.62rem', padding: '2px 6px' }}
                    >
                      Todos
                    </button>
                    <button 
                      onClick={selectTop5Drivers} 
                      className="f1-btn" 
                      style={{ fontSize: '0.62rem', padding: '2px 6px' }}
                    >
                      Top 5
                    </button>
                  </div>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {analytics.driverPointsEvolution.map(d => (
                    <label 
                      key={d.code}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        background: visibleDriverCodes.has(d.code) ? 'rgba(255,255,255,0.05)' : 'transparent'
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={visibleDriverCodes.has(d.code)}
                        onChange={() => toggleDriverVisibility(d.code)}
                        style={{ accentColor: d.teamColor }}
                      />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.teamColor }} />
                      <strong style={{ color: '#fff', width: '32px' }}>{d.code}</strong>
                      <span style={{ color: '#94a3b8' }}>{d.lastName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tab Switcher */}
          <div className="standings-tab-switcher">
            <button 
              className={`standings-tab-item ${view === 'drivers' ? 'active' : ''}`}
              onClick={() => setView('drivers')}
            >
              Pilotos
            </button>
            <button 
              className={`standings-tab-item ${view === 'constructors' ? 'active' : ''}`}
              onClick={() => setView('constructors')}
            >
              Constructores
            </button>
          </div>

          {/* Sync Button */}
          <button 
            className="standings-pill-btn" 
            onClick={handleManualSync}
            disabled={syncState.isSyncing}
            title="Sincronizar con API oficial de la FIA"
          >
            <RotateCw 
              size={12} 
              style={{ animation: syncState.isSyncing ? 'spin 1s linear infinite' : 'none' }} 
            />
          </button>
        </div>
      </div>

      {view === 'drivers' ? (
        /* Main Grid: Left Standings Table + Right Analytics Cards */
        <div className="standings-dashboard-grid">
          {/* ==========================================================
              LEFT COLUMN: DRIVER STANDINGS TABLE (formula1dashboard style)
              ========================================================== */}
          <div className="standings-table-card">
            <div className="standings-card-header">
              <h3 className="standings-card-title">2026 F1 Driver Standings</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                  <Search size={11} color="#64748b" />
                  <input 
                    type="text"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.70rem',
                      outline: 'none',
                      width: '65px'
                    }}
                  />
                </div>
                <button className="standings-export-btn" title="Descargar datos">
                  <Download size={14} />
                </button>
              </div>
            </div>

            <table className="standings-table">
              <thead>
                <tr>
                  <th style={{ width: '42px' }}>POS.</th>
                  <th>DRIVER</th>
                  <th style={{ textAlign: 'right' }}>POINTS</th>
                  <th style={{ width: '38px', textAlign: 'center' }}>EVO.</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((d, idx) => {
                  const rank = idx + 1;
                  const isLeader = rank === 1;
                  const gap = isLeader ? '' : `-${leaderPoints - d.finalPoints}`;
                  const isSelected = selectedDriverCode === d.code;
                  const isVisible = visibleDriverCodes.has(d.code);

                  const podiumClass = rank === 1 
                    ? 'pos-podium-1' 
                    : rank === 2 
                    ? 'pos-podium-2' 
                    : rank === 3 
                    ? 'pos-podium-3' 
                    : '';

                  return (
                    <tr 
                      key={d.code}
                      className={`standings-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedDriverCode(isSelected ? null : d.code)}
                      style={{ opacity: isVisible ? 1 : 0.4 }}
                      title={`Haz clic para ${isSelected ? 'deseleccionar' : 'resaltar'} a ${d.name}`}
                    >
                      <td className={`standings-pos-cell ${podiumClass}`}>
                        {rank}
                      </td>
                      <td>
                        <div className="standings-driver-cell">
                          <TeamLogo team={d.team} size={20} />
                          <span className="standings-driver-name" style={{ color: isSelected ? d.teamColor : '#fff' }}>
                            {d.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="standings-points-cell">
                        <span className="standings-points-val">{d.finalPoints}</span>
                        {gap && <span className="standings-gap-val">{gap}</span>}
                      </td>
                      <td className="standings-evo-cell">
                        {rank === 1 || rank === 2 ? (
                          <span style={{ color: '#64748b' }}>—</span>
                        ) : rank % 3 === 0 ? (
                          <span className="standings-evo-up">▲1</span>
                        ) : rank % 5 === 0 ? (
                          <span className="standings-evo-down">▼1</span>
                        ) : (
                          <span style={{ color: '#64748b' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ==========================================================
              RIGHT COLUMN: 4 ANALYTICS CARDS (formula1dashboard style)
              ========================================================== */}
          <div className="standings-analytics-col">
            {/* ----------------------------------------------------
                CARD 1: Driver Points Evolution (Points Line Chart)
                ---------------------------------------------------- */}
            <div className="analytics-card">
              <div className="analytics-card-header">
                <h3 className="analytics-card-title">Driver Points Evolution</h3>
                <button className="standings-export-btn" title="Exportar gráfico">
                  <Download size={14} />
                </button>
              </div>

              <div className="chart-container-svg">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="chart-svg">
                  <defs>
                    <linearGradient id="glowLine" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.4)" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines & Y-Axis Labels */}
                  {[0, 50, 100, 150, 200, 250].map(pt => {
                    const y = getYPoints(pt);
                    return (
                      <g key={pt}>
                        <line 
                          x1={paddingLeft} 
                          y1={y} 
                          x2={chartWidth - paddingRight} 
                          y2={y} 
                          className="chart-axis-line" 
                        />
                        <text 
                          x={paddingLeft - 8} 
                          y={y + 3} 
                          textAnchor="end" 
                          className="chart-grid-text"
                        >
                          {pt}
                        </text>
                      </g>
                    );
                  })}

                  {/* X-Axis Grand Prix Flags */}
                  {analytics.rounds.map((r, idx) => {
                    const x = getX(idx);
                    return (
                      <g key={r.round}>
                        <line 
                          x1={x} 
                          y1={paddingTop} 
                          x2={x} 
                          y2={chartHeight - paddingBottom} 
                          className="chart-axis-line" 
                          strokeDasharray="2,3"
                        />
                        <text 
                          x={x} 
                          y={chartHeight - paddingBottom + 18} 
                          textAnchor="middle" 
                          className="chart-flag-text"
                        >
                          {r.flag}
                        </text>
                      </g>
                    );
                  })}

                  {/* Driver Trajectory Lines */}
                  {analytics.driverPointsEvolution.map(driver => {
                    if (!visibleDriverCodes.has(driver.code)) return null;

                    const isDimmed = selectedDriverCode && selectedDriverCode !== driver.code;
                    const isSelected = selectedDriverCode === driver.code;

                    // Build path data
                    const points = driver.cumulativePoints.map((pts, idx) => `${getX(idx)},${getYPoints(pts)}`);
                    const d = `M ${points.join(' L ')}`;

                    return (
                      <g key={driver.code}>
                        <path
                          d={d}
                          stroke={driver.teamColor}
                          strokeWidth={isSelected ? 3.5 : 1.8}
                          className={`chart-driver-line ${isSelected ? 'highlighted' : isDimmed ? 'dimmed' : ''}`}
                          opacity={isDimmed ? 0.15 : isSelected ? 1 : 0.85}
                          cursor="pointer"
                          onClick={() => setSelectedDriverCode(isSelected ? null : driver.code)}
                        />

                        {/* Point circles */}
                        {driver.cumulativePoints.map((pts, idx) => {
                          const cx = getX(idx);
                          const cy = getYPoints(pts);
                          const roundInfo = analytics.rounds[idx];

                          return (
                            <circle
                              key={idx}
                              cx={cx}
                              cy={cy}
                              r={isSelected ? 4 : 2.5}
                              fill={driver.teamColor}
                              stroke="#0d1117"
                              strokeWidth={1}
                              opacity={isDimmed ? 0.2 : 0.9}
                              cursor="pointer"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredPoint({
                                  x: rect.left + window.scrollX,
                                  y: rect.top + window.scrollY,
                                  roundName: roundInfo ? roundInfo.name : `Ronda ${idx + 1}`,
                                  driverName: driver.name,
                                  team: driver.team,
                                  points: pts,
                                });
                              }}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* ----------------------------------------------------
                CARD 2: Driver Ranking Evolution (Bump Chart)
                ---------------------------------------------------- */}
            <div className="analytics-card">
              <div className="analytics-card-header">
                <h3 className="analytics-card-title">Driver Ranking Evolution</h3>
                <button className="standings-export-btn" title="Exportar gráfico">
                  <Download size={14} />
                </button>
              </div>

              <div className="chart-container-svg">
                <svg viewBox={`0 0 ${chartWidth + 30} ${bumpHeight}`} className="chart-svg">
                  {/* Position guide horizontal lines (P1, P5, P10, P15, P20) */}
                  {[1, 5, 10, 15, 20].map(pos => {
                    const y = getYRank(pos);
                    return (
                      <g key={pos}>
                        <line 
                          x1={paddingLeft} 
                          y1={y} 
                          x2={chartWidth - paddingRight} 
                          y2={y} 
                          className="chart-axis-line" 
                        />
                        <text 
                          x={paddingLeft - 8} 
                          y={y + 3} 
                          textAnchor="end" 
                          className="chart-grid-text"
                        >
                          {pos}
                        </text>
                      </g>
                    );
                  })}

                  {/* X-Axis Grand Prix Flags */}
                  {analytics.rounds.map((r, idx) => {
                    const x = getX(idx);
                    return (
                      <text 
                        key={r.round}
                        x={x} 
                        y={bumpHeight - paddingBottom + 18} 
                        textAnchor="middle" 
                        className="chart-flag-text"
                      >
                        {r.flag}
                      </text>
                    );
                  })}

                  {/* Rank Evolution Paths (Curved Splines) */}
                  {analytics.driverRankingEvolution.map(driver => {
                    if (!visibleDriverCodes.has(driver.code)) return null;

                    const isDimmed = selectedDriverCode && selectedDriverCode !== driver.code;
                    const isSelected = selectedDriverCode === driver.code;

                    // Build smooth bezier curves between round ranks
                    let pathD = '';
                    driver.rankByRound.forEach((rank, idx) => {
                      const x = getX(idx);
                      const y = getYRank(rank);
                      if (idx === 0) {
                        pathD += `M ${x} ${y}`;
                      } else {
                        const prevX = getX(idx - 1);
                        const prevY = getYRank(driver.rankByRound[idx - 1]);
                        const cX1 = prevX + (x - prevX) / 2;
                        const cX2 = cX1;
                        pathD += ` C ${cX1} ${prevY}, ${cX2} ${y}, ${x} ${y}`;
                      }
                    });

                    const lastIdx = driver.rankByRound.length - 1;
                    const lastX = getX(lastIdx);
                    const lastY = getYRank(driver.rankByRound[lastIdx]);

                    return (
                      <g key={driver.code}>
                        <path
                          d={pathD}
                          stroke={driver.teamColor}
                          strokeWidth={isSelected ? 3.5 : 1.8}
                          className={`chart-driver-line ${isSelected ? 'highlighted' : isDimmed ? 'dimmed' : ''}`}
                          opacity={isDimmed ? 0.15 : isSelected ? 1 : 0.85}
                          cursor="pointer"
                          onClick={() => setSelectedDriverCode(isSelected ? null : driver.code)}
                        />

                        {/* Right side driver code label */}
                        <text
                          x={lastX + 8}
                          y={lastY + 3}
                          fill={driver.teamColor}
                          className="bump-label-badge"
                          fontWeight={isSelected ? 900 : 700}
                          opacity={isDimmed ? 0.3 : 1}
                          onClick={() => setSelectedDriverCode(isSelected ? null : driver.code)}
                        >
                          {driver.code}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* ----------------------------------------------------
                CARD 3: Driver Season Stats (Grouped Bars)
                ---------------------------------------------------- */}
            <div className="analytics-card">
              <div className="analytics-card-header">
                <h3 className="analytics-card-title">Driver Season Stats</h3>
                <button className="standings-export-btn" title="Exportar estadísticas">
                  <Download size={14} />
                </button>
              </div>

              {/* Legend */}
              <div className="stats-legend-group">
                <div className="stats-legend-item">
                  <span className="stats-legend-box" style={{ background: '#ffd700' }} />
                  <span>Wins</span>
                </div>
                <div className="stats-legend-item">
                  <span className="stats-legend-box" style={{ background: '#38bdf8' }} />
                  <span>Podiums</span>
                </div>
                <div className="stats-legend-item">
                  <span className="stats-legend-box" style={{ background: '#ffffff' }} />
                  <span>Finishes in points</span>
                </div>
                <div className="stats-legend-item">
                  <span className="stats-legend-box" style={{ background: '#c084fc' }} />
                  <span>Pole positions</span>
                </div>
                <div className="stats-legend-item">
                  <span className="stats-legend-box" style={{ background: '#ef4444' }} />
                  <span>DNF/DNS/DSQ</span>
                </div>
              </div>

              <div className="chart-container-svg">
                <svg viewBox={`0 0 ${chartWidth} ${statsChartHeight}`} className="chart-svg">
                  {/* Zero baseline */}
                  <line 
                    x1={paddingLeft} 
                    y1={130} 
                    x2={chartWidth - paddingRight} 
                    y2={130} 
                    stroke="rgba(255, 255, 255, 0.2)" 
                    strokeWidth={1} 
                  />

                  {/* Render grouped bars for each driver */}
                  {statsDrivers.map((d, dIdx) => {
                    const colWidth = (chartWidth - paddingLeft - paddingRight) / statsDrivers.length;
                    const baseX = paddingLeft + dIdx * colWidth + 5;
                    const barW = 3.5;
                    const zeroY = 130;
                    const scaleFactor = 6.5;

                    return (
                      <g key={d.code}>
                        {/* Driver Code Label */}
                        <text
                          x={baseX + colWidth / 2 - 4}
                          y={statsChartHeight - 8}
                          textAnchor="middle"
                          className="chart-grid-text"
                          fill={selectedDriverCode === d.code ? d.teamColor : '#94a3b8'}
                          fontWeight={selectedDriverCode === d.code ? 800 : 600}
                          style={{ fontSize: '9px' }}
                        >
                          {d.code}
                        </text>

                        {/* Wins bar */}
                        {d.wins > 0 && (
                          <rect
                            x={baseX}
                            y={zeroY - d.wins * scaleFactor}
                            width={barW}
                            height={d.wins * scaleFactor}
                            fill="#ffd700"
                            rx={1}
                          />
                        )}

                        {/* Podiums bar */}
                        {d.podiums > 0 && (
                          <rect
                            x={baseX + 4}
                            y={zeroY - d.podiums * scaleFactor}
                            width={barW}
                            height={d.podiums * scaleFactor}
                            fill="#38bdf8"
                            rx={1}
                          />
                        )}

                        {/* Points finishes bar */}
                        {d.pointsFinishes > 0 && (
                          <rect
                            x={baseX + 8}
                            y={zeroY - d.pointsFinishes * scaleFactor}
                            width={barW}
                            height={d.pointsFinishes * scaleFactor}
                            fill="#ffffff"
                            rx={1}
                          />
                        )}

                        {/* Poles bar */}
                        {d.poles > 0 && (
                          <rect
                            x={baseX + 12}
                            y={zeroY - d.poles * scaleFactor}
                            width={barW}
                            height={d.poles * scaleFactor}
                            fill="#c084fc"
                            rx={1}
                          />
                        )}

                        {/* DNF negative bar */}
                        {d.dnfs > 0 && (
                          <rect
                            x={baseX + 16}
                            y={zeroY}
                            width={barW}
                            height={d.dnfs * scaleFactor}
                            fill="#ef4444"
                            rx={1}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* ----------------------------------------------------
                CARD 4: Driver Points by Race (Stacked Horizontal Bars)
                ---------------------------------------------------- */}
            <div className="analytics-card">
              <div className="analytics-card-header">
                <h3 className="analytics-card-title">Driver Points by Race</h3>
                <button className="standings-export-btn" title="Exportar distribución">
                  <Download size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px 0' }}>
                {analytics.driverPointsByRace.map(race => {
                  return (
                    <div 
                      key={race.round}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                      <span style={{ fontSize: '15px', width: '24px', textAlign: 'center', flexShrink: 0 }}>
                        {race.flag}
                      </span>

                      {/* Stacked bar segments */}
                      <div 
                        style={{
                          display: 'flex',
                          height: '20px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          flex: 1,
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        {race.scorers.map((scorer, sIdx) => {
                          const widthPct = (scorer.points / maxRacePoints) * 100;
                          return (
                            <div 
                              key={sIdx}
                              style={{
                                width: `${widthPct}%`,
                                background: scorer.teamColor,
                                borderRight: '1px solid #0d1117',
                                transition: 'all 0.2s ease',
                              }}
                              title={`${scorer.code} (${scorer.team}): ${scorer.points} pts`}
                            />
                          );
                        })}
                      </div>

                      <span 
                        style={{ 
                          fontFamily: 'var(--font-mono)', 
                          fontSize: '0.72rem', 
                          fontWeight: 700, 
                          color: '#64748b', 
                          width: '28px',
                          textAlign: 'right' 
                        }}
                      >
                        {race.totalPoints}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==========================================================
           CONSTRUCTOR STANDINGS VIEW
           ========================================================== */
        <div className="standings-dashboard-grid" style={{ gridTemplateColumns: '400px 1fr' }}>
          <div className="standings-table-card">
            <div className="standings-card-header">
              <h3 className="standings-card-title">2026 F1 Constructor Standings</h3>
              <button className="standings-export-btn" title="Descargar datos">
                <Download size={14} />
              </button>
            </div>

            <table className="standings-table">
              <thead>
                <tr>
                  <th style={{ width: '42px' }}>POS.</th>
                  <th>TEAM</th>
                  <th style={{ textAlign: 'right' }}>POINTS</th>
                  <th style={{ textAlign: 'center' }}>WINS</th>
                </tr>
              </thead>
              <tbody>
                {syncState.constructors.map((c, idx) => {
                  const rank = idx + 1;
                  const podiumClass = rank === 1 ? 'pos-podium-1' : rank === 2 ? 'pos-podium-2' : rank === 3 ? 'pos-podium-3' : '';
                  return (
                    <tr key={c.team} className="standings-row">
                      <td className={`standings-pos-cell ${podiumClass}`}>
                        {rank}
                      </td>
                      <td>
                        <div className="standings-driver-cell">
                          <TeamLogo team={c.team} size={22} />
                          <span className="standings-driver-name">{c.team}</span>
                        </div>
                      </td>
                      <td className="standings-points-cell">
                        <span className="standings-points-val">{c.points}</span>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                        {c.wins}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="standings-analytics-col">
            <div className="analytics-card">
              <div className="analytics-card-header">
                <h3 className="analytics-card-title">Constructor Points Comparison</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}>
                {syncState.constructors.map(c => {
                  const maxPts = syncState.constructors[0]?.points || 468;
                  const pct = Math.max(2, (c.points / maxPts) * 100);
                  return (
                    <div key={c.team} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ fontWeight: 800, color: '#fff' }}>{c.team}</span>
                        <span style={{ color: c.teamColor, fontWeight: 800 }}>{c.points} pts</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: c.teamColor, borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chart Tooltip */}
      {hoveredPoint && (
        <div 
          className="chart-floating-tooltip"
          style={{
            position: 'fixed',
            left: `${hoveredPoint.x}px`,
            top: `${hoveredPoint.y}px`,
          }}
        >
          <div style={{ fontWeight: 800, color: '#fff', marginBottom: '2px' }}>{hoveredPoint.driverName}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>{hoveredPoint.roundName} • {hoveredPoint.team}</div>
          <div style={{ color: '#00D7B6', fontWeight: 800, marginTop: '2px' }}>{hoveredPoint.points} pts</div>
        </div>
      )}
    </div>
  );
};
