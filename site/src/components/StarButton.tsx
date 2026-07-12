import React from 'react';

interface StarButtonProps {
  owner?: string;
  repo?: string;
  className?: string;
}

export function StarButton({
  owner = 'abdul-qudus',
  repo = 'sift',
  className = '',
}: StarButtonProps): React.ReactElement {
  return (
    <a
      href={`https://github.com/${owner}/${repo}`}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border border-line bg-surface font-mono text-label tracking-label uppercase text-ink hover:border-clay hover:text-clay transition-colors duration-500 ease-editorial ${className}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <span className="hidden sm:inline">Star on GitHub</span>
    </a>
  );
}
