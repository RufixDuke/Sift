import React from 'react';
import { Box, Text } from 'ink';
import type { ServiceState, Filters } from '../../types/index.js';
import type { MetricsTracker } from '../../core/metrics.js';
import { formatSparkline, formatNumber } from '../../core/metrics.js';
import { theme } from '../theme.js';

export interface StatusBarProps {
  services: ServiceState[];
  totalLogs: number;
  paused: boolean;
  filters: Filters;
  width: number;
  highVolume?: boolean;
  tracker?: MetricsTracker;
  statusMessage?: string | null;
}

export function StatusBar({ services, totalLogs, paused, filters, width, highVolume = false, tracker, statusMessage }: StatusBarProps): React.ReactElement {
  const running = services.filter((s) => s.status === 'running').length;
  const crashed = services.filter((s) => s.status === 'crashed' || s.status === 'unstable').length;

  const statusText = paused ? 'Paused' : crashed > 0 ? `${crashed} crashed` : 'Running';
  const statusBg = paused ? theme.statusWarn.bg : crashed > 0 ? theme.statusError.bg : theme.statusBar.bg;
  const statusFg = paused ? theme.statusWarn.fg : crashed > 0 ? theme.statusError.fg : theme.statusBar.fg;

  const levelText = filters.level && filters.level !== 'all' ? `level:${filters.level}` : '';
  const queryText = filters.query ? `search:${filters.query}` : '';
  const volumeText = highVolume ? '⚡ high volume' : '';

  const errorSeries = tracker?.aggregateErrorSeries() ?? [];
  const sparkline = errorSeries.length > 0 ? formatSparkline(errorSeries, 20) : '';
  const globalRpm = tracker?.aggregateRequestsPerMinute() ?? 0;
  const metricsText = tracker ? `${formatNumber(globalRpm)}/min ${sparkline}` : '';

  const left = ` ${statusText} `;
  const center = statusMessage
    ? ` ${statusMessage}`
    : ` ${running}/${services.length} services | ${totalLogs} logs ${volumeText}`;
  const right = ` ${metricsText} ${levelText} ${queryText} [e/w/i/a] filter [h] help [q] quit `;

  const centerPad = Math.max(0, width - left.length - right.length);

  return (
    <Box width={width} backgroundColor={theme.statusBar.bg}>
      <Text backgroundColor={statusBg} color={statusFg}>{left}</Text>
      <Text backgroundColor={statusMessage ? theme.highlight.bg : undefined} color={statusMessage ? theme.highlight.fg : theme.statusBar.fg} bold={Boolean(statusMessage)}>
        {center.padEnd(centerPad)}
      </Text>
      <Text color={theme.statusBar.fg}>{right}</Text>
    </Box>
  );
}
