import React, { useState } from 'react';

interface TeamLogoProps {
  team: string;
  color?: string;
  size?: number;
}

// Mapping of team names to local official assets in /public/teams/
const TEAM_ASSET_MAP: Record<string, {
  name: string;
  src: string;
  fallbackSvg: React.ReactNode;
}> = {
  ferrari: {
    name: 'Scuderia Ferrari',
    src: '/teams/ferrari.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="5" y="4" width="22" height="24" rx="3" fill="#FFF200" stroke="#000" strokeWidth="0.5" />
        <rect x="5" y="4" width="7.33" height="3" fill="#009246" />
        <rect x="12.33" y="4" width="7.33" height="3" fill="#FFFFFF" />
        <rect x="19.66" y="4" width="7.33" height="3" fill="#CE2B37" />
        <path d="M16 11c-.5 0-1 .4-1.2 1-.3.8.2 1.6.4 2.2-.4.4-1 .8-1.5 1.4-.4.5-.4 1.2 0 1.6.3.3.8.2 1.2 0 .5-.3.9-.7 1.3-1.1.2.6.5 1.2.9 1.7.3.4.9.4 1.2 0 .3-.4.1-1-.2-1.4-.4-.6-.7-1.3-.9-2 .6.2 1.2.2 1.7-.1.4-.2.5-.7.3-1.1-.3-.6-1-.9-1.6-.9-.3 0-.6.1-.9.2.2-.6.3-1.1.1-1.5z" fill="#000000" />
      </svg>
    ),
  },
  mercedes: {
    name: 'Mercedes-AMG',
    src: '/teams/mercedes.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <circle cx="16" cy="16" r="13" stroke="#27F4D2" strokeWidth="2" fill="none" />
        <line x1="16" y1="16" x2="16" y2="4" stroke="#27F4D2" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="16" x2="5.5" y2="22" stroke="#27F4D2" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="16" x2="26.5" y2="22" stroke="#27F4D2" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  redbull: {
    name: 'Red Bull Racing',
    src: '/teams/red_bull_racing.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="2" y="5" width="28" height="22" rx="4" fill="#061633" stroke="#C8102E" strokeWidth="1" />
        <circle cx="16" cy="16" r="6" fill="#FDD200" />
      </svg>
    ),
  },
  mclaren: {
    name: 'McLaren',
    src: '/teams/mclaren.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="2" y="6" width="28" height="20" rx="4" fill="#111111" />
        <path d="M6 21c10 0 19-3.5 20-10-1 4-6 7.5-13 8.5-3 .5-5.5.8-7 1.5z" fill="#FF8000" />
      </svg>
    ),
  },
  astonmartin: {
    name: 'Aston Martin',
    src: '/teams/aston_martin.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="2" y="7" width="28" height="18" rx="3" fill="#00352F" stroke="#CEDC00" strokeWidth="0.8" />
        <path d="M4 17c4.5-3.5 10-3.5 12-1 2-2.5 7.5-2.5 12 1-3.5 1.5-9.5 2-12 1-2.5 1-8.5.5-12-1z" fill="#CEDC00" />
      </svg>
    ),
  },
  williams: {
    name: 'Williams Racing',
    src: '/teams/williams.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="2" y="6" width="28" height="20" rx="4" fill="#001430" stroke="#64C4FF" strokeWidth="1" />
        <path d="M7 10l3.5 11.5L16 13l5.5 8.5L25 10" fill="none" stroke="#64C4FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  alpine: {
    name: 'Alpine',
    src: '/teams/alpine.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="2" y="6" width="28" height="20" rx="4" fill="#001830" stroke="#0093CC" strokeWidth="1" />
        <path d="M9 22l7-14 7 14" fill="none" stroke="#0093CC" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 16h11" stroke="#FD4BC7" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  haas: {
    name: 'Haas F1 Team',
    src: '/teams/haas.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <circle cx="16" cy="16" r="13" fill="#E8002D" />
        <circle cx="16" cy="16" r="8.5" fill="#111111" />
        <path d="M12 10v12M20 10v12M12 16h8" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  rb: {
    name: 'Visa Cash App RB',
    src: '/teams/rb.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="2" y="6" width="28" height="20" rx="4" fill="#09142E" stroke="#6692FF" strokeWidth="1" />
        <text x="16" y="20" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900" fontFamily="sans-serif">RB</text>
      </svg>
    ),
  },
  audi: {
    name: 'Audi F1 Team',
    src: '/teams/audi.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="2" y="8" width="28" height="16" rx="3" fill="#000000" stroke="#52E252" strokeWidth="1" />
        <circle cx="9" cy="16" r="3.5" stroke="#52E252" strokeWidth="1.4" fill="none" />
        <circle cx="13.5" cy="16" r="3.5" stroke="#52E252" strokeWidth="1.4" fill="none" />
        <circle cx="18.5" cy="16" r="3.5" stroke="#52E252" strokeWidth="1.4" fill="none" />
        <circle cx="23" cy="16" r="3.5" stroke="#52E252" strokeWidth="1.4" fill="none" />
      </svg>
    ),
  },
  cadillac: {
    name: 'Cadillac F1 Team',
    src: '/teams/cadillac.png',
    fallbackSvg: (
      <svg viewBox="0 0 32 32" width="100%" height="100%">
        <rect x="2" y="7" width="28" height="18" rx="3" fill="#111111" stroke="#C8A84E" strokeWidth="1" />
        <path d="M7 12l4.5 7L16 14l4.5 5L25 12" fill="none" stroke="#C8A84E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="7" y1="21" x2="25" y2="21" stroke="#C8A84E" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
};

export const TeamLogo: React.FC<TeamLogoProps> = ({ team, size = 30 }) => {
  const [imgError, setImgError] = useState(false);
  const normalized = (team || '').toLowerCase();

  let teamKey = 'ferrari';
  if (normalized.includes('ferrari')) teamKey = 'ferrari';
  else if (normalized.includes('mercedes')) teamKey = 'mercedes';
  else if (normalized.includes('red bull')) teamKey = 'redbull';
  else if (normalized.includes('mclaren')) teamKey = 'mclaren';
  else if (normalized.includes('aston martin')) teamKey = 'astonmartin';
  else if (normalized.includes('williams')) teamKey = 'williams';
  else if (normalized.includes('alpine')) teamKey = 'alpine';
  else if (normalized.includes('haas')) teamKey = 'haas';
  else if (normalized.includes('audi') || normalized.includes('sauber') || normalized.includes('kick')) teamKey = 'audi';
  else if (normalized.includes('cadillac')) teamKey = 'cadillac';
  else if (normalized.includes('rb') || normalized.includes('cash app') || normalized.includes('racing bulls')) teamKey = 'rb';

  const logoData = TEAM_ASSET_MAP[teamKey] || TEAM_ASSET_MAP.ferrari;
  const effectiveHeight = Math.round(size * 1.28);
  const effectiveWidth = Math.round(size * 1.45);

  return (
    <div
      style={{
        width: effectiveWidth,
        height: effectiveHeight,
        minWidth: effectiveWidth,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        borderRadius: '4px',
        overflow: 'visible',
      }}
      title={team || logoData.name}
    >
      {!imgError && logoData.src ? (
        <img
          src={logoData.src}
          alt={team}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 0,
            transform: 'scale(1.12)',
            filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.7))',
          }}
          loading="lazy"
        />
      ) : (
        logoData.fallbackSvg
      )}
    </div>
  );
};
