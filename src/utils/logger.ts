export function logInternal(message: string): void {
  // Internal Sift logs go to stderr so they don't pollute the TUI stdout
  process.stderr.write(`[sift] ${message}\n`);
}
