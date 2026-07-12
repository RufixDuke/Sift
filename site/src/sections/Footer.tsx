import React from 'react';

export function Footer(): React.ReactElement {
  return (
    <footer
      className="grid grid-cols-12 gap-x-4 gap-y-4 md:gap-y-0 items-start md:items-center py-10 border-t border-line"
      style={{ paddingInline: 'var(--gutter)' }}
    >
      <div className="col-span-12 md:col-span-4">
        <span className="font-display text-xl tracking-display text-ink">Sift</span>
      </div>

      <div className="col-span-12 md:col-span-4 md:col-start-5 text-left">
        <p className="text-sm text-muted">MIT © Abdul-Qudus Rufai</p>
      </div>

      <div className="col-span-12 md:col-span-3 md:col-start-10 flex justify-start gap-6">
        <a
          href="https://github.com/abdul-qudus/sift"
          className="font-mono text-label tracking-label uppercase text-muted hover:text-clay transition-colors duration-300"
        >
          GitHub
        </a>
        <a
          href="https://www.npmjs.com/package/sift-logs"
          className="font-mono text-label tracking-label uppercase text-muted hover:text-clay transition-colors duration-300"
        >
          npm
        </a>
      </div>
    </footer>
  );
}
