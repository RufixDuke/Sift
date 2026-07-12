import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps): React.ReactElement {
  const base =
    'relative overflow-hidden inline-flex items-center justify-center px-7 py-3 rounded-full font-text font-medium text-body transition-colors duration-500 ease-editorial';
  const variants =
    variant === 'primary'
      ? 'bg-ink text-paper hover:text-paper'
      : 'bg-transparent text-ink border border-line hover:text-ink';

  return (
    <button className={`group ${base} ${variants} ${className}`} {...props}>
      <span className="relative z-10">{children}</span>
      <span
        className="absolute inset-0 bg-clay translate-y-full transition-transform duration-500 ease-editorial group-hover:translate-y-0"
        aria-hidden="true"
      />
    </button>
  );
}
