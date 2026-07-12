import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ServiceType } from '../../types/index.js';
import { safeRead } from './utils.js';
import type { RawService } from './types.js';

function typeForProcess(name: string): ServiceType {
  if (name === 'web') return 'server';
  if (/worker|clock|queue|job/i.test(name)) return 'worker';
  return 'generic';
}

export function detectProcfileServices(dir: string): RawService[] {
  const procPath = join(dir, 'Procfile');
  if (!existsSync(procPath)) return [];

  const content = safeRead(procPath);
  const services: RawService[] = [];

  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (!match) continue;
    const [, name, command] = match;
    if (name === 'release') continue;
    services.push({ name, command: command.trim(), type: typeForProcess(name) });
  }

  return services;
}
