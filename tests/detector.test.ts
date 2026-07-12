import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectServices } from '../src/core/detector.js';

describe('detectServices', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sift-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects standard scripts from package.json', () => {
    const pkg = {
      scripts: {
        dev: 'next dev',
        server: 'nodemon src/index.js',
        expo: 'expo start --clear',
        db: 'docker compose up postgres',
        stripe: 'stripe listen --forward-to localhost:3000/webhook',
      },
    };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));

    const services = detectServices({ packagePath: join(tempDir, 'package.json') });
    const names = services.map((s) => s.name).sort();
    expect(names).toEqual(['api', 'db', 'mobile', 'stripe', 'web']);
  });

  it('disambiguates duplicate script names by directory', () => {
    const rootPkg = { scripts: { dev: 'next dev' } };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(rootPkg));

    const dashboardDir = join(tempDir, 'dashboard');
    mkdirSync(dashboardDir);
    const dashboardPkg = { scripts: { dev: 'vite' } };
    writeFileSync(join(dashboardDir, 'package.json'), JSON.stringify(dashboardPkg));

    const services = detectServices({ packagePath: join(tempDir, 'package.json') });
    const names = services.map((s) => s.name).sort();
    expect(names).toEqual(['dashboard-web', 'web']);
  });

  it('returns empty array when package.json is missing', () => {
    const services = detectServices({ packagePath: join(tempDir, 'missing.json') });
    expect(services).toEqual([]);
  });

  it('assigns unique colors', () => {
    const pkg = {
      scripts: {
        dev: 'next dev',
        server: 'nodemon src/index.js',
        expo: 'expo start',
      },
    };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg));

    const services = detectServices({ packagePath: join(tempDir, 'package.json') });
    const colors = services.map((s) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
