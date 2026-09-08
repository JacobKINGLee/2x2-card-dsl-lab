import assert from 'node:assert/strict';
import test from 'node:test';
import { extractSemanticsLocally } from '../app/local-semantic-extractor.ts';
import { qwenSemanticRequest, validateSemanticDocument } from '../app/semantic-model.ts';
import { datasetV2, datasetV2Metadata } from './dataset-v2.mjs';
import { scoreConfirmedRuleLayer, scoreEndToEnd, scoreSemanticExtraction } from './scoring.mjs';

test('SemanticDocument v2 validator rejects component-era and internally invalid output', () => {
  const valid = datasetV2[0].confirmedSemantics;
  assert.deepEqual(validateSemanticDocument(valid), []);
  assert.ok(validateSemanticDocument({domain:'energy',visualization:'miniProgress'}).length);
  assert.ok(validateSemanticDocument({...valid,facts:[{...valid.facts[0],value:null,status:'missing'}]}).length === 0);
  assert.ok(validateSemanticDocument({...valid,facts:[{...valid.facts[0],scale:{min:100,max:0}}]}).some(error=>error.includes('scale')));
});

test('all calibration samples have valid confirmed semantics and deterministic rule expectations', () => {
  assert.equal(datasetV2Metadata.independent,false);
  assert.equal(new Set(datasetV2.map(sample=>sample.id)).size,datasetV2.length);
  for (const sample of datasetV2) {
    const result = scoreConfirmedRuleLayer(sample);
    assert.equal(result.confirmedSchemaPass,true,`${sample.id}: ${result.confirmedSchemaErrors?.join(';')}`);
    assert.equal(result.ruleOnlyPass,true,`${sample.id}: ${JSON.stringify(result.ruleOnlyAssertions)}`);
  }
});

test('model understanding score is independent from component decision score', () => {
  const sample = datasetV2[0];
  const wrong = structuredClone(sample.confirmedSemantics);
  wrong.facts[0].value = '82';
  const semantic = scoreSemanticExtraction(wrong,sample);
  assert.equal(semantic.schemaPass,true);
  assert.equal(semantic.semanticPass,false);
  const endToEnd = scoreEndToEnd(wrong,sample);
  assert.equal(endToEnd.status,'ready');
  assert.equal(endToEnd.incorrectCard,true);
  assert.equal(endToEnd.correctCard,false);
});

test('non-ready outcomes are credited only when semantics and decision both agree', () => {
  const sample = datasetV2.find(item=>item.id==='cal-06');
  const result = scoreEndToEnd(sample.confirmedSemantics,sample);
  assert.equal(result.semanticPass,true);
  assert.equal(result.decisionPass,true);
  assert.equal(result.appropriateNonReady,true);
  assert.equal(result.incorrectCard,false);
});

test('local extractor runs through the same v2 layered scorer', () => {
  for (const sample of datasetV2) {
    const raw = extractSemanticsLocally(sample.text);
    assert.deepEqual(validateSemanticDocument(raw),[],sample.id);
    const result = scoreEndToEnd(raw,sample);
    assert.equal(typeof result.semanticPass,'boolean');
    assert.equal(typeof result.decisionPass,'boolean');
  }
});

test('Qwen request asks only for SemanticDocument and never exposes executable event fields', () => {
  const request = qwenSemanticRequest('手机电量18%', 'qwen3-8b');
  assert.equal(request.tools[0].function.name,'emit_card_semantics');
  const schema = JSON.stringify(request.tools[0].function.parameters);
  assert.match(schema,/"facts"/);
  assert.match(schema,/"actions"/);
  assert.doesNotMatch(schema,/actionEvent|visualization|progressRing|capsuleButton/);
});
