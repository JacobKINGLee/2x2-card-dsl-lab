import { writeFile } from 'node:fs/promises';
import { default as worker } from '../dist/server/index.js';
const start = performance.now();
const response = await worker.fetch(new Request('http://localhost/api/interpret', {
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({mode:'auto',text:'手机电量只剩18%，预计还能使用2小时，提供开启省电模式按钮。'}),
}), {ASSETS:{fetch:async()=>new Response('Not found',{status:404})}}, {waitUntil(){},passThroughOnException(){}});
const result=await response.json();
await writeFile('experiments/results/route-smoke.json',JSON.stringify({date:new Date().toISOString(),status:response.status,latencyMs:performance.now()-start,result},null,2));
console.log(JSON.stringify({status:response.status,source:result.source,provider:result.provider,model:result.model,domain:result.plan?.domain,visualization:result.plan?.visualization}));
if(response.status!==200||result.source!=='llm'||result.provider!=='aliyun')process.exitCode=1;
