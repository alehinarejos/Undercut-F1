import React from 'react';
import { History, Activity } from 'lucide-react';
import { useLiveTelemetry } from '../hooks/useLiveTelemetry';

export const TelemetryStatusBadge: React.FC = () => {
  const { isConnected, isLive, statusMessage, latencyMs } = useLiveTelemetry();

  return (
    <div className="telemetry-status-pill" title="Estado de telemetría y transmisión en tiempo real">
      {isLive ? (
        <span className="live-indicator-dot pulsing" />
      ) : (
        <History size={12} color="#00D7B6" />
      )}
      <span className="status-label">{statusMessage}</span>
      {isConnected && (
        <span className="latency-badge">
          <Activity size={10} />
          {latencyMs}ms
        </span>
      )}
    </div>
  );
};
