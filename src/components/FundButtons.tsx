import { useEffect, useRef, useState } from 'react';
import { CreditCard, FlaskConical } from 'lucide-react';
import { rpc, errorText, type MilestoneData, type View } from '../api';
import type { Confirmation } from './Confirm';
export type Act = (action: string, body?: Record<string, unknown>, message?: string) => Promise<boolean>;
declare global { interface Window { paypal?: any } }
let sdk: Promise<void> | null = null;
function loadPayPal(clientId: string) {
  if (window.paypal) return Promise.resolve();
  if (!sdk) sdk = new Promise<void>((resolve,reject) => {
    const s = document.createElement('script'); s.src = 'https://www.paypal.com/sdk/js?'+new URLSearchParams({ 'client-id':clientId,currency:'USD',intent:'authorize',components:'buttons' });
    s.onload = () => resolve(); s.onerror = () => { sdk = null; s.remove(); reject(new Error('PayPal could not load. Check the network and refresh.')); }; document.body.appendChild(s);
  });
  return sdk;
}
export function FundButtons({m,v,k,act,busy,confirm}: {m:MilestoneData;v:View;k:string;act:Act;busy:boolean;confirm:(value:Confirmation)=>void}) {
  const ref = useRef<HTMLDivElement>(null); const [err,setErr] = useState('');
  useEffect(()=>{
    if (!v.config.paypalServer || !v.config.paypalClientId) return;
    let dead=false; let buttons:any;
    loadPayPal(v.config.paypalClientId).then(async()=>{
      if(dead||!ref.current||!window.paypal)return;
      buttons=window.paypal.Buttons({
        style:{layout:'vertical',height:48,tagline:false,label:'paypal'},
        createOrder:async()=> (await rpc<{id:string}>('ppCreate',{id:v.deal.id,k,mid:m.id})).id,
        onApprove:async(data:any)=>{await act('fund',{mid:m.id,orderId:data.orderID},'Confirming sandbox authorization…');},
        onError:(e:unknown)=>setErr(errorText(e)),
        onCancel:()=>setErr('Sandbox checkout was cancelled. No hold was recorded in this room.'),
      });
      await buttons.render(ref.current);
    }).catch(e=>{if(!dead)setErr(errorText(e));});
    return()=>{dead=true;try{buttons?.close();}catch{/* SDK cleanup */}};
  },[m.id,v.deal.id,v.config.paypalServer,v.config.paypalClientId,k,act]);
  return <div className="fund-panel">
    {v.config.paypalServer?<><p><CreditCard size={17}/> Authorize this milestone with a PayPal sandbox buyer account.</p><div ref={ref} className="paypal-buttons" aria-label="PayPal sandbox checkout"/></>:<p className="muted">PayPal sandbox credentials are not configured here. You can explore the complete workflow with a simulated hold.</p>}
    <button className="btn-outline small" disabled={busy} onClick={()=>confirm({title:'Create a simulated hold?',detail:<p>This adds a demo ledger entry for this milestone. It does not contact PayPal or move money.</p>,confirm:'Record demo hold',action:()=>act('fund',{mid:m.id,demo:true},'Recording simulated authorization…')})}><FlaskConical size={16}/> Use a demo hold</button>
    {err&&<p role="alert" className="error">{err}</p>}
  </div>;
}
