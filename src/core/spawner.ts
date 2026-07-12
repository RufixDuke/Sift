import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { ServiceConfig, ServiceState, ServiceStatus } from '../types/index.js';
import { SERVICE_COLORS } from '../types/index.js';

export interface RawLineEvent {
  raw: string;
  service: string;
  stream: 'stdout' | 'stderr';
  serviceColor: string;
  sequence: number;
}

export interface SpawnerOptions {
  services: ServiceConfig[];
  onStatusChange?: (state: ServiceState) => void;
}

export class ServiceSpawner extends EventEmitter {
  private services: ServiceState[] = [];
  private processes = new Map<string, ChildProcess>();
  private options: SpawnerOptions;
  private sequence = 0;
  private shuttingDown = false;

  constructor(options: SpawnerOptions) {
    super();
    this.options = options;
    this.services = options.services.map((s, i) => ({
      ...s,
      status: 'starting' as ServiceStatus,
      logCount: 0,
      restartCount: 0,
      color: s.color || SERVICE_COLORS[i % SERVICE_COLORS.length],
    }));
  }

  getStates(): ServiceState[] {
    return this.services;
  }

  start(): void {
    for (const service of this.services) {
      this.spawnService(service);
    }
  }

  private spawnService(service: ServiceState): void {
    if (this.shuttingDown) return;

    service.status = 'starting';
    this.updateStatus(service);

    const child = spawn(service.command, [], {
      cwd: service.cwd,
      env: { ...process.env, ...service.env },
      shell: true,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    service.pid = child.pid;
    service.status = 'running';
    this.processes.set(service.name, child);
    this.updateStatus(service);

    this.attachStream(child.stdout, service, 'stdout');
    this.attachStream(child.stderr, service, 'stderr');

    child.on('error', (err) => {
      if (this.shuttingDown) return;
      service.status = 'crashed';
      this.updateStatus(service);
      this.emitServiceLog(service, 'stderr', `✗ ${service.name} failed to start: ${err.message}`);
    });

    child.on('exit', (code, signal) => {
      this.processes.delete(service.name);
      service.pid = undefined;
      service.exitCode = code;
      service.status = code === 0 ? 'stopped' : 'crashed';
      this.updateStatus(service);

      if (!this.shuttingDown && code !== 0) {
        this.emitServiceLog(
          service,
          'stderr',
          `✗ ${service.name} exited with code ${code ?? signal} (after ${service.restartCount} restarts)`,
        );
      }
    });
  }

  private attachStream(
    stream: NodeJS.ReadableStream | null,
    service: ServiceState,
    streamName: 'stdout' | 'stderr',
  ): void {
    if (!stream) return;

    let buffer = '';
    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.length === 0) continue;
        this.emitServiceLog(service, streamName, line);
      }
    });

    stream.on('end', () => {
      if (buffer.length > 0) {
        this.emitServiceLog(service, streamName, buffer);
        buffer = '';
      }
    });
  }

  private emitServiceLog(
    service: ServiceState,
    stream: 'stdout' | 'stderr',
    raw: string,
  ): void {
    service.logCount += 1;
    service.lastOutputAt = new Date();
    if (service.status === 'idle') service.status = 'running';
    this.updateStatus(service);

    this.emit('rawLine', {
      raw,
      service: service.name,
      stream,
      serviceColor: service.color,
      sequence: ++this.sequence,
    });
  }

  private updateStatus(service: ServiceState): void {
    this.options.onStatusChange?.(service);
    this.emit('statusChange', service);
  }

  stop(signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    this.shuttingDown = true;
    const promises: Promise<void>[] = [];

    for (const [name, child] of this.processes) {
      promises.push(
        new Promise((resolve) => {
          if (child.killed || child.exitCode !== null) {
            resolve();
            return;
          }
          child.once('exit', () => resolve());
          child.kill(signal);

          // Force kill after 5s
          setTimeout(() => {
            if (!child.killed && child.exitCode === null) {
              child.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        }),
      );
    }

    return Promise.all(promises).then(() => undefined);
  }

  restart(serviceName: string): void {
    const child = this.processes.get(serviceName);
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
    const service = this.services.find((s) => s.name === serviceName);
    if (service) {
      service.restartCount += 1;
      service.status = 'starting';
      this.spawnService(service);
    }
  }
}
