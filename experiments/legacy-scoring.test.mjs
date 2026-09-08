import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSemanticPlan } from '../app/semantic-model.ts';
import { interpretLocally } from '../app/semantic-interpreter.ts';
import { scoreLegacyPlan } from './scoring-v1.mjs';
import { dataset } from './dataset.mjs';

const good = () => interpretLocally('手机电量只剩18%，预计还能使用2小时，开启省电模式。');
test('legacy v1 strict validator remains reproducible', () => {
  assert.deepEqual(validateSemanticPlan(good()), []);
  for (const mutate of [p=>delete p.title,p=>p.domain='madeUp',p=>p.x=12,p=>p.actionEvent='enable_saving',p=>p.progressValue=101,p=>p.confidence=NaN,p=>p.rationale=['one'],p=>p.icon='unknown',p=>p.title='']) {
    const plan=good(); mutate(plan); assert.ok(validateSemanticPlan(plan).length);
  }
});
test('legacy normalization cannot hide schema or fact errors', () => {
  const raw={...good(), actionEvent:'enable_saving',value:'82',progressValue:82};
  const result=scoreLegacyPlan(raw,dataset[0]);
  assert.equal(result.schemaPass,false); assert.equal(result.semanticPass,false);
  assert.equal(result.dslPass,true); assert.equal(result.enginePass,true); assert.equal(result.jointPass,false);
});
test('legacy dataset remains frozen at 132 records', () => {
  assert.equal(dataset.length,132); assert.equal(new Set(dataset.map(sample=>sample.id)).size,132);
});
