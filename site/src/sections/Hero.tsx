import React, { useState } from 'react';
import { TerminalWindow } from '../components/TerminalWindow';
import { SectionLabel } from '../components/SectionLabel';
import { StarButton } from '../components/StarButton';

const TERMINAL_LINES = [
  'docker compose logs -f | sift run --file -',
  'sift run',
  'sift replay --session yesterday',
  'sift diff session1 session2',
];

const INSTALL_COMMAND = 'npm install -g sift-logs';

export function Hero(): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(INSTALL_COMMAND).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section
      className="min-h-screen grid grid-cols-12 gap-x-4 items-center pt-28 pb-20"
      style={{ paddingInline: 'var(--gutter)' }}
    >
      <div className="col-span-12 lg:col-span-7 flex flex-col gap-8">
        <SectionLabel>Local development logs, unified</SectionLabel>
        <h1 className="font-display text-display text-ink">
          One pane.
          <br />
          Every service.
          <span className="text-clay">*</span>
        </h1>
        <p className="max-w-md text-ink/80">
          Sift aggregates, parses, and filters logs from all your running services in a single,
          interactive terminal interface. No more tab-switching.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-media bg-surface border border-line min-w-0 max-w-md">
            <code className="font-mono text-sm text-ink whitespace-nowrap overflow-x-auto scrollbar-hide">{INSTALL_COMMAND}</code>
            <button
              onClick={copy}
              className="shrink-0 px-4 py-2 rounded-full border border-line font-mono text-label tracking-label uppercase text-ink hover:bg-ink hover:text-paper transition-colors duration-500 ease-editorial"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <a
            href="https://github.com/abdul-qudus/sift"
            className="font-mono text-label tracking-label uppercase text-muted hover:text-clay transition-colors duration-300"
          >
            View on GitHub →
          </a>
        </div>
        <div className="w-fit">
          <StarButton />
        </div>
      </div>

      <div className="col-span-12 lg:col-span-5 mt-12 lg:mt-0">
        <TerminalWindow lines={TERMINAL_LINES} typing className="w-full" />
      </div>
    </section>
  );
}
