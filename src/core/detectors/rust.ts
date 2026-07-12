import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { safeRead } from './utils.js';
import type { RawService } from './types.js';

export function detectRustServices(dir: string): RawService[] {
  const cargoPath = join(dir, 'Cargo.toml');
  if (!existsSync(cargoPath)) return [];

  const content = safeRead(cargoPath);
  if (/\[workspace\]/.test(content) && !/\[package\]/.test(content)) return [];

  const binNames = content
    .split(/\[\[bin\]\]/)
    .slice(1)
    .map((block) => block.match(/name\s*=\s*"([^"]+)"/)?.[1])
    .filter((name): name is string => Boolean(name));

  if (binNames.length > 0) {
    return binNames.map((name) => ({ name, command: `cargo run --bin ${name}`, type: 'server' as const }));
  }

  const nameMatch = content.match(/\[package\][\s\S]*?name\s*=\s*"([^"]+)"/);
  const name = nameMatch ? nameMatch[1] : basename(dir);
  return [{ name, command: 'cargo run', type: 'server' }];
}
