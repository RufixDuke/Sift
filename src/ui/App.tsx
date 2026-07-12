import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import type { ServiceState, ParsedLogEntry, Filters } from '../types/index.js';
import { LogBuffer } from '../core/buffer.js';
import type { MetricsTracker } from '../core/metrics.js';
import { ServiceSidebar } from './components/ServiceSidebar.js';
import { LogStream } from './components/LogStream.js';
import { StatusBar } from './components/StatusBar.js';
import { SearchOverlay } from './components/SearchOverlay.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { DetailView } from './components/DetailView.js';
import { theme } from './theme.js';

export interface AppProps {
  services: ServiceState[];
  buffer: LogBuffer;
  tracker?: MetricsTracker;
  paused: boolean;
  onPauseToggle: () => void;
  onQuit: () => void;
  onRestartService?: (name: string) => void;
  stripAnsi?: boolean;
}

type OverlayMode = 'none' | 'search' | 'help' | 'detail';

export function App({
  services: initialServices,
  buffer,
  tracker,
  paused,
  onPauseToggle,
  onQuit,
  onRestartService,
  stripAnsi = false,
}: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [services, setServices] = useState<ServiceState[]>(initialServices);
  const [entries, setEntries] = useState<ParsedLogEntry[]>(buffer.getAll());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filters, setFilters] = useState<Filters>({ level: 'all' });
  const [hiddenServices, setHiddenServices] = useState<Set<string>>(new Set());
  const [overlay, setOverlay] = useState<OverlayMode>('none');
  const [query, setQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [dimensions, setDimensions] = useState({
    width: stdout.columns || 80,
    height: stdout.rows || 24,
  });
  const pendingRender = useRef<number | null>(null);
  const lastVolume = useRef({ count: 0, at: Date.now(), high: false });
  const followTail = useRef(true);
  const prevFilteredLength = useRef(0);

  const filteredEntries = entries.filter((e) => {
    if (filters.level && filters.level !== 'all' && e.level !== filters.level) return false;
    if (filters.query && !e.raw.toLowerCase().includes(filters.query.toLowerCase())) return false;
    if (hiddenServices.has(e.service)) return false;
    return true;
  });

  const matchCount = filters.query
    ? filteredEntries.filter((e) => e.raw.toLowerCase().includes(filters.query.toLowerCase())).length
    : 0;

  const selectedEntry = filteredEntries[Math.min(selectedIndex, Math.max(0, filteredEntries.length - 1))];

  const scheduleRender = useCallback(() => {
    if (pendingRender.current !== null) return;
    pendingRender.current = setTimeout(() => {
      pendingRender.current = null;
      if (!paused) {
        setEntries(buffer.getAll());
      }
    }, 16) as unknown as number;
  }, [buffer, paused]);

  useEffect(() => {
    if (followTail.current && filteredEntries.length > 0) {
      setSelectedIndex(filteredEntries.length - 1);
    }
    prevFilteredLength.current = filteredEntries.length;
  }, [filteredEntries.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      scheduleRender();
    }, 50);
    return () => clearInterval(interval);
  }, [scheduleRender]);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: stdout.columns, height: stdout.rows });
    };
    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  useEffect(() => {
    const now = Date.now();
    const { count, at } = lastVolume.current;
    if (now - at >= 1000) {
      lastVolume.current = { count: entries.length, at: now, high: entries.length - count > 60 };
    }
  }, [entries.length]);

  useInput((input, key) => {
    if (overlay === 'search') {
      if (key.escape || input === '\r' || input === '\n') {
        setOverlay('none');
        return;
      }
      // Let TextInput handle printable keys; we intercept Esc and Enter above
      return;
    }

    if (overlay === 'help' || overlay === 'detail') {
      if (key.escape || input === '?' || input === 'd' || key.backspace) {
        setOverlay('none');
        return;
      }
      return;
    }

    if (input === 'q' || key.escape) {
      onQuit();
      exit();
      return;
    }

    if (input === ' ') {
      onPauseToggle();
      return;
    }

    if (key.upArrow) {
      followTail.current = false;
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => {
        const next = Math.min(filteredEntries.length - 1, prev + 1);
        if (next === filteredEntries.length - 1) followTail.current = true;
        return next;
      });
    } else if (key.pageUp) {
      followTail.current = false;
      setSelectedIndex((prev) => Math.max(0, prev - 10));
    } else if (key.pageDown) {
      setSelectedIndex((prev) => {
        const next = Math.min(filteredEntries.length - 1, prev + 10);
        if (next === filteredEntries.length - 1) followTail.current = true;
        return next;
      });
    } else if (key.home) {
      followTail.current = false;
      setSelectedIndex(0);
    } else if (key.end) {
      followTail.current = true;
      setSelectedIndex(filteredEntries.length - 1);
    }

    if (input === '/') {
      setOverlay('search');
      return;
    }

    if (input === 'h' || input === '?') {
      setOverlay('help');
      return;
    }

    if (input === 'd') {
      if (selectedEntry) setOverlay('detail');
      return;
    }

    if (input === 'e') {
      setFilters((f) => ({ ...f, level: f.level === 'error' ? 'all' : 'error' }));
    } else if (input === 'w') {
      setFilters((f) => ({ ...f, level: f.level === 'warn' ? 'all' : 'warn' }));
    } else if (input === 'i') {
      setFilters((f) => ({ ...f, level: f.level === 'info' ? 'all' : 'info' }));
    } else if (input === 'a') {
      setFilters({ level: 'all' });
    }

    if (input === 'n' && filters.query) {
      const next = filteredEntries.findIndex(
        (e, idx) => idx > selectedIndex && e.raw.toLowerCase().includes(filters.query!.toLowerCase()),
      );
      if (next >= 0) setSelectedIndex(next);
    } else if (input === 'N' && filters.query) {
      const prev = filteredEntries.findLastIndex(
        (e, idx) => idx < selectedIndex && e.raw.toLowerCase().includes(filters.query!.toLowerCase()),
      );
      if (prev >= 0) setSelectedIndex(prev);
    }

    if (input === 'r' && selectedEntry && onRestartService) {
      onRestartService(selectedEntry.service);
    }

    if (input === '\r' || input === '\n') {
      if (selectedEntry?.message.includes('\n')) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          if (next.has(selectedEntry.id)) next.delete(selectedEntry.id);
          else next.add(selectedEntry.id);
          return next;
        });
      }
    }

    // Service toggles: s1, s2, ... s9
    const serviceToggleMatch = input.match(/^s(\d)$/);
    if (serviceToggleMatch) {
      const idx = Number.parseInt(serviceToggleMatch[1], 10) - 1;
      const svc = services[idx];
      if (svc) {
        setHiddenServices((prev) => {
          const next = new Set(prev);
          if (next.has(svc.name)) next.delete(svc.name);
          else next.add(svc.name);
          return next;
        });
      }
      return;
    }

    // Jump to service: 1-9
    if (/^[1-9]$/.test(input)) {
      const idx = Number.parseInt(input, 10) - 1;
      const svc = services[idx];
      if (svc) {
        const first = filteredEntries.findIndex((e) => e.service === svc.name);
        if (first >= 0) setSelectedIndex(first);
      }
    }
  });

  const handleStatusChange = useCallback((updated: ServiceState) => {
    setServices((prev) => prev.map((s) => (s.name === updated.name ? updated : s)));
  }, []);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    setFilters((f) => ({ ...f, query: value }));
    followTail.current = false;
    setSelectedIndex(0);
  };

  const sidebarWidth = dimensions.width >= 100 ? 25 : dimensions.width >= 80 ? 30 : 0;
  const highVolume = lastVolume.current.high;

  return (
    <Box flexDirection="column" width={dimensions.width} height={dimensions.height}>
      <Box flexDirection="row" flexGrow={1}>
        {sidebarWidth > 0 && (
          <Box width={sidebarWidth} flexShrink={0} flexDirection="column" backgroundColor={theme.sidebar.bg}>
            <ServiceSidebar
              services={services}
              hiddenServices={hiddenServices}
              tracker={tracker}
            />
          </Box>
        )}
        <Box flexGrow={1} flexDirection="column">
          <LogStream
            entries={filteredEntries}
            selectedIndex={selectedIndex}
            width={dimensions.width - sidebarWidth}
            height={dimensions.height - 2}
            expandedIds={expandedIds}
            stripAnsi={stripAnsi}
          />
        </Box>
      </Box>
      <StatusBar
        services={services}
        totalLogs={entries.length}
        paused={paused}
        filters={filters}
        width={dimensions.width}
        highVolume={highVolume}
        tracker={tracker}
      />
      {overlay === 'search' && (
        <SearchOverlay query={query} onChange={handleSearchChange} matchCount={matchCount} />
      )}
      {overlay === 'help' && <HelpOverlay />}
      {overlay === 'detail' && selectedEntry && (
        <DetailView entry={selectedEntry} width={dimensions.width} height={dimensions.height - 4} />
      )}
    </Box>
  );
}
