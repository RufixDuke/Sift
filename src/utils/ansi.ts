import stripAnsi from 'strip-ansi';

export function stripAnsiCodes(input: string): string {
  return stripAnsi(input);
}

export function removeCursorMovementCodes(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\\\)/g, '');
}

export function sanitizeForDisplay(input: string): string {
  return removeCursorMovementCodes(input);
}

export function hasAnsi(input: string): boolean {
  return /\x1b\[[0-9;]*m/.test(input);
}

export function isPrintableLine(line: string, threshold = 0.1): boolean {
  if (line.length === 0) return true;
  let nonPrintable = 0;
  for (const char of line) {
    const code = char.charCodeAt(0);
    // Allow tab, newline, carriage return, and printable ASCII; allow Unicode above 127
    if (code < 32 && ![9, 10, 13].includes(code)) {
      nonPrintable += 1;
    }
  }
  return nonPrintable / line.length <= threshold;
}

export function replaceNonPrintable(line: string): string {
  return `[binary data: ${Buffer.byteLength(line, 'utf-8')} bytes] — non-printable output suppressed`;
}
