import { describe, it, expect } from 'vitest';
import { LogBuffer } from '../src/core/buffer.js';
import { MultiLineAssembler } from '../src/core/multiline.js';
import { ServiceSpawner } from '../src/core/spawner.js';
import { parseLogLine } from '../src/core/parser.js';
import type { ParsedLogEntry, ServiceConfig } from '../src/types/index.js';

function runServiceAndCollect(
  config: ServiceConfig,
  timeoutMs = 4000,
): Promise<{ entries: ParsedLogEntry[]; logCount: number }> {
  return new Promise((resolve) => {
    const buffer = new LogBuffer({ capacity: 1000 });
    const assembler = new MultiLineAssembler();
    const spawner = new ServiceSpawner({ services: [config] });

    assembler.on('entry', (event) => {
      const raw = event.lines.join('\n');
      const entry = parseLogLine(raw, { service: event.service, stream: event.stream });
      buffer.append(entry);
    });

    spawner.on('rawLine', (event) => {
      assembler.feed(event);
    });

    const flushInterval = setInterval(() => assembler.flush(), 100);

    spawner.start();

    setTimeout(async () => {
      clearInterval(flushInterval);
      assembler.flush();
      await spawner.stop();
      const states = spawner.getStates();
      resolve({
        entries: buffer.getAll(),
        logCount: states[0]?.logCount ?? 0,
      });
    }, timeoutMs);
  });
}

const SCRATCH =
  '/private/tmp/claude-501/-Users-abdul-qudus-Documents-Projects-sift/cdb736c2-727f-4765-9889-238cacf02514/scratchpad/test-logs';

