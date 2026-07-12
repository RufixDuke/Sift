export function parseTimestamp(value: string | number | undefined): Date | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'number') {
    if (value > 1_000_000_000_000) return new Date(value); // ms
    return new Date(value * 1000); // seconds
  }

  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) return date;

  // Try parsing access-log format: 15/Jan/2026:09:32:15 +0000
  const accessLogMatch = trimmed.match(/^(\d{2})\/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})$/i);
  if (accessLogMatch) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames.findIndex((m) => m.toLowerCase() === accessLogMatch[2].toLowerCase());
    if (month >= 0) {
      const iso = `${accessLogMatch[3]}-${String(month + 1).padStart(2, '0')}-${accessLogMatch[1]}T${accessLogMatch[4]}:${accessLogMatch[5]}:${accessLogMatch[6]}${accessLogMatch[7].slice(0, 3)}:${accessLogMatch[7].slice(3)}`;
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const timeMatch = trimmed.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (timeMatch) {
    const now = new Date();
    const ms = timeMatch[4] ? Number.parseInt(timeMatch[4].padEnd(3, '0').slice(0, 3), 10) : 0;
    now.setHours(
      Number.parseInt(timeMatch[1], 10),
      Number.parseInt(timeMatch[2], 10),
      Number.parseInt(timeMatch[3], 10),
      ms,
    );
    return now;
  }

  return undefined;
}

export function formatTimestamp(date: Date | undefined, format = 'HH:MM:SS'): string {
  if (!date) return '';

  const pad = (n: number) => n.toString().padStart(2, '0');
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = date.getMilliseconds().toString().padStart(3, '0');

  switch (format) {
    case 'HH:MM:SS':
      return `[${hours}:${minutes}:${seconds}]`;
    case 'HH:MM:SS.ms':
      return `[${hours}:${minutes}:${seconds}.${ms}]`;
    case 'ISO':
      return date.toISOString();
    default:
      return `[${hours}:${minutes}:${seconds}]`;
  }
}

export function extractTimestampFromPrefix(line: string): { timestamp?: Date; rest: string } {
  const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/);
  if (isoMatch) {
    return { timestamp: parseTimestamp(isoMatch[1]), rest: line.slice(isoMatch[0].length).trimStart() };
  }

  const dateTimeMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+|,\d+)?)/);
  if (dateTimeMatch) {
    return { timestamp: parseTimestamp(dateTimeMatch[1].replace(',', '.')), rest: line.slice(dateTimeMatch[0].length).trimStart() };
  }

  const bracketTimeMatch = line.match(/^\[(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]\s*/);
  if (bracketTimeMatch) {
    return { timestamp: parseTimestamp(bracketTimeMatch[1]), rest: line.slice(bracketTimeMatch[0].length) };
  }

  const simpleTimeMatch = line.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+/);
  if (simpleTimeMatch) {
    return { timestamp: parseTimestamp(simpleTimeMatch[1]), rest: line.slice(simpleTimeMatch[0].length) };
  }

  const unixMsMatch = line.match(/^(\d{13})(?=\s|$)/);
  if (unixMsMatch) {
    return { timestamp: parseTimestamp(Number.parseInt(unixMsMatch[1], 10)), rest: line.slice(unixMsMatch[0].length).trimStart() };
  }

  const unixSecMatch = line.match(/^(\d{10})(?=\s|$)/);
  if (unixSecMatch) {
    return { timestamp: parseTimestamp(Number.parseInt(unixSecMatch[1], 10)), rest: line.slice(unixSecMatch[0].length).trimStart() };
  }

  return { rest: line };
}
