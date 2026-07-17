import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ServiceType } from '../../types/index.js';
import { safeRead, pythonRunner } from './utils.js';
import type { RawService } from './types.js';

function typeForProcess(name: string): ServiceType {
  if (name === 'web') return 'server';
  if (/worker|clock|queue|job/i.test(name)) return 'worker';
  return 'generic';
}

/**
 * One-off database setup/migration commands. Procfiles are written for
 * production deploys, where running migrations on boot is normal — sift runs
 * services for local development, so these must never be part of a command.
 */
const DB_COMMAND_PATTERNS = [
  /\bmanage\.py\s+(migrate|makemigrations|sqlmigrate|dbshell)\b/,
  /\bdjango-admin\s+(migrate|makemigrations)\b/,
  /\balembic\s+(upgrade|downgrade|stamp|revision)\b/,
  /\bflask\s+db\s+(init|migrate|upgrade|downgrade)\b/,
  /\bprisma\s+(migrate|db\s+push)\b/,
  /\b(?:rails|rake)\s+db:/,
  /\bsequelize(?:-cli)?\s+db:/,
  /\bknex\s+migrate/,
  /\btypeorm\b.*\bmigration:(?:run|revert)/,
  /\bartisan\s+migrate\b/,
  /\bdiesel\s+migration\s+run\b/,
  /\bflyway\s+migrate\b/,
  /\bliquibase\s+update\b/,
];

function isDbCommand(segment: string): boolean {
  return DB_COMMAND_PATTERNS.some((pattern) => pattern.test(segment));
}

/**
 * Removes one-off database commands (migrations etc.) from a compound shell
 * command, keeping the remaining segments joined sensibly. When a dropped
 * segment sat between two kept ones, the separator that preceded the dropped
 * segment wins, so `A & migrate && B` becomes `A & B` (A stays backgrounded).
 */
export function removeDbCommands(command: string): string {
  const tokens = command.split(/(&&|;|&)/);
  let result = '';
  let carrySep = '';
  for (let i = 0; i < tokens.length; i += 2) {
    const segment = tokens[i].trim();
    const sep = i === 0 ? '' : tokens[i - 1];
    if (!segment) continue;
    if (isDbCommand(segment)) {
      if (result) carrySep = sep;
      continue;
    }
    result = result ? `${result} ${carrySep || sep} ${segment}` : segment;
    carrySep = '';
  }
  return result;
}

/**
 * Makes a Procfile command safe for local development: strips database
 * commands, and for Django projects replaces production servers
 * (gunicorn/uwsgi) with the local dev server.
 */
function sanitizeProcfileCommand(dir: string, command: string): string {
  let cleaned = removeDbCommands(command);
  if (existsSync(join(dir, 'manage.py'))) {
    const runner = pythonRunner(dir);
    cleaned = cleaned
      .split(/(&&|;|&)/)
      .map((part, i) =>
        i % 2 === 0
          ? part.replace(/^(\s*)(?:gunicorn|uwsgi)\b.*$/, `$1${runner}python manage.py runserver`)
          : part,
      )
      .join('');
  }
  return cleaned.trim();
}

/** True when the directory's Procfile defines a `web` process. */
export function procfileDefinesWeb(dir: string): boolean {
  return /^web\s*:/m.test(safeRead(join(dir, 'Procfile')));
}

export function detectProcfileServices(dir: string): RawService[] {
  const procPath = join(dir, 'Procfile');
  if (!existsSync(procPath)) return [];

  const content = safeRead(procPath);
  const services: RawService[] = [];

  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (!match) continue;
    const [, name, rawCommand] = match;
    if (name === 'release') continue;
    const command = sanitizeProcfileCommand(dir, rawCommand.trim());
    if (!command) continue;
    const type = typeForProcess(name);
    services.push({ name, command, type, guessed: type === 'worker' });
  }

  return services;
}
