import { marketInput,marketSignals,type MarketInput,type MarketResult } from '../../src/shared/market.js';
import { researchEvidence } from '../../src/shared/research-evidence.js';
import { layaDecision } from './laya.js';
import { allocateCents } from '../../src/shared/validation.js';
export async function analyzeMarket(raw:unknown,now=new Date()):Promise<MarketResult>{
 const input=marketInput.parse(raw),checks=marketSignals(input,now);
 const decision=checks.evidence.policyBlocks.length?{status:'needs_evidence' as const,engine:'Not run',runtime:null,revision:null,choiceId:null,listed:null,reversed:null,optionOrderStable:null,largestOrderChangePoints:null,elapsedMs:null,reason:checks.evidence.policyBlocks.join(' '),stateExcerpt:null,usage:null}:await layaDecision(input,checks.signals.affordableCandidateIds);
 return {schema:'escrowpal.market-analysis.v1',createdAt:now.toISOString(),input,...checks,decision,benchmark:researchEvidence,stages:['Validate declared evidence','Compute observed signals','Compare choices with Laya','Review pilot terms','Authorize PayPal sandbox milestones'],paymentPolicy:{automaticCapture:false,currency:'USD',budget:input.budget,sellerMustAccept:true,humanDecisionRequired:true}};
}
export function pilotPlan(input:MarketInput,selectedId:string){
 const selected=input.options.find(o=>o.id===selectedId);if(!selected||selected.quotedPrice>input.budget)throw Error('Choose a candidate that fits the pilot budget.');
 const amounts=allocateCents([1,2,1],input.budget);
 return {title:input.title+' · measured pilot',milestones:[
  {title:'Research & measurement plan',amount:amounts[0],dueInDays:3,criteria:['Verify the quoted channel and source references','Agree on a tracking method, baseline, and success criterion','Obtain buyer approval of the pilot scope']},
  {title:'Pilot delivery · '+selected.label,amount:amounts[1],dueInDays:7,criteria:['Deliver the agreed pilot assets or setup','Provide dated delivery evidence and tracking references','Document what was actually delivered and any deviations']},
  {title:'Results & handoff',amount:amounts[2],dueInDays:14,criteria:['Report observed counts with their denominators and date range','Separate measured outcomes from model preferences','Hand over the results and agree on next steps']}
 ]};
}
