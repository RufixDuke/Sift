#!/usr/bin/env node
import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { configCommand } from './commands/config.js';
import { replayCommand } from './commands/replay.js';
import { diffCommand } from './commands/diff.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    const pkgPath = resolve(__dirname, '../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('sift')
  .description('Intelligent log aggregator for local development')
  .version(getVersion(), '-v, --version', 'Show sift version');

program
  .command('run')
  .description('Run all detected services and aggregate their logs')
  .option('-c, --config <path>', 'Path to sift.config.json')
  .option('-p, --package <path>', 'Path to package.json')
  .option('--buffer <number>', 'Max log lines to keep in memory', '10000')
  .option('--follow <services>', 'Comma-separated list of services to follow')
  .option('--exclude <services>', 'Comma-separated list of services to exclude')
  .option('--no-detect', 'Do not auto-detect services, use config only')
  .option('--file <path>', 'Read from a log file or stdin (-) instead of spawning processes')
  .option('--strip-ansi', 'Strip ANSI color codes from output')
  .option('--session-name <name>', 'Name for the saved session')
  .option('--no-save', 'Do not persist this session to SQLite')
  .option('--all', 'Run every detected service without prompting for a selection')
  .option(
    '-y, --yes',
    'Skip prompts: reuse the last run selection, or run all confident (non-guessed) services',
  )
  .option(
    '--select',
    'Force the service picker even if a previous selection was saved for this project',
  )
  .action(runCommand);

program
  .command('replay')
  .description('Replay a persisted log session')
  .option('--session <identifier>', 'Session name, id, or alias (last, today, yesterday)', 'last')
  .option('--strip-ansi', 'Strip ANSI color codes from output')
  .action(replayCommand);

program
  .command('diff')
  .description('Compare two persisted log sessions')
  .argument('<sessionA>', 'First session identifier')
  .argument('<sessionB>', 'Second session identifier')
  .action(diffCommand);

program
  .command('config')
  .description('Manage sift configuration')
  .argument('<action>', 'init')
  .option('-p, --package <path>', 'Path to package.json')
  .action(configCommand);

program.parse();
