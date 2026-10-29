// Tiny hash router: #/dashboard, #/students … Hash URLs work on GitHub Pages
// without any server-side rewrite rules.
import { useEffect, useState } from 'react';

export const ROUTES = ['dashboard', 'students', 'income', 'expenses', 'reports', 'settings'];

export function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return ROUTES.includes(h) ? h : 'dashboard';
}

export function navigate(route) {
  window.location.hash = `#/${route}`;
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const fn = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
}
