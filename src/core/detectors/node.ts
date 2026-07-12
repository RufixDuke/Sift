import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { ServicePattern } from '../../types/index.js';
import { SERVICE_PATTERNS } from '../../types/index.js';
import { safeRead, hasAncestorFile } from './utils.js';
import type { RawService } from './types.js';

const SCRIPT_CANDIDATES = ['server.js', 'index.js', 'app.js', 'main.js', 'server.mjs', 'index.mjs', 'app.mjs'];

function findPattern(script: string): ServicePattern | undefined {
  return SERVICE_PATTERNS.find((pattern) => {
    if (typeof pattern.script === 'string') {
      return pattern.script === script;
    }
    return pattern.script.test(script);
  });
}

function detectPlainNodeScript(dir: string): RawService[] {
  // No package.json anywhere in the tree: fall back to a bare script, but
  // only if it actually looks like a long-running server (starts listening),
  // to avoid mistaking an arbitrary one-off .js file for a service.
  if (hasAncestorFile(dir, ['package.json'])) return [];

  for (const candidate of SCRIPT_CANDIDATES) {
    const full = join(dir, candidate);
    if (!existsSync(full)) continue;
    if (/\.listen\s*\(/.test(safeRead(full))) {
      return [{ name: 'server', command: `node ${candidate}`, type: 'server' }];
    }
  }

  return [];
}

export function detectNodeServices(dir: string, packageJsonPathOverride?: string): RawService[] {
  const packagePath = packageJsonPathOverride ?? resolve(dir, 'package.json');
  if (!existsSync(packagePath)) return detectPlainNodeScript(dir);

  let pkg: { scripts?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(safeRead(packagePath));
  } catch {
    return [];
  }

  const services: RawService[] = [];
  const scripts = pkg.scripts || {};
  for (const [script, command] of Object.entries(scripts)) {
    const match = findPattern(script);
    if (!match) continue;

    services.push({
      name: match.name,
      command: `npm run ${script}`,
      type: match.type,
    });
  }

  return services;
}
