import type {
  AppIconElement,
  CardElement,
  ElementDSL,
  HeroMetricElement,
  IconButtonElement,
  MetricElement,
  MiniProgressElement,
  ProgressRingElement,
  TextElement,
} from "./layout-engine";
import type { SemanticDocument, SemanticFact } from "./semantic-protocol";
import type { VisualDomain } from "./visual-resolver";

export type RegisteredAction = {
  id: string;
  intents: string[];
  label: string;
  event: string;
  available?: boolean;
  target?: string;
  icon?: string;
  iconReviewed?: boolean;
};

export type DecisionHostContext = {
  version?: string;
  simulated?: boolean;
  actions?: RegisteredAction[];
  application?: {
    id: string;
    label: string;
    showSource?: boolean;
    singleSource?: boolean;
    resource?: { id: string; icon?: string; symbol?: string; verified: boolean };
  };
  image?: { id: string; src: string; alt: string; verified: boolean };
  policy?: { recommendedActionIds?: string[] };
};

export type DecisionTrace = {
  code: string;
  message: string;
  question?: string;
  alternatives: string[];
  selectedComponents: string[];
  matchedRules: string[];
  omitted: Array<{ item: string; reason: string }>;
  protocolVersion: "semantic-v0.2";
  policyVersion: "ux-component-v0.1";
  contextVersion: string;
};

export type ComponentDecision = {
  status: "ready" | "needs_clarification" | "unsupported" | "no_card";
  decision: DecisionTrace;
  dsl: ElementDSL | null;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shortText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && [...value].length <= max;
}

export function parseDecisionHostContext(value: unknown): { data: DecisionHostContext | null; errors: string[] } {
  if (value === undefined) return { data: {}, errors: [] };
  if (!record(value)) return { data: null, errors: ["context 必须是对象"] };
  const errors: string[] = [];
  const data: DecisionHostContext = {};
  if (value.version !== undefined) {
    if (shortText(value.version, 40)) data.version = value.version;
    else errors.push("context.version 必须是1–40字符的字符串");
  }
  if (value.simulated !== undefined) {
    if (typeof value.simulated === "boolean") data.simulated = value.simulated;
    else errors.push("context.simulated 必须是布尔值");
  }
  if (value.actions !== undefined) {
    if (!Array.isArray(value.actions) || value.actions.length > 20) errors.push("context.actions 必须是最多20项的数组");
    else data.actions = value.actions.flatMap((item, index) => {
      if (!record(item)) {
        errors.push(`context.actions[${index}] 必须是对象`);
        return [];
      }
      const intents = Array.isArray(item.intents) && item.intents.length > 0 && item.intents.every((intent) => shortText(intent, 40))
        ? item.intents as string[] : null;
      const eventValid = shortText(item.event, 40) && /^[a-z][A-Za-z0-9]{2,39}$/.test(item.event);
      if (!shortText(item.id, 40)) errors.push(`context.actions[${index}].id 无效`);
      if (!intents) errors.push(`context.actions[${index}].intents 无效`);
      if (!shortText(item.label, 24)) errors.push(`context.actions[${index}].label 无效`);
      if (!eventValid) errors.push(`context.actions[${index}].event 无效`);
      if (item.available !== undefined && typeof item.available !== "boolean") errors.push(`context.actions[${index}].available 无效`);
      if (item.target !== undefined && !shortText(item.target, 40)) errors.push(`context.actions[${index}].target 无效`);
      if (item.icon !== undefined && !shortText(item.icon, 40)) errors.push(`context.actions[${index}].icon 无效`);
      if (item.iconReviewed !== undefined && typeof item.iconReviewed !== "boolean") errors.push(`context.actions[${index}].iconReviewed 无效`);
      if (!shortText(item.id, 40) || !intents || !shortText(item.label, 24) || !eventValid) return [];
      return [{
        id: item.id,
        intents,
        label: item.label,
        event: item.event as string,
        ...(typeof item.available === "boolean" ? { available: item.available } : {}),
        ...(typeof item.target === "string" ? { target: item.target } : {}),
        ...(typeof item.icon === "string" ? { icon: item.icon } : {}),
        ...(typeof item.iconReviewed === "boolean" ? { iconReviewed: item.iconReviewed } : {}),
      }];
    });
  }
  if (value.application !== undefined) {
    if (!record(value.application)) errors.push("context.application 必须是对象");
    else {
      const app = value.application;
      if (!shortText(app.id, 60)) errors.push("context.application.id 无效");
      if (!shortText(app.label, 30)) errors.push("context.application.label 无效");
      if (app.showSource !== undefined && typeof app.showSource !== "boolean") errors.push("context.application.showSource 无效");
      if (app.singleSource !== undefined && typeof app.singleSource !== "boolean") errors.push("context.application.singleSource 无效");
      let resource: { id: string; icon?: string; symbol?: string; verified: boolean } | undefined;
      if (app.resource !== undefined) {
        if (!record(app.resource)) errors.push("context.application.resource 必须是对象");
        else {
          const icon = shortText(app.resource.icon, 40) ? app.resource.icon : undefined;
          const symbol = shortText(app.resource.symbol, 8) ? app.resource.symbol : undefined;
          if (!shortText(app.resource.id, 80)) errors.push("context.application.resource.id 无效");
          if (!icon && !symbol) errors.push("context.application.resource 至少需要 icon 或 symbol");
          if (typeof app.resource.verified !== "boolean") errors.push("context.application.resource.verified 必须是布尔值");
          if (shortText(app.resource.id, 80) && (icon || symbol) && typeof app.resource.verified === "boolean") {
            resource = { id: app.resource.id, verified: app.resource.verified, ...(icon ? { icon } : {}), ...(symbol ? { symbol } : {}) };
          }
        }
      }
      if (shortText(app.id, 60) && shortText(app.label, 30)) data.application = {
        id: app.id,
        label: app.label,
        ...(typeof app.showSource === "boolean" ? { showSource: app.showSource } : {}),
        ...(typeof app.singleSource === "boolean" ? { singleSource: app.singleSource } : {}),
        ...(resource ? { resource } : {}),
      };
    }
  }
  if (value.image !== undefined) {
    if (!record(value.image) || !shortText(value.image.id, 80) || !shortText(value.image.src, 500) ||
      !shortText(value.image.alt, 120) || typeof value.image.verified !== "boolean") {
      errors.push("context.image 必须包含 id、src、alt 和 verified");
    } else data.image = { id: value.image.id, src: value.image.src, alt: value.image.alt, verified: value.image.verified };
  }
  if (value.policy !== undefined) {
    if (!record(value.policy) || !Array.isArray(value.policy.recommendedActionIds) ||
      !value.policy.recommendedActionIds.every((id) => shortText(id, 40))) errors.push("context.policy.recommendedActionIds 必须是字符串数组");
    else data.policy = { recommendedActionIds: value.policy.recommendedActionIds as string[] };
  }
  return { data: errors.length ? null : data, errors };
}

