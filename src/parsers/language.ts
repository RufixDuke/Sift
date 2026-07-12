import type { ParserContext, ParserResult } from '../types/index.js';
import { parseTimestamp } from '../utils/time.js';
import { detectLevel } from '../core/parser.js';

/**
 * Language-specific parsers for Python, Go, Rust, Ruby, and Elixir/Phoenix.
 * Covers framework and library conventions beyond the generic formats.
 */
export function parseLanguage(
  _line: string,
  stripped: string,
  _context: ParserContext,
): ParserResult | null {
  return (
    parsePython(stripped) ??
    parseGo(stripped) ??
    parseRust(stripped) ??
    parseRuby(stripped) ??
    parseElixir(stripped)
  );
}

// --------------------------------------------------------------------------
// Python — Django, Flask/Werkzeug, FastAPI/Uvicorn
// --------------------------------------------------------------------------

function parsePython(stripped: string): ParserResult | null {
  // Python standard: 2026-01-15 09:32:15,123 - myapp - INFO - Server started
  const pythonStd = stripped.match(
    /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:,\d+)?)\s+-\s+[^-]+\s+-\s+(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\s+-\s*(.+)$/i,
  );
  if (pythonStd) {
    return {
      timestamp: new Date(pythonStd[1].replace(',', '.')),
      level: normalizeLevel(pythonStd[2]),
      message: pythonStd[3].trim(),
    };
  }

  // Uvicorn/FastAPI access: INFO:     127.0.0.1:1234 - "GET /api/users HTTP/1.1" 200 OK
  const uvicornAccess = stripped.match(
    /^(ERROR|WARN|WARNING|INFO|DEBUG|TRACE):\s+\S+\s+-\s+"(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+[^"]+"\s+(\d{3})\s*(.*)$/i,
  );
  if (uvicornAccess) {
    const status = parseInt(uvicornAccess[3], 10);
    return {
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      message: stripped.trim(),
    };
  }

  // Uvicorn/FastAPI startup: INFO:     Started server process [12345]
  const uvicornLog = stripped.match(/^(ERROR|WARN|WARNING|INFO|DEBUG|TRACE):\s*(.+)$/i);
  if (uvicornLog) {
    return {
      level: normalizeLevel(uvicornLog[1]),
      message: uvicornLog[2].trim(),
    };
  }

  // Django development server: [15/Jan/2026 09:32:15] "GET /api/users HTTP/1.1" 200
  const django = stripped.match(
    /^\[(\d{1,2}\/[A-Za-z]{3}\/\d{4}\s+\d{2}:\d{2}:\d{2})\]\s+"(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+[^"]+"\s+(\d{3})/,
  );
  if (django) {
    const status = parseInt(django[3], 10);
    return {
      timestamp: parseTimestamp(django[1]),
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      message: stripped.trim(),
    };
  }

  // Flask/Werkzeug: 127.0.0.1 - - [15/Jan/2026 09:32:15] "GET / HTTP/1.1" 200 -
  const werkzeug = stripped.match(
    /^\S+\s+-\s+-\s+\[(\d{1,2}\/[A-Za-z]{3}\/\d{4}\s+\d{2}:\d{2}:\d{2})\]\s+"(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+[^"]+"\s+(\d{3})/,
  );
  if (werkzeug) {
    const status = parseInt(werkzeug[3], 10);
    return {
      timestamp: parseTimestamp(werkzeug[1]),
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      message: stripped.trim(),
    };
  }

  return null;
}

// --------------------------------------------------------------------------
// Go — native log, Logrus, Zap
// --------------------------------------------------------------------------

function parseGo(stripped: string): ParserResult | null {
  // Go standard: 2026/01/15 09:32:15 http: GET /api/users 200 45ms
  const goStd = stripped.match(/^(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+)$/);
  if (goStd) {
    return {
      timestamp: new Date(goStd[1]),
      level: detectLevel(goStd[2]),
      message: goStd[2].trim(),
    };
  }

  // Logrus key=value: time="2026-01-15T09:32:15Z" level=info msg="Server started"
  const logrus = stripped.match(
    /time="([^"]+)"\s+level=(\S+)\s+msg="([^"]+)"/i,
  );
  if (logrus) {
    return {
      timestamp: parseTimestamp(logrus[1]),
      level: normalizeLevel(logrus[2]),
      message: logrus[3].trim(),
    };
  }

  // Zap production: 2026-01-15T09:32:15.123Z	info	api/server.go:42	started server
  const zap = stripped.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+\t?\s*(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\s+\t?\s*(.+)$/i,
  );
  if (zap) {
    return {
      timestamp: parseTimestamp(zap[1]),
      level: normalizeLevel(zap[2]),
      message: zap[3].trim(),
    };
  }

  return null;
}

