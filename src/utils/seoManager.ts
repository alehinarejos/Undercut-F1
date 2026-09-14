export type AppRoute = 'home' | 'timing' | 'leaderboard' | 'schedule';

export interface RouteMeta {
  path: string;
  tab: AppRoute;
  title: Record<string, string>;
  description: Record<string, string>;
  keywords: string;
}

export const ROUTE_CONFIG: Record<AppRoute, RouteMeta> = {
  home: {
    path: '/',
    tab: 'home',
    title: {
      es: 'UNDERCUT | F1 Live Timing, Telemetría y Dashboard en Directo',
      en: 'UNDERCUT | Live F1 Telemetry, Real-Time Timing & Dashboard',
      fr: 'UNDERCUT | Télémétrie F1 en Direct & Tableau de Bord',
      it: 'UNDERCUT | Telemetria F1 in Diretta & Dashboard Live',
    },
    description: {
      es: 'Dashboard principal de Fórmula 1 en directo. Telemetría en tiempo real, resumen de carrera, clasificaciones oficiales y tiempos de F1.',
      en: 'Real-time Formula 1 dashboard. Live car telemetry, race overview, official standings and F1 lap times.',
      fr: 'Tableau de bord Formule 1 en direct. Télémétrie des monoplaces, aperçu de course et classements officiels F1.',
      it: 'Dashboard Formula 1 in diretta. Telemetria monoposto in tempo reale, panoramica di gara e classifiche F1.',
    },
    keywords: 'F1 live, dashboard F1, telemetria F1, tiempos F1 en directo, F1 2026, UNDERCUT F1',
  },
  schedule: {
    path: '/schedule',
    tab: 'schedule',
    title: {
      es: 'Calendario F1 2026 | Horarios Oficiales, Circuitos y Trazados | UNDERCUT',
      en: '2026 F1 Schedule | Official Race Calendar, Timetable & Circuits | UNDERCUT',
      fr: 'Calendrier F1 2026 | Horaires Officiels & Circuits de Formule 1 | UNDERCUT',
      it: 'Calendario F1 2026 | Orari Ufficiali, Circuiti e Date Gran Premi | UNDERCUT',
    },
    description: {
      es: 'Calendario oficial de Fórmula 1 2026. Horarios de sesiones (FP1, FP2, FP3, Qualy, Sprint y Carrera), mapa interactivo 3D con trazados reales de circuito y cuenta atrás en directo.',
      en: 'Official 2026 Formula 1 Schedule. Session timetables (FP1, FP2, FP3, Qualy, Sprint, Race), interactive 3D map with real track layouts and live race countdowns.',
      fr: 'Calendrier officiel Formule 1 2026. Horaires des sessions, carte 3D interactive des circuits et compte à rebours.',
      it: 'Calendario ufficiale Formula 1 2026. Orari sessioni (Prove, Qualifiche, Sprint e Gara), mappa interattiva 3D con tracciati reali e conto alla rovescia.',
    },
    keywords: 'calendario f1 2026, f1 schedule, horarios f1, carreras f1 2026, circuitos formula 1, mapa circuitos f1, fechas f1 2026',
  },
  leaderboard: {
    path: '/driver-standings',
    tab: 'leaderboard',
    title: {
      es: 'Mundial de Pilotos F1 2026 | Clasificación Oficial del Campeonato | UNDERCUT',
      en: '2026 F1 Driver Standings | Official World Championship | UNDERCUT',
      fr: 'Classement Pilotes F1 2026 | Championnat du Monde Officiel | UNDERCUT',
      it: 'Classifica Piloti F1 2026 | Mondiale Formula 1 Ufficiale | UNDERCUT',
    },
    description: {
      es: 'Clasificación oficial del Campeonato Mundial de Pilotos y Constructores de Fórmula 1 2026. Puntos, victorias, podios y estadísticas actualizadas tras cada Gran Premio.',
      en: 'Official 2026 Formula 1 Drivers and Constructors Championship Standings. Points, wins, podiums and updated stats after each Grand Prix.',
      fr: 'Classement officiel du Championnat du Monde Pilotes et Constructeurs F1 2026. Points, victoires et podiums mis à jour.',
      it: 'Classifica ufficiale Mondiale Piloti e Costruttori Formula 1 2026. Punti, vittorie, podi e statistiche aggiornate.',
    },
    keywords: 'mundial de pilotos f1, clasificacion f1 2026, f1 driver standings, puntos f1, campeonato f1, mundial constructores f1',
  },
  timing: {
    path: '/live-timing',
    tab: 'timing',
    title: {
      es: 'Live Timing F1 en Directo | Tiempos por Vuelta, Telemetría y Microsectores | UNDERCUT',
      en: 'Live F1 Timing | Real-Time Lap Times, Car Telemetry & Microsectors | UNDERCUT',
      fr: 'Live Timing F1 en Direct | Temps au Tour, Télémétrie et Microsecteurs | UNDERCUT',
      it: 'Live Timing F1 in Diretta | Tempi sul Giro, Telemetria e Microsettori | UNDERCUT',
    },
    description: {
      es: 'Live timing oficial de Fórmula 1 en tiempo real. Tabla de tiempos por vuelta, 25 microsectores, telemetría de monoplazas (acelerador, freno, marchas), mensajes de control de carrera y radio de equipo.',
      en: 'Official real-time Formula 1 live timing. Lap times, 25 microsectors, car telemetry (throttle, brake, gear), race control messages and team radio.',
      fr: 'Live timing Formule 1 en direct. Temps au tour, 25 microsecteurs, télémétrie accélérateur/frein et messages radio.',
      it: 'Live timing ufficiale Formula 1 in tempo reale. Tempi sul giro, 25 microsettori, telemetria acceleratore/freno e team radio.',
    },
    keywords: 'live timing f1, telemetria f1 en directo, tiempos f1 en vivo, microsectores f1, radio f1, control de carrera f1',
  },
};

export function getRouteFromPathname(pathname: string): AppRoute {
  if (typeof window === 'undefined') return 'home';
  const clean = pathname.replace(/\/$/, '').toLowerCase();
  if (clean === '/schedule' || clean.startsWith('/schedule/')) return 'schedule';
  if (clean === '/live-timing' || clean.startsWith('/live-timing/') || clean === '/timing') return 'timing';
  if (clean === '/driver-standings' || clean === '/standings' || clean === '/leaderboard') return 'leaderboard';
  return 'home';
}

export function getPathnameForRoute(route: AppRoute): string {
  return ROUTE_CONFIG[route]?.path || '/';
}

export function updateSeoMetadata(route: AppRoute, lang: string = 'es') {
  if (typeof document === 'undefined') return;
  const config = ROUTE_CONFIG[route] || ROUTE_CONFIG.home;
  const title = config.title[lang] || config.title.es;
  const desc = config.description[lang] || config.description.es;
  const fullUrl = `https://undercut-f1-live.vercel.app${config.path === '/' ? '' : config.path}`;

  // 1. Document Title
  document.title = title;

  // 2. Meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', desc);
  }

  // 3. Meta keywords
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords && config.keywords) {
    metaKeywords.setAttribute('content', config.keywords);
  }

  // 4. Canonical URL
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute('href', fullUrl);
  }

  // 5. OpenGraph Tags
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', desc);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', fullUrl);

  // 6. Twitter Card Tags
  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', title);

  const twDesc = document.querySelector('meta[name="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', desc);

  const twUrl = document.querySelector('meta[name="twitter:url"]');
  if (twUrl) twUrl.setAttribute('content', fullUrl);
}
