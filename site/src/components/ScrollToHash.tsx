import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToHash(): null {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [hash, pathname]);

  return null;
}
