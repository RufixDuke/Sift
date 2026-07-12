import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { safeRead, hasAncestorFile } from './utils.js';
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

function pythonRunner(dir: string): string {
  if (existsSync(join(dir, 'poetry.lock'))) return 'poetry run ';
  if (existsSync(join(dir, 'Pipfile'))) return 'pipenv run ';
  return '';
}

function toModule(candidate: string): string {
  return candidate.replace(/\.py$/, '').replace(/\//g, '.');
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
    const depsText = [
      safeRead(join(dir, 'pyproject.toml')),
      safeRead(join(dir, 'requirements.txt')),
      safeRead(join(dir, 'Pipfile')),
    ]
      .join('\n')
      .toLowerCase();
    if (depsText.includes('celery')) {
      services.push({ name: 'worker', command: `${runner}celery -A app worker -l info`, type: 'worker' });
    }
    return services;
  }

  for (const candidate of ENTRY_CANDIDATES) {
    const full = join(dir, candidate);
    if (!existsSync(full)) continue;
    const content = safeRead(full);

    const fastapiMatch = content.match(/(\w+)\s*=\s*FastAPI\(/);
    if (fastapiMatch) {
      const module = toModule(candidate);
      return [
        { name: 'server', command: `${runner}uvicorn ${module}:${fastapiMatch[1]} --reload`, type: 'server' },
      ];
    }

    const flaskMatch = content.match(/(\w+)\s*=\s*Flask\(/);
    if (flaskMatch) {
      const module = toModule(candidate);
      return [
        { name: 'server', command: `${runner}flask --app ${module} run --debug`, type: 'server' },
      ];
    }

    if (/import\s+streamlit/.test(content)) {
      return [{ name: 'app', command: `${runner}streamlit run ${candidate}`, type: 'client' }];
    }
  }

  if (existsSync(join(dir, 'main.py'))) {
    return [{ name: 'server', command: `${runner}python main.py`, type: 'server' }];
  }

  return [];
}
