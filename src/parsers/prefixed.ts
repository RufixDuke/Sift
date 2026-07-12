import type { ParserContext, ParserResult } from '../types/index.js';
import { extractTimestampFromPrefix } from '../utils/time.js';
import { detectLevel } from '../core/parser.js';

export function parsePrefixed(
  _line: string,
  stripped: string,
  _context: ParserContext,
): ParserResult | null {
  // LEVEL: message
  const levelColon = stripped.match(/^(ERROR|WARN|WARNING|INFO|DEBUG|TRACE):\s*(.+)$/i);
  if (levelColon) {
    return {
      level: normalizeLevel(levelColon[1]),
      message: levelColon[2].trim(),
    };
  }

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

  // Go standard: 2026/01/15 09:32:15 http: GET /api/users 200 45ms
  const goStd = stripped.match(/^(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+)$/);
  if (goStd) {
    const rest = goStd[2];
    return {
      timestamp: new Date(goStd[1]),
      level: detectLevel(rest),
      message: rest.trim(),
    };
  }

  // Vite: 9:32:15 AM [vite] hmr update /src/App.tsx
  const vite = stripped.match(/^(\d{1,2}:\d{2}:\d{2}(?:\s+[AP]M)?)\s+\[([^\]]+)\]\s*(.+)$/i);
  if (vite) {
    return {
      timestamp: new Date(`1970-01-01 ${vite[1]}`),
      level: detectLevel(vite[3]),
      message: `[${vite[2]}] ${vite[3]}`,
    };
  }

  // Next.js: " GET /dashboard 200 in 45ms"
  const nextjs = stripped.match(/^\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+(.+)$/i);
  if (nextjs) {
    const rest = `${nextjs[1]} ${nextjs[2]}`;
    return {
      level: detectLevel(rest),
      message: rest.trim(),
    };
  }

  // TIMESTAMP LEVEL message
  const { timestamp, rest } = extractTimestampFromPrefix(stripped);
  if (timestamp) {
    const levelMatch = rest.match(/^(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\b\s*/i);
    const message = levelMatch ? rest.slice(levelMatch[0].length).trim() : rest;
    const level = levelMatch ? normalizeLevel(levelMatch[1]) : detectLevel(rest);
    return { timestamp, level, message };
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
