import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ folder not found. Please run vite build first.');
  process.exit(1);
}

const baseHtmlPath = path.resolve(distDir, 'index.html');
if (!fs.existsSync(baseHtmlPath)) {
  console.error('❌ dist/index.html not found.');
  process.exit(1);
}

const baseHtml = fs.readFileSync(baseHtmlPath, 'utf8');

// Route configurations with rich metadata and semantic pre-rendered HTML for search bots
const routes = [
  {
    path: '/',
    fileName: 'index.html',
    title: 'UNDERCUT | F1 Live Timing, Telemetría y Estrategia en Directo',
    description: 'UNDERCUT - Plataforma de telemetría, live timing y tiempos de Fórmula 1 en directo. Sigue en tiempo real las vueltas, mapas de circuito, telemetría de monoplazas, clasificaciones del Mundial 2026 y calendario oficial de F1.',
    keywords: 'F1, Formula 1, Live Timing F1, telemetria F1, F1 tiempos en directo, clasificacion F1 2026, calendario F1 2026, F1 telemetry, UNDERCUT F1',
    canonical: 'https://undercut-f1-live.vercel.app/',
    heading: 'UNDERCUT F1 — Plataforma de Live Timing, Telemetría y Estrategia en Directo',
    content: `
      <section class="seo-crawler-content" style="padding: 2rem; max-width: 1200px; margin: 0 auto; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif;">
        <header>
          <h1 style="color: #ffffff; font-size: 2rem; margin-bottom: 0.5rem;">UNDERCUT F1 | Live Timing y Telemetría de Fórmula 1 en Tiempo Real</h1>
          <p style="color: #94a3b8; font-size: 1.1rem; line-height: 1.6;">
            Accede al centro de operaciones en tiempo real de la Fórmula 1: telemetría segundo a segundo, mapa interactivo del circuito, comparador de microsectores, tiempos por vuelta y radio de equipo oficial.
          </p>
        </header>

        <nav aria-label="Navegación principal del sitio" style="margin: 2rem 0; padding: 1.5rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
          <h2 style="font-size: 1.2rem; color: #00d7b6; margin-bottom: 1rem;">Secciones de la Plataforma F1:</h2>
          <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
            <li>
              <a href="/live-timing" style="color: #38bdf8; font-weight: 700; text-decoration: none; font-size: 1.1rem;">⏱️ Live Timing & Telemetría &rarr;</a>
              <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.25rem;">Tiempos en directo, telemetría de acelerador, freno, marchas y 25 microsectores.</p>
            </li>
            <li>
              <a href="/schedule" style="color: #a855f7; font-weight: 700; text-decoration: none; font-size: 1.1rem;">📅 Calendario Oficial F1 2026 &rarr;</a>
              <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.25rem;">Horarios de todas las sesiones (FP1, FP2, FP3, Qualy, Sprint y Carrera) con cuenta atrás.</p>
            </li>
            <li>
              <a href="/driver-standings" style="color: #ffd700; font-weight: 700; text-decoration: none; font-size: 1.1rem;">🏆 Mundial de Pilotos y Constructores &rarr;</a>
              <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.25rem;">Clasificación actualizada del campeonato mundial de F1 2026, puntos, victorias y podios.</p>
            </li>
          </ul>
        </nav>
      </section>
    `,
  },
  {
    path: '/schedule',
    slug: 'schedule',
    title: 'Calendario F1 2026 | Horarios Oficiales, Circuitos y Trazados | UNDERCUT',
    description: 'Calendario oficial de Fórmula 1 2026. Horarios de sesiones (FP1, FP2, FP3, Qualy, Sprint y Carrera), mapa interactivo 3D con trazados reales de circuito y cuenta atrás en directo.',
    keywords: 'calendario f1 2026, f1 schedule, horarios f1, carreras f1 2026, circuitos formula 1, mapa circuitos f1, fechas f1 2026, undercut f1',
    canonical: 'https://undercut-f1-live.vercel.app/schedule',
    heading: 'Calendario Oficial de Fórmula 1 Temporada 2026',
    content: `
      <section class="seo-crawler-content" style="padding: 2rem; max-width: 1200px; margin: 0 auto; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif;">
        <header>
          <nav aria-label="Migas de pan" style="margin-bottom: 1rem; font-size: 0.9rem; color: #64748b;">
            <a href="/" style="color: #38bdf8; text-decoration: none;">Inicio</a> &gt; <span>Calendario F1 2026</span>
          </nav>
          <h1 style="color: #ffffff; font-size: 2rem; margin-bottom: 0.5rem;">Calendario Oficial de Fórmula 1 2026 | Grandes Premios y Horarios</h1>
          <p style="color: #94a3b8; font-size: 1.1rem; line-height: 1.6;">
            Consulta el calendario oficial completo de la temporada de Fórmula 1 2026. Fechas, circuitos internacionales, trazados técnicos y horarios de cada sesión (Entrenamientos Libres FP1, FP2, FP3, Clasificación, Sprint y Carrera de Gran Premio).
          </p>
        </header>

        <article style="margin: 2rem 0; padding: 1.5rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
          <h2 style="font-size: 1.3rem; color: #a855f7; margin-bottom: 1rem;">Grandes Premios del Campeonato Mundial 2026</h2>
          <p style="color: #cbd5e1; line-height: 1.6;">
            Sigue cada fin de semana de Gran Premio con cuenta atrás en tiempo real sincronizada por reloj atómico UTC, mapas de circuito en 3D con curvas y zonas DRS, y cobertura en directo.
          </p>
          <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: 1.5rem;">
            <li style="padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <strong style="color: #ffffff; display: block; font-size: 1.1rem;">🇦🇺 GP de Australia — Melbourne</strong>
              <span style="color: #94a3b8; font-size: 0.9rem;">Albert Park Circuit • 58 vueltas</span>
            </li>
            <li style="padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <strong style="color: #ffffff; display: block; font-size: 1.1rem;">🇪🇸 GP de España — Circuito de Madrid</strong>
              <span style="color: #94a3b8; font-size: 0.9rem;">Madring Street Circuit • 55 vueltas</span>
            </li>
            <li style="padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <strong style="color: #ffffff; display: block; font-size: 1.1rem;">🇲🇨 GP de Mónaco — Monte Carlo</strong>
              <span style="color: #94a3b8; font-size: 0.9rem;">Circuit de Monaco • 78 vueltas</span>
            </li>
            <li style="padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <strong style="color: #ffffff; display: block; font-size: 1.1rem;">🇬🇧 GP de Gran Bretaña — Silverstone</strong>
              <span style="color: #94a3b8; font-size: 0.9rem;">Silverstone Circuit • 52 vueltas</span>
            </li>
            <li style="padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <strong style="color: #ffffff; display: block; font-size: 1.1rem;">🇮🇹 GP de Italia — Monza</strong>
              <span style="color: #94a3b8; font-size: 0.9rem;">Autodromo Nazionale Monza • 53 vueltas</span>
            </li>
            <li style="padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <strong style="color: #ffffff; display: block; font-size: 1.1rem;">🇦🇪 GP de Abu Dhabi — Yas Marina</strong>
              <span style="color: #94a3b8; font-size: 0.9rem;">Yas Marina Circuit • 58 vueltas</span>
            </li>
          </ul>
        </article>

        <nav aria-label="Enlaces rápidos" style="margin-top: 2rem; display: flex; gap: 1.5rem; flex-wrap: wrap;">
          <a href="/live-timing" style="color: #38bdf8; text-decoration: underline;">Ir a Live Timing en Directo</a>
          <a href="/driver-standings" style="color: #ffd700; text-decoration: underline;">Ver Clasificación del Mundial</a>
          <a href="/" style="color: #94a3b8; text-decoration: underline;">Volver al Dashboard</a>
        </nav>
      </section>
    `,
  },
  {
    path: '/driver-standings',
    slug: 'driver-standings',
    title: 'Mundial de Pilotos F1 2026 | Clasificación Oficial del Campeonato | UNDERCUT',
    description: 'Clasificación oficial del Campeonato Mundial de Pilotos y Constructores de Fórmula 1 2026. Puntos, victorias, podios y estadísticas actualizadas tras cada Gran Premio.',
    keywords: 'mundial de pilotos f1, clasificacion f1 2026, f1 driver standings, puntos f1, campeonato f1, mundial constructores f1, undercut f1',
    canonical: 'https://undercut-f1-live.vercel.app/driver-standings',
    heading: 'Clasificación del Campeonato Mundial de Pilotos y Constructores F1 2026',
    content: `
      <section class="seo-crawler-content" style="padding: 2rem; max-width: 1200px; margin: 0 auto; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif;">
        <header>
          <nav aria-label="Migas de pan" style="margin-bottom: 1rem; font-size: 0.9rem; color: #64748b;">
            <a href="/" style="color: #38bdf8; text-decoration: none;">Inicio</a> &gt; <span>Mundial de Pilotos 2026</span>
          </nav>
          <h1 style="color: #ffffff; font-size: 2rem; margin-bottom: 0.5rem;">Mundial de Pilotos y Constructores F1 2026 | Clasificación Oficial</h1>
          <p style="color: #94a3b8; font-size: 1.1rem; line-height: 1.6;">
            Sigue la tabla de puntos en directo del Campeonato Mundial de Fórmula 1 2026. Clasificación de pilotos y equipos constructores actualizada carrera a carrera con estadísticas de victorias, podios y vueltas rápidas.
          </p>
        </header>

        <article style="margin: 2rem 0; padding: 1.5rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
          <h2 style="font-size: 1.3rem; color: #ffd700; margin-bottom: 1rem;">Líderes y Escuderías del Mundial 2026</h2>
          <p style="color: #cbd5e1; line-height: 1.6;">
            Consulta la comparativa de rendimiento entre compañeros de equipo, puntos sumados en carreras principales y sprints, y la lucha por el título de la FIA Formula One World Championship 2026.
          </p>
        </article>

        <nav aria-label="Enlaces rápidos" style="margin-top: 2rem; display: flex; gap: 1.5rem; flex-wrap: wrap;">
          <a href="/schedule" style="color: #a855f7; text-decoration: underline;">Ver Calendario de Carreras</a>
          <a href="/live-timing" style="color: #38bdf8; text-decoration: underline;">Ir a Live Timing en Directo</a>
          <a href="/" style="color: #94a3b8; text-decoration: underline;">Volver al Dashboard</a>
        </nav>
      </section>
    `,
  },
  {
    path: '/live-timing',
    slug: 'live-timing',
    title: 'Live Timing F1 en Directo | Tiempos por Vuelta, Telemetría y Microsectores | UNDERCUT',
    description: 'Live timing oficial de Fórmula 1 en tiempo real. Tabla de tiempos por vuelta, 25 microsectores, telemetría de monoplazas (acelerador, freno, marchas), mensajes de control de carrera y radio de equipo.',
    keywords: 'live timing f1, telemetria f1 en directo, tiempos f1 en vivo, microsectores f1, radio f1, control de carrera f1, undercut f1',
    canonical: 'https://undercut-f1-live.vercel.app/live-timing',
    heading: 'Live Timing y Telemetría de Fórmula 1 en Directo',
    content: `
      <section class="seo-crawler-content" style="padding: 2rem; max-width: 1200px; margin: 0 auto; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif;">
        <header>
          <nav aria-label="Migas de pan" style="margin-bottom: 1rem; font-size: 0.9rem; color: #64748b;">
            <a href="/" style="color: #38bdf8; text-decoration: none;">Inicio</a> &gt; <span>Live Timing F1</span>
          </nav>
          <h1 style="color: #ffffff; font-size: 2rem; margin-bottom: 0.5rem;">Live Timing F1 en Directo | Telemetría, Sectores y Tiempos de Vuelta</h1>
          <p style="color: #94a3b8; font-size: 1.1rem; line-height: 1.6;">
            Pantalla oficial de tiempos y telemetría de Fórmula 1 en tiempo real. Análisis profundo vuelta a vuelta con 25 microsectores, datos de acelerador, freno, RPM, DRS, mensajes oficiales de Dirección de Carrera (Race Control) y transcripciones de radio de equipo.
          </p>
        </header>

        <article style="margin: 2rem 0; padding: 1.5rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
          <h2 style="font-size: 1.3rem; color: #00d7b6; margin-bottom: 1rem;">Herramientas Profesionales de Telemetría</h2>
          <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
            <li style="padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <strong style="color: #ffffff; display: block;">⚡ 25 Microsectores</strong>
              <span style="color: #94a3b8; font-size: 0.9rem;">Detección en tiempo real de sectores púrpuras, verdes y amarillos de cada piloto.</span>
            </li>
            <li style="padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <strong style="color: #ffffff; display: block;">🏎️ Telemetría de Monoplazas</strong>
              <span style="color: #94a3b8; font-size: 0.9rem;">Traza interactiva de velocidad, pedal de acelerador y presión de freno.</span>
            </li>
            <li style="padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
              <strong style="color: #ffffff; display: block;">🚩 Control de Carrera (FIA)</strong>
              <span style="color: #94a3b8; font-size: 0.9rem;">Notificaciones instantáneas de banderas amarillas, Safety Car (SC/VSC) y sanciones.</span>
            </li>
          </ul>
        </article>

        <nav aria-label="Enlaces rápidos" style="margin-top: 2rem; display: flex; gap: 1.5rem; flex-wrap: wrap;">
          <a href="/schedule" style="color: #a855f7; text-decoration: underline;">Consultar Próximos Horarios</a>
          <a href="/driver-standings" style="color: #ffd700; text-decoration: underline;">Ver Mundial de Pilotos</a>
          <a href="/" style="color: #94a3b8; text-decoration: underline;">Volver al Dashboard</a>
        </nav>
      </section>
    `,
  },
];

