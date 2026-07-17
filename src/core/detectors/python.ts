import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { safeRead, hasAncestorFile, pythonRunner } from './utils.js';
import { detectCeleryApp } from './celery.js';
import { procfileDefinesWeb } from './procfile.js';
import type { RawService } from './types.js';

const MARKERS = ['pyproject.toml', 'requirements.txt', 'Pipfile', 'setup.py', 'manage.py'];

const ENTRY_CANDIDATES = [
  'main.py',
  'app.py',
  'app/main.py',
  'src/main.py',
  'src/app.py',
  'application.py',
];

function toModule(candidate: string): string {
  return candidate.replace(/\.py$/, '').replace(/\//g, '.');
}

function workerService(dir: string, runner: string): RawService | undefined {
  const celery = detectCeleryApp(dir);
  if (!celery) return undefined;
  return {
    name: 'worker',
    command: `${runner}celery -A ${celery.module} worker -l info`,
    type: 'worker',
    guessed: celery.guessed || undefined,
  };
}

/**
 * When a project needs both a server and a worker, the `web` service bundles
 * both into one command (worker backgrounded) so it can run everything at
 * once. Skipped when a Procfile already defines `web` for the directory.
 */
function withCombinedWeb(dir: string, services: RawService[]): RawService[] {
  const server = services.find((s) => s.type === 'server');
  const worker = services.find((s) => s.type === 'worker');
  if (!server || !worker || procfileDefinesWeb(dir)) return services;

  return [
    {
      name: 'web',
      command: `${worker.command} & ${server.command}`,
      type: 'server',
      guessed: server.guessed || worker.guessed || undefined,
    },
    ...services,
  ];
}

export function detectPythonServices(dir: string): RawService[] {
  const hasManifest = MARKERS.some((m) => existsSync(join(dir, m)));
  const hasEntryFile = ENTRY_CANDIDATES.some((c) => existsSync(join(dir, c)));
  if (!hasManifest && !hasEntryFile) return [];
  // No local manifest, but an ancestor has one: this dir is just a regular
  // module within that project (e.g. a package folder that happens to
  // contain a main.py), not a standalone script.
  if (!hasManifest && hasAncestorFile(dir, MARKERS)) return [];

  const runner = pythonRunner(dir);

  if (existsSync(join(dir, 'manage.py'))) {
    const services: RawService[] = [
      { name: 'server', command: `${runner}python manage.py runserver`, type: 'server' },
    ];
    const worker = workerService(dir, runner);
    if (worker) services.push(worker);
    return withCombinedWeb(dir, services);
  }

  let server: RawService | undefined;
  for (const candidate of ENTRY_CANDIDATES) {
    const full = join(dir, candidate);
    if (!existsSync(full)) continue;
    const content = safeRead(full);

    const fastapiMatch = content.match(/(\w+)\s*=\s*FastAPI\(/);
    if (fastapiMatch) {
      const module = toModule(candidate);
      server = {
        name: 'server',
        command: `${runner}uvicorn ${module}:${fastapiMatch[1]} --reload`,
        type: 'server',
      };
      break;
    }

    const flaskMatch = content.match(/(\w+)\s*=\s*Flask\(/);
    if (flaskMatch) {
      const module = toModule(candidate);
      server = {
        name: 'server',
        command: `${runner}flask --app ${module} run --debug`,
        type: 'server',
      };
      break;
    }

    if (/import\s+streamlit/.test(content)) {
      return [{ name: 'app', command: `${runner}streamlit run ${candidate}`, type: 'client' }];
    }
  }

  if (!server && existsSync(join(dir, 'main.py'))) {
    server = { name: 'server', command: `${runner}python main.py`, type: 'server' };
  }
  if (!server) return [];

  const services = [server];
  const worker = workerService(dir, runner);
  if (worker) services.push(worker);
  return withCombinedWeb(dir, services);
}
