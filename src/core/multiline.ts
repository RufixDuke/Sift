import { EventEmitter } from 'node:events';

export interface LineEvent {
  raw: string;
  service: string;
  stream: 'stdout' | 'stderr';
  serviceColor: string;
  sequence: number;
}

export interface EntryEvent {
  lines: string[];
  service: string;
  stream: 'stdout' | 'stderr';
  serviceColor: string;
  startSequence: number;
}

export class MultiLineAssembler extends EventEmitter {
  private pending = new Map<string, { lines: string[]; stream: 'stdout' | 'stderr'; serviceColor: string; startSequence: number }>();

  feed(event: LineEvent): void {
    const key = event.service;
    const current = this.pending.get(key);

    if (current) {
      if (this.isContinuation(event.raw, current.lines[current.lines.length - 1])) {
        current.lines.push(event.raw);
        return;
      }

      this.flush(key);
    }

    this.pending.set(key, {
      lines: [event.raw],
      stream: event.stream,
      serviceColor: event.serviceColor,
      startSequence: event.sequence,
    });
  }

  flush(service?: string): void {
    if (service) {
      const current = this.pending.get(service);
      if (current) {
        this.emit('entry', {
          lines: current.lines,
          service,
          stream: current.stream,
          serviceColor: current.serviceColor,
          startSequence: current.startSequence,
        });
        this.pending.delete(service);
      }
      return;
    }

    for (const [key, current] of this.pending) {
      this.emit('entry', {
        lines: current.lines,
        service: key,
        stream: current.stream,
        serviceColor: current.serviceColor,
        startSequence: current.startSequence,
      });
    }
    this.pending.clear();
  }

  private isContinuation(line: string, previous: string): boolean {
    const trimmed = line.trimStart();
    const prevIndent = previous.length - previous.trimStart().length;
    const currIndent = line.length - trimmed.length;

    // Stack trace continuation
    if (/^at\s+/.test(trimmed)) return true;

    // Indented continuation (e.g., JSON, SQL, multi-line strings)
    if (currIndent > prevIndent + 2 && currIndent >= 2) return true;

    // Caused by / ... x more lines
    if (/^(Caused by|\.\.\.\s+\d+ more)/.test(trimmed)) return true;

    // Line without timestamp/level is likely a continuation
    if (!this.hasTimestampOrLevel(trimmed)) return true;

    return false;
  }

  private hasTimestampOrLevel(line: string): boolean {
    return (
      /^\d{4}-\d{2}-\d{2}/.test(line) ||
      /^\d{2}:\d{2}:\d{2}/.test(line) ||
      /^\[/.test(line) ||
      /\b(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)\b/i.test(line) ||
      /^\{/.test(line)
    );
  }
}
