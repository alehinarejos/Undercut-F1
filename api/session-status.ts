// Vercel Serverless Function: Authoritative Server-Side F1 Session Lifecycle Endpoint

export default async function handler(req: any, res: any) {
  // CORS & Cache headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = new Date();
  const nowMs = now.getTime();

  try {
    // 1. Fetch latest official session from OpenF1 API
    const openF1Res = await fetch('https://api.openf1.org/v1/sessions?session_key=latest', {
      headers: { 'Accept': 'application/json' },
    });

    let openF1Session = null;
    if (openF1Res.ok) {
      const data = await openF1Res.json();
      if (Array.isArray(data) && data.length > 0) {
        openF1Session = data[0];
      }
    }

    let isLive = false;
    let isFinished = false;
    let remainingSec = 0;
    let sessionKey = 'idle';
    let sessionName = 'Sin sesión en curso';
    let sessionType = 'PRACTICE';
    let circuitShortName = '';

    if (openF1Session) {
      const startMs = new Date(openF1Session.date_start).getTime();
      const endMs = new Date(openF1Session.date_end).getTime();
      sessionKey = String(openF1Session.session_key);
      sessionName = `${openF1Session.country_name || openF1Session.circuit_short_name || 'Grand Prix'} - ${openF1Session.session_name}`;
      circuitShortName = openF1Session.circuit_short_name || '';

      const rawType = String(openF1Session.session_type || openF1Session.session_name || '').toUpperCase();
      sessionType = rawType.includes('RACE') ? 'RACE' : rawType.includes('SPRINT') ? 'SPRINT' : rawType.includes('QUAL') ? 'QUALIFYING' : 'PRACTICE';

      if (!isNaN(startMs) && !isNaN(endMs)) {
        if (nowMs >= startMs && nowMs <= endMs) {
          isLive = true;
          remainingSec = Math.max(0, Math.round((endMs - nowMs) / 1000));
        } else if (nowMs > endMs) {
          isFinished = true;
          remainingSec = 0;
        }
      }
    }

    return res.status(200).json({
      status: 'ok',
      serverTimeUtc: now.toISOString(),
      isLive,
      isFinished,
      remainingSec,
      activeSession: {
        sessionKey,
        sessionName,
        sessionType,
        circuitShortName,
        dateStart: openF1Session?.date_start || null,
        dateEnd: openF1Session?.date_end || null,
      },
      source: 'OPENF1_OFFICIAL_API',
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      serverTimeUtc: now.toISOString(),
      message: error?.message || 'Internal server error while resolving session lifecycle',
    });
  }
}
