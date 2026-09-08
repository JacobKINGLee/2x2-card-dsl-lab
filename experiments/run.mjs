import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { datasetV2, datasetV2Metadata } from './dataset-v2.mjs';
import { scoreConfirmedRuleLayer, scoreEndToEnd } from './scoring.mjs';
import { qwenSemanticRequest } from '../app/semantic-model.ts';
import { extractSemanticsLocally } from '../app/local-semantic-extractor.ts';

const args = process.argv.slice(2);
const option = (name, fallback=null) => args.includes(name) ? args[args.indexOf(name)+1] : fallback;
const provider = option('--provider','local');
if (!['aliyun','local'].includes(provider)) throw new Error('Unsupported provider');
const datasetPath = option('--dataset');
let datasetBundle = {metadata:datasetV2Metadata,samples:datasetV2};
if (datasetPath) {
  if (datasetPath.endsWith('.mjs')) {
    const datasetModule = await import(pathToFileURL(resolve(datasetPath)).href);
    if (!Array.isArray(datasetModule.dataset) || !datasetModule.metadata) throw new Error('Dataset module must export metadata and dataset');
    datasetBundle = {metadata:datasetModule.metadata,samples:datasetModule.dataset};
  } else {
    const parsed = JSON.parse(await readFile(datasetPath,'utf8'));
    if (!parsed || !Array.isArray(parsed.samples)) throw new Error('Dataset JSON must contain samples[]');
    datasetBundle = {metadata:{name:parsed.name,independent:parsed.independent,purpose:parsed.purpose},samples:parsed.samples};
  }
}
if (provider === 'aliyun' && !datasetPath) throw new Error('Qwen v2 runs require an explicit --dataset path; the built-in calibration set is not independent');
if (provider === 'aliyun' && datasetBundle.metadata.independent !== true) throw new Error('Qwen conclusion runs require dataset.independent=true');
const limit = Number(option('--limit',String(datasetBundle.samples.length)));
const concurrency = Number(option('--concurrency','2'));
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4 || !Number.isInteger(limit) || limit < 1) throw new Error('Invalid run bounds');
const label = option('--label',`${provider}-semantic-v2-${new Date().toISOString().replace(/[:.]/g,'-')}`);
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Invalid label');
const samples = datasetBundle.samples.slice(0,limit);
if (!samples.length) throw new Error('Dataset is empty');
for (const sample of samples) {
  if (!sample.id || !sample.text || !sample.expected || !sample.confirmedSemantics) throw new Error(`Incomplete dataset sample: ${sample.id ?? '<unknown>'}`);
  const rule = scoreConfirmedRuleLayer(sample);
  if (!rule.confirmedSchemaPass || !rule.ruleOnlyPass) throw new Error(`Dataset preflight failed for ${sample.id}: ${JSON.stringify(rule)}`);
}
if (args.includes('--preflight')) {
  console.log(`Preflight passed: ${samples.length} samples from ${datasetBundle.metadata.name}`);
  process.exit(0);
}

const directory = `experiments/results/${label}`;
await mkdir(directory,{recursive:true});
const model = provider === 'local' ? 'deterministic-local-extractor-v2' : process.env.ALIYUN_MAAS_MODEL || 'qwen3-8b';
const key = process.env.ALIYUN_MAAS_API_KEY;
const base = process.env.ALIYUN_MAAS_BASE_URL;
if (provider === 'aliyun' && (!key || !base)) throw new Error('Missing Aliyun configuration');
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceHashes = {};
for (const file of ['experiments/scoring.mjs','app/semantic-protocol.ts','app/semantic-model.ts','app/component-decision.ts','app/delivery-gate.ts','app/layout-engine.ts']) sourceHashes[file] = hash(await readFile(file));
const metadata = {
  startedAt:new Date().toISOString(),provider,model,endpoint:provider === 'aliyun' ? base : null,
  protocolVersion:'semantic-v0.2',policyVersion:'ux-component-v0.1',dataset:datasetBundle.metadata,
  concurrency,retries:0,fallback:false,sampleCount:samples.length,datasetHash:hash(JSON.stringify(samples)),sourceHashes,
  requestTemplate:provider === 'aliyun' ? qwenSemanticRequest('{{text}}',model) : null,
  limitations:['Cloud API, not on-device inference','Independent flag is dataset-author attestation','Automated assertions require human audit','Layout uses current project text measurement path'],
};
await writeFile(`${directory}/metadata.json`,JSON.stringify(metadata,null,2),{flag:'wx'});
await writeFile(`${directory}/dataset.json`,JSON.stringify(samples,null,2));

