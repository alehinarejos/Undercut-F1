export type AppRoute = 'home' | 'timing' | 'leaderboard' | 'schedule' | 'glossary';

export interface RouteMeta {
  path: string;
  tab: AppRoute;
  title: Record<string, string>;
  description: Record<string, string>;
  keywords: string;
}

// ─── Canonical domain — change here to update everywhere ────────────────────
export const CANONICAL_DOMAIN = 'https://undercut-f1-live.vercel.app';
export const OG_IMAGE = `${CANONICAL_DOMAIN}/og-preview.png`;   // 1200×630 PNG

// ─── Route config ────────────────────────────────────────────────────────────
export const ROUTE_CONFIG: Record<AppRoute, RouteMeta> = {
  home: {
    path: '/',
    tab: 'home',
    title: {
      es: 'UNDERCUT F1 | Live Timing, Telemetría y Estrategia de Fórmula 1 en Directo',
      en: 'UNDERCUT F1 | Live F1 Timing, Telemetry & Real-Time Strategy',
      fr: 'UNDERCUT F1 | Live Timing Formule 1, Télémétrie et Stratégie en Direct',
      it: 'UNDERCUT F1 | Live Timing Formula 1, Telemetria e Strategia in Diretta',
    },
    description: {
      es: 'Plataforma gratuita de telemetría y tiempos en directo de Fórmula 1. Posiciones, sectores S1/S2/S3, estrategia de neumáticos y telemetría por piloto. Datos en tiempo real.',
      en: 'Free Formula 1 live timing and telemetry platform. Positions, S1/S2/S3 sectors, tyre strategy and per-driver telemetry. Real-time official data.',
      fr: 'Plateforme gratuite de télémétrie et live timing Formule 1. Positions, secteurs S1/S2/S3, stratégie pneus et données en temps réel.',
      it: 'Piattaforma gratuita di telemetria e live timing Formula 1. Posizioni, settori S1/S2/S3, strategia gomme e dati in tempo reale.',
    },
    keywords: 'live timing f1, tiempos en directo f1, telemetria f1, f1 live timing, livetimings f1, undercut f1, estrategia neumaticos f1',
  },
  schedule: {
    path: '/schedule',
    tab: 'schedule',
    title: {
      es: 'Calendario F1 2026 | Horarios Oficiales, Circuitos y Trazados | UNDERCUT F1',
      en: '2026 F1 Schedule | Official Race Calendar, Timetable & Circuits | UNDERCUT F1',
      fr: 'Calendrier F1 2026 | Horaires Officiels & Circuits Formule 1 | UNDERCUT F1',
      it: 'Calendario F1 2026 | Orari Ufficiali, Circuiti e Date Gran Premi | UNDERCUT F1',
    },
    description: {
      es: 'Calendario oficial de Fórmula 1 2026. Horarios de sesiones (FP1, FP2, FP3, Qualy, Sprint y Carrera), circuitos y cuenta atrás en directo.',
      en: 'Official 2026 Formula 1 Schedule. Session timetables (FP1, FP2, FP3, Qualifying, Sprint, Race), circuits and live race countdowns.',
      fr: 'Calendrier officiel Formule 1 2026. Horaires des sessions, circuits et compte à rebours en direct.',
      it: 'Calendario ufficiale Formula 1 2026. Orari sessioni, circuiti e conto alla rovescia in diretta.',
    },
    keywords: 'calendario f1 2026, f1 schedule 2026, horarios f1, fechas f1 2026, circuitos formula 1',
  },
  leaderboard: {
    path: '/driver-standings',
    tab: 'leaderboard',
    title: {
      es: 'Mundial de Pilotos F1 2026 | Clasificación Oficial del Campeonato | UNDERCUT F1',
      en: '2026 F1 Driver Standings | Official World Championship Classification | UNDERCUT F1',
      fr: 'Classement Pilotes F1 2026 | Championnat du Monde Officiel | UNDERCUT F1',
      it: 'Classifica Piloti F1 2026 | Mondiale Formula 1 Ufficiale | UNDERCUT F1',
    },
    description: {
      es: 'Clasificación oficial del Campeonato Mundial de Pilotos y Constructores de Fórmula 1 2026. Puntos, victorias, podios y estadísticas actualizadas.',
      en: 'Official 2026 Formula 1 Drivers and Constructors Championship Standings. Points, wins, podiums and updated stats after each Grand Prix.',
      fr: 'Classement officiel Championnat du Monde Pilotes et Constructeurs F1 2026. Points, victoires et podiums mis à jour.',
      it: 'Classifica ufficiale Mondiale Piloti e Costruttori Formula 1 2026. Punti, vittorie, podi e statistiche aggiornate.',
    },
    keywords: 'mundial pilotos f1 2026, clasificacion f1, driver standings f1, puntos f1 2026, campeonato constructores f1',
  },
  timing: {
    path: '/live-timing',
    tab: 'timing',
    title: {
      es: 'Live Timing F1 en Directo | Tiempos por Vuelta, Sectores y Telemetría | UNDERCUT F1',
      en: 'F1 Live Timing | Real-Time Lap Times, Sectors & Car Telemetry | UNDERCUT F1',
      fr: 'Live Timing F1 en Direct | Temps au Tour, Secteurs & Télémétrie | UNDERCUT F1',
      it: 'Live Timing F1 in Diretta | Tempi sul Giro, Settori & Telemetria | UNDERCUT F1',
    },
    description: {
      es: 'Live timing oficial de Fórmula 1 en tiempo real. Tiempos por vuelta, sectores S1/S2/S3, microsectores, estrategia de neumáticos, mensajes de control de carrera y radio de equipo.',
      en: 'Official real-time Formula 1 live timing. Lap times, S1/S2/S3 sectors, microsectors, tyre strategy, race control messages and team radio.',
      fr: 'Live timing officiel Formule 1 en direct. Temps au tour, secteurs S1/S2/S3, microsecteurs, stratégie pneus et messages radio.',
      it: 'Live timing ufficiale Formula 1 in tempo reale. Tempi sul giro, settori S1/S2/S3, microsettori, strategia gomme e radio.',
    },
    keywords: 'live timing f1, f1 livetimings, tiempos f1 en vivo, telemetria f1 en directo, sectores f1, estrategia neumaticos f1 en directo',
  },
  glossary: {
    path: '/glossary/undercut/',
    tab: 'glossary',
    title: {
      es: '¿Qué es el Undercut en F1? Estrategia de Boxes Explicada | UNDERCUT F1',
      en: 'What is the Undercut in F1? Pit Stop Strategy Explained | UNDERCUT F1',
      fr: "Qu'est-ce que l'Undercut en F1 ? Stratégie aux Stands Expliquée | UNDERCUT F1",
      it: "Cos'è l'Undercut in F1? Strategia ai Box Spiegata | UNDERCUT F1",
    },
    description: {
      es: 'El undercut en Fórmula 1 es la maniobra de parar en boxes antes que el rival para aprovechar neumáticos nuevos. Guía completa con ejemplos, comparativa con overcut y cómo detectarlo en live timing.',
      en: 'The undercut in Formula 1 is the strategy of pitting before your rival to exploit fresh tyre pace. Full guide with examples, overcut comparison and how to spot it in live timing.',
      fr: "L'undercut en Formule 1 consiste à s'arrêter avant le rival pour profiter des pneus neufs. Guide complet avec exemples et comparaison avec l'overcut.",
      it: "L'undercut in Formula 1 è la strategia di fermarsi ai box prima del rivale per sfruttare i pneumatici nuovi. Guida completa con esempi.",
    },
    keywords: 'undercut f1, que es undercut formula 1, estrategia undercut f1, undercut vs overcut f1, estrategia boxes f1',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getRouteFromPathname(pathname: string): AppRoute {
  if (typeof window === 'undefined') return 'home';
  const clean = pathname.replace(/\/$/, '').toLowerCase();
  if (clean === '/schedule' || clean.startsWith('/schedule/')) return 'schedule';
  if (clean === '/live-timing' || clean.startsWith('/live-timing/') || clean === '/timing') return 'timing';
  if (clean === '/driver-standings' || clean === '/standings' || clean === '/leaderboard') return 'leaderboard';
  if (clean.startsWith('/glossary')) return 'glossary';
  return 'home';
}

export function getPathnameForRoute(route: AppRoute): string {
  return ROUTE_CONFIG[route]?.path || '/';
}

/** Inject or update a <script type="application/ld+json"> block by a stable id attribute */
function upsertJsonLd(id: string, data: object): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector<HTMLScriptElement>(`script[data-ld-id="${id}"]`);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-ld-id', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data, null, 2);
}

function removeJsonLd(id: string): void {
  if (typeof document === 'undefined') return;
  document.querySelector(`script[data-ld-id="${id}"]`)?.remove();
}

// ─── Core SEO updater ─────────────────────────────────────────────────────────

export function updateSeoMetadata(route: AppRoute, lang: string = 'es') {
  if (typeof document === 'undefined') return;
  const config = ROUTE_CONFIG[route] || ROUTE_CONFIG.home;
  const title = config.title[lang] || config.title.es;
  const desc = config.description[lang] || config.description.es;
  const fullUrl = `${CANONICAL_DOMAIN}${config.path === '/' ? '' : config.path}`;

  // 1. Document Title
  document.title = title;

  // 2. Meta description
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);

  // 3. Meta keywords
  const metaKw = document.querySelector('meta[name="keywords"]');
  if (metaKw && config.keywords) metaKw.setAttribute('content', config.keywords);

  // 4. Canonical URL
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', fullUrl);

  // 5. OpenGraph
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', fullUrl);
  document.querySelector('meta[property="og:image"]')?.setAttribute('content', OG_IMAGE);

  // 6. Twitter / X
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc);
  document.querySelector('meta[name="twitter:url"]')?.setAttribute('content', fullUrl);
  document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', OG_IMAGE);

  // 7. Inject FAQPage schema on home route (GEO: AI Overviews + rich results)
  if (route === 'home') {
    upsertJsonLd('faq-home', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: '¿Dónde ver el live timing de Fórmula 1 gratis?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Undercut F1 (undercutf1.com) ofrece tiempos en directo gratuitos con datos oficiales: posiciones, sectores S1/S2/S3, estrategia de neumáticos y telemetría por piloto durante todas las sesiones del Gran Premio.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Qué es el undercut en Fórmula 1?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'El undercut es una estrategia de carrera en la que un equipo para en boxes antes que su rival directo. Al montar neumáticos nuevos con mayor agarre, el piloto registra vueltas más rápidas y emerge delante del rival cuando este también para.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Qué datos de telemetría de F1 puedo ver en directo?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'En Undercut F1 puedes ver en tiempo real: tiempos de vuelta, sectores S1/S2/S3, microsectores, tipo y edad de neumáticos, paradas en boxes, gaps entre pilotos y estado de la pista.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Es gratuito el live timing de F1 en Undercut?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Sí, Undercut F1 es completamente gratuito y no requiere registro. Puedes acceder a todos los datos de telemetría y tiempos en directo sin ningún coste.',
          },
        },
      ],
    });
  } else {
    removeJsonLd('faq-home');
  }

  // 8. Remove live session schemas when not on timing route
  if (route !== 'timing') {
    removeJsonLd('live-blog-session');
    removeJsonLd('sports-event-session');
  }
}

