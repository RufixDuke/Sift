import React, { useRef } from 'react';
import gsap from 'gsap';

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function MagneticButton({ children, className = '', onClick }: MagneticButtonProps): React.ReactElement {
  const ref = useRef<HTMLButtonElement>(null);
  const xTo = useRef<gsap.QuickToFunc | null>(null);
  const yTo = useRef<gsap.QuickToFunc | null>(null);

  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    if (!xTo.current) xTo.current = gsap.quickTo(ref.current, 'x', { duration: 0.4, ease: 'power2.out' });
    if (!yTo.current) yTo.current = gsap.quickTo(ref.current, 'y', { duration: 0.4, ease: 'power2.out' });

    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);

    xTo.current(x * 0.25);
    yTo.current(y * 0.25);
  };

  const handleLeave = () => {
    xTo.current?.(0);
    yTo.current?.(0);
  };

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`group relative overflow-hidden inline-flex items-center justify-center px-8 py-4 rounded-full bg-ink text-paper font-text font-medium text-body transition-colors duration-500 ease-editorial ${className}`}
    >
      <span className="relative z-10">{children}</span>
      <span
        className="absolute inset-0 bg-clay translate-y-full transition-transform duration-500 ease-editorial group-hover:translate-y-0"
        aria-hidden="true"
      />
    </button>
  );
}
