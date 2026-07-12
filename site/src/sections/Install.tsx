import React, { useState } from 'react';
import { SectionLabel } from '../components/SectionLabel';

const COMMANDS = [
  { label: 'npm', command: 'npm install -g sift-logs' },
  { label: 'pnpm', command: 'pnpm add -g sift-logs' },
  { label: 'yarn', command: 'yarn global add sift-logs' },
];

export function Install(): React.ReactElement {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, text: string) => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section
      id="install"
      className="py-28 border-t border-line"
      style={{ paddingInline: 'var(--gutter)' }}
    >
      <div className="grid grid-cols-12 gap-x-4 gap-y-10">
        <div className="col-span-12 md:col-span-4">
          <SectionLabel className="mb-4">Install</SectionLabel>
          <h2 className="font-display text-[clamp(2rem,4vw,4rem)] tracking-display leading-display text-ink">
            One command.
          </h2>
        </div>

        <div className="col-span-12 md:col-span-7 md:col-start-6 flex flex-col gap-4">
          {COMMANDS.map(({ label, command }) => (
            <div
              key={label}
              className="group flex items-center justify-between gap-4 p-5 rounded-media bg-surface border border-line"
            >
              <div className="flex items-center gap-4 min-w-0 overflow-hidden">
                <span className="font-mono text-label tracking-label uppercase text-muted shrink-0">{label}</span>
                <code className="font-mono text-sm text-ink break-all md:whitespace-nowrap md:overflow-x-auto md:scrollbar-hide">{command}</code>
              </div>
              <button
                onClick={() => copy(label, command)}
                className="shrink-0 px-4 py-2 rounded-full border border-line font-mono text-label tracking-label uppercase text-ink hover:bg-ink hover:text-paper transition-colors duration-500 ease-editorial"
              >
                {copied === label ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
