import React from 'react';
import { CANONICAL_DOMAIN } from '../utils/seoManager';

const GLOSSARY_URL = `${CANONICAL_DOMAIN}/glossary/undercut/`;

/** Injects/updates the DefinedTerm + FAQPage JSON-LD for this page */
function injectGlossarySchema() {
  if (typeof document === 'undefined') return;
  const id = 'glossary-undercut-ld';
  let el = document.querySelector<HTMLScriptElement>(`script[data-ld-id="${id}"]`);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-ld-id', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm',
        '@id': `${GLOSSARY_URL}#term`,
        name: 'Undercut',
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: 'Glosario de Fórmula 1 — UNDERCUT F1',
          url: `${CANONICAL_DOMAIN}/glossary/`,
        },
        description:
          'El undercut en Fórmula 1 es una estrategia de carrera en la que un equipo realiza su parada en boxes antes que el rival directo. Al montar neumáticos nuevos con mayor agarre, el piloto registra vueltas más rápidas y emerge delante del rival cuando este también para.',
        url: GLOSSARY_URL,
      },
      {
        '@type': 'Article',
        '@id': `${GLOSSARY_URL}#article`,
        headline: '¿Qué es el Undercut en Fórmula 1? Estrategia explicada',
        description:
          'Guía completa sobre la estrategia de undercut en F1: definición, cuándo funciona, ejemplos históricos y cómo seguirla en tiempo real con live timing.',
        url: GLOSSARY_URL,
        datePublished: '2026-09-29',
        dateModified: new Date().toISOString().split('T')[0],
        author: { '@type': 'Organization', name: 'UNDERCUT F1', url: CANONICAL_DOMAIN },
        publisher: { '@type': 'Organization', name: 'UNDERCUT F1', url: CANONICAL_DOMAIN },
        inLanguage: 'es',
        about: { '@id': `${GLOSSARY_URL}#term` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${GLOSSARY_URL}#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: '¿Qué es el undercut en Fórmula 1?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'El undercut es una estrategia de carrera en la que un equipo para en boxes antes que su rival. Al montar neumáticos nuevos, el piloto puede registrar vueltas más rápidas y emerger delante del rival cuando este finalmente también para.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Cuándo funciona el undercut en F1?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'El undercut funciona cuando la ventaja por vuelta de los neumáticos nuevos (generalmente 0.5–1.5 segundos) supera el tiempo perdido en el pit stop (~22–25 segundos) en las vueltas disponibles hasta que el rival también pare.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Cuál es la diferencia entre undercut y overcut en F1?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'El undercut consiste en parar antes que el rival para aprovechar los neumáticos nuevos. El overcut es la estrategia opuesta: seguir en pista más vueltas que el rival para que sus neumáticos se degraden más y ganar posición en pista antes de parar.',
            },
          },
          {
            '@type': 'Question',
            name: '¿Cómo se detecta un undercut en el live timing de F1?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'En el live timing de Undercut F1 puedes detectarlo en tiempo real: cuando un piloto entra a boxes y su rival sigue en pista, observa si el piloto con neumáticos nuevos registra tiempos de vuelta significativamente más rápidos en los sectores S1, S2 y S3.',
            },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: CANONICAL_DOMAIN },
          { '@type': 'ListItem', position: 2, name: 'Glosario F1', item: `${CANONICAL_DOMAIN}/glossary/` },
          { '@type': 'ListItem', position: 3, name: 'Undercut', item: GLOSSARY_URL },
        ],
      },
    ],
  }, null, 2);
}

