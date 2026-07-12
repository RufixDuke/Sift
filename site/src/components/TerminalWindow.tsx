import React, { useState, useEffect, useRef } from 'react';

interface TerminalWindowProps {
  lines: string[];
  typing?: boolean;
  className?: string;
}

export function TerminalWindow({ lines, typing = false, className = '' }: TerminalWindowProps): React.ReactElement {
  const [visibleCount, setVisibleCount] = useState(typing ? 0 : lines.length);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!typing) return;
    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= lines.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [typing, lines.length]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleCount]);

  return (
    <div className={`rounded-media bg-ink text-paper overflow-hidden shadow-2xl ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-clay" />
        <span className="w-3 h-3 rounded-full bg-muted" />
        <span className="w-3 h-3 rounded-full bg-line" />
      </div>
      <div ref={containerRef} className="p-5 font-mono text-sm leading-relaxed max-h-[360px] overflow-y-auto">
        {lines.slice(0, visibleCount).map((line, idx) => (
          <div key={idx} className="whitespace-pre">
            <span className="text-muted">$ </span>
            {line}
          </div>
        ))}
        {typing && visibleCount < lines.length && <span className="inline-block w-2 h-4 bg-clay animate-pulse" />}
      </div>
    </div>
  );
}
