import React from 'react';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className = '' }: SectionLabelProps): React.ReactElement {
  return (
    <span
      className={`inline-block font-mono text-label tracking-label uppercase text-muted ${className}`}
    >
      {children}
    </span>
  );
}
