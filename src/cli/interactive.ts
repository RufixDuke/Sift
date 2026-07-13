import { createInterface } from 'node:readline';
import { render } from 'ink';
import React from 'react';
import type { ServiceConfig } from '../types/index.js';
import type { LastRunEntry } from '../core/lastRun.js';
import { summarizeLastRun } from '../core/lastRun.js';
import type { SelectionResult } from '../core/selectorState.js';
import { ServiceSelector } from '../ui/components/ServiceSelector.js';

/** Asks whether to re-run the same services as last time. Resolves true for yes, false for anything else (including empty = default yes). */
export async function promptRunLastRun(entry: LastRunEntry): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((res) => {
    rl.question(`Last run: ${summarizeLastRun(entry)}\nRun the same services again? [Y/n] `, (a) =>
      res(a.trim().toLowerCase()),
    );
  });
  rl.close();
  return answer === '' || answer === 'y' || answer === 'yes';
}

export function runServiceSelector(
  detected: ServiceConfig[],
  lastRun?: LastRunEntry,
): Promise<SelectionResult | null> {
  return new Promise((resolvePromise) => {
    const app = render(
      React.createElement(ServiceSelector, {
        detected,
        lastRun,
        onConfirm: (result: SelectionResult) => resolvePromise(result),
        onCancel: () => resolvePromise(null),
      }),
    );
    app.waitUntilExit().catch(() => {});
  });
}
