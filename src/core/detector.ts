import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import type { ServiceConfig, ServicePattern } from '../types/index.js';
import { SERVICE_PATTERNS, SERVICE_COLORS } from '../types/index.js';

export interface DetectOptions {
  packagePath?: string;
  maxDepth?: number;
}

export function detectServices(options: DetectOptions = {}): ServiceConfig[] {
  const packagePath = resolve(options.packagePath || './package.json');
  const services: ServiceConfig[] = [];
  const usedNames = new Set<string>();
  const usedColors = new Set<string>();

  if (existsSync(packagePath)) {
    const rootServices = detectFromPackageJson(packagePath, usedNames, usedColors);
    services.push(...rootServices);
  }

  // Walk subdirectories up to maxDepth for additional package.json files
  const maxDepth = options.maxDepth ?? 2;
  const rootDir = dirname(packagePath);
  const subServices = detectFromSubdirectories(rootDir, maxDepth, usedNames, usedColors);
  services.push(...subServices);

  return services;
}

function detectFromPackageJson(
  packagePath: string,
  usedNames: Set<string>,
  usedColors: Set<string>,
): ServiceConfig[] {
  const services: ServiceConfig[] = [];
  const dir = dirname(packagePath);
  const dirName = basename(dir);

  let pkg: { scripts?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  } catch {
    return services;
  }

  const scripts = pkg.scripts || {};
  for (const [script, command] of Object.entries(scripts)) {
    const match = findPattern(script);
    if (!match) continue;

    const name = makeUniqueName(match.name, dirName, usedNames);
    usedNames.add(name);
    const color = pickColor(usedColors);
    usedColors.add(color);

    services.push({
      name,
      command: command as string,
      cwd: dir,
      color,
      type: match.type,
    });
  }

  return services;
}

function detectFromSubdirectories(
  rootDir: string,
  maxDepth: number,
  usedNames: Set<string>,
  usedColors: Set<string>,
): ServiceConfig[] {
  if (maxDepth <= 0) return [];
  const services: ServiceConfig[] = [];
  const entries = safeReadDir(rootDir);

  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const subPath = resolve(rootDir, entry);
    const subPackage = resolve(subPath, 'package.json');

    if (existsSync(subPackage)) {
      const detected = detectFromPackageJson(subPackage, usedNames, usedColors);
      services.push(...detected);
    }

    services.push(...detectFromSubdirectories(subPath, maxDepth - 1, usedNames, usedColors));
  }

  return services;
}

function safeReadDir(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function findPattern(script: string): ServicePattern | undefined {
  return SERVICE_PATTERNS.find((pattern) => {
    if (typeof pattern.script === 'string') {
      return pattern.script === script;
    }
    return pattern.script.test(script);
  });
}

function makeUniqueName(base: string, dirName: string, usedNames: Set<string>): string {
  if (!usedNames.has(base)) return base;
  const prefixed = `${dirName}-${base}`;
  if (!usedNames.has(prefixed)) return prefixed;

  let i = 2;
  while (usedNames.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function pickColor(usedColors: Set<string>): string {
  const available = SERVICE_COLORS.find((c) => !usedColors.has(c));
  return available ?? SERVICE_COLORS[Math.floor(Math.random() * SERVICE_COLORS.length)];
}