const contentIcons: Partial<Record<VisualDomain, string>> = {
  weather: "cloud-rain",
  environment: "droplets",
  wellness: "activity",
  fitness: "activity",
  energy: "battery",
  productivity: "calendar",
  system: "sparkles",
};

function makeResult(
  status: ComponentDecision["status"],
  code: string,
  message: string,
  rules: string[],
  context: DecisionHostContext,
  extra: Partial<Pick<DecisionTrace, "question" | "alternatives" | "selectedComponents" | "omitted">> = {},
  dsl: ElementDSL | null = null,
): ComponentDecision {
  return {
    status,
    dsl,
    decision: {
      code,
      message,
      alternatives: extra.alternatives ?? [],
      selectedComponents: extra.selectedComponents ?? dsl?.elements.map((element) => element.type) ?? [],
      matchedRules: [...new Set(rules)],
      omitted: extra.omitted ?? [],
      protocolVersion: "semantic-v0.2",
      policyVersion: "ux-component-v0.1",
      contextVersion: context.version ?? "host-context-v0.1",
      ...(extra.question ? { question: extra.question } : {}),
    },
  };
}

function displayValue(fact: SemanticFact) {
  return `${fact.value ?? ""}${fact.unit}`;
}

function numericValue(fact: SemanticFact) {
  if (fact.value === null || fact.value.trim() === "") return null;
  const value = Number(fact.value.replaceAll(",", ""));
  return Number.isFinite(value) ? value : null;
}

