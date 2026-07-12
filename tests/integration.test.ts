import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseLogLine } from '../src/core/parser.js';
import { detectServices } from '../src/core/detector.js';
import { MultiLineAssembler } from '../src/core/multiline.js';
import { mkdtempSync, writeFileSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLines } from '../src/cli/commands/run.js';

const FIXTURES_DIR = resolve(process.cwd(), 'tests/fixtures');

function parseFixture(fileName: string): ReturnType<typeof parseLogLine>[] {
  const content = readFileSync(resolve(FIXTURES_DIR, fileName), 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, idx) =>
      parseLogLine(line, { service: 'fixture', stream: 'stdout' }, { injectTimestamps: false }),
    );
}

describe('fixtures', () => {
  it('parses express-combined.log', () => {
    const entries = parseFixture('express-combined.log');
    expect(entries).toHaveLength(3);
    expect(entries[0].level).toBe('info');
    expect(entries[1].level).toBe('warn');
    expect(entries[2].level).toBe('error');
  });

  it('parses pino.log numeric levels', () => {
    const entries = parseFixture('pino.log');
    expect(entries[0].level).toBe('info');
    expect(entries[1].level).toBe('warn');
    expect(entries[2].level).toBe('error');
  });

  it('parses docker-compose.log', () => {
    const entries = parseFixture('docker-compose.log');
    expect(entries).toHaveLength(3);
    expect(entries[0].level).toBe('info');
    expect(entries[2].level).toBe('info');
  });

  it('parses multiline-stacktrace.log via assembler', () => {
    const content = readFileSync(resolve(FIXTURES_DIR, 'multiline-stacktrace.log'), 'utf-8');
    const assembler = new MultiLineAssembler();
    const emitted: { lines: string[] }[] = [];
    assembler.on('entry', (e) => emitted.push(e));

    for (const line of content.split('\n').filter((l) => l.trim())) {
      assembler.feed({ raw: line, service: 'api', stream: 'stderr', serviceColor: '#f00', sequence: 0 });
    }
    assembler.flush();

    expect(emitted.length).toBeGreaterThanOrEqual(2);
    expect(emitted[0].lines.length).toBeGreaterThanOrEqual(3);
  });
});

describe('detectServices integration', () => {
  let tempDir: string;

  it('detects full-stack package.json', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'sift-fullstack-'));
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
    expect(services.length).toBe(5);

    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe('readLines file follow', () => {
  it('reads existing content and picks up appended lines', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sift-readlines-'));
    const filePath = join(tempDir, 'app.log');
    writeFileSync(filePath, 'first line\nsecond line\n');

    const lines: string[] = [];
    const reader = readLines(filePath, (line) => lines.push(line));

    // Wait for the initial read to complete.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(lines).toEqual(['first line', 'second line']);

    appendFileSync(filePath, 'third line\n');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(lines).toEqual(['first line', 'second line', 'third line']);

    reader.stop();
    await reader.done;

    rmSync(tempDir, { recursive: true, force: true });
  });
});

