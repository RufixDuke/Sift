import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import type { ParsedLogEntry } from '../types/index.js';
import { buildDisplay } from './parser.js';

const require = createRequire(import.meta.url);

export interface SessionRow {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  command: string | null;
  serviceCount: number | null;
  logCount: number;
}

export interface SessionCreateOptions {
  name?: string;
  command?: string;
  serviceCount?: number;
}

export interface PersistenceOptions {
  dbPath?: string;
}

const DEFAULT_DB_DIR = resolve(homedir(), '.config', 'sift');
const DEFAULT_DB_PATH = resolve(DEFAULT_DB_DIR, 'sift.db');

function ensureDbDir(dbPath: string): void {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function defaultSessionName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `session-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function platformBuildToolsMessage(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    return 'Install Xcode Command Line Tools: xcode-select --install';
  }
  if (platform === 'linux') {
    return 'Install build tools. For Debian/Ubuntu: sudo apt-get install build-essential python3';
  }
  if (platform === 'win32') {
    return 'Install Visual Studio Build Tools or Windows SDK, or use WSL2';
  }
  return 'Install a C++ compiler, Python, and Node.js headers for your platform';
}

function loadBetterSqlite(): typeof import('better-sqlite3') {
  try {
    return require('better-sqlite3') as typeof import('better-sqlite3');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `SQLite persistence requires native build tools.\n${platformBuildToolsMessage()}\nOriginal error: ${message}`,
    );
  }
}

export class Persistence {
  private dbPath: string;
  private db: import('better-sqlite3').Database | null = null;
  private sessionId: number | null = null;
  private pending: ParsedLogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private insertStmt: import('better-sqlite3').Statement | null = null;
  private available: boolean;
  private unavailableReason: string | null = null;

  constructor(options: PersistenceOptions = {}) {
    this.dbPath = options.dbPath ?? DEFAULT_DB_PATH;
    try {
      loadBetterSqlite();
      this.available = true;
    } catch (err) {
      this.available = false;
      this.unavailableReason = err instanceof Error ? err.message : String(err);
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  getUnavailableReason(): string | null {
    return this.unavailableReason;
  }

  private loadDb(): import('better-sqlite3').Database {
    if (this.db) return this.db;
    if (!this.available) {
      throw new Error(this.unavailableReason ?? 'SQLite persistence is not available');
    }

    const Database = loadBetterSqlite();
    ensureDbDir(this.dbPath);
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
    return this.db;
  }

  private migrate(): void {
    const db = this.loadDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        command TEXT,
        service_count INTEGER,
        log_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(name);

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        sequence INTEGER NOT NULL,
        raw TEXT NOT NULL,
        stripped TEXT NOT NULL,
        service TEXT NOT NULL,
        stream TEXT NOT NULL,
        timestamp INTEGER,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        request_id TEXT,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_logs_session_id ON logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_logs_session_sequence ON logs(session_id, sequence);
    `);
  }

  createSession(options: SessionCreateOptions = {}): number {
    if (this.sessionId !== null) return this.sessionId;

    const db = this.loadDb();
    const name = options.name || defaultSessionName();
    const now = Date.now();
    const result = db
      .prepare(
        `INSERT INTO sessions (name, created_at, updated_at, command, service_count, log_count)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(name, now, now, options.command ?? null, options.serviceCount ?? null, 0);

    this.sessionId = Number(result.lastInsertRowid);
    this.insertStmt = db.prepare(
      `INSERT INTO logs
       (session_id, sequence, raw, stripped, service, stream, timestamp, level, message, request_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.startFlushTimer();
    return this.sessionId;
  }

  append(entry: ParsedLogEntry): void {
    if (this.closed || !this.available) return;
    this.createSession();
    this.pending.push(entry);
    if (this.pending.length >= 100) {
      this.flush();
    }
  }

  flush(): void {
    if (this.pending.length === 0 || this.sessionId === null || !this.insertStmt || !this.available)
      return;

    const db = this.loadDb();
    const sessionId = this.sessionId;
    const batch = this.pending.splice(0, this.pending.length);

    db.transaction(() => {
      for (const entry of batch) {
        this.insertStmt!.run(
          sessionId,
          entry.id,
          entry.raw,
          entry.stripped,
          entry.service,
          entry.stream,
          entry.timestamp ? entry.timestamp.getTime() : null,
          entry.level,
          entry.message,
          entry.requestId ?? null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
        );
      }
      db.prepare(`UPDATE sessions SET log_count = log_count + ?, updated_at = ? WHERE id = ?`).run(
        batch.length,
        Date.now(),
        sessionId,
      );
    })();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), 250);
  }

  listSessions(limit = 50): SessionRow[] {
    const db = this.loadDb();
    return db
      .prepare(
        `SELECT id, name, created_at AS createdAt, updated_at AS updatedAt,
                command, service_count AS serviceCount, log_count AS logCount
         FROM sessions
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as SessionRow[];
  }

  findSession(identifier: string): SessionRow | undefined {
    const db = this.loadDb();
    const lower = identifier.toLowerCase();

    if (lower === 'last') {
      return db
        .prepare(
          `SELECT id, name, created_at AS createdAt, updated_at AS updatedAt,
                  command, service_count AS serviceCount, log_count AS logCount
           FROM sessions
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .get() as SessionRow | undefined;
    }

    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    if (lower === 'today') {
      const start = startOfDay(now);
      const end = start + 24 * 60 * 60 * 1000;
      return db
        .prepare(
          `SELECT id, name, created_at AS createdAt, updated_at AS updatedAt,
                  command, service_count AS serviceCount, log_count AS logCount
           FROM sessions
           WHERE created_at >= ? AND created_at < ?
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .get(start, end) as SessionRow | undefined;
    }

    if (lower === 'yesterday') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const start = startOfDay(yesterday);
      const end = start + 24 * 60 * 60 * 1000;
      return db
        .prepare(
          `SELECT id, name, created_at AS createdAt, updated_at AS updatedAt,
                  command, service_count AS serviceCount, log_count AS logCount
           FROM sessions
           WHERE created_at >= ? AND created_at < ?
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .get(start, end) as SessionRow | undefined;
    }

    // Try numeric id first.
    const numericId = Number(identifier);
    if (!Number.isNaN(numericId)) {
      const byId = db
        .prepare(
          `SELECT id, name, created_at AS createdAt, updated_at AS updatedAt,
                  command, service_count AS serviceCount, log_count AS logCount
           FROM sessions
           WHERE id = ?
           LIMIT 1`,
        )
        .get(numericId) as SessionRow | undefined;
      if (byId) return byId;
    }

    // Exact name match.
    const exact = db
      .prepare(
        `SELECT id, name, created_at AS createdAt, updated_at AS updatedAt,
                command, service_count AS serviceCount, log_count AS logCount
         FROM sessions
         WHERE name = ?
         LIMIT 1`,
      )
      .get(identifier) as SessionRow | undefined;
    if (exact) return exact;

    // Partial name match (most recent).
    return db
      .prepare(
        `SELECT id, name, created_at AS createdAt, updated_at AS updatedAt,
                command, service_count AS serviceCount, log_count AS logCount
         FROM sessions
         WHERE name LIKE ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(`%${identifier}%`) as SessionRow | undefined;
  }

  getSessionLogs(sessionId: number): ParsedLogEntry[] {
    const db = this.loadDb();
    const rows = db
      .prepare(
        `SELECT sequence, raw, stripped, service, stream, timestamp, level, message, request_id, metadata
         FROM logs
         WHERE session_id = ?
         ORDER BY sequence ASC`,
      )
      .all(sessionId) as {
      sequence: number;
      raw: string;
      stripped: string;
      service: string;
      stream: 'stdout' | 'stderr';
      timestamp: number | null;
      level: string;
      message: string;
      request_id: string | null;
      metadata: string | null;
    }[];

    return rows.map((row) => {
      const timestamp = row.timestamp ? new Date(row.timestamp) : undefined;
      const level = row.level as ParsedLogEntry['level'];
      return {
        id: row.sequence,
        raw: row.raw,
        stripped: row.stripped,
        service: row.service,
        stream: row.stream,
        timestamp,
        level,
        message: row.message,
        requestId: row.request_id ?? undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        display: buildDisplay(row.raw, row.service, timestamp, level, row.message),
      };
    });
  }

  summarizeSession(sessionId: number): {
    levelCounts: Record<string, number>;
    serviceCounts: Record<string, number>;
  } {
    const db = this.loadDb();
    const levelRows = db
      .prepare(`SELECT level, COUNT(*) AS count FROM logs WHERE session_id = ? GROUP BY level`)
      .all(sessionId) as { level: string; count: number }[];
    const serviceRows = db
      .prepare(`SELECT service, COUNT(*) AS count FROM logs WHERE session_id = ? GROUP BY service`)
      .all(sessionId) as { service: string; count: number }[];

    const levelCounts: Record<string, number> = {};
    const serviceCounts: Record<string, number> = {};
    for (const row of levelRows) levelCounts[row.level] = row.count;
    for (const row of serviceRows) serviceCounts[row.service] = row.count;
    return { levelCounts, serviceCounts };
  }

  deleteSession(sessionId: number): void {
    const db = this.loadDb();
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
  }

  getDbPath(): string {
    return this.dbPath;
  }
}