function resolveAction(semantics: SemanticDocument, context: DecisionHostContext, rules: string[], omitted: DecisionTrace["omitted"]): CardElement | ComponentDecision | null {
  if (semantics.actions.mode === "forbidden_all") {
    rules.push("A01");
    omitted.push({ item: "action", reason: "结构化语义明确禁止所有操作入口" });
    return null;
  }
  const forbidden = new Set(semantics.actions.forbiddenIntents);
  const contradictory = semantics.actions.requests.filter((request) => forbidden.has(request.intent));
  if (contradictory.length > 0) return makeResult("needs_clarification", "contradictory_action", "同一动作同时被请求和禁止。", ["A02", "E03"], context, {
    question: `是否需要“${contradictory[0].label}”？`, alternatives: ["保留动作", "禁止动作"],
  });
  const requests = semantics.actions.requests.filter((request) => !forbidden.has(request.intent));
  const required = requests.filter((request) => request.required);
  if (required.length > 1) return makeResult("unsupported", "multiple_required_actions", "当前单卡最多支持一个必要操作。", ["A09"], context, {
    alternatives: ["拆分为多张卡片", "明确一个主动作并允许省略其他动作"],
  });
  const request = required[0] ?? requests[0];
  if (!request) {
    rules.push("A03");
    omitted.push({ item: "action", reason: semantics.actions.mode === "specified" ? "只有特定动作禁止，没有剩余动作请求" : "结构化语义未包含动作请求" });
    return null;
  }
  const allMatches = (context.actions ?? []).filter((capability) => capability.id === request.intent || capability.intents.includes(request.intent));
  const targetMatches = allMatches.filter((capability) => !capability.target || capability.target === request.target);
  const available = targetMatches.filter((capability) => capability.available !== false);
  if (available.length > 1) return makeResult("needs_clarification", "ambiguous_action", "动作意图匹配到多个可用能力。", ["A05"], context, {
    question: `“${request.label}”应使用哪个应用能力？`, alternatives: available.map((capability) => capability.label),
  });
  if (available.length === 0) {
    if (allMatches.length > 0 && targetMatches.length === 0) return makeResult("needs_clarification", "action_target_mismatch", "动作目标与注册能力目标不一致。", ["A05"], context, {
      question: `“${request.label}”要作用于哪个目标？`, alternatives: [request.target, ...allMatches.flatMap((item) => item.target ? [item.target] : [])],
    });
    const unavailable = targetMatches.length > 0;
    if (!request.required) {
      rules.push("A07");
      omitted.push({ item: request.label, reason: unavailable ? "可选动作当前不可用" : "可选动作未注册" });
      return null;
    }
    return makeResult("unsupported", unavailable ? "action_unavailable" : "unknown_action", unavailable
      ? `“${request.label}”对应的应用能力当前不可用。` : `无法从宿主能力注册表验证“${request.label}”。`, ["A06"], context, {
      alternatives: ["仅展示信息", "由宿主注册并启用该动作后重试"],
    });
  }
  const capability = available[0];
  if (semantics.presentation.button === "icon") {
    if (!capability.icon || !capability.iconReviewed) return makeResult("needs_clarification", "icon_action_unreviewed", "纯图标方案缺少已审核资源或语义证据。", ["A14"], context, {
      question: "是否接受使用带文字的胶囊按钮？", alternatives: ["使用胶囊按钮", "等待审核图标资源"],
    });
    rules.push("A04", "A12");
    return { id: "action", type: "iconButton", icon: capability.icon, label: capability.label, event: capability.event, placement: "bottom-end", priority: 100 } satisfies IconButtonElement;
  }
  rules.push("A04", "A11");
  return { id: "action", type: "capsuleButton", label: capability.label, event: capability.event, ...(capability.icon && capability.iconReviewed ? { icon: capability.icon } : {}), priority: 100 };
}

