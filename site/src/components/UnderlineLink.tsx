import React from 'react';
import { Link } from 'react-router-dom';

interface UnderlineLinkProps {
  to?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}

export function UnderlineLink({ to, href, children, className = '' }: UnderlineLinkProps): React.ReactElement {
  const classes = `relative inline-block text-ink hover:text-clay transition-colors duration-300 ease-editorial after:content-[''] after:absolute after:left-0 after:bottom-0 after:w-full after:h-px after:bg-current after:origin-left after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-[450ms] after:ease-editorial ${className}`;

  if (to) {
    return <Link to={to} className={classes}>{children}</Link>;
  }

  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}
