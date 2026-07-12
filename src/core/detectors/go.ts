import { existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { ServiceType } from '../../types/index.js';
import { safeRead } from './utils.js';
import type { RawService } from './types.js';

function moduleName(dir: string): string {
  const content = safeRead(join(dir, 'go.mod'));
  const match = content.match(/^module\s+(\S+)/m);
  if (!match) return basename(dir);
  const parts = match[1].split('/');
  return parts[parts.length - 1];
}

function safeListDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

export function detectGoServices(dir: string): RawService[] {
  if (!existsSync(join(dir, 'go.mod'))) return [];

  const cmdDir = join(dir, 'cmd');
  if (existsSync(cmdDir)) {
    const services: RawService[] = [];
    for (const entry of safeListDirs(cmdDir)) {
      if (!existsSync(join(cmdDir, entry, 'main.go'))) continue;
      const type: ServiceType = /worker|job|cron/i.test(entry) ? 'worker' : 'server';
      services.push({ name: entry, command: `go run ./cmd/${entry}`, type });
    }
    if (services.length > 0) return services;
  }

  if (existsSync(join(dir, 'main.go'))) {
    const command = existsSync(join(dir, '.air.toml')) ? 'air' : 'go run .';
    return [{ name: moduleName(dir), command, type: 'server' }];
  }

  return [];
}