function primaryElement(fact: SemanticFact, semantics: SemanticDocument, context: DecisionHostContext, rules: string[]): CardElement | ComponentDecision {
  if (fact.dataType === "missing" || fact.status === "missing") {
    rules.push("E01", "C13", "V06");
    return { id: fact.id, type: "text", role: "body", text: `${fact.label}暂无数据`, maxLines: 3, priority: 100 } satisfies TextElement;
  }
  if (fact.value === null) return makeResult("needs_clarification", "missing_required_value", `必要事实“${fact.label}”没有可展示值。`, ["E02"], context, { question: `请提供“${fact.label}”的值。` });
  if (fact.dataType === "text") {
    if ([...fact.value].length > 36) return makeResult("unsupported", "required_text_too_long", "必要文字无法在当前 2×2 卡片中无损展示。", ["E08", "V06"], context, {
      alternatives: ["拆分卡片", "由用户确认可接受的短摘要"],
    });
    rules.push("C13", "V06");
    return { id: fact.id, type: "text", role: "body", text: fact.value, maxLines: 3, priority: 100 } satisfies TextElement;
  }
  const number = numericValue(fact);
  if (fact.dataType === "percentage") {
    if (number === null) return makeResult("needs_clarification", "invalid_percentage", `“${fact.label}”不是可计算的百分比。`, ["E03", "C11"], context, { question: `请确认“${fact.label}”的百分比值。` });
    if (number < 0 || (fact.progressSemantics === "bounded_measurement" && number > 100)) return makeResult("needs_clarification", "invalid_measurement", `“${fact.label}”超出有效量程，不能截断后当作正常数据。`, ["E03", "C11"], context, {
      question: `请确认“${fact.label} ${displayValue(fact)}”是否正确。`,
    });
    if (semantics.presentation.primaryVisual === "big_number") {
      rules.push("E05", "C10");
      return { id: fact.id, type: "heroMetric", value: fact.value, unit: fact.unit || undefined, label: fact.label, icon: contentIcons[semantics.domain], priority: 100 } satisfies HeroMetricElement;
    }
    const detail = fact.progressSemantics === "completion" && number > 100 ? `已超额完成 ${number - 100}%` : undefined;
    rules.push("C11");
    return { id: fact.id, type: "miniProgress", value: Math.min(100, number), displayValue: displayValue(fact), label: fact.label, ...(detail ? { detail } : {}), priority: 100 } satisfies MiniProgressElement;
  }
  if (fact.dataType === "score" && fact.scale) {
    const value = numericValue(fact);
    if (value === null || value < fact.scale.min || value > fact.scale.max) return makeResult("needs_clarification", "invalid_score", `“${fact.label}”超出明确量程。`, ["E03", "C12"], context, { question: `请确认“${fact.label}”的得分和量程。` });
    const fill = (value - fact.scale.min) / (fact.scale.max - fact.scale.min) * 100;
    rules.push("C12");
    return { id: fact.id, type: "progressRing", value: fill, displayValue: displayValue(fact), label: fact.label, detail: `满分 ${fact.scale.max}`, icon: contentIcons[semantics.domain], priority: 100 } satisfies ProgressRingElement;
  }
  rules.push("C10");
  return { id: fact.id, type: "heroMetric", value: fact.value, unit: fact.unit || undefined, label: fact.label, icon: contentIcons[semantics.domain], priority: 100 } satisfies HeroMetricElement;
}

function resolveContent(semantics: SemanticDocument, context: DecisionHostContext, rules: string[]): CardElement[] | ComponentDecision {
  if (semantics.ambiguities.length > 0) {
    const ambiguity = semantics.ambiguities[0];
    return makeResult("needs_clarification", ambiguity.code, "结构化语义包含会改变核心事实的歧义。", ["E03", "C08"], context, {
      question: ambiguity.question,
      alternatives: ambiguity.factIds.map((id) => {
        const item = semantics.facts.find((fact) => fact.id === id);
        return item ? displayValue(item) : id;
      }),
    });
  }
  const usable = semantics.facts.filter((fact) => fact.polarity === "asserted" && fact.status !== "superseded");
  if (usable.some((fact) => fact.status === "conflicting")) return makeResult("needs_clarification", "conflicting_fact", "结构化语义包含互相冲突的当前事实。", ["E03"], context, {
    question: "请确认应采用哪个事实。", alternatives: usable.filter((fact) => fact.status === "conflicting").map((fact) => `${fact.label} ${displayValue(fact)}`),
  });
  if (usable.length === 0) return makeResult("no_card", "no_displayable_fact", "没有可展示的已确认事实。", ["E02"], context);
  const imageFacts = usable.filter((fact) => fact.dataType === "image");
  const contentFacts = usable.filter((fact) => fact.dataType !== "image");
  if (imageFacts.length && contentFacts.length) return makeResult("unsupported", "image_metric_conflict", "当前 DSL 不能在单卡中同时表示图片和独立内容。", ["V05", "C06", "E08"], context, {
    alternatives: ["拆分为图片卡和信息卡", "明确只保留其中一种主体"],
  });
  if (imageFacts.length) {
    if (!context.image?.verified) return makeResult("unsupported", "unverified_image_resource", "图片是必要主体，但宿主没有证明资源可用。", ["V05"], context, {
      alternatives: ["由宿主解析资源并提供 verified=true"],
    });
    rules.push("V05");
    return [{ id: imageFacts[0].id, type: "image", src: context.image.src, alt: context.image.alt, priority: 100 }];
  }
  const parallel = usable.filter((fact) => fact.role === "parallel");
  if (parallel.length > 0) {
    if (parallel.length !== usable.length) return makeResult("unsupported", "mixed_information_structure", "并列指标与主次内容不能在当前 DSL 中无损混排。", ["C06"], context, { alternatives: ["全部并列展示", "指定一个主指标并允许其余作为辅助文字"] });
    if (parallel.length > 4) return makeResult("unsupported", "too_many_metrics", "必要并列指标超过当前单卡上限。", ["C07"], context, { alternatives: ["拆分为多张卡片"] });
    rules.push("C03", "C09");
    return parallel.map((fact) => ({ id: fact.id, type: "metric", label: fact.label, value: displayValue(fact), priority: 100 } satisfies MetricElement));
  }
  const primaries = usable.filter((fact) => fact.role === "primary");
  if (primaries.length !== 1) return makeResult("needs_clarification", "ambiguous_primary_fact", "无法唯一确定主内容。", ["C01", "C03"], context, {
    question: "请确认哪一项是主内容。", alternatives: primaries.map((fact) => fact.label),
  });
  const primary = primaryElement(primaries[0], semantics, context, rules);
  if ("status" in primary) return primary;
  const secondary = [
    ...usable.filter((fact) => fact.role === "secondary"),
    ...semantics.facts.filter((fact) => fact.polarity === "asserted" && fact.status === "superseded" && fact.role === "secondary"),
  ];
  if (secondary.length > 0) {
    if (primary.type !== "heroMetric" && primary.type !== "progressRing" && primary.type !== "miniProgress") {
      return makeResult("unsupported", "secondary_content_unsupported", "当前主体不能同时承载必要辅助事实。", ["C05", "E08"], context);
    }
    primary.detail = secondary.map((fact) => `${fact.label} ${displayValue(fact)}`).join("；");
    rules.push("C05");
  }
  return [primary];
}

