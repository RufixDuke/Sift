import type {
  LogLevel,
  ParsedLogEntry,
  ParserContext,
  ParserResult,
  DisplayEntry,
  Filters,
} from '../types/index.js';
import { LOG_LEVEL_PATTERNS, REQUEST_ID_PATTERNS, DEFAULT_SETTINGS } from '../types/index.js';
import { stripAnsiCodes, sanitizeForDisplay } from '../utils/ansi.js';
import { extractTimestampFromPrefix, formatTimestamp } from '../utils/time.js';
import { parseWithRegistry, detectFormat } from '../parsers/index.js';

export interface ParseOptions {
  injectTimestamps?: boolean;
  dateFormat?: string;
}

export function parseLogLine(
  raw: string,
  context: ParserContext,
  options: ParseOptions = {},
): ParsedLogEntry {
  const sanitized = sanitizeForDisplay(raw);
  const stripped = stripAnsiCodes(sanitized);
  const firstLine = stripped.split('\n')[0] ?? '';
  const formatHint = context.formatHint || detectFormat(firstLine, context);

  let result: ParserResult = {
    level: 'unknown',
    message: stripped,
  };

  const registryResult = parseWithRegistry(firstLine, context, formatHint);
  if (registryResult) {
    result = registryResult;
    // For multi-line entries, keep full stripped text as message
    if (sanitized.includes('\n')) {
      result.message = stripped;
    }
  } else {
    result = parseGeneric(firstLine);
    if (sanitized.includes('\n')) {
      result.message = stripped;
    }
  }

  // Stderr stream bumps level up if still unknown/info
  if (context.stream === 'stderr' && (result.level === 'unknown' || result.level === 'info')) {
    result.level = result.level === 'unknown' ? 'warn' : 'warn';
  }

  const timestamp = result.timestamp || (options.injectTimestamps ? new Date() : undefined);
  const requestId = result.requestId || extractRequestId(stripped);

  const display = buildDisplay(
    sanitized,
    context.service,
    timestamp,
    result.level,
    result.message,
    options.dateFormat,
  );

  return {
    id: 0,
    raw: sanitized,
    stripped,
    service: context.service,
    stream: context.stream,
    timestamp,
    level: result.level,
    message: result.message,
    requestId,
    metadata: result.metadata,
    display,
  };
}

export function buildDisplay(
  raw: string,
  service: string,
  timestamp: Date | undefined,
  level: LogLevel,
  message: string,
  dateFormat = DEFAULT_SETTINGS.dateFormat,
): DisplayEntry {
  const symbols: Record<LogLevel, string> = {
    error: '✗',
    warn: '⚠',
    info: 'ℹ',
    debug: '◆',
    trace: '···',
    unknown: '?',
  };

  return {
    timestamp: timestamp ? formatTimestamp(timestamp, dateFormat) : '',
    serviceTag: service,
    levelSymbol: symbols[level],
    message: message || raw,
    raw,
  };
}

export function detectLevel(line: string): LogLevel {
  for (const level of ['error', 'warn', 'info', 'debug', 'trace'] as LogLevel[]) {
    for (const pattern of LOG_LEVEL_PATTERNS[level]) {
      if (pattern.test(line)) return level;
    }
  }
  return 'unknown';
}

export function extractRequestId(line: string): string | undefined {
  for (const pattern of REQUEST_ID_PATTERNS) {
    const match = line.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export function parseGeneric(stripped: string): ParserResult {
  const { timestamp, rest } = extractTimestampFromPrefix(stripped);
  const level = detectLevel(rest);

  // Strip known level prefixes from message
  let message = rest;
  const levelPrefixMatch = message.match(/^(?:\[)?(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)(?:\])?[:\s]+/i);
  if (levelPrefixMatch) {
    message = message.slice(levelPrefixMatch[0].length).trim();
  }

  return { timestamp, level, message: message || stripped };
}

export function applyFilters(entry: ParsedLogEntry, filters: Filters): boolean {
  if (filters.level && filters.level !== 'all' && entry.level !== filters.level) {
    return false;
  }

  if (filters.services && filters.services.length > 0 && !filters.services.includes(entry.service)) {
    return false;
  }

  if (filters.requestId && entry.requestId !== filters.requestId) {
    return false;
  }

  if (filters.query) {
    const q = filters.query.toLowerCase();
    const haystack = `${entry.raw} ${entry.service} ${entry.requestId ?? ''}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}
