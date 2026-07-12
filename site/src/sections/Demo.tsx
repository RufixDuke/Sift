import React from 'react';
import { TerminalWindow } from '../components/TerminalWindow';
import { SectionLabel } from '../components/SectionLabel';

const DEMO_LINES = [
  '[09:32:15] web     GET /api/users 200',
  '[09:32:15] api     SELECT users 12ms',
  '⚠ [09:32:16] api   Deprecation warn',
  '[09:32:16] mobile  BUNDLE complete',
  '✗ [09:32:18] api   ERROR: Timeout',
  '[09:32:18] db      Connection pool',
  '[09:32:19] api     Retry attempt 2',
  '[09:32:20] api     200 OK (retry)',
];

export function Demo(): React.ReactElement {
  return (
    <section
      className="grid grid-cols-12 gap-x-4 gap-y-10 py-28 border-t border-line"
      style={{ paddingInline: 'var(--gutter)' }}
    >
      <div className="col-span-12 md:col-span-8">
        <SectionLabel className="mb-4">Live demo</SectionLabel>
        <TerminalWindow lines={DEMO_LINES} className="w-full" />
      </div>

      <div className="col-span-12 md:col-span-3 md:col-start-10 flex flex-col justify-center gap-4">
        <h3 className="font-display text-2xl tracking-display text-ink">See everything at a glance</h3>
        <p className="text-ink/70">
          Timestamps, service tags, log levels, and warnings are parsed automatically — no
          configuration required.
        </p>
      </div>
    </section>
  );
}
