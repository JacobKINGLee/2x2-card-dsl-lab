import type { VisualDomain, VisualEmphasis } from "./visual-resolver";

export type SemanticDataType =
  | "absolute"
  | "percentage"
  | "score"
  | "duration"
  | "time"
  | "capacity"
  | "count"
  | "text"
  | "missing"
  | "image";

export type SemanticFact = {
  id: string;
  subject: string;
  label: string;
  value: string | null;
  unit: string;
  dataType: SemanticDataType;
  progressSemantics: "none" | "bounded_measurement" | "completion";
  scale: { min: number; max: number } | null;
  polarity: "asserted" | "negated";
  status: "current" | "superseded" | "conflicting" | "missing";
  role: "primary" | "secondary" | "parallel";
  required: boolean;
  source: string;
};

export type SemanticActionRequest = {
  intent: string;
  label: string;
  target: string;
  required: boolean;
};

export type SemanticDocument = {
  version: "2.0";
  task: "card" | "non_card";
  domain: VisualDomain;
  topic: string;
  state: string;
  emphasis: VisualEmphasis;
  facts: SemanticFact[];
  actions: {
    mode: "unmentioned" | "forbidden_all" | "specified";
    requests: SemanticActionRequest[];
    forbiddenIntents: string[];
  };
  presentation: {
    title: "default" | "show" | "hide";
    primaryVisual: "default" | "big_number" | "progress_bar" | "ring";
    button: "default" | "icon" | "capsule";
  };
  ambiguities: Array<{
    code: string;
    factIds: string[];
    question: string;
  }>;
};

const domains: VisualDomain[] = [
  "weather", "wellness", "fitness", "system", "energy", "productivity", "environment", "generic",
];
const emphases: VisualEmphasis[] = ["quiet", "standard", "high"];
const dataTypes: SemanticDataType[] = [
  "absolute", "percentage", "score", "duration", "time", "capacity", "count", "text", "missing", "image",
];

const nullableString = { anyOf: [{ type: "string", minLength: 1, maxLength: 300 }, { type: "null" }] };
const nullableScale = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["min", "max"],
      properties: {
        min: { type: "number" },
        max: { type: "number" },
      },
    },
    { type: "null" },
  ],
};

export const semanticDocumentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "task", "domain", "topic", "state", "emphasis", "facts", "actions", "presentation", "ambiguities"],
  properties: {
    version: { type: "string", enum: ["2.0"] },
    task: { type: "string", enum: ["card", "non_card"] },
    domain: { type: "string", enum: domains },
    topic: { type: "string", minLength: 1, maxLength: 30 },
    state: { type: "string", minLength: 1, maxLength: 24 },
    emphasis: { type: "string", enum: emphases },
    facts: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "subject", "label", "value", "unit", "dataType", "progressSemantics", "scale", "polarity", "status", "role", "required", "source"],
        properties: {
          id: { type: "string", pattern: "^[a-z][A-Za-z0-9]{0,31}$" },
          subject: { type: "string", minLength: 1, maxLength: 40 },
          label: { type: "string", minLength: 1, maxLength: 24 },
          value: nullableString,
          unit: { type: "string", maxLength: 16 },
          dataType: { type: "string", enum: dataTypes },
          progressSemantics: { type: "string", enum: ["none", "bounded_measurement", "completion"] },
          scale: nullableScale,
          polarity: { type: "string", enum: ["asserted", "negated"] },
          status: { type: "string", enum: ["current", "superseded", "conflicting", "missing"] },
          role: { type: "string", enum: ["primary", "secondary", "parallel"] },
          required: { type: "boolean" },
          source: { type: "string", minLength: 1, maxLength: 160 },
        },
      },
    },
    actions: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "requests", "forbiddenIntents"],
      properties: {
        mode: { type: "string", enum: ["unmentioned", "forbidden_all", "specified"] },
        requests: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["intent", "label", "target", "required"],
            properties: {
              intent: { type: "string", pattern: "^[a-z][A-Za-z0-9]{1,39}$" },
              label: { type: "string", minLength: 1, maxLength: 24 },
              target: { type: "string", minLength: 1, maxLength: 40 },
              required: { type: "boolean" },
            },
          },
        },
        forbiddenIntents: {
          type: "array",
          maxItems: 8,
          items: { type: "string", pattern: "^[a-z][A-Za-z0-9]{1,39}$" },
        },
      },
    },
    presentation: {
      type: "object",
      additionalProperties: false,
      required: ["title", "primaryVisual", "button"],
      properties: {
        title: { type: "string", enum: ["default", "show", "hide"] },
        primaryVisual: { type: "string", enum: ["default", "big_number", "progress_bar", "ring"] },
        button: { type: "string", enum: ["default", "icon", "capsule"] },
      },
    },
    ambiguities: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "factIds", "question"],
        properties: {
          code: { type: "string", pattern: "^[a-z][a-z0-9_]{1,39}$" },
          factIds: { type: "array", minItems: 1, maxItems: 8, items: { type: "string", pattern: "^[a-z][A-Za-z0-9]{0,31}$" } },
          question: { type: "string", minLength: 1, maxLength: 120 },
        },
      },
    },
  },
} as const;

