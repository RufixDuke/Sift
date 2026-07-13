import { describe, it, expect } from 'vitest';
import { parseLogLine, detectLevel, extractRequestId } from '../src/core/parser.js';

describe('parseLogLine', () => {
  it('parses JSON structured logs', () => {
    const entry = parseLogLine('{"level":30,"msg":"request completed","responseTime":45}', {
      service: 'api',
      stream: 'stdout',
    });
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('request completed');
    expect(entry.metadata).toBeDefined();
  });

  it('parses bracketed level logs', () => {
    const entry = parseLogLine('[INFO] Server started on port 3000', {
      service: 'api',
      stream: 'stdout',
    });
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Server started on port 3000');
  });

  it('parses prefixed level logs', () => {
    const entry = parseLogLine('ERROR: database connection failed', {
      service: 'db',
      stream: 'stderr',
    });
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('database connection failed');
  });

  it('parses access logs with status mapping', () => {
    const entry = parseLogLine(
      '::1 - - [15/Jan/2026:09:32:15 +0000] "GET /api/users HTTP/1.1" 500 45ms',
      { service: 'web', stream: 'stdout' },
    );
    expect(entry.level).toBe('error');
    expect(entry.message).toContain('GET /api/users');
  });

  it('parses docker compose logs', () => {
    const entry = parseLogLine('api-web-1   | {"level":"info","message":"request"}', {
      service: 'api',
      stream: 'stdout',
    });
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('request');
  });

  it('extracts timestamps', () => {
    const entry = parseLogLine(
      '::1 - - [09/Jan/2026:09:32:15 +0000] "GET /health HTTP/1.1" 200 12ms',
      {
        service: 'web',
        stream: 'stdout',
      },
    );
    expect(entry.timestamp).toBeInstanceOf(Date);
    expect(entry.level).toBe('info');
  });

  it('extracts request IDs', () => {
    const entry = parseLogLine('2026-01-15T09:32:15Z [req:abc-123] login attempt', {
      service: 'api',
      stream: 'stdout',
    });
    expect(entry.requestId).toBe('abc-123');
  });

  it('parses language-specific logs (Python, Go, Rust, Ruby, Elixir)', () => {
    const python = parseLogLine('2026-01-15 09:32:15,123 - django - INFO - Started server', {
      service: 'web',
      stream: 'stdout',
    });
    expect(python.level).toBe('info');
    expect(python.message).toBe('Started server');

    const uvicorn = parseLogLine('INFO:     127.0.0.1:1234 - "GET /api/users HTTP/1.1" 200 OK', {
      service: 'api',
      stream: 'stdout',
    });
    expect(uvicorn.level).toBe('info');

    const djangoDev = parseLogLine('[15/Jan/2026 09:32:15] "GET /api/users HTTP/1.1" 200', {
      service: 'web',
      stream: 'stdout',
    });
    expect(djangoDev.level).toBe('info');

    const zap = parseLogLine('2026-01-15T09:32:15.123Z\tinfo\tapi/server.go:42\tstarted server', {
      service: 'api',
      stream: 'stdout',
    });
    expect(zap.level).toBe('info');
    expect(zap.message).toContain('started server');

    const rustTracing = parseLogLine(
      '2026-01-15T09:32:15.123456Z  INFO api::server: started server',
      { service: 'api', stream: 'stdout' },
    );
    expect(rustTracing.level).toBe('info');

    const rails = parseLogLine(
      'I, [2026-01-15T09:32:15.123456 #12345]  INFO -- : Started GET "/api/users"',
      { service: 'api', stream: 'stdout' },
    );
    expect(rails.level).toBe('info');

    const phoenix = parseLogLine('09:32:15.123 [info] GET /api/users', {
      service: 'api',
      stream: 'stdout',
    });
    expect(phoenix.level).toBe('info');
  });

  it('bumps stderr unknown to warn', () => {
    const entry = parseLogLine('some stderr output', { service: 'api', stream: 'stderr' });
    expect(entry.level).toBe('warn');
  });
});

describe('detectLevel', () => {
  it('detects error levels', () => {
    expect(detectLevel('ERROR something')).toBe('error');
    expect(detectLevel('FATAL crash')).toBe('error');
  });

  it('detects warn levels', () => {
    expect(detectLevel('WARN careful')).toBe('warn');
    expect(detectLevel('WARNING deprecation')).toBe('warn');
  });

  it('returns unknown for plain text', () => {
    expect(detectLevel('hello world')).toBe('unknown');
  });
});

describe('extractRequestId', () => {
  it('extracts requestId field', () => {
    expect(extractRequestId('requestId=xyz-123')).toBe('xyz-123');
  });

  it('extracts traceId field', () => {
    expect(extractRequestId('traceId:abc-456')).toBe('abc-456');
  });
});
