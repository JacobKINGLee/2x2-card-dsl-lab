import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {dataset} from './dataset.mjs';
import {scorePlan} from './scoring.mjs';
const hashes=[];
for(const run of ['local-baseline','qwen-baseline','qwen-explicit-v1']) {
  const base=`experiments/results/${run}`;
  const records=(await readFile(`${base}/records.jsonl`,'utf8')).trim().split('\n').map(s=>JSON.parse(s));
  const metadata=JSON.parse(await readFile(`${base}/metadata.json`,'utf8'));
  const summary=JSON.parse(await readFile(`${base}/summary.json`,'utf8'));
  assert.equal(records.length,132); assert.equal(new Set(records.map(r=>r.id)).size,132);
  hashes.push(metadata.datasetHash);
  assert.equal(summary.completed,132);
  for(const record of records)if(record.rawPlan) {
    const rescored=scorePlan(record.rawPlan,dataset.find(s=>s.id===record.id));
    for(const field of ['schemaPass','semanticPass','jointPass','enginePass'])assert.equal(record[field],rescored[field],`${run}/${record.id}/${field}`);
  }
}
assert.equal(new Set(hashes).size,1,'All runs must use identical frozen inputs');
const key=process.env.ALIYUN_MAAS_API_KEY;
assert.ok(key,'Load local credential only for exact-match leakage check');
async function scan(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const path=`${dir}/${entry.name}`;
    if(entry.isDirectory())await scan(path);
    else assert.equal((await readFile(path)).includes(Buffer.from(key)),false,`Credential leaked into ${path}`);
  }
}
for(const dir of ['app','experiments','dist/client'])await scan(dir);
console.log('Verified 396 unique run records, identical datasets, reproducible scores, and no credential in app/experiment/client artifacts.');
