import type { ParsedLogEntry, Filters, LogLevel } from '../types/index.js';
import { applyFilters } from './parser.js';

export interface LogBufferOptions {
  capacity?: number;
  reorderWindowMs?: number;
}

export class LogBuffer {
  private entries: ParsedLogEntry[];
  private head = 0;
  private size = 0;
  private capacity: number;
  private reorderWindowMs: number;
  private pendingReorder: ParsedLogEntry[] = [];
  private sequence = 0;

  constructor(options: LogBufferOptions = {}) {
    this.capacity = options.capacity ?? 10000;
    this.reorderWindowMs = options.reorderWindowMs ?? 500;
    this.entries = new Array(this.capacity);
  }

  append(entry: ParsedLogEntry): void {
    entry.id = ++this.sequence;

    if (this.pendingReorder.length > 0) {
      this.flushReorderWindow();
    }

    if (entry.timestamp) {
      this.pendingReorder.push(entry);
      setTimeout(() => this.flushReorderWindow(), this.reorderWindowMs);
    } else {
      this.pushEntry(entry);
    }
  }

  private flushReorderWindow(): void {
    if (this.pendingReorder.length === 0) return;

    const now = Date.now();
    const ready = this.pendingReorder.filter(
      (e) => !e.timestamp || now - e.timestamp.getTime() >= this.reorderWindowMs,
    );

    if (ready.length === 0) return;

    // Sort ready entries by timestamp, then sequence
    ready.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp.getTime() - b.timestamp.getTime();
      }
      return a.id - b.id;
    });

    for (const entry of ready) {
      this.pushEntry(entry);
      const idx = this.pendingReorder.indexOf(entry);
      if (idx >= 0) this.pendingReorder.splice(idx, 1);
    }
  }

  private pushEntry(entry: ParsedLogEntry): void {
    this.entries[this.head] = entry;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) this.size += 1;
  }

  getAll(): ParsedLogEntry[] {
    return this.getVisibleSlice(0, this.size);
  }

  getVisible(filters: Filters, offset = 0, limit = 100): ParsedLogEntry[] {
    const filtered = this.getAll().filter((entry) => applyFilters(entry, filters));
    return filtered.slice(offset, offset + limit);
  }

  search(query: string): ParsedLogEntry[] {
    return this.getAll().filter((entry) => applyFilters(entry, { query }));
  }

  countByLevel(): Record<LogLevel, number> {
    const counts: Record<LogLevel, number> = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      trace: 0,
      unknown: 0,
    };

    for (const entry of this.getAll()) {
      counts[entry.level] += 1;
    }

    return counts;
  }

  countByService(service: string): number {
    return this.getAll().filter((e) => e.service === service).length;
  }

  length(): number {
    return this.size;
  }

  private getVisibleSlice(offset: number, limit: number): ParsedLogEntry[] {
    const result: ParsedLogEntry[] = [];
    const start = this.size < this.capacity ? 0 : this.head;

    for (let i = 0; i < this.size; i += 1) {
      const idx = (start + i) % this.capacity;
      const entry = this.entries[idx];
      if (entry) result.push(entry);
    }

    return result.slice(offset, offset + limit);
  }
}
