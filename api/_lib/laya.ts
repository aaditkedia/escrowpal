import { z } from 'zod';
import type { MarketInput, LayaDecision, Preference } from '../../src/shared/market.js';
const answer=z.object({choice:z.string(),probabilities:z.record(z.string(),z.number().finite().min(0).max(1))});
export const layaConfigured=()=>Boolean(process.env.LAYA_BASE_URL);
export function parsePreference(raw:unknown,ids:string[]):Preference|null{
 const p=answer.safeParse(raw);if(!p.success)return null;
 const a=p.data,keys=Object.keys(a.probabilities);if(keys.length!==ids.length||keys.some(k=>!ids.includes(k))||!ids.includes(a.choice))return null;
 if(Math.abs(Object.values(a.probabilities).reduce((s,v)=>s+v,0)-1)>.002)return null;
 const max=Math.max(...Object.values(a.probabilities));if(a.probabilities[a.choice]<max-.00001)return null;
 return a;
}
export function combinePreferences(listed:Preference,reversed:Preference){
 const stable=listed.choice===reversed.choice;
 return {status:stable?'suggested' as const:'manual_review' as const,choiceId:stable?listed.choice:null,optionOrderStable:stable,largestOrderChangePoints:Math.round(Math.max(...Object.keys(listed.probabilities).map(k=>Math.abs(listed.probabilities[k]-reversed.probabilities[k])))*10000)/100};
}
export async function layaDecision(input:MarketInput,allowed:string[]):Promise<LayaDecision>{
 const unavailable=(reason:string):LayaDecision=>({status:'unavailable',engine:'Unavailable',runtime:null,revision:null,choiceId:null,listed:null,reversed:null,optionOrderStable:null,largestOrderChangePoints:null,elapsedMs:null,reason,stateExcerpt:null,usage:null});
 if(!layaConfigured())return unavailable('Configure the Laya companion service to obtain a model recommendation. Evidence checks are still available.');
 const candidates=input.options.filter(o=>allowed.includes(o.id));
 if(candidates.length<2)return unavailable('At least two affordable candidates are required for a comparative model decision.');
 const state={objective:input.objective.slice(0,180),audience:input.audience.slice(0,80),budgetUSD:input.budget,candidates:candidates.map(o=>({id:o.id,channel:o.channel,quoteUSD:o.quotedPrice,claim:o.offer.slice(0,110),impressions:o.impressions??null,clicks:o.clicks??null})),scope:'Unverified user claims. Compare pilot suitability, not expected sales. No payment authority.'};
 const criteria=Object.fromEntries(candidates.map(o=>[o.id,o.label.slice(0,45)+'; '+o.channel+'; quote USD '+o.quotedPrice]));
 const q={type:'choice',instructions:'Which candidate best fits this objective, audience and measurable pilot budget? Treat quoted claims as unverified evidence. Never authorize payment.',criteria};
 const reversed={...q,criteria:Object.fromEntries(Object.entries(criteria).reverse())};
 const started=performance.now();
 try{
  const base=new URL(process.env.LAYA_BASE_URL!);if(base.protocol!=='https:'&&!['127.0.0.1','localhost','::1','[::1]','10.0.2.2'].includes(base.hostname))return unavailable('A remote model endpoint must use HTTPS.');
  const r=await fetch(base.href.replace(/\/$/,'')+'/v1/systemone',{method:'POST',signal:AbortSignal.timeout(60000),headers:{'content-type':'application/json',...(process.env.LAYA_API_KEY?{authorization:'Bearer '+process.env.LAYA_API_KEY}:{})},body:JSON.stringify({state,questions:{pilot:q,pilot_reversed:reversed}})});
  if(!r.ok)return unavailable(r.status===429?'The Laya service is busy. Try again after its current analysis.':'The Laya service could not complete this analysis.');
  const result=await r.json() as any;const ids=candidates.map(o=>o.id);
  const a=parsePreference(result.answers?.pilot,ids),b=parsePreference(result.answers?.pilot_reversed,ids);
  if(!a||!b)return unavailable('Laya returned an invalid or incomplete choice distribution; no recommendation was accepted.');
  const merged=combinePreferences(a,b);
  return {...merged,engine:'Laya',runtime:typeof result.runtime==='string'?result.runtime:null,revision:typeof result.revision==='string'?result.revision:null,listed:a,reversed:b,elapsedMs:Math.round(performance.now()-started),reason:merged.optionOrderStable?'Both option orders selected the same pilot. This preference is advisory; it does not predict sales or authorize payment.':'The selection changed when the option order changed. Review the candidates manually before choosing a pilot.',stateExcerpt:JSON.stringify(state),usage:result.usage??null};
 }catch{return unavailable('Laya did not finish within the request window. No model recommendation was substituted.');}
}
