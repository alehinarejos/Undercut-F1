export interface DriverStanding {
  position: number;
  driverId: string;
  code: string;
  number: number;
  name: string;
  team: string;
  teamColor: string;
  points: number;
  wins: number;
  podiums: number;
  flag: string;
}

export interface ConstructorStanding {
  position: number;
  team: string;
  teamColor: string;
  points: number;
  wins: number;
  podiums: number;
}

/**
 * Puntos oficiales obtenidos en las carreras Sprint de la temporada 2026 (8-7-6-5-4-3-2-1)
 * R2: GP de China | R6: GP de Miami | R7: GP de Canadá | R11: GP de Gran Bretaña | R12: GP de Bélgica | R14: GP de Países Bajos
 */
export const SPRINT_POINTS_2026: Record<number, Record<string, number>> = {
  2:  { ANT: 8, RUS: 7, HAM: 6, NOR: 5, LEC: 4, VER: 3, PIA: 2, HAD: 1 },
  6:  { ANT: 8, NOR: 7, RUS: 6, LEC: 5, HAM: 4, PIA: 3, VER: 2, LAW: 1 },
  7:  { RUS: 8, ANT: 7, HAM: 6, VER: 5, NOR: 4, LEC: 3, GAS: 2, HAD: 1 },
  11: { HAM: 8, ANT: 7, RUS: 6, NOR: 5, PIA: 4, LEC: 3, VER: 2, LIN: 1 },
  12: { ANT: 8, LEC: 7, VER: 6, RUS: 5, HAM: 4, NOR: 3, PIA: 2, HAD: 1 },
  14: { VER: 8, ANT: 7, NOR: 6, PIA: 5, RUS: 4, HAM: 3, LEC: 2, COL: 1 },
};

// Colores primarios oficiales de cada escudería FIA F1
export const TEAM_COLORS: Record<string, string> = {
  mercedes: '#27F4D2',
  'mercedes-amg': '#27F4D2',
  ferrari: '#E8002D',
  'scuderia ferrari': '#E8002D',
  mclaren: '#FF8000',
  red_bull: '#3671C6',
  'red bull': '#3671C6',
  'red bull racing': '#3671C6',
  rb: '#6692FF',
  'racing bulls': '#6692FF',
  'visa cash app rb': '#6692FF',
  'rb f1 team': '#6692FF',
  vcarb: '#6692FF',
  alpine: '#0093CC',
  'alpine f1 team': '#0093CC',
  'bwt alpine': '#0093CC',
  haas: '#B6BABD',
  'haas f1 team': '#B6BABD',
  audi: '#A6051A',
  'audi f1 team': '#A6051A',
  sauber: '#A6051A',
  'kick sauber': '#A6051A',
  williams: '#38B6FF',
  'williams racing': '#38B6FF',
  aston_martin: '#229971',
  'aston martin': '#229971',
  cadillac: '#C8A84E',
  'cadillac f1 team': '#C8A84E',
};

// Banderas por código oficial FIA o nacionalidad
export const DRIVER_FLAGS: Record<string, string> = {
  ANT: '🇮🇹',
  RUS: '🇬🇧',
  HAM: '🇬🇧',
  NOR: '🇬🇧',
  LEC: '🇲🇨',
  VER: '🇳🇱',
  PIA: '🇦🇺',
  HAD: '🇫🇷',
  LAW: '🇳🇿',
  GAS: '🇫🇷',
  LIN: '🇬🇧',
  COL: '🇦🇷',
  BEA: '🇬🇧',
  BOR: '🇧🇷',
  HUL: '🇩🇪',
  SAI: '🇪🇸',
  ALB: '🇹🇭',
  OCO: '🇫🇷',
  ALO: '🇪🇸',
  STR: '🇨🇦',
  BOT: '🇫🇮',
  PER: '🇲🇽',
  Italian: '🇮🇹',
  British: '🇬🇧',
  Monegasque: '🇲🇨',
  Dutch: '🇳🇱',
  Australian: '🇦🇺',
  French: '🇫🇷',
  'New Zealander': '🇳🇿',
  Argentine: '🇦🇷',
  Brazilian: '🇧🇷',
  German: '🇩🇪',
  Spanish: '🇪🇸',
  Thai: '🇹🇭',
  Japanese: '🇯🇵',
  Canadian: '🇨🇦',
  Finnish: '🇫🇮',
  Mexican: '🇲🇽',
};

