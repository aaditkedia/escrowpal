import { useEffect, useState } from 'react';
import { Nav, Link } from '../Router';
import { rpc, saved, money } from '../api';
export function Dashboard() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { Promise.all(saved().map(s => rpc('get', { id: s.id, k: s.k }).then(v => ({ s, v })).catch(() => ({ s, v: null })))).then(setRows); }, []);
  return <><div className="bar"><Nav /></div><main className="page">
    <h1 className="display small">My deals</h1>
    <p className="muted">Deals are opened with private links, so no password is needed. This device remembers the links you created or opened.</p>
    {!saved().length && <p>No deals yet. <Link to="/new">Create one →</Link></p>}
    <div className="deal-list">{rows.map(({ s, v }) => <Link key={s.id + s.role} to={`/d/${s.id}?k=${s.k}`} className="deal-row">
      <div><b>{s.title}</b><small>{s.role === 'buyer' ? 'You are the buyer' : 'You are the seller'}</small></div>
      {v ? <><span className={`status ${v.deal.status}`}>{v.deal.status.replace('_', ' ')}</span><span>{money(v.deal.total)}</span>
        <span>{v.milestones.filter((m: any) => m.status === 'released').length}/{v.milestones.length} released</span></> : <span className="muted">unavailable</span>}
    </Link>)}</div>
  </main></>;
}
