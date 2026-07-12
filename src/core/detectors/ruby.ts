import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { safeRead } from './utils.js';
import type { RawService } from './types.js';

export function detectRubyServices(dir: string): RawService[] {
  if (!existsSync(join(dir, 'Gemfile'))) return [];

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