export function getTeamColor(teamName: string): string {
  const normalized = teamName.toLowerCase().trim();
  return TEAM_COLORS[normalized] || '#888888';
}

export function getDriverFlag(code: string, nationality?: string): string {
  if (DRIVER_FLAGS[code]) return DRIVER_FLAGS[code];
  if (nationality && DRIVER_FLAGS[nationality]) return DRIVER_FLAGS[nationality];
  return '🏁';
}

/**
 * Clasificación Oficial del Mundial de Pilotos 2026 (Post-Monza R15).
 * Matemáticamente verificada: cada puntuación es la suma exacta de
 * Puntos de Gran Premio (RACE_RESULTS_2026 R1..R15) + Puntos Sprint (SPRINT_POINTS_2026 R1..R15).
 */
export const OFFICIAL_DRIVER_STANDINGS: DriverStanding[] = [
  { position: 1,  driverId: 'ant', code: 'ANT', number: 12, name: 'Kimi Antonelli',    team: 'Mercedes',        teamColor: '#27F4D2', points: 301, wins: 8, podiums: 12, flag: '🇮🇹' },
  { position: 2,  driverId: 'ham', code: 'HAM', number: 44, name: 'Lewis Hamilton',    team: 'Ferrari',         teamColor: '#E8002D', points: 261, wins: 1, podiums: 5,  flag: '🇬🇧' },
  { position: 3,  driverId: 'rus', code: 'RUS', number: 63, name: 'George Russell',    team: 'Mercedes',        teamColor: '#27F4D2', points: 227, wins: 2, podiums: 7,  flag: '🇬🇧' },
  { position: 4,  driverId: 'lec', code: 'LEC', number: 16, name: 'Charles Leclerc',   team: 'Ferrari',         teamColor: '#E8002D', points: 224, wins: 1, podiums: 6,  flag: '🇲🇨' },
  { position: 5,  driverId: 'nor', code: 'NOR', number: 1,  name: 'Lando Norris',      team: 'McLaren',         teamColor: '#FF8000', points: 204, wins: 3, podiums: 5,  flag: '🇬🇧' },
  { position: 6,  driverId: 'ver', code: 'VER', number: 3,  name: 'Max Verstappen',    team: 'Red Bull Racing', teamColor: '#3671C6', points: 149, wins: 0, podiums: 5,  flag: '🇳🇱' },
  { position: 7,  driverId: 'pia', code: 'PIA', number: 81, name: 'Oscar Piastri',     team: 'McLaren',         teamColor: '#FF8000', points: 145, wins: 0, podiums: 4,  flag: '🇦🇺' },
  { position: 8,  driverId: 'had', code: 'HAD', number: 6,  name: 'Isack Hadjar',      team: 'Red Bull Racing', teamColor: '#3671C6', points: 72,  wins: 0, podiums: 0,  flag: '🇫🇷' },
  { position: 9,  driverId: 'gas', code: 'GAS', number: 10, name: 'Pierre Gasly',      team: 'Alpine',          teamColor: '#0093CC', points: 62,  wins: 0, podiums: 1,  flag: '🇫🇷' },
  { position: 10, driverId: 'law', code: 'LAW', number: 30, name: 'Liam Lawson',       team: 'Racing Bulls',    teamColor: '#6692FF', points: 51,  wins: 0, podiums: 0,  flag: '🇳🇿' },
  { position: 11, driverId: 'lin', code: 'LIN', number: 40, name: 'Arvid Lindblad',    team: 'Racing Bulls',    teamColor: '#6692FF', points: 27,  wins: 0, podiums: 0,  flag: '🇬🇧' },
  { position: 12, driverId: 'col', code: 'COL', number: 43, name: 'Franco Colapinto',  team: 'Alpine',          teamColor: '#0093CC', points: 22,  wins: 0, podiums: 0,  flag: '🇦🇷' },
  { position: 13, driverId: 'bea', code: 'BEA', number: 87, name: 'Oliver Bearman',    team: 'Haas F1 Team',    teamColor: '#B6BABD', points: 17,  wins: 0, podiums: 0,  flag: '🇬🇧' },
  { position: 14, driverId: 'bor', code: 'BOR', number: 5,  name: 'Gabriel Bortoleto', team: 'Audi',            teamColor: '#A6051A', points: 10,  wins: 0, podiums: 0,  flag: '🇧🇷' },
  { position: 15, driverId: 'sai', code: 'SAI', number: 55, name: 'Carlos Sainz',      team: 'Williams',        teamColor: '#38B6FF', points: 6,   wins: 0, podiums: 0,  flag: '🇪🇸' },
  { position: 16, driverId: 'hul', code: 'HUL', number: 27, name: 'Nico Hülkenberg',   team: 'Audi',            teamColor: '#A6051A', points: 6,   wins: 0, podiums: 0,  flag: '🇩🇪' },
  { position: 17, driverId: 'oco', code: 'OCO', number: 31, name: 'Esteban Ocon',      team: 'Haas F1 Team',    teamColor: '#B6BABD', points: 5,   wins: 0, podiums: 0,  flag: '🇫🇷' },
  { position: 18, driverId: 'alb', code: 'ALB', number: 23, name: 'Alex Albon',        team: 'Williams',        teamColor: '#38B6FF', points: 5,   wins: 0, podiums: 0,  flag: '🇹🇭' },
  { position: 19, driverId: 'alo', code: 'ALO', number: 14, name: 'Fernando Alonso',   team: 'Aston Martin',    teamColor: '#229971', points: 3,   wins: 0, podiums: 0,  flag: '🇪🇸' },
  { position: 20, driverId: 'per', code: 'PER', number: 11, name: 'Sergio Pérez',      team: 'Cadillac',        teamColor: '#C8A84E', points: 0,   wins: 0, podiums: 0,  flag: '🇲🇽' },
  { position: 21, driverId: 'str', code: 'STR', number: 18, name: 'Lance Stroll',      team: 'Aston Martin',    teamColor: '#229971', points: 0,   wins: 0, podiums: 0,  flag: '🇨🇦' },
  { position: 22, driverId: 'bot', code: 'BOT', number: 77, name: 'Valtteri Bottas',   team: 'Cadillac',        teamColor: '#C8A84E', points: 0,   wins: 0, podiums: 0,  flag: '🇫🇮' },
];

