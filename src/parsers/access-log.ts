import type { ParserContext, ParserResult, LogLevel } from '../types/index.js';
import { parseTimestamp } from '../utils/time.js';

export function parseAccessLog(
  _line: string,
  stripped: string,
  _context: ParserContext,
): ParserResult | null {
  // Morgan combined: ::1 - - [15/Jan/2026:09:32:15 +0000] "GET /api/users HTTP/1.1" 200 45ms
  const morganCombined = stripped.match(
    /^([^\s]+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d{3})\s+(\S+)(?:\s+"([^"]*)"\s+"([^"]*)")?/,
  );
  if (morganCombined) {
    const status = Number.parseInt(morganCombined[4], 10);
    return {
      timestamp: parseTimestamp(morganCombined[2]),
      level: statusToLevel(status),
      message: `"${morganCombined[3]}" ${status} ${morganCombined[5]}`,
    };
  }

  // Uvicorn: INFO:     127.0.0.1:1234 - "GET /health HTTP/1.1" 200 OK
  const uvicorn = stripped.match(
    /^(INFO|DEBUG|WARNING|ERROR):\s+\S+\s+-\s+"([^"]+)"\s+(\d{3})(?:\s+\S+)?/i,
  );
  if (uvicorn) {
    const status = Number.parseInt(uvicorn[3], 10);
    return {
      level: statusToLevel(status),
      message: `"${uvicorn[2]}" ${status}`,
    };
  }

  // Generic HTTP method line with status
  const generic = stripped.match(
    /"(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+([^\s]+)\s+HTTP\/[^"]+"\s+(\d{3})/i,
  );
  if (generic) {
    const status = Number.parseInt(generic[3], 10);
    return {
      level: statusToLevel(status),
      message: `"${generic[1]} ${generic[2]}" ${status}`,
    };
  }

  return null;
}

function statusToLevel(status: number): LogLevel {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  if (status >= 300) return 'info';
  return 'info';
}