// --------------------------------------------------------------------------
// Rust — env_logger, tracing, slog
// --------------------------------------------------------------------------

function parseRust(stripped: string): ParserResult | null {
  // env_logger: [2026-01-15T09:32:15Z INFO mycrate] Server started
  const envLogger = stripped.match(
    /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\s+[^\]]+\]\s*(.+)$/i,
  );
  if (envLogger) {
    return {
      timestamp: parseTimestamp(envLogger[1]),
      level: normalizeLevel(envLogger[2]),
      message: envLogger[3].trim(),
    };
  }

  // tracing: 2026-01-15T09:32:15.123456Z  INFO api::server: started server
  // or with span: 2026-01-15T09:32:15.123456Z  INFO request{req_id=abc}: started server
  const tracing = stripped.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\s+(.+)$/i,
  );
  if (tracing) {
    return {
      timestamp: parseTimestamp(tracing[1]),
      level: normalizeLevel(tracing[2]),
      message: tracing[3].trim(),
    };
  }

  // slog key=value: msg="Server started" level=INFO ts="2026-01-15T09:32:15Z"
  const slog = stripped.match(/(?:^|\s)(?:msg|message)="([^"]+)".*(?:^|\s)level=(\S+)/i) ??
    stripped.match(/(?:^|\s)level=(\S+).*?(?:^|\s)(?:msg|message)="([^"]+)"/i);
  if (slog) {
    const level = slog[2] && /^(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)$/i.test(slog[2]) ? slog[2] : slog[1];
    const message = slog[2] && /^(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)$/i.test(slog[2]) ? slog[1] : slog[2];
    return {
      level: normalizeLevel(level),
      message: message?.trim() ?? stripped.trim(),
    };
  }

  return null;
}

// --------------------------------------------------------------------------
// Ruby on Rails
// --------------------------------------------------------------------------

function parseRuby(stripped: string): ParserResult | null {
  // Rails default logger:
  // I, [2026-01-15T09:32:15.123456 #12345]  INFO -- : Started GET "/api/users" for 127.0.0.1
  const rails = stripped.match(
    /^([A-Z]),\s+\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\s+[+-]\d{4})?)\s+#\d+\]\s+([A-Z]+)\s+--\s+:\s*(.+)$/,
  );
  if (rails) {
    return {
      timestamp: parseTimestamp(rails[2]),
      level: normalizeLevel(rails[3]),
      message: rails[4].trim(),
    };
  }

  // Rails request line: Started GET "/api/users" for 127.0.0.1 at 2026-01-15 09:32:15 +0000
  const railsStarted = stripped.match(
    /^Started\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+"([^"]+)"\s+for\s+\S+\s+at\s+(.+)$/i,
  );
  if (railsStarted) {
    return {
      timestamp: parseTimestamp(railsStarted[3]),
      level: 'info',
      message: stripped.trim(),
    };
  }

  return null;
}

// --------------------------------------------------------------------------
// Elixir / Phoenix
// --------------------------------------------------------------------------

function parseElixir(stripped: string): ParserResult | null {
  // Phoenix: 09:32:15.123 [info] GET /api/users
  const phoenix = stripped.match(
    /^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+\[(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\]\s*(.+)$/i,
  );
  if (phoenix) {
    return {
      timestamp: parseTimestamp(phoenix[1]),
      level: normalizeLevel(phoenix[2]),
      message: phoenix[3].trim(),
    };
  }

  // Bare bracketed level: [info] Sent 200 in 45ms
  const bare = stripped.match(/^\[(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\]\s*(.+)$/i);
  if (bare) {
    return {
      level: normalizeLevel(bare[1]),
      message: bare[2].trim(),
    };
  }

  return null;
}

function normalizeLevel(level: string): ParserResult['level'] {
  const lowered = level.toLowerCase();
  if (lowered === 'warning') return 'warn';
  if (lowered === 'trace') return 'trace';
  if (lowered === 'debug') return 'debug';
  if (lowered === 'info') return 'info';
  if (lowered === 'warn') return 'warn';
  if (lowered === 'error') return 'error';
  return detectLevel(level);
}
