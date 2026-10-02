// Vercel Cron Job: Autonomous Unattended Background Worker for F1 Session Lifecycle

export default async function handler(req: any, res: any) {
  // Verify authorization for cron if CRON_SECRET is set
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized cron trigger' });
  }

  const now = new Date();
  const nowMs = now.getTime();

  try {
    console.info(`[VercelCron] ⏱️ Autonomous session lifecycle check running at: ${now.toISOString()}`);

    // Query OpenF1 API latest session
    const openF1Res = await fetch('https://api.openf1.org/v1/sessions?session_key=latest', {
      headers: { 'Accept': 'application/json' },
    });

    let sessionData = null;
    if (openF1Res.ok) {
      const list = await openF1Res.json();
      if (Array.isArray(list) && list.length > 0) {
        sessionData = list[0];
      }
    }

    let isLive = false;
    let isFinished = false;
    let transitionDetected = false;

    if (sessionData) {
      const startMs = new Date(sessionData.date_start).getTime();
      const endMs = new Date(sessionData.date_end).getTime();

      if (!isNaN(startMs) && !isNaN(endMs)) {
        if (nowMs >= startMs && nowMs <= endMs) {
          isLive = true;
        } else if (nowMs > endMs) {
          isFinished = true;
        }
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: now.toISOString(),
      cronExecution: 'AUTONOMOUS_CHECK_OK',
      isLive,
      isFinished,
      sessionKey: sessionData?.session_key || 'none',
      sessionName: sessionData?.session_name || 'none',
      circuit: sessionData?.circuit_short_name || 'none',
    });
  } catch (err: any) {
    console.error('[VercelCron] Error executing autonomous check:', err);
    return res.status(500).json({
      success: false,
      timestamp: now.toISOString(),
      error: err?.message || 'Error executing cron check',
    });
  }
}