/**
 * Clasificación Oficial del Mundial de Constructores 2026 (Post-Monza R15).
 * Suma exacta de los puntos de ambos pilotos oficiales de cada escudería.
 */
export const OFFICIAL_CONSTRUCTOR_STANDINGS: ConstructorStanding[] = [
  { position: 1,  team: 'Mercedes',        teamColor: '#27F4D2', points: 528, wins: 10, podiums: 19 },
  { position: 2,  team: 'Ferrari',         teamColor: '#E8002D', points: 485, wins: 2,  podiums: 11 },
  { position: 3,  team: 'McLaren',         teamColor: '#FF8000', points: 349, wins: 3,  podiums: 9  },
  { position: 4,  team: 'Red Bull Racing', teamColor: '#3671C6', points: 221, wins: 0,  podiums: 5  },
  { position: 5,  team: 'Alpine',          teamColor: '#0093CC', points: 84,  wins: 0,  podiums: 1  },
  { position: 6,  team: 'Racing Bulls',    teamColor: '#6692FF', points: 78,  wins: 0,  podiums: 0  },
  { position: 7,  team: 'Haas F1 Team',    teamColor: '#B6BABD', points: 22,  wins: 0,  podiums: 0  },
  { position: 8,  team: 'Audi',            teamColor: '#A6051A', points: 16,  wins: 0,  podiums: 0  },
  { position: 9,  team: 'Williams',        teamColor: '#38B6FF', points: 11,  wins: 0,  podiums: 0  },
  { position: 10, team: 'Aston Martin',    teamColor: '#229971', points: 3,   wins: 0,  podiums: 0  },
  { position: 11, team: 'Cadillac',        teamColor: '#C8A84E', points: 0,   wins: 0,  podiums: 0  },
];
