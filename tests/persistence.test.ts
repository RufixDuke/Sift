import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Persistence } from '../src/core/persistence.js';
import type { ParsedLogEntry } from '../src/types/index.js';

function makeEntry(overrides: Partial<ParsedLogEntry> = {}): ParsedLogEntry {
  const raw = overrides.raw ?? 'test log';
  return {
    id: 0,
    raw,
    stripped: raw,
    service: overrides.service ?? 'api',
    stream: overrides.stream ?? 'stdout',
    timestamp: overrides.timestamp ?? new Date('2026-07-12T10:00:00.000Z'),
    level: overrides.level ?? 'info',
    message: overrides.message ?? raw,
    requestId: overrides.requestId,
    metadata: overrides.metadata,
    display: {
      timestamp: '10:00:00',
      serviceTag: overrides.service ?? 'api',
      levelSymbol: 'ℹ',
      message: overrides.message ?? raw,
      raw,
    },
  };
}

describe('Persistence', () => {
  let tmpDir: string;
  let dbPath: string;
  let persistence: Persistence;

  beforeEach(() => {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'sift-persistence-'));
    dbPath = resolve(tmpDir, 'test.db');
    persistence = new Persistence({ dbPath });
  });

  afterEach(() => {
    try {
      persistence.close();
    } catch {
      // ignore
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a session and returns an id', () => {
    const id = persistence.createSession({
      name: 'test-session',
      command: 'sift run',
      serviceCount: 2,
    });
    expect(id).toBeGreaterThan(0);

    const session = persistence.findSession('test-session');
    expect(session).toBeDefined();
    expect(session?.name).toBe('test-session');
    expect(session?.command).toBe('sift run');
    expect(session?.serviceCount).toBe(2);
    expect(session?.logCount).toBe(0);
  });

  it('appends and retrieves log entries', () => {
    persistence.createSession({ name: 'test-session' });
    persistence.append(makeEntry({ service: 'web', level: 'info', message: 'hello' }));
    persistence.append(makeEntry({ service: 'api', level: 'error', message: 'boom' }));
    persistence.flush();

    const session = persistence.findSession('test-session')!;
    expect(session.logCount).toBe(2);

    const logs = persistence.getSessionLogs(session.id);
    expect(logs).toHaveLength(2);
    expect(logs[0].service).toBe('web');
    expect(logs[0].level).toBe('info');
    expect(logs[1].service).toBe('api');
    expect(logs[1].level).toBe('error');
  });

  it('auto-flushes pending entries on close', () => {
    persistence.createSession({ name: 'test-session' });
    persistence.append(makeEntry({ message: 'pending' }));
    persistence.close();

    const reopened = new Persistence({ dbPath });
    const session = reopened.findSession('test-session')!;
    expect(session.logCount).toBe(1);
    reopened.close();
  });

  it('finds sessions by alias', () => {
    const now = Date.now();
    persistence.createSession({ name: 'today-session' });
    const yesterday = new Persistence({ dbPath });
    yesterday.createSession({ name: 'yesterday-session' });
    // Override created_at to yesterday by raw SQL for alias testing.
    // @ts-expect-error private access
    const yesterdayDb = yesterday.loadDb();
    yesterdayDb
      .prepare('UPDATE sessions SET created_at = ? WHERE name = ?')
      .run(now - 24 * 60 * 60 * 1000, 'yesterday-session');
    yesterday.close();

    const todaySession = persistence.findSession('today');
    expect(todaySession?.name).toBe('today-session');

    const yesterdaySession = persistence.findSession('yesterday');
    expect(yesterdaySession?.name).toBe('yesterday-session');

    const lastSession = persistence.findSession('last');
    expect(lastSession?.name).toBe('today-session');
  });

  it('summarizes session counts', () => {
    persistence.createSession({ name: 'test-session' });
    persistence.append(makeEntry({ service: 'web', level: 'info' }));
    persistence.append(makeEntry({ service: 'web', level: 'error' }));
    persistence.append(makeEntry({ service: 'api', level: 'info' }));
    persistence.flush();

    const session = persistence.findSession('test-session')!;
    const summary = persistence.summarizeSession(session.id);
    expect(summary.levelCounts).toEqual({ info: 2, error: 1 });
    expect(summary.serviceCounts).toEqual({ web: 2, api: 1 });
  });

  it('lists sessions in descending order', () => {
    persistence.createSession({ name: 'first' });
    persistence.close();

    const second = new Persistence({ dbPath });
    second.createSession({ name: 'second' });
    const sessions = second.listSessions();
    second.close();

    expect(sessions.map((s) => s.name)).toEqual(['second', 'first']);
  });

  it('deletes a session and its logs', () => {
    persistence.createSession({ name: 'to-delete' });
    persistence.append(makeEntry());
    persistence.flush();

    let session = persistence.findSession('to-delete');
    expect(session).toBeDefined();

    persistence.deleteSession(session!.id);
    session = persistence.findSession('to-delete');
    expect(session).toBeUndefined();
  });
});
