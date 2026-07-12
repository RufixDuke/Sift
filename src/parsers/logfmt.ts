import type { ParserContext, ParserResult } from '../types/index.js';
import { extractTimestampFromPrefix } from '../utils/time.js';
import { detectLevel } from '../core/parser.js';

export function parseLogfmt(
  _line: string,
  stripped: string,
  _context: ParserContext,
): ParserResult | null {
  // Quick rejection: must contain key=value pairs with =
  if (!/\w+=/.test(stripped)) return null;
  // Reject if it looks like JSON
  if (stripped.trimStart().startsWith('{')) return null;

  const pairs: Record<string, string> = {};
  const regex = /([\w.-]+)="([^"]*)"|([\w.-]+)=([^\s]+)/g;
  let match;
  let hasPairs = false;

  while ((match = regex.exec(stripped)) !== null) {
    hasPairs = true;
    const key = match[1] ?? match[3];
    const value = match[2] ?? match[4];
    pairs[key] = value;
  }

  if (!hasPairs) return null;

  const timestamp =
    pairs.time ?? pairs.timestamp ?? pairs.ts ?? pairs['@timestamp'] ?? pairs.datetime;
  const levelRaw = pairs.level ?? pairs.severity ?? pairs.PRIORITY ?? pairs.log_level;
  const message = pairs.msg ?? pairs.message ?? pairs.MESSAGE ?? pairs.text;

  if (!message && !levelRaw && !timestamp) return null;

  const level = levelRaw ? detectLevel(levelRaw) : detectLevel(stripped);

  return {
    timestamp: timestamp ? new Date(timestamp) : undefined,
    level,
    message: message || stripped,
    metadata: pairs,
  };
}
