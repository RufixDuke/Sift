import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseLogLine } from '../src/core/parser.js';
import { detectServices } from '../src/core/detector.js';
import { MultiLineAssembler } from '../src/core/multiline.js';
import { LogBuffer } from '../src/core/buffer.js';
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

describe('log pipeline: assembler → parser → buffer', () => {
  function runPipeline(rawLines: string[], service = 'server', stream: 'stdout' | 'stderr' = 'stdout') {
    const assembler = new MultiLineAssembler();
    const buffer = new LogBuffer({ capacity: 1000 });
    let seq = 0;

    assembler.on('entry', (event) => {
      const raw = event.lines.join('\n');
      const entry = parseLogLine(raw, { service: event.service, stream: event.stream });
      buffer.append(entry);
    });

    for (const line of rawLines) {
      if (line.trim().length === 0) continue;
      assembler.feed({ raw: line, service, stream, serviceColor: '#00BCD4', sequence: ++seq });
    }
    assembler.flush();

    return buffer;
  }

  it('Python: standard logging with timestamps appears immediately', () => {
    const buffer = runPipeline([
      '2026-07-13 10:00:00,123 - myapp - INFO - Server started on port 8000',
      '2026-07-13 10:00:00,456 - myapp - DEBUG - Loading config from settings.py',
      '2026-07-13 10:00:01,789 - myapp - ERROR - Database connection failed',
    ]);
    expect(buffer.length()).toBe(3);
    const entries = buffer.getAll();
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toBe('Server started on port 8000');
    expect(entries[1].level).toBe('debug');
    expect(entries[2].level).toBe('error');
  });

  it('Python: Uvicorn/FastAPI logs appear immediately', () => {
    const buffer = runPipeline([
      'INFO:     Started server process [12345]',
      'INFO:     Waiting for application startup.',
      'INFO:     Application startup complete.',
      'INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)',
      'INFO:     127.0.0.1:54321 - "GET /api/users HTTP/1.1" 200 OK',
      'INFO:     127.0.0.1:54321 - "POST /api/users HTTP/1.1" 404 Not Found',
      'INFO:     127.0.0.1:54321 - "GET /api/crash HTTP/1.1" 500 Internal Server Error',
    ]);
    expect(buffer.length()).toBe(7);
    const entries = buffer.getAll();
    expect(entries[0].level).toBe('info');
    expect(entries[4].level).toBe('info');
    expect(entries[5].level).toBe('warn');
    expect(entries[6].level).toBe('error');
  });

  it('Python: Django dev server logs appear immediately', () => {
    const buffer = runPipeline([
      'Watching for file changes with StatReloader',
      'Performing system checks...',
      'System check identified no issues (0 silenced).',
      '[13/Jul/2026 10:00:00] "GET /api/users HTTP/1.1" 200 1234',
      '[13/Jul/2026 10:00:01] "POST /login HTTP/1.1" 403 567',
      '[13/Jul/2026 10:00:02] "GET /missing HTTP/1.1" 500 89',
    ]);
    expect(buffer.length()).toBe(6);
    const entries = buffer.getAll();
    expect(entries[3].level).toBe('info');
    expect(entries[4].level).toBe('warn');
    expect(entries[5].level).toBe('error');
  });

  it('Python: Flask/Werkzeug access logs appear immediately', () => {
    const buffer = runPipeline([
      ' * Serving Flask app "app"',
      ' * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)',
      '127.0.0.1 - - [13/Jul/2026 10:00:00] "GET / HTTP/1.1" 200 -',
      '127.0.0.1 - - [13/Jul/2026 10:00:01] "POST /api HTTP/1.1" 500 -',
    ]);
    expect(buffer.length()).toBe(4);
    const entries = buffer.getAll();
    expect(entries[2].level).toBe('info');
    expect(entries[3].level).toBe('error');
  });

  it('Go: standard log and Zap logs appear immediately', () => {
    const buffer = runPipeline([
      '2026/07/13 10:00:00 http: Server started on :8080',
      '2026-07-13T10:00:00.123Z\tinfo\tapi/server.go:42\tstarted server',
      '2026-07-13T10:00:00.456Z\terror\tapi/handler.go:55\thandler panicked',
    ]);
    expect(buffer.length()).toBe(3);
    const entries = buffer.getAll();
    expect(entries[1].level).toBe('info');
    expect(entries[2].level).toBe('error');
  });

  it('Go: Logrus key=value logs appear immediately', () => {
    const buffer = runPipeline([
      'time="2026-07-13T10:00:00Z" level=info msg="Server started"',
      'time="2026-07-13T10:00:01Z" level=error msg="Connection refused"',
    ]);
    expect(buffer.length()).toBe(2);
    const entries = buffer.getAll();
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toBe('Server started');
    expect(entries[1].level).toBe('error');
  });

  it('Rust: env_logger and tracing logs appear immediately', () => {
    const buffer = runPipeline([
      '[2026-07-13T10:00:00Z INFO mycrate] Server started on 0.0.0.0:8080',
      '2026-07-13T10:00:00.123456Z  INFO api::server: listening on 0.0.0.0:8080',
      '2026-07-13T10:00:01.234567Z  ERROR api::handler: request failed',
    ]);
    expect(buffer.length()).toBe(3);
    const entries = buffer.getAll();
    expect(entries[0].level).toBe('info');
    expect(entries[1].level).toBe('info');
    expect(entries[2].level).toBe('error');
  });

  it('Ruby: Rails logger and request logs appear immediately', () => {
    const buffer = runPipeline([
      'I, [2026-07-13T10:00:00.123456 #12345]  INFO -- : Started GET "/api/users" for 127.0.0.1',
      'I, [2026-07-13T10:00:00.234567 #12345]  INFO -- : Processing by UsersController#index',
      'E, [2026-07-13T10:00:01.345678 #12345] ERROR -- : ActionView::MissingTemplate',
    ]);
    expect(buffer.length()).toBe(3);
    const entries = buffer.getAll();
    expect(entries[0].level).toBe('info');
    expect(entries[2].level).toBe('error');
  });

  it('Elixir/Phoenix: logs appear immediately', () => {
    const buffer = runPipeline([
      '10:00:00.123 [info] GET /api/users',
      '10:00:00.456 [error] ** (RuntimeError) something went wrong',
      '[info] Sent 200 in 45ms',
    ]);
    expect(buffer.length()).toBe(3);
    const entries = buffer.getAll();
    expect(entries[0].level).toBe('info');
    expect(entries[1].level).toBe('error');
    expect(entries[2].level).toBe('info');
  });

  it('JSON structured logs appear immediately', () => {
    const buffer = runPipeline([
      '{"level":30,"msg":"request completed","responseTime":45}',
      '{"level":"error","message":"database timeout","duration":5000}',
      '{"level":50,"msg":"unhandled exception","stack":"Error: ..."}',
    ]);
    expect(buffer.length()).toBe(3);
    const entries = buffer.getAll();
    expect(entries[0].level).toBe('info');
    expect(entries[1].level).toBe('error');
    expect(entries[2].level).toBe('error');
  });

  it('mixed stderr and stdout logs from multiple services', () => {
    const assembler = new MultiLineAssembler();
    const buffer = new LogBuffer({ capacity: 1000 });
    let seq = 0;

    assembler.on('entry', (event) => {
      const raw = event.lines.join('\n');
      const entry = parseLogLine(raw, { service: event.service, stream: event.stream });
      buffer.append(entry);
    });

    assembler.feed({ raw: 'INFO:     Application startup complete.', service: 'api', stream: 'stdout', serviceColor: '#00BCD4', sequence: ++seq });
    assembler.feed({ raw: 'DeprecationWarning: use X instead', service: 'api', stream: 'stderr', serviceColor: '#00BCD4', sequence: ++seq });
    assembler.feed({ raw: 'I, [2026-07-13T10:00:00.123 #1]  INFO -- : Started GET "/"', service: 'web', stream: 'stdout', serviceColor: '#2196F3', sequence: ++seq });
    assembler.feed({ raw: '2026-07-13T10:00:00.456Z\tinfo\tapi/server.go:42\tstarted', service: 'go-api', stream: 'stdout', serviceColor: '#9C27B0', sequence: ++seq });
    assembler.flush();

    expect(buffer.length()).toBe(4);
    const entries = buffer.getAll();
    expect(entries[0].service).toBe('api');
    expect(entries[1].service).toBe('api');
    expect(entries[1].stream).toBe('stderr');
    expect(entries[1].level).toBe('warn');
    expect(entries[2].service).toBe('web');
    expect(entries[3].service).toBe('go-api');
  });

  it('entries with timestamps are immediately available in buffer', () => {
    const buffer = new LogBuffer({ capacity: 100 });
    const entry = parseLogLine(
      '2026-07-13 10:00:00,123 - myapp - INFO - Hello',
      { service: 'api', stream: 'stdout' },
    );
    expect(entry.timestamp).toBeInstanceOf(Date);
    buffer.append(entry);
    expect(buffer.length()).toBe(1);
    expect(buffer.getAll()).toHaveLength(1);
    expect(buffer.getAll()[0].message).toBe('Hello');
  });

  it('rapid sequential entries all appear in buffer', () => {
    const buffer = new LogBuffer({ capacity: 100 });
    for (let i = 0; i < 50; i++) {
      const entry = parseLogLine(
        `2026-07-13 10:00:${String(i).padStart(2, '0')},000 - app - INFO - Message ${i}`,
        { service: 'api', stream: 'stdout' },
      );
      buffer.append(entry);
    }
    expect(buffer.length()).toBe(50);
    expect(buffer.getAll()).toHaveLength(50);
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