const records = [];
let cursor = 0;
async function work() {
  while (cursor < samples.length) {
    const sample = samples[cursor++];
    const record = {id:sample.id,split:sample.split,category:sample.category,text:sample.text};
    const start = performance.now();
    try {
      let raw;
      if (provider === 'local') {
        raw = extractSemanticsLocally(sample.text);
        Object.assign(record,{transportPass:true,jsonPass:true,toolPass:true});
      } else {
        const response = await fetch(`${base.replace(/\/+$/,'')}/chat/completions`,{
          method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
          body:JSON.stringify(qwenSemanticRequest(sample.text,model)),signal:AbortSignal.timeout(60000),
        });
        const body = (await response.text()).replaceAll(key,'[REDACTED]');
        Object.assign(record,{httpStatus:response.status,transportPass:response.ok,responseBody:body});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = JSON.parse(body);
        Object.assign(record,{responseModel:payload.model,usage:payload.usage,finishReason:payload.choices?.[0]?.finish_reason});
        const calls = payload.choices?.[0]?.message?.tool_calls;
        record.toolPass = calls?.length === 1 && calls[0].function?.name === 'emit_card_semantics';
        if (!record.toolPass) throw new Error('Expected exactly one SemanticDocument tool call');
        raw = JSON.parse(calls[0].function.arguments);
        record.jsonPass = true;
      }
      record.rawSemantics = raw;
      Object.assign(record,scoreEndToEnd(raw,sample));
      const ruleOnly = scoreConfirmedRuleLayer(sample);
      record.ruleOnlyPass = ruleOnly.ruleOnlyPass;
      record.ruleOnlyAssertions = ruleOnly.ruleOnlyAssertions;
    } catch (error) {
      record.error = String(error.message).replaceAll(key || '__NO_KEY__','[REDACTED]');
      if (error.cause?.code) record.errorCode = error.cause.code;
    }
    record.latencyMs = performance.now()-start;
    records.push(record);
    await appendFile(`${directory}/records.jsonl`,JSON.stringify(record)+'\n');
    console.log(`${records.length}/${samples.length} ${record.id} schema=${!!record.schemaPass} semantic=${record.semanticPass ?? '-'} decision=${record.decisionPass ?? '-'} delivery=${record.deliveryStatus ?? '-'} incorrect=${!!record.incorrectCard}`);
    if ([401,403].includes(record.httpStatus) || record.errorCode === 'EACCES') cursor = samples.length;
  }
}
await Promise.all(Array.from({length:concurrency},work));

const metric = (group,field) => ({passed:group.filter(record=>record[field]===true).length,total:group.length});
const countRate = (group,field,eligible=group) => {
  const count = group.filter(record=>record[field]===true).length;
  return {count,total:eligible.length,rate:eligible.length ? count/eligible.length : null};
};
const times = records.map(record=>record.latencyMs).sort((a,b)=>a-b);
const expectedReady = records.filter(record=>samples.find(sample=>sample.id===record.id)?.expected?.decision?.status==='ready');
const expectedNonReady = records.filter(record=>samples.find(sample=>sample.id===record.id)?.expected?.decision?.status!=='ready');
const summary = {
  completedAt:new Date().toISOString(),expected:samples.length,completed:records.length,
  transport:metric(records,'transportPass'),json:metric(records,'jsonPass'),schema:metric(records,'schemaPass'),
  semanticUnderstanding:metric(records,'semanticPass'),ruleDecision:metric(records,'decisionPass'),ruleOnly:metric(records,'ruleOnlyPass'),
  correctCards:countRate(records,'correctCard',expectedReady),
  incorrectCards:countRate(records,'incorrectCard'),
  appropriateNonReady:countRate(records,'appropriateNonReady',expectedNonReady),
  deliverable:{passed:records.filter(record=>record.deliveryStatus==='deliverable').length,total:records.length},
  byCategory:Object.fromEntries([...new Set(records.map(record=>record.category))].map(category=>[category,{
    semantic:metric(records.filter(record=>record.category===category),'semanticPass'),
    decision:metric(records.filter(record=>record.category===category),'decisionPass'),
  }])),
  latencyMs:{p50:times[Math.ceil(times.length*.5)-1]??null,p95:times[Math.ceil(times.length*.95)-1]??null},
  promptTokens:records.reduce((sum,record)=>sum+(record.usage?.prompt_tokens||0),0),
  completionTokens:records.reduce((sum,record)=>sum+(record.usage?.completion_tokens||0),0),
  failures:records.filter(record=>!record.semanticPass || !record.decisionPass).map(record=>({id:record.id,error:record.error,semanticAssertions:record.semanticAssertions,decisionAssertions:record.decisionAssertions})),
};
await writeFile(`${directory}/summary.json`,JSON.stringify(summary,null,2));
console.log(`Saved ${directory}/summary.json`);
