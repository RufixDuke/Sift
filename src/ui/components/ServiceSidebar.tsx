import React from 'react';
import { Box, Text } from 'ink';
import type { ServiceState } from '../types/index.js';
import type { MetricsTracker, ServiceHealth } from '../../core/metrics.js';
import { formatNumber } from '../../core/metrics.js';
import { theme } from '../theme.js';

export interface ServiceSidebarProps {
  services: ServiceState[];
  hiddenServices?: Set<string>;
  tracker?: MetricsTracker;
}

function statusIndicator(status: ServiceState['status']): string {
  switch (status) {
    case 'starting':
      return '◐';
    case 'running':
      return '●';
    case 'idle':
      return '○';
    case 'stopped':
      return '○';
    case 'crashed':
      return '✗';
    case 'unstable':
      return '!';
    default:
      return '?';
  }
}

function healthColor(health: ServiceHealth): string {
  switch (health) {
    case 'healthy':
      return '#4CAF50';
    case 'degraded':
      return '#FBC02D';
    case 'unhealthy':
      return '#F44336';
    default:
      return theme.muted.fg;
  }
}

export function ServiceSidebar({ services, hiddenServices = new Set(), tracker }: ServiceSidebarProps): React.ReactElement {
  const errorCount = services.reduce((sum, s) => sum + (s.status === 'crashed' ? 1 : 0), 0);
  const warningCount = services.reduce((sum, s) => sum + (s.status === 'unstable' ? 1 : 0), 0);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color={theme.sidebar.fg}>Services</Text>
      <Box flexDirection="column" marginY={1}>
        {services.map((service, idx) => {
          const hidden = hiddenServices.has(service.name);
          const metrics = tracker?.snapshot(service.name, service.status);
          const health = metrics?.health ?? 'healthy';
          const showMetrics = tracker && (metrics?.requestsPerMinute ?? 0) > 0;
          return (
            <Box key={service.name}>
              <Text color={theme.muted.fg}>{idx + 1}. {statusIndicator(service.status)} </Text>
              <Text color={healthColor(health)}>● </Text>
              <Text color={hidden ? theme.muted.fg : service.color}>{service.name.padEnd(12)}</Text>
              <Text color={theme.muted.fg}>{service.logCount} logs</Text>
              {showMetrics && (
                <Text color={theme.muted.fg}>  {formatNumber(metrics.requestsPerMinute)}/min · {Math.round(metrics.avgResponseTimeMs)}ms</Text>
              )}
              {hidden && <Text color={theme.muted.fg}> [hidden]</Text>}
            </Box>
          );
        })}
      </Box>
      <Box flexDirection="column">
        {errorCount > 0 && (
          <Text color={theme.levels.error.fg}>{errorCount} error{errorCount > 1 ? 's' : ''}</Text>
        )}
        {warningCount > 0 && (
          <Text color={theme.levels.warn.fg}>{warningCount} warning{warningCount > 1 ? 's' : ''}</Text>
        )}
      </Box>
    </Box>
  );
}
