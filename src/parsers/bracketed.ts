import type { ParserContext, ParserResult } from '../types/index.js';
import { parseTimestamp } from '../utils/time.js';
import { detectLevel } from '../core/parser.js';

export function parseBracketed(
  _line: string,
  stripped: string,
  _context: ParserContext,
): ParserResult | null {
  // Metro bundler style: " BUNDLE  ./index.js ▓▓▓▓░░░░ 67% (120/180)"
  if (/^\s+(BUNDLE|DONE|ERROR|WARN|INFO)\s+/.test(stripped)) {
    const level = /ERROR/.test(stripped) ? 'error' : /WARN/.test(stripped) ? 'warn' : 'info';
    return { level, message: stripped.trim() };
  }

  // [LEVEL] message
  const levelOnly = stripped.match(/^\[(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\]\s*(.+)$/i);
  if (levelOnly) {
    return {
      level: normalizeLevel(levelOnly[1]),
      message: levelOnly[2].trim(),
    };
  }

  // [timestamp] LEVEL message or [timestamp] message
  const tsLevel = stripped.match(
    /^\[(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]\s*(?:(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\s+)?(.+)$/i,
  );
  if (tsLevel) {
    const explicitLevel = tsLevel[2] ? normalizeLevel(tsLevel[2]) : undefined;
    const inferredLevel = detectLevel(tsLevel[3]);
    const level = explicitLevel ?? inferredLevel;
    // If we only have a timestamp and no level, let other parsers (e.g. access-log) try
    if (!explicitLevel && inferredLevel === 'unknown') {
      return null;
    }
    return {
      timestamp: parseTimestamp(tsLevel[1]),
      level,
      message: tsLevel[3].trim(),
    };
  }

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
