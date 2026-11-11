import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Layers2, Plus } from 'lucide-react';
import { Landing } from './pages/Landing';
const MarketLab = lazy(() => import('./pages/MarketLab').then(m => ({ default: m.MarketLab })));
const NewDeal = lazy(() => import('./pages/NewDeal').then(m => ({ default: m.NewDeal })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const DealRoom = lazy(() => import('./pages/DealRoom').then(m => ({ default: m.DealRoom })));
import { go } from './navigation';
export function Link({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return <a href={to} className={className} onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; e.preventDefault(); go(to); }}>{children}</a>;
}
export function Nav() {
  return <><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><nav className="nav shell" aria-label="Main">
    <Link to="/" className="brand"><span className="brand-mark"><Layers2 size={23} strokeWidth={1.7} /></span><span className="brand-word">EscrowPal</span><span className="brand-dot">.</span></Link>
    <div className="nav-links"><span className="sandbox-tag"><i /> Sandbox edition</span><Link to="/market" className={location.pathname.startsWith('/market') ? 'nav-active' : ''}>Market brief</Link><Link to="/dashboard" className={location.pathname === '/dashboard' ? 'nav-active' : ''}>My deals</Link><Link to="/new" className="btn btn-dark small"><Plus size={16} /> New deal</Link></div>
  </nav></header></>;
}
export function Footer() {
  return <footer className="site-footer shell"><Link to="/" className="brand">EscrowPal.</Link><p>A PayPal sandbox prototype. Built for clearer agreements.</p><a href="https://developer.paypal.com/docs/api/payments/v2/" target="_blank" rel="noreferrer">PayPal developer docs <ArrowUpRight size={14} /></a></footer>;
}
export function Router() {
  const [url, setUrl] = useState(location.pathname + location.search);
  useEffect(() => { const f = () => setUrl(location.pathname + location.search); addEventListener('popstate', f); return () => removeEventListener('popstate', f); }, []);
  useEffect(() => { document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true }); }, [url]);
  const path = url.split('?')[0]; const m = path.match(/^\/d\/([\w-]+)$/);
  let page: ReactNode = <Landing />;
  if (m) page = <DealRoom key={url} id={m[1]} k={new URLSearchParams(url.split('?')[1]).get('k') || ''} />;
  else if (path === '/market' || path.startsWith('/market/')) page = <MarketLab key={url} id={path.split('/')[2]} k={new URLSearchParams(url.split('?')[1]).get('k') || ''} />;
  else if (path === '/new') page = <NewDeal />;
  else if (path === '/dashboard') page = <Dashboard />;
  else if (path !== '/') page = <><Nav /><main id="main" className="shell page" tabIndex={-1}><h1>That page isn’t here.</h1><Link to="/">Return home</Link></main></>;
  return <Suspense fallback={<><Nav /><main id="main" className="shell page" tabIndex={-1}><p role="status">Opening your workspace…</p></main></>}>{page}</Suspense>;
}
