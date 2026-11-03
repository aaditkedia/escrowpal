import { useEffect, useState } from 'react';
import { Landing } from './pages/Landing';
import { NewDeal } from './pages/NewDeal';
import { Dashboard } from './pages/Dashboard';
import { DealRoom } from './pages/DealRoom';
export const go = (to: string) => { history.pushState(null, '', to); dispatchEvent(new PopStateEvent('popstate')); scrollTo(0, 0); };
export function Link({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return <a href={to} className={className} onClick={e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go(to); }}>{children}</a>;
}
export function Nav() {
  return <nav className="nav" aria-label="Main"><Link to="/" className="brand">ESCROW<span>PAL</span></Link><div><Link to="/dashboard">My deals</Link><Link to="/new" className="btn small">New deal</Link></div></nav>;
}
export function Router() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => { const f = () => setPath(location.pathname); addEventListener('popstate', f); return () => removeEventListener('popstate', f); }, []);
  const m = path.match(/^\/d\/([\w-]+)/);
  if (m) return <DealRoom id={m[1]} k={new URLSearchParams(location.search).get('k') || ''} />;
  if (path === '/new') return <NewDeal />;
  if (path === '/dashboard') return <Dashboard />;
  return <Landing />;
}
