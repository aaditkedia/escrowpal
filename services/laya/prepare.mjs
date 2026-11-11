import { createHash } from 'node:crypto';
import { createReadStream,createWriteStream } from 'node:fs';
import { mkdir,rename,stat } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
export const revision='68f27dfe5a27a54fb2b1fefc432f43f972e90868';
export const hashes={'laya.onnx':'a874eb254b58b0fcb1e7ad56fbb188c29d64e08c9a46b689433e1f52c66dba1e','laya.onnx.data':'487746363a8da57bcadb4345352997d22a0fb90d70aa22c6856668d023242aba','laya_config.json':'5049005dc6ae3ca5e82cc7d85c421357d5c543817300c8e8c5281ddbc69bb561','tokenizer/tokenizer.json':'6c8aaa9a542084f2457eab775d4eeb51f92a70c0fd9de28d5edb0ddec3c08d30','tokenizer/tokenizer_config.json':'50044de60daaa73df97d262e15a40d4faf0160e7d742df64b377877a1320dd12'};
export async function fileHash(path){const h=createHash('sha256');for await(const c of createReadStream(path))h.update(c);return h.digest('hex');}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const root=resolve(process.env.LAYA_MODEL_DIR||'model');
 for(const [name,hash] of Object.entries(hashes)){
  const dest=resolve(root,name);await mkdir(dirname(dest),{recursive:true});
  if(!(await stat(dest).catch(()=>null))){const r=await fetch('https://huggingface.co/receptron/laya-onnx/resolve/'+revision+'/'+name);if(!r.ok)throw Error('Download failed: '+name);await pipeline(Readable.fromWeb(r.body),createWriteStream(dest+'.partial'));await rename(dest+'.partial',dest);}
  if(await fileHash(dest)!==hash)throw Error('Checksum mismatch: '+name);
  console.log('Verified '+name);
 }
 console.log('Pinned public Laya weights ready. They are not included in the source release.');
}
