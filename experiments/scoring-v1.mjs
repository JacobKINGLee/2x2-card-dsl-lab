import { validateSemanticPlan } from '../app/semantic-model.ts';
import { normalizeSemanticPlan, planToDSL } from '../app/semantic-interpreter.ts';
import { parseElementDSL, solveLayout } from '../app/layout-engine.ts';

// Frozen legacy scorer for reproducing the first Semantic Plan experiment.
export function scoreLegacyPlan(raw, sample) {
  const schemaErrors = validateSemanticPlan(raw);
  const plan = normalizeSemanticPlan(raw);
  const changes = Object.keys(plan).filter(key => JSON.stringify(raw?.[key]) !== JSON.stringify(plan[key]));
  const assertions = {};
  if (sample.expected) {
    const e = sample.expected;
    assertions.domain = raw?.domain === e.domain;
    assertions.visualization = raw?.visualization === e.visualization;
    let value = typeof raw?.value === 'string' ? raw.value.trim() : '';
    const unit = typeof raw?.unit === 'string' ? raw.unit.trim() : null;
    if (unit && value.endsWith(unit)) value = value.slice(0,-unit.length).trim();
    assertions.value = e.value.some(expected => value === expected || (value !== '' && Number.isFinite(Number(expected)) && Number(value) === Number(expected)));
    assertions.unit = e.unit.includes(unit);
    if ('progressValue' in e) assertions.progressValue = raw?.progressValue === e.progressValue;
    if (e.state) assertions.state = e.state.includes(raw?.state);
    if (e.emphasis) assertions.emphasis = raw?.emphasis === e.emphasis;
    assertions.actionLabel = typeof raw?.actionLabel === 'string' && e.actionTerms.some(term => raw.actionLabel.includes(term));
  }
  const dsl = planToDSL(plan);
  const parsed = parseElementDSL(JSON.stringify(dsl));
  const layout = parsed.data ? solveLayout(parsed.data) : null;
  const semanticPass = sample.scope === 'core' ? Object.values(assertions).every(Boolean) : null;
  const enginePass = layout?.status === 'solved' && layout?.quality.status !== 'rejected';
  return { schemaErrors, schemaPass: schemaErrors.length === 0, changes, assertions, semanticPass,
    dslPass: !!parsed.data, dslErrors: parsed.errors, enginePass,
    jointPass: sample.scope === 'core' ? schemaErrors.length === 0 && semanticPass && enginePass : null,
    plan, dsl, layout };
}

export const scorePlan = scoreLegacyPlan;
