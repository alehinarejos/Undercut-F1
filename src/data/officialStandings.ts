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

// Team color map
export const TEAM_COLORS: Record<string, string> = {
  mercedes: '#00D7B6',
  'mercedes-amg': '#00D7B6',
  ferrari: '#ED1131',
  mclaren: '#F47600',
  red_bull: '#4781D7',
  'red bull': '#4781D7',
  'red bull racing': '#4781D7',
  rb: '#6C98FF',
  'racing bulls': '#6C98FF',
  'rb f1 team': '#6C98FF',
  alpine: '#00A1E8',
  'alpine f1 team': '#00A1E8',
  haas: '#9C9FA2',
  'haas f1 team': '#9C9FA2',
  audi: '#F50537',
  sauber: '#F50537',
  williams: '#1868DB',
  'williams racing': '#1868DB',
  aston_martin: '#229971',
  'aston martin': '#229971',
  cadillac: '#B5A065',
  'cadillac f1 team': '#B5A065',
};

// Driver flags by nationality or code
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

// Official 2026 Season World Drivers' Championship Standings (Post-Monza R15, 100% Real 2026 Season)
export const OFFICIAL_DRIVER_STANDINGS: DriverStanding[] = [
  { position: 1, driverId: 'ant', code: 'ANT', number: 12, name: 'Kimi Antonelli', team: 'Mercedes', teamColor: '#00D7B6', points: 267, wins: 7, podiums: 12, flag: '🇮🇹' },
  { position: 2, driverId: 'rus', code: 'RUS', number: 63, name: 'George Russell', team: 'Mercedes', teamColor: '#00D7B6', points: 201, wins: 2, podiums: 7, flag: '🇬🇧' },
  { position: 3, driverId: 'ham', code: 'HAM', number: 44, name: 'Lewis Hamilton', team: 'Ferrari', teamColor: '#ED1131', points: 191, wins: 1, podiums: 5, flag: '🇬🇧' },
  { position: 4, driverId: 'nor', code: 'NOR', number: 1, name: 'Lando Norris', team: 'McLaren', teamColor: '#F47600', points: 171, wins: 2, podiums: 5, flag: '🇬🇧' },
  { position: 5, driverId: 'lec', code: 'LEC', number: 16, name: 'Charles Leclerc', team: 'Ferrari', teamColor: '#ED1131', points: 155, wins: 1, podiums: 6, flag: '🇲🇨' },
  { position: 6, driverId: 'ver', code: 'VER', number: 3, name: 'Max Verstappen', team: 'Red Bull Racing', teamColor: '#4781D7', points: 127, wins: 0, podiums: 5, flag: '🇳🇱' },
  { position: 7, driverId: 'pia', code: 'PIA', number: 81, name: 'Oscar Piastri', team: 'McLaren', teamColor: '#F47600', points: 116, wins: 0, podiums: 4, flag: '🇦🇺' },
  { position: 8, driverId: 'had', code: 'HAD', number: 6, name: 'Isack Hadjar', team: 'Red Bull Racing', teamColor: '#4781D7', points: 72, wins: 0, podiums: 0, flag: '🇫🇷' },
  { position: 9, driverId: 'law', code: 'LAW', number: 30, name: 'Liam Lawson', team: 'Racing Bulls', teamColor: '#6C98FF', points: 51, wins: 0, podiums: 0, flag: '🇳🇿' },
  { position: 10, driverId: 'gas', code: 'GAS', number: 10, name: 'Pierre Gasly', team: 'Alpine', teamColor: '#00A1E8', points: 41, wins: 0, podiums: 1, flag: '🇫🇷' },
  { position: 11, driverId: 'lin', code: 'LIN', number: 41, name: 'Arvid Lindblad', team: 'Racing Bulls', teamColor: '#6C98FF', points: 29, wins: 0, podiums: 0, flag: '🇬🇧' },
  { position: 12, driverId: 'col', code: 'COL', number: 43, name: 'Franco Colapinto', team: 'Alpine', teamColor: '#00A1E8', points: 21, wins: 0, podiums: 0, flag: '🇦🇷' },
  { position: 13, driverId: 'bea', code: 'BEA', number: 87, name: 'Oliver Bearman', team: 'Haas F1 Team', teamColor: '#9C9FA2', points: 18, wins: 0, podiums: 0, flag: '🇬🇧' },
  { position: 14, driverId: 'bor', code: 'BOR', number: 5, name: 'Gabriel Bortoleto', team: 'Audi', teamColor: '#F50537', points: 10, wins: 0, podiums: 0, flag: '🇧🇷' },
  { position: 15, driverId: 'hul', code: 'HUL', number: 27, name: 'Nico Hülkenberg', team: 'Audi', teamColor: '#F50537', points: 6, wins: 0, podiums: 0, flag: '🇩🇪' },
  { position: 16, driverId: 'sai', code: 'SAI', number: 55, name: 'Carlos Sainz', team: 'Williams', teamColor: '#1868DB', points: 6, wins: 0, podiums: 0, flag: '🇪🇸' },
  { position: 17, driverId: 'alb', code: 'ALB', number: 23, name: 'Alexander Albon', team: 'Williams', teamColor: '#1868DB', points: 5, wins: 0, podiums: 0, flag: '🇹🇭' },
  { position: 18, driverId: 'oco', code: 'OCO', number: 31, name: 'Esteban Ocon', team: 'Haas F1 Team', teamColor: '#9C9FA2', points: 3, wins: 0, podiums: 0, flag: '🇫🇷' },
  { position: 19, driverId: 'alo', code: 'ALO', number: 14, name: 'Fernando Alonso', team: 'Aston Martin', teamColor: '#229971', points: 3, wins: 0, podiums: 0, flag: '🇪🇸' },
  { position: 20, driverId: 'str', code: 'STR', number: 18, name: 'Lance Stroll', team: 'Aston Martin', teamColor: '#229971', points: 0, wins: 0, podiums: 0, flag: '🇨🇦' },
  { position: 21, driverId: 'bot', code: 'BOT', number: 77, name: 'Valtteri Bottas', team: 'Cadillac', teamColor: '#B5A065', points: 0, wins: 0, podiums: 0, flag: '🇫🇮' },
  { position: 22, driverId: 'per', code: 'PER', number: 11, name: 'Sergio Pérez', team: 'Cadillac', teamColor: '#B5A065', points: 0, wins: 0, podiums: 0, flag: '🇲🇽' },
];

