import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hasAncestorFile } from './utils.js';
import type { RawService } from './types.js';

function detectPlainPhpScript(dir: string): RawService[] {
  if (hasAncestorFile(dir, ['composer.json'])) return [];
  if (existsSync(join(dir, 'index.php'))) {
    return [{ name: 'server', command: 'php -S localhost:8000', type: 'server' }];
  }
  return [];
}

export function detectPhpServices(dir: string): RawService[] {
  if (!existsSync(join(dir, 'composer.json'))) return detectPlainPhpScript(dir);

  if (existsSync(join(dir, 'artisan'))) {
    const services: RawService[] = [{ name: 'server', command: 'php artisan serve', type: 'server' }];
    if (existsSync(join(dir, 'config', 'queue.php'))) {
      services.push({ name: 'worker', command: 'php artisan queue:work', type: 'worker' });
    }
    return services;
  }

  if (existsSync(join(dir, 'bin', 'console'))) {
    return [{ name: 'server', command: 'php bin/console server:run', type: 'server' }];
  }

  if (existsSync(join(dir, 'index.php'))) {
    return [{ name: 'server', command: 'php -S localhost:8000', type: 'server' }];
  }

  return [];
}
