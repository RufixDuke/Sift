import type { ParserContext, ParserResult } from '../types/index.js';
import { extractTimestampFromPrefix } from '../utils/time.js';
import { detectLevel } from '../core/parser.js';

export function parseDocker(
  _line: string,
  stripped: string,
  _context: ParserContext,
): ParserResult | null {
  // Docker Compose: api-web-1   | {"level":"info","message":"request"}
  // Standard Docker: web_1  | [09:32:15] GET /users 200
  const docker = stripped.match(/^([a-zA-Z0-9_.-]+)\s*\|\s*(.+)$/);
  if (docker) {
    const rest = docker[2].trim();

    // If the content after the pipe is JSON structured log, parse it
    if (rest.startsWith('{')) {
      try {
        const parsed = JSON.parse(rest) as Record<string, unknown>;
        const level = detectLevel(String(parsed.level ?? ''));
        const message = typeof parsed.message === 'string' ? parsed.message : typeof parsed.msg === 'string' ? parsed.msg : rest;
        const timestamp = parsed.timestamp || parsed.time || parsed.ts;
        return {
          level: level === 'unknown' ? 'info' : level,
          message,
          timestamp: timestamp ? new Date(String(timestamp)) : undefined,
          metadata: parsed,
        };
      } catch {
        // fall through to plain docker parsing
      }
    }

    const { timestamp, rest: msgRest } = extractTimestampFromPrefix(rest);
    return {
      timestamp,
      level: detectLevel(msgRest),
      message: msgRest.trim() || rest,
    };
  }

  // Container ID prefix: a1b2c3d4e5f6 [INFO] Server started
  const containerId = stripped.match(/^([a-f0-9]{12})\s+(.+)$/i);
  if (containerId) {
    const rest = containerId[2];
    const { timestamp, rest: msgRest } = extractTimestampFromPrefix(rest);
    return {
      timestamp,
      level: detectLevel(msgRest),
      message: msgRest.trim() || rest,
    };
  }

  return null;
}
