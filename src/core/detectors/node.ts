import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ServicePattern } from '../../types/index.js';
import { SERVICE_PATTERNS } from '../../types/index.js';
import { safeRead } from './utils.js';
import type { RawService } from './types.js';

function findPattern(script: string): ServicePattern | undefined {
  return SERVICE_PATTERNS.find((pattern) => {
    if (typeof pattern.script === 'string') {
      return pattern.script === script;
    }
    return pattern.script.test(script);
  });
}

export function detectNodeServices(dir: string, packageJsonPathOverride?: string): RawService[] {
  const packagePath = packageJsonPathOverride ?? resolve(dir, 'package.json');
  if (!existsSync(packagePath)) return [];

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
