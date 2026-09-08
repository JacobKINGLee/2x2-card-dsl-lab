import { compileComponentDecision, parseDecisionHostContext } from '../app/component-decision.ts';
import { applyDeliveryGate } from '../app/delivery-gate.ts';
import { validateSemanticDocument } from '../app/semantic-protocol.ts';

function equivalentValue(actual, expected) {
  if (actual === expected) return true;
  return actual !== null && expected !== null && actual !== '' && expected !== '' &&
    Number.isFinite(Number(actual)) && Number.isFinite(Number(expected)) && Number(actual) === Number(expected);
}

function factMatches(actual, expected) {
  return Object.entries(expected).every(([key, value]) => {
    if (key === 'value') return equivalentValue(actual.value, value);
    return actual[key] === value;
  });
}

export function scoreSemanticExtraction(raw, sample) {
  const schemaErrors = validateSemanticDocument(raw);
  const assertions = {};
  const expected = sample.expected?.semantics;
  if (expected) {
    const confirmed = sample.confirmedSemantics;
    assertions.task = raw?.task === confirmed.task;
    assertions.domain = raw?.domain === confirmed.domain;
    const confirmedFacts = confirmed.facts.map(fact => ({
      subject:fact.subject,value:fact.value,unit:fact.unit,dataType:fact.dataType,
      polarity:fact.polarity,status:fact.status,role:fact.role,required:fact.required,
    }));
    assertions.facts = confirmedFacts.every((wanted) => Array.isArray(raw?.facts) &&
      raw.facts.some((actual) => factMatches(actual,wanted)));
    assertions.factCount = raw?.facts?.length === confirmed.facts.length;
    if (expected.primarySubject) assertions.primary = Array.isArray(raw?.facts) &&
      raw.facts.some((fact) => fact.subject === expected.primarySubject && fact.role === 'primary' && fact.polarity === 'asserted' && fact.status === 'current');
    assertions.actionMode = raw?.actions?.mode === confirmed.actions.mode;
    const actualRequests = raw?.actions?.requests?.map(request=>`${request.intent}:${request.target}:${request.required}`).sort() ?? [];
    const confirmedRequests = confirmed.actions.requests.map(request=>`${request.intent}:${request.target}:${request.required}`).sort();
    assertions.requestedIntents = JSON.stringify(actualRequests) === JSON.stringify(confirmedRequests);
    assertions.forbiddenIntents = JSON.stringify([...(raw?.actions?.forbiddenIntents ?? [])].sort()) === JSON.stringify([...confirmed.actions.forbiddenIntents].sort());
    if (expected.primaryVisual) assertions.primaryVisual = raw?.presentation?.primaryVisual === expected.primaryVisual;
    if (typeof expected.ambiguityCount === 'number') assertions.ambiguities = raw?.ambiguities?.length === expected.ambiguityCount;
  }
  return {
    schemaErrors,
    schemaPass: schemaErrors.length === 0,
    semanticAssertions: assertions,
    semanticPass: schemaErrors.length === 0 && Object.values(assertions).every(Boolean),
  };
}

export function scoreRuleDecision(semantics, context, sample) {
  const parsedContext = parseDecisionHostContext(context);
  if (!parsedContext.data) return {
    contextErrors: parsedContext.errors,
    decisionAssertions: { context: false },
    decisionPass: false,
    result: null,
  };
  const result = applyDeliveryGate(compileComponentDecision(semantics, parsedContext.data));
  const expected = sample.expected?.decision ?? {};
  const assertions = {};
  if (expected.status) assertions.status = result.status === expected.status;
  if (expected.code) assertions.code = result.decision.code === expected.code;
  if (expected.components) {
    const actual = result.dsl?.elements.map((element) => element.type).sort() ?? [];
    assertions.components = JSON.stringify(actual) === JSON.stringify([...expected.components].sort());
  }
  if (expected.actionEvent) assertions.actionEvent = result.dsl?.elements.some((element) =>
    (element.type === 'iconButton' || element.type === 'capsuleButton') && element.event === expected.actionEvent) ?? false;
  if (expected.delivery) assertions.delivery = result.delivery.status === expected.delivery;
  if (result.status === 'ready' && result.dsl) {
    const serialized = JSON.stringify(result.dsl);
    const requiredFacts = semantics.facts.filter(fact=>fact.required && fact.polarity==='asserted' &&
      fact.status==='current' && fact.value !== null && !['image','missing'].includes(fact.dataType));
    assertions.factsPreserved = requiredFacts.every(fact=>
      serialized.includes(`${fact.value}${fact.unit}`) ||
      (serialized.includes(JSON.stringify(fact.value)) && (!fact.unit || serialized.includes(JSON.stringify(fact.unit)))));
  }
  return {
    contextErrors: [],
    decisionAssertions: assertions,
    decisionPass: Object.values(assertions).every(Boolean),
    result,
  };
}

export function scoreEndToEnd(raw, sample) {
  const semantic = scoreSemanticExtraction(raw, sample);
  if (!semantic.schemaPass) return {
    ...semantic,
    decisionAssertions: {},
    decisionPass: false,
    status: null,
    deliveryStatus: null,
    correctCard: false,
    incorrectCard: false,
    appropriateNonReady: false,
    result: null,
  };
  const decision = scoreRuleDecision(raw, sample.context ?? {}, sample);
  const status = decision.result?.status ?? null;
  const expectedStatus = sample.expected?.decision?.status;
  const expectedReady = expectedStatus === 'ready';
  return {
    ...semantic,
    ...decision,
    status,
    deliveryStatus: decision.result?.delivery.status ?? null,
    correctCard: expectedReady && semantic.semanticPass && decision.decisionPass && decision.result?.delivery.status === 'deliverable',
    incorrectCard: status === 'ready' && (!semantic.semanticPass || !decision.decisionPass),
    appropriateNonReady: !expectedReady && status === expectedStatus && semantic.semanticPass && decision.decisionPass,
  };
}

export function scoreConfirmedRuleLayer(sample) {
  const schemaErrors = validateSemanticDocument(sample.confirmedSemantics);
  if (schemaErrors.length) return { confirmedSchemaErrors: schemaErrors, confirmedSchemaPass: false, ruleOnlyPass: false };
  const scored = scoreRuleDecision(sample.confirmedSemantics, sample.context ?? {}, sample);
  return {
    confirmedSchemaErrors: [],
    confirmedSchemaPass: true,
    ruleOnlyPass: scored.decisionPass,
    ruleOnlyAssertions: scored.decisionAssertions,
    ruleOnlyResult: scored.result,
  };
}