describe('e2e pipeline: real process → spawner → assembler → parser → buffer', () => {
  it('Python standard logging: all logs visible and correctly parsed', async () => {
    const result = await runServiceAndCollect(
      { name: 'python-std', command: `bash ${SCRATCH}/python_std.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBe(4);
    expect(result.entries[0].level).toBe('info');
    expect(result.entries[0].message).toBe('Server started on port 8000');
    expect(result.entries[0].timestamp).toBeInstanceOf(Date);
    expect(result.entries[1].level).toBe('debug');
    expect(result.entries[2].level).toBe('error');
    expect(result.entries[3].level).toBe('warn');
  }, 5000);

  it('Uvicorn/FastAPI: all logs visible with correct HTTP status levels', async () => {
    const result = await runServiceAndCollect(
      { name: 'uvicorn', command: `bash ${SCRATCH}/uvicorn.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBeGreaterThanOrEqual(10);

    const get200 = result.entries.find((e) => e.raw.includes('200 OK'));
    expect(get200?.level).toBe('info');

    const post404 = result.entries.find((e) => e.raw.includes('404 Not Found'));
    expect(post404?.level).toBe('warn');

    const get500 = result.entries.find((e) => e.raw.includes('500 Internal Server Error'));
    expect(get500?.level).toBe('error');
  }, 5000);

  it('Django dev server: all logs visible with status-based levels', async () => {
    const result = await runServiceAndCollect(
      { name: 'django', command: `bash ${SCRATCH}/django.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBe(7);

    const ok200 = result.entries.find((e) => e.raw.includes('200 1234'));
    expect(ok200?.level).toBe('info');

    const forbidden403 = result.entries.find((e) => e.raw.includes('403'));
    expect(forbidden403?.level).toBe('warn');

    const error500 = result.entries.find((e) => e.raw.includes('500'));
    expect(error500?.level).toBe('error');
  }, 5000);

  it('Flask/Werkzeug: all logs visible with status-based levels', async () => {
    const result = await runServiceAndCollect(
      { name: 'flask', command: `bash ${SCRATCH}/flask.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBe(5);

    const ok = result.entries.find((e) => e.raw.includes('"GET / HTTP/1.1" 200'));
    expect(ok?.level).toBe('info');

    const error = result.entries.find((e) => e.raw.includes('"POST /api HTTP/1.1" 500'));
    expect(error?.level).toBe('error');
  }, 5000);

  it('Go standard + Zap: all logs visible and correctly parsed', async () => {
    const result = await runServiceAndCollect(
      { name: 'go-api', command: `bash ${SCRATCH}/go.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBe(5);

    const zapError = result.entries.find((e) => e.raw.includes('handler panicked'));
    expect(zapError?.level).toBe('error');

    const zapWarn = result.entries.find((e) => e.raw.includes('slow request'));
    expect(zapWarn?.level).toBe('warn');
  }, 5000);

  it('Go Logrus: all logs visible and correctly parsed', async () => {
    const result = await runServiceAndCollect(
      { name: 'logrus', command: `bash ${SCRATCH}/logrus.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBe(4);
    expect(result.entries[0].level).toBe('info');
    expect(result.entries[0].message).toBe('Server started on :8080');
    expect(result.entries[1].level).toBe('warn');
    expect(result.entries[2].level).toBe('error');
    expect(result.entries[3].level).toBe('debug');
  }, 5000);

  it('Rust env_logger + tracing: all logs visible and correctly parsed', async () => {
    const result = await runServiceAndCollect(
      { name: 'rust-api', command: `bash ${SCRATCH}/rust.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBe(7);

    const envLoggerError = result.entries.find((e) => e.raw.includes('Connection pool exhausted'));
    expect(envLoggerError?.level).toBe('error');

    const tracingWarn = result.entries.find((e) => e.raw.includes('90% capacity'));
    expect(tracingWarn?.level).toBe('warn');

    const tracingDebug = result.entries.find((e) => e.raw.includes('processing request'));
    expect(tracingDebug?.level).toBe('debug');
  }, 5000);

  it('Ruby Rails: all logs visible and correctly parsed', async () => {
    const result = await runServiceAndCollect(
      { name: 'rails', command: `bash ${SCRATCH}/rails.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBe(7);

    const railsError = result.entries.find((e) => e.raw.includes('MissingTemplate'));
    expect(railsError?.level).toBe('error');

    const railsWarn = result.entries.find((e) => e.raw.includes('Deprecated'));
    expect(railsWarn?.level).toBe('warn');

    const railsDebug = result.entries.find((e) => e.raw.includes('User Load'));
    expect(railsDebug?.level).toBe('debug');
  }, 5000);

  it('Elixir/Phoenix: all logs visible and correctly parsed', async () => {
    const result = await runServiceAndCollect(
      { name: 'phoenix', command: `bash ${SCRATCH}/elixir.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBe(6);

    const phoenixError = result.entries.find((e) => e.raw.includes('RuntimeError'));
    expect(phoenixError?.level).toBe('error');

    const phoenixDebug = result.entries.find((e) => e.raw.includes('QUERY OK'));
    expect(phoenixDebug?.level).toBe('debug');
  }, 5000);

  it('JSON structured logs: all logs visible and correctly parsed', async () => {
    const result = await runServiceAndCollect(
      { name: 'json-api', command: `bash ${SCRATCH}/json.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBe(6);

    const info = result.entries.find((e) => e.message.includes('Server listening'));
    expect(info?.level).toBe('info');

    const warn = result.entries.find((e) => e.message.includes('Slow query'));
    expect(warn?.level).toBe('warn');

    const error = result.entries.find((e) => e.message.includes('Unhandled promise'));
    expect(error?.level).toBe('error');
  }, 5000);

  it('Node.js / Next.js / Vite: all logs visible and correctly parsed', async () => {
    const result = await runServiceAndCollect(
      { name: 'node-app', command: `bash ${SCRATCH}/node.sh` },
      2000,
    );
    expect(result.entries.length).toBe(result.logCount);
    expect(result.entries.length).toBe(8);

    const bracketInfo = result.entries.find((e) => e.raw.includes('[INFO] Server started'));
    expect(bracketInfo?.level).toBe('info');

    const bracketError = result.entries.find((e) => e.raw.includes('[ERROR] Failed'));
    expect(bracketError?.level).toBe('error');

    const viteEntry = result.entries.find((e) => e.raw.includes('[vite] hmr'));
    expect(viteEntry).toBeDefined();
  }, 5000);

  it('buffer.length matches logCount for ALL frameworks (the original bug)', async () => {
    const frameworks = [
      { name: 'python', command: `bash ${SCRATCH}/python_std.sh` },
      { name: 'uvicorn', command: `bash ${SCRATCH}/uvicorn.sh` },
      { name: 'django', command: `bash ${SCRATCH}/django.sh` },
      { name: 'flask', command: `bash ${SCRATCH}/flask.sh` },
      { name: 'go', command: `bash ${SCRATCH}/go.sh` },
      { name: 'logrus', command: `bash ${SCRATCH}/logrus.sh` },
      { name: 'rust', command: `bash ${SCRATCH}/rust.sh` },
      { name: 'rails', command: `bash ${SCRATCH}/rails.sh` },
      { name: 'phoenix', command: `bash ${SCRATCH}/elixir.sh` },
      { name: 'json', command: `bash ${SCRATCH}/json.sh` },
      { name: 'node', command: `bash ${SCRATCH}/node.sh` },
    ];

    const failures: string[] = [];

    for (const fw of frameworks) {
      const result = await runServiceAndCollect(fw, 2000);
      if (result.entries.length !== result.logCount) {
        failures.push(
          `${fw.name}: buffer has ${result.entries.length} entries but logCount is ${result.logCount}`,
        );
      }
      if (result.entries.length === 0) {
        failures.push(`${fw.name}: no entries in buffer at all`);
      }
    }

    expect(failures).toEqual([]);
  }, 30000);
});
