import { readdirSync } from 'node:fs';
import { join, relative, sep, basename, dirname } from 'node:path';
import { safeRead } from './utils.js';

export interface CeleryApp {
  /** Dotted module passed to `celery -A`. */
  module: string;
  /** True when no Celery app module was found and the module is a convention-based guess. */
  guessed: boolean;
}

const SKIP_DIRS = new Set([
  'node_modules',
  'vendor',
  'venv',
  'env',
  '__pycache__',
  'target',
  'dist',
  'build',
  'out',
  'site-packages',
  'migrations',
  'tests',
  'test',
]);

const MAX_DEPTH = 5;
const MAX_FILES = 400;

const CELERY_IMPORT = /(?:from\s+celery\s+import|import\s+celery\b)/;
const CELERY_INSTANCE = /\bCelery\s*\(/;

/**
 * Collects the project's .py files (skipping virtualenvs, caches, tests and
 * dot-directories), ordered shallowest-first so conventional layouts win.
 */
function collectPythonFiles(dir: string): string[] {
  const files: string[] = [];

  const walk = (current: string, depth: number): void => {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES) return;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        walk(join(current, entry.name), depth + 1);
      } else if (entry.name.endsWith('.py') && !entry.name.startsWith('test_')) {
        files.push(join(current, entry.name));
      }
    }
  };

  walk(dir, 0);
  return files.sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
}

function depth(filePath: string): number {
  return filePath.split(sep).length;
}

function toDottedModule(dir: string, path: string): string {
  return relative(dir, path).replace(/\.py$/, '').split(sep).filter(Boolean).join('.');
}

function depsMentionCelery(dir: string): boolean {
  const texts = [
    safeRead(join(dir, 'pyproject.toml')),
    safeRead(join(dir, 'requirements.txt')),
    safeRead(join(dir, 'Pipfile')),
  ];
  try {
    for (const entry of readdirSync(join(dir, 'requirements'))) {
      if (entry.endsWith('.txt')) texts.push(safeRead(join(dir, 'requirements', entry)));
    }
  } catch {
    // no requirements/ directory
  }
  return texts.join('\n').toLowerCase().includes('celery');
}

/**
 * Locates the project's Celery app module, in order of confidence:
 * 1. a `celery.py` module (`pkg/celery.py` -> `-A pkg`, the Django convention);
 * 2. any module instantiating `Celery(...)` (FastAPI/custom layouts:
 *    tasks.py, worker.py, celery_app.py, ...);
 * 3. Celery only referenced (imports or dependencies): fall back to the
 *    Django settings package, or a plain `app` guess flagged for editing.
 */
export function detectCeleryApp(dir: string): CeleryApp | null {
  const pyFiles = collectPythonFiles(dir);

  const celeryFile = pyFiles.find((f) => basename(f) === 'celery.py');
  if (celeryFile) {
    const parent = toDottedModule(dir, dirname(celeryFile));
    return { module: parent || 'celery', guessed: false };
  }

  let importsCelery = false;
  for (const file of pyFiles) {
    const content = safeRead(file);
    if (CELERY_INSTANCE.test(content)) {
      return { module: toDottedModule(dir, file), guessed: false };
    }
    if (CELERY_IMPORT.test(content)) importsCelery = true;
  }

  if (!importsCelery && !depsMentionCelery(dir)) return null;

  const settingsFile = pyFiles.find((f) => basename(f) === 'settings.py');
  if (settingsFile) {
    const parent = toDottedModule(dir, dirname(settingsFile));
    if (parent) return { module: parent, guessed: true };
  }
  return { module: 'app', guessed: true };
}
