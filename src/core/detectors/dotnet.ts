import { readdirSync } from 'node:fs';
import { basename } from 'node:path';
import type { RawService } from './types.js';

export function detectDotnetServices(dir: string): RawService[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const csproj = entries.find((f) => f.endsWith('.csproj') || f.endsWith('.fsproj'));
  if (!csproj) return [];

  const name = basename(csproj, csproj.endsWith('.fsproj') ? '.fsproj' : '.csproj');
  return [{ name, command: 'dotnet run', type: 'server' }];
}