function removeGlossarySchema() {
  document.querySelector('script[data-ld-id="glossary-undercut-ld"]')?.remove();
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GlossaryUndercutViewProps {
  onNavigate: (tab: string) => void;
}

export const GlossaryUndercutView: React.FC<GlossaryUndercutViewProps> = ({ onNavigate }) => {
  React.useEffect(() => {
    // Inject schemas
    injectGlossarySchema();

    // Update page meta
    document.title = '¿Qué es el Undercut en F1? Estrategia Explicada | UNDERCUT F1';
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      'El undercut en Fórmula 1 es la maniobra de parar en boxes antes que el rival para aprovechar neumáticos nuevos. Guía completa con ejemplos reales y cómo detectarlo en live timing.'
    );
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', GLOSSARY_URL);

    return () => {
      removeGlossarySchema();
    };
  }, []);

  return (
    <div style={{
      maxWidth: '820px',
      margin: '0 auto',
      padding: '32px 20px 80px',
      color: '#e2e8f0',
      fontFamily: 'var(--font-body, Inter, sans-serif)',
    }}>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: '28px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
        <span
          onClick={() => onNavigate('home')}
          style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
        >Inicio</span>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Glosario F1</span>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: '#e10600', fontWeight: 700 }}>Undercut</span>
      </nav>

      {/* Hero definition block — optimised for AI Overview extraction */}
      <section
        id="what-is-undercut-f1"
        itemScope
        itemType="https://schema.org/DefinedTerm"
        style={{
          background: 'rgba(225, 6, 0, 0.08)',
          border: '1px solid rgba(225, 6, 0, 0.3)',
          borderLeft: '4px solid #e10600',
          borderRadius: '10px',
          padding: '28px 28px 24px',
          marginBottom: '40px',
        }}
      >
        <h1
          itemProp="name"
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
            fontWeight: 900,
            color: '#ffffff',
            fontFamily: 'var(--font-display, Chakra Petch, sans-serif)',
            margin: '0 0 16px',
            letterSpacing: '-0.01em',
          }}
        >
          ¿Qué es el <span style={{ color: '#e10600' }}>Undercut</span> en Fórmula 1?
        </h1>

        <p
          itemProp="description"
          style={{ fontSize: '1.08rem', lineHeight: 1.7, color: '#e2e8f0', margin: '0 0 16px' }}
        >
          El <strong>undercut en Fórmula 1</strong> es una <strong>maniobra de estrategia de carrera</strong>{' '}
          en la que un equipo realiza su parada en boxes <em>antes</em> que el rival directo.
          Al montar neumáticos nuevos con mayor agarre, el piloto registra vueltas significativamente
          más rápidas durante las 2–4 vueltas siguientes, recuperando el tiempo perdido en el pit stop
          y emergiendo delante del rival cuando este finalmente también para.
        </p>

        <p style={{ fontSize: '0.95rem', color: '#94a3b8', margin: 0 }}>
          <strong style={{ color: '#e2e8f0' }}>Condición necesaria:</strong> El undercut es efectivo
          cuando la ventaja por vuelta de los neumáticos nuevos supera el tiempo de pit stop (~22–25 segundos)
          en las vueltas disponibles antes de que el rival también entre a boxes.
        </p>
      </section>

      {/* How it works */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginBottom: '16px', fontFamily: 'var(--font-display, Chakra Petch, sans-serif)' }}>
          Cómo funciona el undercut paso a paso
        </h2>
        <ol style={{ paddingLeft: '24px', lineHeight: 1.9, color: '#cbd5e1', fontSize: '0.97rem' }}>
          <li>
            <strong style={{ color: '#e2e8f0' }}>Un piloto (A) sigue a su rival (B) en pista</strong>,
            por ejemplo a 1.5 segundos.
          </li>
          <li>
            El equipo de A detecta que los <strong>neumáticos de B se están degradando</strong> y que
            los suyos también necesitan ser cambiados pronto.
          </li>
          <li>
            A <strong>entra en boxes antes que B</strong>. Pierde ~22–25 segundos en la parada y sale
            por detrás de B en pista.
          </li>
          <li>
            Con neumáticos nuevos, A registra <strong>vueltas 0.8–1.5 segundos más rápidas</strong>.
            En 3–4 vueltas, recupera la diferencia.
          </li>
          <li>
            Cuando B finalmente entra a boxes, <strong>A sale delante</strong>. El undercut ha funcionado.
          </li>
        </ol>
      </section>

      {/* When it works — table */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginBottom: '16px', fontFamily: 'var(--font-display, Chakra Petch, sans-serif)' }}>
          ¿Cuándo funciona el undercut?
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.88rem',
            color: '#cbd5e1',
          }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.06)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700 }}>Factor</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#e10600', fontWeight: 700 }}>✅ Favorece el undercut</th>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontWeight: 700 }}>❌ Dificulta el undercut</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Degradación de neumáticos', 'Alta — el rival pierde tiempo por vuelta', 'Baja — el rival mantiene ritmo'],
                ['Tiempo de pit stop', 'Corto (< 22s) — menos tiempo a recuperar', 'Largo (> 25s) — más difícil de recuperar'],
                ['Ventaja de neumáticos nuevos', 'Alta (> 0.8s/vuelta)', 'Baja (< 0.5s/vuelta)'],
                ['Dificultad de adelantamiento', 'Alta — difícil adelantar en pista', 'Baja — se puede adelantar sin parar'],
                ['Diferencia de posición', 'Pequeña (< 2s)', 'Grande (> 3s)'],
                ['Circuito', 'Bajo desgaste lateral, poco pitting (Mónaco, Hungría)', 'Alto desgaste, fácil adelantamiento (Spa, Monza)'],
              ].map(([factor, pro, con], i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '9px 14px', fontWeight: 600, color: '#e2e8f0' }}>{factor}</td>
                  <td style={{ padding: '9px 14px' }}>{pro}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b' }}>{con}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Undercut vs Overcut */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginBottom: '16px', fontFamily: 'var(--font-display, Chakra Petch, sans-serif)' }}>
          Undercut vs Overcut: ¿cuál es la diferencia?
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            {
              label: 'UNDERCUT', color: '#e10600',
              desc: 'Parar antes que el rival. Aprovechar la velocidad de neumáticos nuevos para recuperar posición en el pit stop.',
              when: 'El rival se degrada más rápido. La ventaja de goma nueva es grande.',
            },
            {
              label: 'OVERCUT', color: '#3b82f6',
              desc: 'Seguir más vueltas que el rival en pista. Dejar que sus neumáticos se degraden más antes de parar.',
              when: 'El ritmo en pista es superior. Hay tráfico al salir de boxes. Safety Car inminente.',
            },
          ].map(s => (
            <div key={s.label} style={{
              background: `rgba(${s.color === '#e10600' ? '225, 6, 0' : '59, 130, 246'}, 0.08)`,
              border: `1px solid ${s.color}44`,
              borderRadius: '10px',
              padding: '20px',
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 900, color: s.color, letterSpacing: '0.1em', marginBottom: '8px' }}>{s.label}</div>
              <p style={{ margin: '0 0 10px', fontSize: '0.93rem', color: '#e2e8f0', lineHeight: 1.6 }}>{s.desc}</p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}><strong style={{ color: '#cbd5e1' }}>Cuándo:</strong> {s.when}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ section — renders visually and is also in JSON-LD */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginBottom: '20px', fontFamily: 'var(--font-display, Chakra Petch, sans-serif)' }}>
          Preguntas frecuentes sobre el undercut en F1
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            {
              q: '¿Cómo se detecta un undercut en el live timing?',
              a: 'En el live timing de UNDERCUT F1 puedes verlo en tiempo real: cuando un piloto entra a boxes y su rival sigue en pista, observa si el piloto con neumáticos nuevos registra tiempos de sector S1, S2 y S3 significativamente más rápidos (en color morado o verde) durante las vueltas siguientes.',
            },
            {
              q: '¿Cuántos segundos se ganan con un undercut?',
              a: 'Depende del circuito y el compuesto. En condiciones óptimas, los neumáticos nuevos pueden dar entre 0.5 y 1.5 segundos por vuelta de ventaja durante 3–5 vueltas. En un pit stop de 22 segundos, son necesarios al menos unos 15 segundos de ventaja total para que el undercut sea rentable.',
            },
            {
              q: '¿Por qué se llama "undercut"?',
              a: 'El término viene del inglés "to undercut" (socavar). En F1 se usa porque el equipo que para antes "socava" la posición del rival adelantándose a su parada y aprovechando el mayor rendimiento de los neumáticos nuevos.',
            },
            {
              q: '¿Es el undercut siempre la estrategia correcta?',
              a: 'No. El undercut tiene riesgo: si los neumáticos nuevos no dan suficiente ventaja por vuelta, el piloto puede quedarse detrás del rival al salir de boxes. Además, parar antes implica que el rival puede extender su stint y aprovechar condiciones de pista cambiantes (safety car, degradación más lenta de lo esperado).',
            },
          ].map((item, i) => (
            <details
              key={i}
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '0',
                cursor: 'pointer',
              }}
            >
              <summary
                itemProp="name"
                style={{
                  padding: '14px 18px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: '#e2e8f0',
                  listStyle: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {item.q}
                <span style={{ color: '#e10600', fontSize: '1.2rem', flexShrink: 0 }}>+</span>
              </summary>
              <div
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
                style={{ padding: '0 18px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p itemProp="text" style={{ margin: '14px 0 0', fontSize: '0.93rem', color: '#94a3b8', lineHeight: 1.7 }}>{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA — Live timing */}
      <section style={{
        background: 'linear-gradient(135deg, rgba(225, 6, 0, 0.15) 0%, rgba(225, 6, 0, 0.05) 100%)',
        border: '1px solid rgba(225, 6, 0, 0.35)',
        borderRadius: '12px',
        padding: '28px 28px',
        textAlign: 'center',
      }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', margin: '0 0 10px', fontFamily: 'var(--font-display, Chakra Petch, sans-serif)' }}>
          Detecta el undercut en tiempo real
        </h2>
        <p style={{ fontSize: '0.93rem', color: '#94a3b8', margin: '0 0 20px', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
          Sigue los tiempos de sector S1, S2 y S3 en directo durante el fin de semana de Gran Premio
          y detecta estrategias de undercut en el momento en que ocurren.
        </p>
        <button
          onClick={() => onNavigate('timing')}
          style={{
            background: '#e10600',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 28px',
            fontSize: '0.88rem',
            fontWeight: 900,
            fontFamily: 'var(--font-display, Chakra Petch, sans-serif)',
            cursor: 'pointer',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#c00400')}
          onMouseLeave={e => (e.currentTarget.style.background = '#e10600')}
        >
          Ir al Live Timing →
        </button>
      </section>

      {/* Footer disclaimer */}
      <p style={{ marginTop: '40px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 1.6 }}>
        UNDERCUT F1 es una plataforma independiente. No está afiliada con Formula 1 Group, FIA ni ningún equipo oficial.
        Los datos de telemetría y tiempos se obtienen a través de fuentes públicas.
      </p>
    </div>
  );
};
