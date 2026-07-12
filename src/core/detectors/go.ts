import { existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { ServiceType } from '../../types/index.js';
import { safeRead, hasAncestorFile } from './utils.js';
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

function safeListGoFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.go') && !d.name.endsWith('_test.go'))
      .map((d) => d.name)
      .sort((a, b) => (a === 'main.go' ? -1 : b === 'main.go' ? 1 : a.localeCompare(b)));
  } catch {
    return [];
  }
}

export function detectGoServices(dir: string): RawService[] {
  if (!existsSync(join(dir, 'go.mod'))) {
    // No go.mod anywhere in the tree: `go run .` requires a module, but a bare
    // main.go can still be run directly (GOPATH-less single-package mode),
    // which is how simple scripts and tutorials are commonly run. If an
    // ancestor directory has go.mod, this dir is just a regular package
    // within that module (e.g. an internal/ package), not a standalone script.
    if (!existsSync(join(dir, 'main.go')) || hasAncestorFile(dir, ['go.mod'])) return [];
    const goFiles = safeListGoFiles(dir);
    return [{ name: basename(dir), command: `go run ${goFiles.join(' ')}`, type: 'server' }];
  }

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
