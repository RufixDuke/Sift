import type { ParserContext, ParserResult } from '../types/index.js';
import { extractTimestampFromPrefix } from '../utils/time.js';
import { detectLevel } from '../core/parser.js';

export function parseGeneric(
  _line: string,
  stripped: string,
  _context: ParserContext,
): ParserResult | null {
  const { timestamp, rest } = extractTimestampFromPrefix(stripped);
  const level = detectLevel(rest);

  let message = rest;
  const levelPrefixMatch = message.match(
    /^(?:\[)?(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)(?:\])?[:\s]+/i,
  );
  if (levelPrefixMatch) {
    message = message.slice(levelPrefixMatch[0].length).trim();
  }

  return {
    timestamp,
    level,
    message: message || stripped,
  };
}