// ─── Live session schema injection (call when a GP session is detected active) ─

export interface LiveSessionSchemaOptions {
  gpName: string;
  sessionName: string;         // e.g. "Libres 2 (FP2)"
  circuitName: string;
  circuitCountry: string;
  startTimeUtc: string;        // ISO 8601
  endTimeUtc: string;          // ISO 8601
  sessionPath: string;         // e.g. "/live-timing"
  latestHeadline?: string;     // e.g. "Verstappen lidera FP2 con 1:42.340"
  latestBody?: string;
}

export function injectLiveSessionSchema(opts: LiveSessionSchemaOptions): void {
  const sessionUrl = `${CANONICAL_DOMAIN}${opts.sessionPath}`;
  const nowIso = new Date().toISOString();

  // LiveBlogPosting — activates "LIVE" badge in Google Search results
  upsertJsonLd('live-blog-session', {
    '@context': 'https://schema.org',
    '@type': 'LiveBlogPosting',
    name: `${opts.sessionName} en directo — ${opts.gpName}`,
    headline: `${opts.sessionName} en tiempo real: tiempos, sectores y telemetría | ${opts.gpName}`,
    url: sessionUrl,
    datePublished: opts.startTimeUtc,
    dateModified: nowIso,
    coverageStartTime: opts.startTimeUtc,
    coverageEndTime: opts.endTimeUtc,
    author: { '@type': 'Organization', name: 'UNDERCUT F1', url: CANONICAL_DOMAIN },
    publisher: { '@type': 'Organization', name: 'UNDERCUT F1', url: CANONICAL_DOMAIN },
    ...(opts.latestHeadline ? {
      liveBlogUpdate: {
        '@type': 'BlogPosting',
        headline: opts.latestHeadline,
        datePublished: nowIso,
        articleBody: opts.latestBody || opts.latestHeadline,
      },
    } : {}),
  });

  // SportsEvent — rich result for the GP weekend
  upsertJsonLd('sports-event-session', {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: opts.gpName,
    sport: 'Formula 1',
    startDate: opts.startTimeUtc,
    endDate: opts.endTimeUtc,
    location: {
      '@type': 'Place',
      name: opts.circuitName,
      address: { '@type': 'PostalAddress', addressCountry: opts.circuitCountry },
    },
    url: sessionUrl,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: sessionUrl,
    },
    organizer: { '@type': 'Organization', name: 'Fédération Internationale de l\'Automobile' },
  });
}

export function removeLiveSessionSchema(): void {
  removeJsonLd('live-blog-session');
  removeJsonLd('sports-event-session');
}
