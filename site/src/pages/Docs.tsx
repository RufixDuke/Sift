import React from 'react';
import { SEO } from '../components/SEO';
import { Nav } from '../sections/Nav';
import { Footer } from '../sections/Footer';
import { SectionLabel } from '../components/SectionLabel';
import { TerminalWindow } from '../components/TerminalWindow';

const SHORTCUTS: [string, string][] = [
  ['↑ / ↓', 'Scroll logs (1 line)'],
  ['PgUp / PgDn', 'Scroll (10 lines)'],
  ['Home / End', 'Jump to first / last log'],
  ['Space', 'Pause / resume stream'],
  ['/', 'Open search overlay'],
  ['n / N', 'Next / previous search match'],
  ['e', 'Filter errors'],
  ['w', 'Filter warnings'],
  ['i', 'Filter info'],
  ['a', 'Show all levels'],
  ['s1 … s9', 'Toggle service visibility'],
  ['1 … 9', 'Jump to service in sidebar'],
  ['Enter', 'Expand multi-line log / show trace'],
  ['Backspace / Esc', 'Close overlay / return to full view'],
  ['d', 'Show detail view for selected log'],
  ['c', 'Copy selected log to clipboard'],
  ['r', 'Restart selected service'],
  ['l', 'Toggle line wrapping'],
  ['t', 'Toggle timestamps'],
  ['h / ?', 'Show help overlay'],
  ['q / Ctrl+C', 'Quit Sift'],
];

const CONFIG_EXAMPLE = `{
  "$schema": "https://sift.dev/schema.json",
  "version": 1,
  "services": [
    { "name": "web", "command": "npm run dev", "cwd": "./frontend" },
    { "name": "api", "command": "npm run server", "cwd": "./backend" }
  ],
  "settings": {
    "bufferSize": 10000,
    "theme": "dark"
  }
}`;

