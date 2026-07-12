import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function safeRead(path: string): string {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Walks up from `dir` (excluding `dir` itself) looking for any of `names`.
 * Used to avoid re-detecting a manifest-less fallback service inside a
 * subdirectory that already belongs to a project rooted higher up.
 */
export function hasAncestorFile(dir: string, names: string[]): boolean {
  let current = dirname(dir);
  while (true) {
    if (names.some((name) => existsSync(join(current, name)))) return true;
    const parent = dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}
