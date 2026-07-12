import React from 'react';
import { SectionLabel } from '../components/SectionLabel';

const FEATURES = [
  {
    label: '01',
    title: 'Aggregate',
    body: 'One pane for every service. Sift reads from pipes, files, or auto-detects scripts in your package.json.',
  },
  {
    label: '02',
    title: 'Parse',
    body: 'Recognises log levels, timestamps, service names, and request IDs across Python, Go, Rust, Ruby, Elixir, JSON, bracketed, logfmt, access-log, and Docker formats.',
  },
  {
    label: '03',
    title: 'Filter',
    body: 'Search, filter by level, hide services, and pause the stream without losing a single line.',
  },
  {
    label: '04',
    title: 'Metrics',
    body: 'Live request rate, error-rate sparkline, average response time, and per-service health indicators.',
  },
  {
    label: '05',
    title: 'Correlate',
    body: 'Trace a single request across multiple services when your stack emits shared trace IDs.',
  },
  {
    label: '06',
    title: 'Persist',
    body: 'Every session is saved to SQLite. Replay yesterday with sift replay or compare two runs with sift diff.',
  },
];

export function Features(): React.ReactElement {
  return (
    <section
      className="py-28 border-t border-line"
      style={{ paddingInline: 'var(--gutter)' }}
    >
      <div className="grid grid-cols-12 gap-x-4 gap-y-12">
        <div className="col-span-12 md:col-span-4">
          <SectionLabel className="mb-4">Capabilities</SectionLabel>
          <h2 className="font-display text-[clamp(2rem,4vw,4rem)] tracking-display leading-display text-ink">
            Built for the multi-service loop.
          </h2>
        </div>

        <div className="col-span-12 md:col-span-7 md:col-start-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex flex-col gap-3">
              <span className="font-mono text-label tracking-label uppercase text-clay">{f.label}</span>
              <h3 className="font-display text-2xl tracking-display text-ink">{f.title}</h3>
              <p className="text-ink/70">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