export function Docs(): React.ReactElement {
  return (
    <>
      <SEO title="Docs" description="Quickstart, CLI reference, and configuration for Sift." />
      <Nav />
      <main className="pt-32 pb-20" style={{ paddingInline: 'var(--gutter)' }}>
        <div className="grid grid-cols-12 gap-x-4 gap-y-12">
          <div className="col-span-12 md:col-span-3">
            <SectionLabel className="mb-4">Documentation.</SectionLabel>
            <nav className="flex flex-col gap-3 mb-8">
              <a href="#quickstart" className="font-mono text-label tracking-label uppercase text-ink/80 hover:text-clay transition-colors">Quickstart</a>
              <a href="#formats" className="font-mono text-label tracking-label uppercase text-ink/80 hover:text-clay transition-colors">Supported formats</a>
              <a href="#metrics" className="font-mono text-label tracking-label uppercase text-ink/80 hover:text-clay transition-colors">Metrics</a>
              <a href="#persistence" className="font-mono text-label tracking-label uppercase text-ink/80 hover:text-clay transition-colors">Persistence</a>
              <a href="#commands" className="font-mono text-label tracking-label uppercase text-ink/80 hover:text-clay transition-colors">Commands</a>
              <a href="#shortcuts" className="font-mono text-label tracking-label uppercase text-ink/80 hover:text-clay transition-colors">Shortcuts</a>
              <a href="#config" className="font-mono text-label tracking-label uppercase text-ink/80 hover:text-clay transition-colors">Config</a>
            </nav>
            <div className="flex flex-wrap gap-2">
              <a href="https://www.npmjs.com/package/sift-logs" target="_blank" rel="noreferrer">
                <img
                  src="https://img.shields.io/npm/v/sift-logs?style=flat-square&color=4E8C82&labelColor=1A1D1B"
                  alt="npm version"
                  className="h-6"
                />
              </a>
              <a href="https://github.com/RufixDuke/Sift/blob/main/LICENSE" target="_blank" rel="noreferrer">
                <img
                  src="https://img.shields.io/github/license/RufixDuke/Sift?style=flat-square&color=86897F&labelColor=1A1D1B"
                  alt="license"
                  className="h-6"
                />
              </a>
            </div>
          </div>

          <div className="col-span-12 md:col-span-8 md:col-start-5 flex flex-col gap-16">
            <section id="quickstart">
              <h1 className="font-display text-[clamp(2rem,4vw,4rem)] tracking-display leading-display text-ink mb-6">
                Get started
              </h1>
              <p className="text-ink/80 mb-4">Install Sift globally, then run it from any project.</p>
              <TerminalWindow lines={['npm install -g sift-logs', 'sift run', 'docker compose logs -f | sift run --file -']} className="w-full" />
            </section>

            <section id="formats">
              <h2 className="font-display text-3xl tracking-display text-ink mb-6">Supported log formats</h2>
              <p className="text-ink/80 mb-6">
                Sift auto-detects the format of each line. No configuration is required for any of these.
              </p>
              <dl className="grid grid-cols-1 gap-4">
                {[
                  [
                    'Python',
                    'Django, Flask/Werkzeug, FastAPI/Uvicorn, and the standard logging module.',
                    '2026-01-15 09:32:15,123 - django - INFO - Started server',
                  ],
                  [
                    'Go',
                    'Native log package, Logrus key=value output, and Zap production logs.',
                    '2026-01-15T09:32:15.123Z\tinfo\tapi/server.go:42\tstarted server',
                  ],
                  [
                    'Rust',
                    'env_logger, tracing, and slog structured output.',
                    '2026-01-15T09:32:15.123456Z  INFO api::server: started server',
                  ],
                  [
                    'Ruby',
                    'Rails logger output including request start lines.',
                    'I, [2026-01-15T09:32:15.123456 #12345]  INFO -- : Started GET "/api/users"',
                  ],
                  [
                    'Elixir',
                    'Phoenix request and bracketed level logs.',
                    '09:32:15.123 [info] GET /api/users',
                  ],
                  [
                    'Generic',
                    'JSON structured logs, bracketed levels, prefixed levels, logfmt, access logs, and Docker Compose prefixes.',
                    '{"level":"info","message":"request completed"}',
                  ],
                ].map(([lang, desc, example]) => (
                  <div key={lang} className="p-4 rounded-media bg-surface border border-line">
                    <dt className="font-mono text-sm text-clay mb-1">{lang}</dt>
                    <dd className="text-ink/80 mb-3">{desc}</dd>
                    <code className="block font-mono text-xs text-muted break-all">{example}</code>
                  </div>
                ))}
              </dl>
            </section>

            <section id="metrics">
              <h2 className="font-display text-3xl tracking-display text-ink mb-6">Metrics dashboard</h2>
              <p className="text-ink/80 mb-6">
                Sift extracts request rate, error rate, and response times from HTTP access logs in real time.
                No configuration is required.
              </p>
              <dl className="grid grid-cols-1 gap-4">
                {[
                  [
                    'Request rate',
                    'Requests per minute for each service, shown in the service sidebar.',
                  ],
                  [
                    'Error rate',
                    'Rolling error ratio with a sparkline in the status bar.',
                  ],
                  [
                    'Response time',
                    'Average response time per service when logs include duration.',
                  ],
                  [
                    'Health',
                    'Green, yellow, or red indicator per service based on error ratio.',
                  ],
                ].map(([title, desc]) => (
                  <div key={title} className="p-4 rounded-media bg-surface border border-line">
                    <dt className="font-mono text-sm text-clay mb-1">{title}</dt>
                    <dd className="text-ink/80">{desc}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section id="persistence">
              <h2 className="font-display text-3xl tracking-display text-ink mb-6">Log persistence</h2>
              <p className="text-ink/80 mb-6">
                Every session is saved to a local SQLite database at <code className="font-mono text-sm text-clay">~/.config/sift/sift.db</code>.
                Replay yesterday's logs or compare two sessions side-by-side.
              </p>
              <div className="mb-6">
                <TerminalWindow
                  lines={[
                    'sift run --session-name deploy-fix',
                    'sift replay --session yesterday',
                    'sift diff session1 session2',
                  ]}
                  className="w-full"
                />
              </div>
              <dl className="grid grid-cols-1 gap-4">
                {[
                  [
                    'Auto-save',
                    'Sessions are persisted automatically unless you pass --no-save.',
                  ],
                  [
                    'Session aliases',
                    'Use a name, id, or alias: last, today, yesterday.',
                  ],
                  [
                    'Replay',
                    'Load any past session back into the interactive viewer.',
                  ],
                  [
                    'Diff',
                    'Compare log volume, levels, and services across two sessions.',
                  ],
                ].map(([title, desc]) => (
                  <div key={title} className="p-4 rounded-media bg-surface border border-line">
                    <dt className="font-mono text-sm text-clay mb-1">{title}</dt>
                    <dd className="text-ink/80">{desc}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section id="commands">
              <h2 className="font-display text-3xl tracking-display text-ink mb-6">CLI commands</h2>
              <dl className="grid grid-cols-1 gap-4">
                {[
                  ['sift run', 'Detect services from package.json and aggregate logs.'],
                  ['sift run --file -', 'Read logs from stdin.'],
                  ['sift run --session-name <name>', 'Name the saved session.'],
                  ['sift run --no-save', 'Run without persisting the session.'],
                  ['sift replay --session yesterday', 'Replay a past session in the UI.'],
                  ['sift diff session1 session2', 'Compare two persisted sessions.'],
                  ['sift config init', 'Create a sift.config.json file.'],
                  ['sift --version', 'Show version.'],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="p-4 rounded-media bg-surface border border-line">
                    <dt className="font-mono text-sm text-clay mb-1">{cmd}</dt>
                    <dd className="text-ink/80">{desc}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section id="shortcuts">
              <h2 className="font-display text-3xl tracking-display text-ink mb-6">Keyboard shortcuts</h2>
              <p className="text-ink/80 mb-6">
                Available in the interactive viewer at any time — press <code className="font-mono text-sm text-clay">h</code> or{' '}
                <code className="font-mono text-sm text-clay">?</code> in the app to bring this list up on the spot.
              </p>
              <div className="rounded-media bg-surface border border-line divide-y divide-line">
                {SHORTCUTS.map(([key, desc]) => (
                  <div key={key} className="flex items-center gap-6 px-4 py-3">
                    <code className="font-mono text-sm text-clay w-36 shrink-0">{key}</code>
                    <span className="text-ink/80">{desc}</span>
                  </div>
                ))}
              </div>
            </section>

            <section id="config">
              <h2 className="font-display text-3xl tracking-display text-ink mb-6">Configuration</h2>
              <p className="text-ink/80 mb-4">Use sift.config.json when auto-detection is not enough.</p>
              <pre className="p-5 rounded-media bg-ink text-paper font-mono text-sm overflow-x-auto">
                {CONFIG_EXAMPLE}
              </pre>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
