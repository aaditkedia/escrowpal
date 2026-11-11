import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
export type Confirmation = { title: string; detail: ReactNode; confirm: string; noteLabel?: string; danger?: boolean; action: (note: string) => Promise<boolean> };
export function Confirm({ value, close, error }: { value: Confirmation | null; close: () => void; error: string }) {
  const ref = useRef<HTMLDialogElement>(null); const [note, setNote] = useState(''); const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (value && d && !d.open) { setNote(''); d.showModal(); }
    if (!value && d?.open) d.close();
  }, [value]);
  return <dialog ref={ref} className="confirm-dialog" aria-labelledby="confirm-title" aria-busy={waiting} onKeyDown={e => {
    if (e.key !== 'Tab') return;
    const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]') || []).filter(n => n.offsetParent !== null);
    const first = nodes[0], last = nodes[nodes.length-1];
    if (!first) { e.preventDefault(); return; }
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }} onCancel={e => { if (waiting) e.preventDefault(); else close(); }} onClose={() => { if (!waiting) close(); }}>
    {value && <form onSubmit={async e => { e.preventDefault(); if (waiting) return; setWaiting(true); try { if (await value.action(note)) close(); } finally { setWaiting(false); } }}>
      <div className="dialog-head"><span className="eyebrow">Review your decision</span><button type="button" className="icon-button" aria-label="Close confirmation" onClick={close} disabled={waiting}><X size={19} /></button></div>
      <h2 id="confirm-title">{value.title}</h2><div className="dialog-detail">{value.detail}</div>
      {value.noteLabel && <label>{value.noteLabel}<textarea autoFocus required rows={4} maxLength={1500} value={note} onChange={e => setNote(e.target.value)} /></label>}
      {error && <p role="alert" className="error">{error}</p>}<div className="actions"><button type="submit" className={value.danger ? 'btn-danger' : ''} disabled={waiting || (!!value.noteLabel && !note.trim())}>{waiting ? 'Saving decision…' : value.confirm}</button><button type="button" className="btn-outline" onClick={close} disabled={waiting}>Keep reviewing</button></div>
    </form>}
  </dialog>;
}
