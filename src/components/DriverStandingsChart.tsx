import React, { useState, useMemo, useCallback } from 'react';
import { Download } from 'lucide-react';
import type { DriverSeries, RoundInfo } from '../services/driverStandingsAnalytics';

export interface DriverStandingsChartProps {
  title: string;
  exportTitle?: string;
  rounds: RoundInfo[];
  driverSeries: DriverSeries[];
  maxPoints: number;
  visibleDriverCodes: Set<string>;
  selectedDriverCode: string | null;
  onSelectDriver: (code: string | null) => void;
  onToggleDriverVisibility: (code: string) => void;
  onSelectTop5: () => void;
  onSelectTop10: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

interface HoveredChartPoint {
  x: number;
  y: number;
  round: number;
  roundName: string;
  countryCode?: string;
  flag?: string;
  driverCode: string;
  driverName: string;
  team: string;
  teamColor: string;
  strokeColor: string;
  isSecondDriver: boolean;
  points: number;
  roundGain: number;
  racePoints: number;
  sprintPoints: number;
  position: number;
}

export const DriverStandingsChart: React.FC<DriverStandingsChartProps> = React.memo(({
  title,
  exportTitle = 'Exportar gráfico',
  rounds,
  driverSeries,
  maxPoints,
  visibleDriverCodes,
  selectedDriverCode,
  onSelectDriver,
  onToggleDriverVisibility,
  onSelectTop5,
  onSelectTop10,
  onSelectAll,
  onClearSelection,
}) => {
  const [hoveredDriverCode, setHoveredDriverCode] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredChartPoint | null>(null);

  // El piloto enfocado en el gráfico es el que tiene hover activo o el seleccionado
  const focusedDriverCode = hoveredDriverCode || selectedDriverCode;

  // Dimensiones del lienzo SVG optimizadas para 22 pilotos y hasta 24 rondas
  const chartWidth = 760;
  const chartHeight = 310;
  const paddingLeft = 44;
  const paddingRight = 46;
  const paddingTop = 22;
  const paddingBottom = 44;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const numRounds = rounds.length;

  // Coordenadas X memoizadas para todas las rondas disputadas [R1 .. R_última_completada]
  const xCoords = useMemo(() => {
    return rounds.map((_, idx) => {
      if (numRounds <= 1) return paddingLeft + innerWidth / 2;
      return paddingLeft + (idx / (numRounds - 1)) * innerWidth;
    });
  }, [rounds, numRounds, innerWidth]);

  // Techo del eje Y y escalones de rejilla memoizados
  const maxPointsCeil = useMemo(
    () => Math.max(Math.ceil((maxPoints + 20) / 50) * 50, 100),
    [maxPoints]
  );

  const yPointsSteps = useMemo(() => {
    const step = maxPointsCeil <= 150 ? 25 : maxPointsCeil <= 300 ? 50 : 100;
    const steps: number[] = [];
    for (let p = 0; p <= maxPointsCeil; p += step) {
      steps.push(p);
    }
    return steps;
  }, [maxPointsCeil]);

  const getYPoints = useCallback(
    (pts: number) => {
      // Asegurar que los pilotos con 0 puntos tengan su línea horizontal nítida en el valor 0
      const clamped = Math.max(0, pts);
      return paddingTop + (1 - clamped / maxPointsCeil) * innerHeight;
    },
    [maxPointsCeil, innerHeight]
  );

  // Precalcular las rutas SVG (d="M ... L ...") y coordenadas de cada punto para los 22 pilotos (60 FPS)
  const computedSeries = useMemo(() => {
    return driverSeries.map((series) => {
      const coords = series.data.map((pt, idx) => ({
        x: xCoords[idx] ?? paddingLeft,
        y: getYPoints(pt.points),
        pt,
      }));
      const pathD =
        coords.length > 0
          ? `M ${coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' L ')}`
          : '';
      return {
        series,
        coords,
        pathD,
      };
    });
  }, [driverSeries, xCoords, getYPoints]);

  // Ordenar el renderizado SVG para que la línea en focus (hover o seleccionada) se dibuje siempre encima
  const orderedVisibleSeries = useMemo(() => {
    const visible = computedSeries.filter((item) =>
      visibleDriverCodes.has(item.series.driverCode)
    );
    return visible.sort((a, b) => {
      const aFocused = a.series.driverCode === focusedDriverCode ? 1 : 0;
      const bFocused = b.series.driverCode === focusedDriverCode ? 1 : 0;
      if (aFocused !== bFocused) return aFocused - bFocused;
      // Por defecto dibujar los primeros del mundial encima de los últimos
      return b.series.position - a.series.position;
    });
  }, [computedSeries, visibleDriverCodes, focusedDriverCode]);

  const totalDriversCount = driverSeries.length;
  const lastRoundNum = rounds[rounds.length - 1]?.round || 1;
  const isTop5Active =
    visibleDriverCodes.size === 5 &&
    driverSeries.slice(0, 5).every((d) => visibleDriverCodes.has(d.driverCode));
  const isTop10Active =
    visibleDriverCodes.size === 10 &&
    driverSeries.slice(0, 10).every((d) => visibleDriverCodes.has(d.driverCode));
  const isAllActive = visibleDriverCodes.size === totalDriversCount && totalDriversCount > 0;
  const isCleared = visibleDriverCodes.size === 0;

  return (
    <div className="analytics-card" style={{ position: 'relative' }}>
      {/* Cabecera con título, rango completo de rondas y botones de filtro rápido */}
      <div
        className="analytics-card-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <h3 className="analytics-card-title">{title}</h3>
          <span
            style={{
              fontSize: '0.68rem',
              color: '#94a3b8',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Parrilla Completa ({totalDriversCount} Pilotos) • Histórico R1–R{lastRoundNum} ({rounds.length} GPs disputados)
          </span>
        </div>

        {/* Botones de acceso rápido: [Top 5], [Top 10], [Todos (22)], [Limpiar selección] */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onSelectTop5}
            className="f1-btn"
            style={{
              fontSize: '0.65rem',
              padding: '4px 9px',
              background: isTop5Active ? 'var(--f1-red)' : 'rgba(255,255,255,0.06)',
              borderColor: isTop5Active ? 'var(--f1-red)' : 'rgba(255,255,255,0.12)',
              fontWeight: 700,
            }}
          >
            Top 5
          </button>

          <button
            type="button"
            onClick={onSelectTop10}
            className="f1-btn"
            style={{
              fontSize: '0.65rem',
              padding: '4px 9px',
              background: isTop10Active ? 'var(--f1-red)' : 'rgba(255,255,255,0.06)',
              borderColor: isTop10Active ? 'var(--f1-red)' : 'rgba(255,255,255,0.12)',
              fontWeight: 700,
            }}
          >
            Top 10
          </button>

          <button
            type="button"
            onClick={onSelectAll}
            className="f1-btn"
            style={{
              fontSize: '0.65rem',
              padding: '4px 9px',
              background: isAllActive ? 'var(--f1-red)' : 'rgba(255,255,255,0.06)',
              borderColor: isAllActive ? 'var(--f1-red)' : 'rgba(255,255,255,0.12)',
              fontWeight: 700,
            }}
          >
            Todos ({totalDriversCount})
          </button>

          <button
            type="button"
            onClick={onClearSelection}
            className="f1-btn"
            style={{
              fontSize: '0.65rem',
              padding: '4px 9px',
              background: isCleared ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.04)',
              borderColor: isCleared ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255,255,255,0.1)',
              color: isCleared ? '#fca5a5' : '#cbd5e1',
              fontWeight: 600,
            }}
          >
            Limpiar selección
          </button>

          <button className="standings-export-btn" title={exportTitle}>
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Guía visual de diferenciación de compañeros de equipo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '4px 2px 8px 2px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          marginBottom: '6px',
          fontSize: '0.65rem',
          color: '#94a3b8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="22" height="6">
              <line x1="0" y1="3" x2="22" y2="3" stroke="#00D7B6" strokeWidth="2.5" />
            </svg>
            <span>Piloto #1 Escudería (Línea continua)</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="22" height="6">
              <line
                x1="0"
                y1="3"
                x2="22"
                y2="3"
                stroke="#00D7B6"
                strokeWidth="2.5"
                strokeDasharray="4 4"
              />
            </svg>
            <span>Piloto #2 Escudería (Discontinua 4-4 + tono diferenciado)</span>
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: '#64748b' }}>
          Mostrando {visibleDriverCodes.size} de {totalDriversCount} pilotos
        </span>
      </div>

      {/* Lienzo SVG Principal del Gráfico */}
      <div className="chart-container-svg">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 14}`} className="chart-svg">
          <defs>
            <filter id="driverFocusGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ffffff" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Líneas de rejilla horizontal y etiquetas del eje Y (incluyendo 0 pts) */}
          {yPointsSteps.map((pt) => {
            const y = getYPoints(pt);
            const isZeroLine = pt === 0;
            return (
              <g key={pt}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  className="chart-axis-line"
                  style={{
                    stroke: isZeroLine ? 'rgba(255,255,255,0.22)' : undefined,
                    strokeWidth: isZeroLine ? 1.2 : undefined,
                  }}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="chart-grid-text"
                  style={{
                    fill: isZeroLine ? '#e2e8f0' : undefined,
                    fontWeight: isZeroLine ? 700 : undefined,
                  }}
                >
                  {pt}
                </text>
              </g>
            );
          })}

          {/* Eje X Cronológico Completo: [R1, R2, R3, ..., R_última_completada] */}
          {rounds.map((r, idx) => {
            const x = xCoords[idx] ?? paddingLeft;
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
                  y={chartHeight - paddingBottom + 15}
                  textAnchor="middle"
                  className="chart-flag-text"
                >
                  {r.flag}
                </text>
                <text
                  x={x}
                  y={chartHeight - paddingBottom + 28}
                  textAnchor="middle"
                  className="chart-grid-text"
                  style={{
                    fontSize: '8.2px',
                    fontWeight: 700,
                    fill: r.hasSprint ? '#00D7B6' : '#94a3b8',
                  }}
                >
                  R{r.round} {r.countryCode}
                </text>
              </g>
            );
          })}

          {/* Estado cuando se ha limpiado la selección */}
          {orderedVisibleSeries.length === 0 && (
            <text
              x={chartWidth / 2}
              y={chartHeight / 2}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="12"
              fontFamily="var(--font-mono)"
            >
              Selección vacía — Haz clic en cualquier piloto de la leyenda inferior o usa [Todos ({totalDriversCount})]
            </text>
          )}

          {/* Series de Trayectoria de los Pilotos Activos */}
          {orderedVisibleSeries.map(({ series, coords, pathD }) => {
            const isFocused = focusedDriverCode === series.driverCode;
            const isDimmed = Boolean(focusedDriverCode && !isFocused);
            const strokeColor = series.strokeColor || series.teamColor;
            const lastCoord = coords[coords.length - 1];

            return (
              <g
                key={series.driverCode}
                onMouseEnter={() => setHoveredDriverCode(series.driverCode)}
                onMouseLeave={() => setHoveredDriverCode(null)}
              >
                {/* Área de hit invisible más ancha para facilitar el hover sobre cada línea */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={10}
                  cursor="pointer"
                  onClick={() =>
                    onSelectDriver(
                      selectedDriverCode === series.driverCode ? null : series.driverCode
                    )
                  }
                />

                {/* Línea visible del piloto (Continua para Piloto #1, Discontinua "4 4" para Piloto #2) */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isFocused ? 3.2 : isDimmed ? 1.4 : 2.1}
                  strokeDasharray={series.isSecondDriver ? '4 4' : undefined}
                  opacity={isDimmed ? 0.2 : isFocused ? 1 : 0.88}
                  filter={isFocused ? 'url(#driverFocusGlow)' : undefined}
                  style={{ transition: 'opacity 140ms ease, stroke-width 140ms ease' }}
                  cursor="pointer"
                  onClick={() =>
                    onSelectDriver(
                      selectedDriverCode === series.driverCode ? null : series.driverCode
                    )
                  }
                />

                {/* Etiqueta de código de piloto al final de la línea cuando está en focus */}
                {isFocused && lastCoord && (
                  <text
                    x={lastCoord.x + 6}
                    y={lastCoord.y + 3}
                    fill={strokeColor}
                    fontSize="9.5"
                    fontWeight="800"
                    fontFamily="var(--font-mono)"
                  >
                    {series.driverCode} ({series.finalPoints})
                  </text>
                )}

                {/* Nodos de datos por cada Gran Premio disputado */}
                {coords.map(({ x, y, pt }, idx) => (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r={isFocused ? 4.4 : isDimmed ? 2.1 : 2.9}
                    fill={strokeColor}
                    stroke="#0d1117"
                    strokeWidth={1.1}
                    opacity={isDimmed ? 0.2 : 0.96}
                    cursor="pointer"
                    onMouseEnter={(e) => {
                      setHoveredDriverCode(series.driverCode);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredPoint({
                        x: rect.left,
                        y: rect.top - 10,
                        round: pt.round,
                        roundName: pt.raceName,
                        countryCode: pt.countryCode,
                        flag: pt.flag,
                        driverCode: series.driverCode,
                        driverName: series.driverName,
                        team: series.team,
                        teamColor: series.teamColor,
                        strokeColor,
                        isSecondDriver: series.isSecondDriver,
                        points: pt.points,
                        roundGain: pt.roundGain,
                        racePoints: pt.racePoints,
                        sprintPoints: pt.sprintPoints,
                        position: pt.position,
                      });
                    }}
                    onMouseLeave={() => {
                      setHoveredPoint(null);
                    }}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* =====================================================================
          LEYENDA INTERACTIVA DE LOS 22 PILOTOS (incluyendo pilotos con 0 pts)
          Clic activa/desactiva la línea individual; Hover aplica Focus
         ===================================================================== */}
      <div
        style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            fontSize: '0.65rem',
            color: '#94a3b8',
          }}
        >
          <span style={{ fontWeight: 700, color: '#cbd5e1' }}>
            Leyenda Interactiva de Parrilla ({totalDriversCount} pilotos — Haz clic para activar/ocultar o pasa el cursor para enfocar):
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
            gap: '5px',
          }}
        >
          {driverSeries.map((series) => {
            const isVisible = visibleDriverCodes.has(series.driverCode);
            const isFocused = focusedDriverCode === series.driverCode;
            const strokeColor = series.strokeColor || series.teamColor;

            return (
              <button
                key={series.driverCode}
                type="button"
                onClick={() => onToggleDriverVisibility(series.driverCode)}
                onMouseEnter={() => setHoveredDriverCode(series.driverCode)}
                onMouseLeave={() => setHoveredDriverCode(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '5px',
                  padding: '4px 7px',
                  borderRadius: '6px',
                  border: isFocused
                    ? `1px solid ${strokeColor}`
                    : isVisible
                    ? '1px solid rgba(255,255,255,0.12)'
                    : '1px solid rgba(255,255,255,0.04)',
                  background: isFocused
                    ? 'rgba(255,255,255,0.12)'
                    : isVisible
                    ? 'rgba(255,255,255,0.045)'
                    : 'rgba(255,255,255,0.015)',
                  opacity: isVisible ? 1 : 0.42,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                  textAlign: 'left',
                }}
                title={`${series.position}º ${series.driverName} (${series.team}) — ${series.finalPoints} pts • ${
                  series.isSecondDriver ? 'Piloto #2 (Línea discontinua)' : 'Piloto #1 (Línea continua)'
                }`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '0.6rem',
                      fontFamily: 'var(--font-mono)',
                      color: '#64748b',
                      fontWeight: 700,
                      minWidth: '16px',
                    }}
                  >
                    {series.position}º
                  </span>

                  {/* Muestra visual de la línea: continua vs discontinua 4-4 */}
                  <svg width="18" height="8" style={{ flexShrink: 0 }}>
                    <line
                      x1="0"
                      y1="4"
                      x2="18"
                      y2="4"
                      stroke={strokeColor}
                      strokeWidth="2.6"
                      strokeDasharray={series.isSecondDriver ? '4 4' : undefined}
                    />
                  </svg>

                  <span
                    style={{
                      fontSize: '0.67rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: isVisible ? '#f8fafc' : '#64748b',
                    }}
                  >
                    {series.driverCode}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '0.62rem',
                    fontFamily: 'var(--font-mono)',
                    color: series.finalPoints === 0 ? '#64748b' : '#cbd5e1',
                    fontWeight: 700,
                  }}
                >
                  {series.finalPoints}p
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          TOOLTIP ENRIQUECIDO AL POSICIONARSE EN UNA RONDA CONCRETA
         ===================================================================== */}
      {hoveredPoint && (
        <div
          className="chart-svg-tooltip"
          style={{
            left: Math.min(
              hoveredPoint.x,
              typeof window !== 'undefined' ? window.innerWidth - 270 : hoveredPoint.x
            ),
            top: Math.max(hoveredPoint.y, 70),
            minWidth: '235px',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                color: '#94a3b8',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {hoveredPoint.flag || '🏁'} R{hoveredPoint.round} • {hoveredPoint.roundName}
            </span>
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                color: '#00D7B6',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Posición: P{hoveredPoint.position}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              marginBottom: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: hoveredPoint.strokeColor,
                }}
              />
              <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.82rem' }}>
                {hoveredPoint.driverName}
              </span>
            </div>
            <span
              style={{
                fontSize: '0.58rem',
                fontFamily: 'var(--font-mono)',
                color: '#94a3b8',
                padding: '1px 5px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.06)',
              }}
            >
              {hoveredPoint.isSecondDriver ? 'Piloto #2 (4-4)' : 'Piloto #1'}
            </span>
          </div>

          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '6px' }}>
            Escudería: <strong style={{ color: '#cbd5e1' }}>{hoveredPoint.team}</strong>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              fontSize: '0.7rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Puntos Acumulados:</span>
              <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>
                {hoveredPoint.points} pts
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Sumados en este GP:</span>
              <strong
                style={{
                  color: hoveredPoint.roundGain > 0 ? '#10b981' : '#94a3b8',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                +{hoveredPoint.roundGain} pts
              </strong>
            </div>
            {hoveredPoint.sprintPoints > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.63rem',
                  color: '#cbd5e1',
                }}
              >
                <span>Desglose (Carrera + Sprint):</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {hoveredPoint.racePoints} + {hoveredPoint.sprintPoints} Sprint
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
