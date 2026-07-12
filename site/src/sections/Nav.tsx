import React from 'react';
import { Link } from 'react-router-dom';
import { UnderlineLink } from '../components/UnderlineLink';

export function Nav(): React.ReactElement {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-paper/90 backdrop-blur-sm border-b border-line">
      <div
        className="grid grid-cols-12 gap-x-4 items-center py-5"
        style={{ paddingInline: 'var(--gutter)' }}
      >
        <div className="col-span-6 md:col-span-3">
          <Link to="/" className="font-display text-2xl tracking-display text-ink">
            Sift
          </Link>
        </div>
        <div className="hidden md:flex col-span-6 justify-center gap-8">
          <UnderlineLink to="/docs">Docs</UnderlineLink>
          <UnderlineLink to="/#install">Install</UnderlineLink>
          <UnderlineLink href="https://github.com/abdul-qudus/sift">GitHub</UnderlineLink>
        </div>
        <div className="col-span-6 md:col-span-3 flex justify-end">
        </div>
      </div>
    </nav>
  );
}
