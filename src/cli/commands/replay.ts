import { render } from 'ink';
import React from 'react';
import { Persistence } from '../../core/persistence.js';
import { LogBuffer } from '../../core/buffer.js';
import { MetricsTracker } from '../../core/metrics.js';
import { createServiceState } from '../../core/service.js';
import { App } from '../../ui/App.js';
import type { ServiceState } from '../../types/index.js';

export interface ReplayOptions {
  session?: string;
  stripAnsi?: boolean;
}

export async function replayCommand(options: ReplayOptions): Promise<void> {
  const identifier = options.session ?? 'last';
  const persistence = new Persistence();

  const session = persistence.findSession(identifier);
  if (!session) {
    console.error(`No session found for "${identifier}".`);
    process.exit(1);
  }

  const entries = persistence.getSessionLogs(session.id);
  persistence.close();

  if (entries.length === 0) {
    console.log(`Session "${session.name}" has no logs.`);
    return;
  }

  const buffer = new LogBuffer({ capacity: Math.max(entries.length, 1000) });
  const tracker = new MetricsTracker();
  const servicesMap = new Map<string, ServiceState>();
  let index = 0;

  for (const entry of entries) {
    entry.id = ++index;
    buffer.append(entry);
    tracker.observe(entry);

    if (!servicesMap.has(entry.service)) {
      servicesMap.set(entry.service, createServiceState({ name: entry.service, command: '' }, servicesMap.size));
    }
    const state = servicesMap.get(entry.service)!;
    state.logCount += 1;
    state.status = 'running';
  }

  const services = Array.from(servicesMap.values());

  const app = render(
    React.createElement(App, {
      services,
      buffer,
      tracker,
      paused: true,
      stripAnsi: options.stripAnsi ?? false,
      onPauseToggle: () => {},
      onQuit: () => {},
    }),
  );

  await app.waitUntilExit();
}