function visitSchema(data: unknown, schema: Record<string, unknown>, path: string): string[] {
  const problems: string[] = [];
  const supported = new Set(["type", "additionalProperties", "required", "properties", "enum", "minLength", "maxLength", "minimum", "maximum", "pattern", "anyOf", "minItems", "maxItems", "items"]);
  for (const keyword of Object.keys(schema)) if (!supported.has(keyword)) throw new Error(`Unsupported schema keyword: ${keyword}`);
  if (Array.isArray(schema.anyOf)) {
    if (!schema.anyOf.some((branch) => visitSchema(data, branch as Record<string, unknown>, path).length === 0)) problems.push(`${path}: anyOf`);
    return problems;
  }
  const kind = data === null ? "null" : Array.isArray(data) ? "array" : typeof data;
  if (schema.type && kind !== schema.type) return [`${path}: expected ${schema.type}, got ${kind}`];
  if (Array.isArray(schema.enum) && !schema.enum.includes(data)) problems.push(`${path}: enum`);
  if (typeof data === "string") {
    const length = [...data].length;
    if (typeof schema.minLength === "number" && length < schema.minLength) problems.push(`${path}: minLength`);
    if (typeof schema.maxLength === "number" && length > schema.maxLength) problems.push(`${path}: maxLength`);
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(data)) problems.push(`${path}: pattern`);
  }
  if (typeof data === "number" && (!Number.isFinite(data) ||
    (typeof schema.minimum === "number" && data < schema.minimum) ||
    (typeof schema.maximum === "number" && data > schema.maximum))) problems.push(`${path}: number bounds`);
  if (Array.isArray(data)) {
    if (typeof schema.minItems === "number" && data.length < schema.minItems) problems.push(`${path}: minItems`);
    if (typeof schema.maxItems === "number" && data.length > schema.maxItems) problems.push(`${path}: maxItems`);
    if (schema.items) data.forEach((item, index) => problems.push(...visitSchema(item, schema.items as Record<string, unknown>, `${path}[${index}]`)));
  } else if (data !== null && typeof data === "object") {
    const object = data as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    for (const key of (schema.required ?? []) as string[]) if (!Object.hasOwn(object, key)) problems.push(`${path}.${key}: required`);
    for (const [key, item] of Object.entries(object)) {
      if (Object.hasOwn(properties, key)) problems.push(...visitSchema(item, properties[key], `${path}.${key}`));
      else if (schema.additionalProperties === false) problems.push(`${path}.${key}: additionalProperties`);
    }
  }
  return problems;
}

export function validateSemanticDocument(value: unknown): string[] {
  const errors = visitSchema(value, semanticDocumentSchema, "$.");
  if (errors.length || typeof value !== "object" || value === null || Array.isArray(value)) return errors;
  const document = value as SemanticDocument;
  const ids = new Set<string>();
  document.facts.forEach((fact, index) => {
    if (ids.has(fact.id)) errors.push(`$.facts[${index}].id: duplicate`);
    ids.add(fact.id);
    if (fact.scale && fact.scale.max <= fact.scale.min) errors.push(`$.facts[${index}].scale: max must exceed min`);
    if (fact.status === "missing" && fact.value !== null) errors.push(`$.facts[${index}].value: missing fact must be null`);
    if (fact.dataType === "missing" && fact.status !== "missing") errors.push(`$.facts[${index}].status: missing dataType requires missing status`);
  });
  document.ambiguities.forEach((ambiguity, index) => ambiguity.factIds.forEach((id) => {
    if (!ids.has(id)) errors.push(`$.ambiguities[${index}].factIds: unknown ${id}`);
  }));
  if (document.task === "non_card" && document.facts.length > 0) errors.push("$.facts: non_card must not contain card facts");
  if (document.actions.mode === "unmentioned" && (document.actions.requests.length > 0 || document.actions.forbiddenIntents.length > 0)) {
    errors.push("$.actions: unmentioned cannot contain requests or prohibitions");
  }
  if (document.actions.mode === "forbidden_all" && document.actions.requests.length > 0) {
    errors.push("$.actions: forbidden_all cannot contain requests");
  }
  return errors;
}