function generateHtmlForRoute(base, route) {
  let html = base;

  // 1. Replace <title>
  html = html.replace(/<title>.*?<\/title>/s, `<title>${route.title}</title>`);

  // 2. Replace meta title
  html = html.replace(/<meta name="title" content=".*?" \/>/s, `<meta name="title" content="${route.title}" />`);

  // 3. Replace meta description
  html = html.replace(/<meta name="description" content=".*?" \/>/s, `<meta name="description" content="${route.description}" />`);

  // 4. Replace keywords if specified
  if (route.keywords) {
    html = html.replace(/<meta name="keywords" content=".*?" \/>/s, `<meta name="keywords" content="${route.keywords}" />`);
  }

  // 5. Replace canonical link
  html = html.replace(/<link rel="canonical" href=".*?" \/>/s, `<link rel="canonical" href="${route.canonical}" />`);

  // 6. Replace OpenGraph tags
  html = html.replace(/<meta property="og:title" content=".*?" \/>/s, `<meta property="og:title" content="${route.title}" />`);
  html = html.replace(/<meta property="og:description" content=".*?" \/>/s, `<meta property="og:description" content="${route.description}" />`);
  html = html.replace(/<meta property="og:url" content=".*?" \/>/s, `<meta property="og:url" content="${route.canonical}" />`);

  // 7. Replace Twitter tags
  html = html.replace(/<meta name="twitter:title" content=".*?" \/>/s, `<meta name="twitter:title" content="${route.title}" />`);
  html = html.replace(/<meta name="twitter:description" content=".*?" \/>/s, `<meta name="twitter:description" content="${route.description}" />`);
  html = html.replace(/<meta name="twitter:url" content=".*?" \/>/s, `<meta name="twitter:url" content="${route.canonical}" />`);

  // 8. Inject semantic crawlable content inside <div id="root"></div>
  // When React mounts, React replaces this content immediately.
  // When Googlebot visits, it reads high-value semantic content immediately.
  const rootReplacement = `<div id="root">${route.content}</div>`;
  html = html.replace('<div id="root"></div>', rootReplacement);

  return html;
}

console.log('🚀 Generating prerendered static pages for SEO & Google Search Console...');

for (const route of routes) {
  const renderedHtml = generateHtmlForRoute(baseHtml, route);

  if (route.path === '/') {
    fs.writeFileSync(baseHtmlPath, renderedHtml, 'utf8');
    console.log(`✅ [Root] Overwritten dist/index.html with crawlable shell`);
  } else {
    // Generate both dist/<slug>/index.html AND dist/<slug>.html for maximum Vercel compatibility
    const targetDir = path.resolve(distDir, route.slug);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const indexFilePath = path.resolve(targetDir, 'index.html');
    fs.writeFileSync(indexFilePath, renderedHtml, 'utf8');

    const flatFilePath = path.resolve(distDir, `${route.slug}.html`);
    fs.writeFileSync(flatFilePath, renderedHtml, 'utf8');

    console.log(`✅ [Route ${route.path}] Generated:`);
    console.log(`   -> dist/${route.slug}/index.html`);
    console.log(`   -> dist/${route.slug}.html`);
  }
}

console.log('🎉 Static prerendered pages generation completed successfully!');
