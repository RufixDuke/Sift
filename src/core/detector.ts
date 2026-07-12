import { readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import type { ServiceConfig } from '../types/index.js';
import { SERVICE_COLORS } from '../types/index.js';
import { detectInDirectory, type RawService } from './detectors/index.js';

export interface DetectOptions {
  packagePath?: string;
  maxDepth?: number;
}

const SKIP_DIRS = new Set([
  'node_modules',
  'vendor',
  'venv',
  '.venv',
  'env',
  '__pycache__',
  '.git',
  '.hg',
  '.svn',
  'target',
  'dist',
  'build',
  'out',
  'bin',
  'obj',
  '.next',
  '.nuxt',
  'coverage',
  'site-packages',
  '.tox',
  '.mypy_cache',
  '.pytest_cache',
  '.gradle',
  '.idea',
  '.vscode',
]);

export function detectServices(options: DetectOptions = {}): ServiceConfig[] {
  const explicitPackagePath = options.packagePath ? resolve(options.packagePath) : undefined;
  const rootDir = explicitPackagePath ? dirname(explicitPackagePath) : resolve('.');

  const usedNames = new Set<string>();
  const usedColors = new Set<string>();
  const services: ServiceConfig[] = [];

  const rootRaw = detectInDirectory(rootDir, explicitPackagePath);
  services.push(...finalize(rootRaw, rootDir, usedNames, usedColors));

  const maxDepth = options.maxDepth ?? 2;
  services.push(...walkSubdirectories(rootDir, maxDepth, usedNames, usedColors));

  return services;
}

function walkSubdirectories(
  rootDir: string,
  maxDepth: number,
  usedNames: Set<string>,
  usedColors: Set<string>,
): ServiceConfig[] {
  if (maxDepth <= 0) return [];
  const services: ServiceConfig[] = [];

  for (const entry of safeReadDir(rootDir)) {
    if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue;
    const subPath = resolve(rootDir, entry);

    const raw = detectInDirectory(subPath);
    services.push(...finalize(raw, subPath, usedNames, usedColors));

    services.push(...walkSubdirectories(subPath, maxDepth - 1, usedNames, usedColors));
  }

  return services;
}

function finalize(
  raw: RawService[],
  dir: string,
  usedNames: Set<string>,
  usedColors: Set<string>,
): ServiceConfig[] {
  const dirName = basename(dir);
  const services: ServiceConfig[] = [];

  for (const svc of raw) {
    const name = makeUniqueName(svc.name, dirName, usedNames);
    usedNames.add(name);
    const color = pickColor(usedColors);
    usedColors.add(color);

    services.push({
      name,
      command: svc.command,
      cwd: dir,
      color,
      type: svc.type,
    });
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
