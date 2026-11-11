import { z } from 'zod';
import { dollars } from './validation.js';
import { researchEvidence } from './research-evidence.js';
const date = z.string().refine(s => !s || (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s), 'Use a valid observation date.');
const source = z.string().max(1200).refine(s => {if(!s)return true;try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}},'Use an HTTPS source URL without credentials.');
export const marketOption = z.object({
 id:z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/),label:z.string().trim().min(2).max(70),channel:z.enum(['email','search','social','creator','other']),
 offer:z.string().trim().min(5).max(600),quotedPrice:dollars,sourceUrl:source.default(''),observedOn:date.default(''),
 impressions:z.number().int().min(1).max(1e9).nullable().optional(),clicks:z.number().int().min(0).max(1e9).nullable().optional(),
}).refine(v=>v.clicks==null||v.impressions==null||v.clicks<=v.impressions,'Clicks cannot exceed impressions.');
export const marketInput=z.object({
 title:z.string().trim().min(3).max(100),objective:z.string().trim().min(10).max(600),audience:z.string().trim().min(3).max(300),budget:dollars.refine(n=>n>=10,'The pilot budget must be at least $10.'),
 fictional:z.boolean().default(false),options:z.array(marketOption).min(2).max(3),
}).refine(v=>new Set(v.options.map(o=>o.id)).size===v.options.length,'Candidate IDs must be unique.');
export type MarketInput=z.infer<typeof marketInput>;
export type Preference = {choice:string;probabilities:Record<string,number>};
export type LayaDecision = {status:'suggested'|'manual_review'|'unavailable'|'needs_evidence';engine:string;runtime:string|null;revision:string|null;choiceId:string|null;listed:Preference|null;reversed:Preference|null;optionOrderStable:boolean|null;largestOrderChangePoints:number|null;elapsedMs:number|null;reason:string;stateExcerpt:string|null;usage:unknown};
export type MarketResult = {
 schema:'escrowpal.market-analysis.v1';inferenceMode?:'recorded'|'live'|'unavailable';recordedExampleNotice?:string;createdAt:string;input:MarketInput;stages:string[];
 evidence:{sourceCount:number;candidateCount:number;freshSourceCount:number;flags:string[];policyBlocks:string[];verifiedSources:false};
 signals:{minQuotedPrice:number;medianQuotedPrice:number;maxQuotedPrice:number;affordableCandidateIds:string[];observedCtr:{id:string;percent:number|null;sampleImpressions:number|null}[]};
 decision:LayaDecision;benchmark:typeof researchEvidence;paymentPolicy:{automaticCapture:false;currency:'USD';budget:number;sellerMustAccept:true;humanDecisionRequired:true};
};
export function marketSignals(input:MarketInput,now=new Date()){
 const amounts=input.options.map(o=>o.quotedPrice).sort((a,b)=>a-b),mid=Math.floor(amounts.length/2);
 const flags:string[]=[],policyBlocks:string[]=[];
 const sourced=input.options.filter(o=>o.sourceUrl&&o.observedOn),fresh=sourced.filter(o=>{const age=now.getTime()-Date.parse(o.observedOn);return age>=-864e5&&age<=90*864e5;});
 if(sourced.length<input.options.length)flags.push('Some candidates need a dated source reference.');
 if(fresh.length<sourced.length)flags.push('Some source dates are in the future or more than 90 days old.');
 if(fresh.length<2)policyBlocks.push('At least two candidates need a reference observed within the past 90 days.');
 const affordable=input.options.filter(o=>o.quotedPrice<=input.budget).map(o=>o.id);
 if(!affordable.length)policyBlocks.push('No quoted candidate fits the pilot budget.');
 if(/ignore (all|previous)|system prompt|release (all|the funds)|approve this|you are now/i.test(JSON.stringify(input)))policyBlocks.push('The brief contains instructions aimed at the reviewer. Rewrite them as factual evidence.');
 if(input.fictional)flags.push('All sample observations and source links are fictional.');
 flags.push('Source references are supplied by the user; this pipeline has not independently verified their contents.');
 return {
  evidence:{sourceCount:sourced.length,candidateCount:input.options.length,freshSourceCount:fresh.length,flags,policyBlocks,verifiedSources:false as const},
  signals:{minQuotedPrice:amounts[0],medianQuotedPrice:amounts.length%2?amounts[mid]:(amounts[mid-1]+amounts[mid])/2,maxQuotedPrice:amounts[amounts.length-1],affordableCandidateIds:affordable,observedCtr:input.options.map(o=>({id:o.id,percent:o.impressions&&o.clicks!=null?o.clicks/o.impressions*100:null,sampleImpressions:o.impressions||null}))}
 };
}
export function sampleMarket():MarketInput{
 const day=new Date().toISOString().slice(0,10);
 return {title:'Sweet Crumb · neighborhood launch',objective:'Choose a small, measurable launch channel for a fictional bakery website. Prioritize local reach and a testable response over broad exposure.',audience:'Neighbors within five miles of a fictional bakery',budget:1200,fictional:true,options:[
  {id:'newsletter',label:'Neighborhood newsletter',channel:'email',offer:'A sponsored issue with a tracked menu link and a simple discount code.',quotedPrice:240,sourceUrl:'https://example.com/fictional-newsletter-quote',observedOn:day,impressions:2400,clicks:96},
  {id:'social',label:'Local social creator',channel:'creator',offer:'One launch post with a tracked link; broad local followers, uncertain purchase intent.',quotedPrice:480,sourceUrl:'https://example.com/fictional-creator-quote',observedOn:day,impressions:8000,clicks:80},
  {id:'search',label:'Neighborhood search pilot',channel:'search',offer:'A short local search test with a dedicated landing page and weekly report.',quotedPrice:360,sourceUrl:'https://example.com/fictional-search-quote',observedOn:day,impressions:3000,clicks:90}
 ]};
}
