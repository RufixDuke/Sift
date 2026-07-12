import React from 'react';
import { SectionLabel } from '../components/SectionLabel';

export function Problem(): React.ReactElement {
  return (
    <section
      className="grid grid-cols-12 gap-x-4 gap-y-10 py-28 border-t border-line"
      style={{ paddingInline: 'var(--gutter)' }}
    >
      <div className="col-span-12 md:col-span-5">
        <SectionLabel className="mb-4">The problem</SectionLabel>
        <h2 className="font-display text-[clamp(2rem,4vw,4rem)] tracking-display leading-display text-ink">
          Five tabs.
          <br />
          One error.
        </h2>
      </div>

      <div className="col-span-12 md:col-span-6 md:col-start-7 flex flex-col gap-6">
        <p className="text-ink/80">
          You are running a mobile bundler, a web frontend, an API, a database, and a webhook
          listener. Something breaks. You see a flicker of red in one terminal, but by the time you
          switch, it has scrolled away.
        </p>
        <p className="text-ink/80">
          Existing tools either run your processes without parsing their output, or assume you have
          already adopted a specific runtime. Sift meets you where you are: pipe anything, or let it
          detect your services automatically.
        </p>
      </div>
    </section>
  );
}