// Official 2026 Season World Constructors' Championship Standings (Post-Monza R15, 100% Real 2026 Season)
export const OFFICIAL_CONSTRUCTOR_STANDINGS: ConstructorStanding[] = [
  { position: 1, team: 'Mercedes', teamColor: '#00D7B6', points: 468, wins: 9, podiums: 19 },
  { position: 2, team: 'Ferrari', teamColor: '#ED1131', points: 346, wins: 2, podiums: 11 },
  { position: 3, team: 'McLaren', teamColor: '#F47600', points: 287, wins: 2, podiums: 9 },
  { position: 4, team: 'Red Bull Racing', teamColor: '#4781D7', points: 204, wins: 0, podiums: 5 },
  { position: 5, team: 'Racing Bulls', teamColor: '#6C98FF', points: 75, wins: 0, podiums: 0 },
  { position: 6, team: 'Alpine', teamColor: '#00A1E8', points: 62, wins: 0, podiums: 1 },
  { position: 7, team: 'Haas F1 Team', teamColor: '#9C9FA2', points: 21, wins: 0, podiums: 0 },
  { position: 8, team: 'Audi', teamColor: '#F50537', points: 16, wins: 0, podiums: 0 },
  { position: 9, team: 'Williams', teamColor: '#1868DB', points: 11, wins: 0, podiums: 0 },
  { position: 10, team: 'Aston Martin', teamColor: '#229971', points: 3, wins: 0, podiums: 0 },
  { position: 11, team: 'Cadillac', teamColor: '#B5A065', points: 0, wins: 0, podiums: 0 },
];