function resolveAppIcon(context: DecisionHostContext, omitted: DecisionTrace["omitted"], rules: string[]): AppIconElement | null {
  const app = context.application;
  const resource = app?.resource;
  if (!app?.showSource || app.singleSource === false || !resource?.verified || (!resource.icon && !resource.symbol)) {
    rules.push("V02");
    omitted.push({ item: "appIcon", reason: app?.singleSource === false ? "内容来自多个应用" : !resource?.verified ? "宿主未证明应用资源可用" : "来源展示策略未开启" });
    return null;
  }
  rules.push("V02");
  return { id: "app", type: "appIcon", label: app.label, ...(resource.icon ? { icon: resource.icon } : {}), ...(resource.symbol ? { symbol: resource.symbol } : {}), priority: 82 };
}

/** Deterministic policy boundary: source text is intentionally not accepted. */
export function compileComponentDecision(semantics: SemanticDocument, context: DecisionHostContext = {}): ComponentDecision {
  if (semantics.task === "non_card") return makeResult("no_card", "non_card_request", "语义协议将输入标记为非卡片任务。", ["E07"], context);
  const rules: string[] = [];
  const omitted: DecisionTrace["omitted"] = [];
  const content = resolveContent(semantics, context, rules);
  if (!Array.isArray(content)) return content;
  const action = resolveAction(semantics, context, rules, omitted);
  if (action && "status" in action) return action;
  const elements: CardElement[] = [];
  const omitParallelTitle = content.length === 2 && content.every((item) => item.type === "metric");
  if (semantics.presentation.title !== "hide" && !omitParallelTitle) {
    rules.push("V01");
    elements.push({ id: "title", type: "text", role: "title", text: semantics.topic, priority: 95 });
  } else {
    rules.push("V01");
    omitted.push({ item: "title", reason: semantics.presentation.title === "hide" ? "用户明确隐藏标题" : "两个并列内容沿用无标题区域模式" });
  }
  const appIcon = resolveAppIcon(context, omitted, rules);
  if (appIcon) elements.push(appIcon);
  elements.push(...content);
  if (action) elements.push(action);
  const dsl: ElementDSL = { version: "4.0", type: "adaptive-card", context: { domain: semantics.domain, state: semantics.state, emphasis: semantics.emphasis }, elements };
  return makeResult("ready", "component_ready", "组件决策完成，等待 DSL 与布局交付门禁。", rules, context, {
    selectedComponents: elements.map((element) => element.type), omitted,
  }, dsl);
}
