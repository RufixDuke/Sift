import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { safeRead, hasAncestorFile } from './utils.js';
import type { RawService } from './types.js';

const SCRIPT_CANDIDATES = ['main.rb', 'app.rb', 'server.rb'];

function detectPlainRubyScript(dir: string): RawService[] {
  if (hasAncestorFile(dir, ['Gemfile'])) return [];
  for (const candidate of SCRIPT_CANDIDATES) {
    if (existsSync(join(dir, candidate))) {
      return [{ name: 'server', command: `ruby ${candidate}`, type: 'server' }];
    }
  }
  return [];
}

export function detectRubyServices(dir: string): RawService[] {
  if (!existsSync(join(dir, 'Gemfile'))) return detectPlainRubyScript(dir);

  const gemfile = safeRead(join(dir, 'Gemfile')).toLowerCase();
  const isRails =
    existsSync(join(dir, 'bin', 'rails')) || existsSync(join(dir, 'config', 'application.rb'));

  if (isRails) {
    const command = existsSync(join(dir, 'bin', 'rails'))
      ? 'bin/rails server'
      : 'bundle exec rails server';
    const services: RawService[] = [{ name: 'server', command, type: 'server' }];
    if (gemfile.includes('sidekiq')) {
      services.push({ name: 'worker', command: 'bundle exec sidekiq', type: 'worker' });
    }
    return services;
  }

  if (existsSync(join(dir, 'config.ru'))) {
    return [{ name: 'server', command: 'bundle exec rackup', type: 'server' }];
  }

  if (existsSync(join(dir, 'app.rb'))) {
    return [{ name: 'server', command: 'ruby app.rb', type: 'server' }];
  }

  return [];
}
