import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { render } from 'ink';
import React from 'react';
import type { ServiceConfig } from '../../types/index.js';
import { detectServices } from '../../core/detector.js';
import { ServiceSpawner } from '../../core/spawner.js';
import { LogBuffer } from '../../core/buffer.js';
import { parseLogLine } from '../../core/parser.js';
import { MetricsTracker } from '../../core/metrics.js';
import { resolveConfig } from '../../core/config.js';
import { createServiceState } from '../../core/service.js';
import { MultiLineAssembler } from '../../core/multiline.js';
import { isPrintableLine, replaceNonPrintable } from '../../utils/ansi.js';
import { Persistence } from '../../core/persistence.js';
import { App } from '../../ui/App.js';

export interface RunOptions {
  config?: string;
  package?: string;
  buffer?: string;
  follow?: string;
  exclude?: string;
  detect?: boolean;
  file?: string;
  stripAnsi?: boolean;
  sessionName?: string;
  save?: boolean;
}

export async function runCommand(options: RunOptions): Promise<void> {
  let services: ServiceConfig[] = [];
  let settings = {
    bufferSize: Number.parseInt(options.buffer || '10000', 10),
    stripAnsi: options.stripAnsi ?? false,
  };
  const persistence = options.save === false ? null : new Persistence();

  const sessionName = options.sessionName;

  if (options.file) {
    await runFileMode(options.file, settings, persistence, sessionName);
    return;
  }

  const resolved = options.config ? resolveConfig(options.config) : resolveConfig();
  if (resolved) {
    services = resolved.config.services;
    settings = {
      bufferSize: resolved.config.settings?.bufferSize ?? settings.bufferSize,
      stripAnsi: resolved.config.settings?.stripAnsi ?? settings.stripAnsi,
    };
  } else if (options.detect !== false) {
    services = detectServices({ packagePath: options.package });
  }

  if (services.length === 0) {
    console.error('No services found. Run `sift config init` or ensure a package.json is present.');
    process.exit(1);
  }

  if (options.follow) {
    const followSet = new Set(options.follow.split(',').map((s) => s.trim()));
    services = services.filter((s) => followSet.has(s.name));
  }

  if (options.exclude) {
    const excludeSet = new Set(options.exclude.split(',').map((s) => s.trim()));
    services = services.filter((s) => !excludeSet.has(s.name));
  }

  const buffer = new LogBuffer({ capacity: settings.bufferSize });
  const tracker = new MetricsTracker();
  const states = services.map(createServiceState);
  const spawner = new ServiceSpawner({ services });
  const assembler = new MultiLineAssembler();

  if (persistence) {
    persistence.createSession({
      name: sessionName,
      command: `sift run${options.config ? ` -c ${options.config}` : ''}${options.package ? ` -p ${options.package}` : ''}`,
      serviceCount: services.length,
    });
  }

  assembler.on('entry', (event) => {
    const raw = event.lines.join('\n');
    const entry = parseLogLine(raw, {
      service: event.service,
      stream: event.stream,
    });
    tracker.observe(entry);
    buffer.append(entry);
    persistence?.append(entry);
  });

  spawner.on('rawLine', (event) => {
    assembler.feed(event);
  });

  // Flush pending multi-line entries periodically
  const flushInterval = setInterval(() => {
    assembler.flush();
  }, 200);

  spawner.on('statusChange', (updated) => {
    const idx = states.findIndex((s) => s.name === updated.name);
    if (idx >= 0) states[idx] = updated;
  });

  let paused = false;

  const app = render(
    React.createElement(App, {
      services: states,
      buffer,
      tracker,
      paused,
      stripAnsi: settings.stripAnsi,
      onPauseToggle: () => {
        paused = !paused;
      },
      onQuit: () => {
        spawner.stop();
      },
      onRestartService: (name) => {
        spawner.restart(name);
      },
    }),
  );

  spawner.start();

  const handleShutdown = () => {
    clearInterval(flushInterval);
    assembler.flush();
    persistence?.flush();
    spawner.stop().then(() => {
      persistence?.close();
      process.exit(0);
    });
  };

  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);

  await app.waitUntilExit();
  clearInterval(flushInterval);
  assembler.flush();
  persistence?.flush();
  await spawner.stop();
  persistence?.close();

  process.off('SIGINT', handleShutdown);
  process.off('SIGTERM', handleShutdown);
}

async function runFileMode(
  filePath: string,
  settings: { bufferSize: number; stripAnsi: boolean },
  persistence: Persistence | null,
  sessionName?: string,
): Promise<void> {
  const serviceName = 'file';
  const input = filePath === '-' ? process.stdin : createReadStream(filePath);
  const buffer = new LogBuffer({ capacity: settings.bufferSize });
  const tracker = new MetricsTracker();
  const assembler = new MultiLineAssembler();

  if (persistence) {
    persistence.createSession({
      name: sessionName ?? `file-${filePath === '-' ? 'stdin' : filePath}`,
      command: `sift run --file ${filePath}`,
      serviceCount: 1,
    });
  }

  assembler.on('entry', (event) => {
    const raw = event.lines.join('\n');
    const entry = parseLogLine(raw, {
      service: event.service,
      stream: event.stream,
    });
    tracker.observe(entry);
    buffer.append(entry);
    persistence?.append(entry);
  });

  const rl = createInterface({ input, crlfDelay: Infinity });

  for await (const line of rl) {
    const safe = isPrintableLine(line) ? line : replaceNonPrintable(line);
    assembler.feed({
      raw: safe,
      service: serviceName,
      stream: 'stdout',
      serviceColor: '#00BCD4',
      sequence: 0,
    });
  }

  assembler.flush();
  persistence?.flush();

  const states = [createServiceState({ name: serviceName, command: filePath }, 0)];
  states[0].status = 'running';

  const app = render(
    React.createElement(App, {
      services: states,
      buffer,
      tracker,
      paused: false,
      stripAnsi: settings.stripAnsi,
      onPauseToggle: () => {},
      onQuit: () => {},
    }),
  );

  await app.waitUntilExit();
  persistence?.close();
}
