import type { ParserContext, ParserResult, LogLevel } from '../types/index.js';
import { parseTimestamp } from '../utils/time.js';

const LEVEL_FIELD_MAP: Record<string, LogLevel> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'error',
  trace: 'trace',
  debug: 'debug',
  info: 'info',
  log: 'info',
  warn: 'warn',
  warning: 'warn',
  error: 'error',
  fatal: 'error',
  critical: 'error',
};

export function parseJsonLine(
  _line: string,
  stripped: string,
  _context: ParserContext,
): ParserResult | null {
  if (!stripped.trimStart().startsWith('{')) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripped);
    if (typeof parsed !== 'object' || parsed === null) return null;
  } catch {
    return null;
  }

  const level = extractLevel(parsed);
  const message = extractMessage(parsed);
  const timestamp = extractTimestamp(parsed);
  const requestId = extractRequestId(parsed);

  if (!message && !level && !timestamp) return null;

  return {
    level: level || 'info',
    message: message || stripped,
    timestamp,
    requestId,
    metadata: parsed,
  };
}

function extractLevel(parsed: Record<string, unknown>): LogLevel | undefined {
  const raw = parsed.level ?? parsed.severity ?? parsed.log_level;
  if (raw === undefined) return undefined;

  const key = String(raw).toLowerCase();
  return LEVEL_FIELD_MAP[key];
}

function extractMessage(parsed: Record<string, unknown>): string | undefined {
  for (const field of ['message', 'msg', 'text', '@message']) {
    const value = parsed[field];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function extractTimestamp(parsed: Record<string, unknown>): Date | undefined {
  for (const field of ['timestamp', 'time', 'ts', '@timestamp', 'datetime']) {
    const value = parsed[field];
    if (value === undefined) continue;
    const ts = parseTimestamp(value as string | number);
    if (ts) return ts;
  }
  return undefined;
}

function extractRequestId(parsed: Record<string, unknown>): string | undefined {
  for (const field of ['requestId', 'traceId', 'correlationId', 'rid', 'request_id']) {
    const value = parsed[field];
    if (typeof value === 'string') return value;
  }
  return undefined;
}
