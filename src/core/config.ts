import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import type { SiftConfig, ServiceConfig } from '../types/index.js';
import { DEFAULT_SETTINGS } from '../types/index.js';

export const CONFIG_FILE_NAME = 'sift.config.json';
export const DOT_CONFIG_FILE = '.siftrc';

const ServiceTypeSchema = z.enum([
  'server',
  'client',
  'mobile',
  'bundler',
  'database',
  'cache',
  'webhook',
  'network',
  'worker',
  'generic',
]);

const RestartSchema = z.enum(['never', 'on-failure', 'always']);

const ServiceConfigSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  color: z.string().optional(),
  parser: z.string().optional(),
  dependsOn: z.array(z.string()).optional(),
  readyPattern: z.string().optional(),
  readyTimeout: z.number().int().positive().optional(),
  restart: RestartSchema.optional(),
  maxRestarts: z.number().int().positive().optional(),
  tty: z.boolean().optional(),
  interactive: z.boolean().optional(),
  suppress: z.boolean().optional(),
  prefix: z.string().optional(),
  type: ServiceTypeSchema.optional(),
});

const SiftSettingsSchema = z.object({
  bufferSize: z.number().int().positive().optional(),
  showTimestamp: z.boolean().optional(),
  showServiceName: z.boolean().optional(),
  showStreamIndicator: z.boolean().optional(),
  stripAnsi: z.boolean().optional(),
  injectTimestamps: z.boolean().optional(),
  autoScroll: z.boolean().optional(),
  autoRestart: z.boolean().optional(),
  theme: z.enum(['dark', 'light']).optional(),
  sidebarWidth: z.number().int().positive().optional(),
  dateFormat: z.string().optional(),
});

const SiftConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.number().int().positive(),
  services: z.array(ServiceConfigSchema).min(1, 'At least one service is required'),
  settings: SiftSettingsSchema.optional(),
});

export interface ConfigResolution {
  path: string;
  config: SiftConfig;
}

export function validateConfig(config: unknown): SiftConfig {
  return SiftConfigSchema.parse(config);
}

export function resolveConfig(configPath?: string): ConfigResolution | null {
  const candidates = configPath
    ? [resolve(configPath)]
    : [
        resolve(process.cwd(), CONFIG_FILE_NAME),
        resolve(process.cwd(), DOT_CONFIG_FILE),
        resolve(homedir(), '.config', 'sift', 'config.json'),
      ];

  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(content);
        const config = validateConfig(parsed);
        return { path, config: normalizeConfig(config) };
      } catch (err) {
        if (err instanceof z.ZodError) {
          const issues = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
          throw new Error(`Invalid config at ${path}: ${issues}`);
        }
        throw new Error(`Failed to parse config at ${path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return null;
}

export function normalizeConfig(config: SiftConfig): SiftConfig {
  return {
    ...config,
    services: config.services.map((s) => ({
      cwd: process.cwd(),
      ...s,
    })),
    settings: {
      ...DEFAULT_SETTINGS,
      ...config.settings,
    },
  };
}

export function createDefaultConfig(services: ServiceConfig[]): SiftConfig {
  return {
    $schema: 'https://sift.dev/schema.json',
    version: 1,
    services,
    settings: DEFAULT_SETTINGS,
  };
}

export function writeConfig(path: string, config: SiftConfig): void {
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
