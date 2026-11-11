import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { Laya } from '@receptron/laya';
import { hashes,fileHash,revision } from './prepare.mjs';
const root=resolve(process.env.LAYA_MODEL_DIR||'model'),port=Number(process.env.LAYA_PORT||4180),host=process.env.LAYA_HOST||'127.0.0.1';
const key=process.env.LAYA_API_KEY||'';
if(!['127.0.0.1','::1','localhost'].includes(host)&&key.length<24)throw Error('A nonlocal model endpoint requires a strong LAYA_API_KEY.');
let agent=null,busy=false,failure=false;
function same(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function reply(res,status,data){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));}
const server=createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return reply(res,agent?200:503,{ready:!!agent,loading:!agent&&!failure,failed:failure,model:'convaiinnovations/laya',revision,runtime:'onnx-cpu',checkpointScope:'public-pretrained'});
 if(req.method!=='POST'||req.url!=='/v1/systemone')return reply(res,404,{error:'Unknown model endpoint.'});
 if(key&&!same(req.headers.authorization||'','Bearer '+key))return reply(res,401,{error:'Model authorization required.'});
 if(!agent)return reply(res,503,{error:'Laya is not ready.'});
 if(busy)return reply(res,429,{error:'Laya is busy. Retry after the current analysis.'});
 let raw='',ownsSlot=false;req.setTimeout(60000,()=>req.destroy());
 try{
  for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>12000)throw Error('Model request is too large.');}
  const body=JSON.parse(raw);const qs=body.questions;
  if(!body.state||!qs||Object.keys(qs).length>2||Object.keys(qs).length<1)throw Error('Use a bounded state and one or two choice questions.');
  for(const q of Object.values(qs))if(q.type!=='choice'||!q.criteria||Object.keys(q.criteria).length>3||Object.keys(q.criteria).length<2)throw Error('Two or three explicit choice options are required.');
  if(busy)return reply(res,429,{error:'Laya is busy.'});
  ownsSlot=true;busy=true;const started=performance.now();const result=await agent.systemOne(body.state,qs);
  reply(res,200,{...result,engine:'Laya',runtime:'onnx-cpu',revision,checkpointScope:'public-pretrained',elapsedMs:Math.round(performance.now()-started)});
 }catch(e){reply(res,400,{error:e instanceof SyntaxError?'Send valid JSON.':'The bounded model request could not run.'});}
 finally{if(ownsSlot)busy=false;}
});
server.listen(port,host,async()=>{
 try{for(const [name,hash] of Object.entries(hashes))if(await fileHash(resolve(root,name))!==hash)throw Error('Model integrity check failed.');
  agent=await Laya.load({modelDir:root,executionProviders:['cpu'],sessionOptions:{intraOpNumThreads:2,interOpNumThreads:1,graphOptimizationLevel:'disabled',enableCpuMemArena:false,enableMemPattern:false}});
  console.log(JSON.stringify({ready:true,model:'convaiinnovations/laya',revision,runtime:'onnx-cpu'}));
 }catch(e){failure=true;console.error(e?.message||'Model load failed');}
});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close(async()=>{await agent?.close();process.exit(0);});setTimeout(()=>process.exit(0),10000).unref();});
