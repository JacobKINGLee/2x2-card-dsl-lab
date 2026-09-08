import type {
  ElementDSL,
  HeroMetricElement,
  MiniProgressElement,
  ProgressRingElement,
} from "./layout-engine";
import type { VisualContext, VisualDomain, VisualEmphasis } from "./visual-resolver";
import type { SemanticDocument } from "./semantic-protocol";
export type SemanticVisualization = "heroMetric" | "progressRing" | "miniProgress";

export type SemanticPlan = {
  domain: VisualDomain;
  state: string;
  emphasis: VisualEmphasis;
  title: string;
  visualization: SemanticVisualization;
  icon: string;
  value: string;
  unit: string;
  label: string;
  detail: string;
  progressValue: number | null;
  actionLabel: string;
  actionEvent: string;
  confidence: number;
  rationale: string[];
};

export type SemanticInterpretation = {
  source: "llm" | "fallback";
  provider: "openai" | "huawei" | "aliyun" | "local";
  model: string | null;
  notice: string;
  semantics: SemanticDocument;
  status: "ready" | "needs_clarification" | "unsupported" | "no_card";
  decision: {
    code: string;
    message: string;
    question?: string;
    alternatives: string[];
    selectedComponents: string[];
    matchedRules: string[];
    omitted: Array<{ item: string; reason: string }>;
    protocolVersion: string;
    policyVersion: string;
    contextVersion: string;
  };
  delivery: {
    status: "deliverable" | "not_applicable" | "rejected";
    dslValid: boolean | null;
    layoutStatus: string | null;
    qualityStatus: string | null;
    reasons: string[];
  };
  dsl: ElementDSL | null;
};

const domains: VisualDomain[] = [
  "weather",
  "wellness",
  "fitness",
  "system",
  "energy",
  "productivity",
  "environment",
  "generic",
];

const emphases: VisualEmphasis[] = ["quiet", "standard", "high"];
const visualizations: SemanticVisualization[] = ["heroMetric", "progressRing", "miniProgress"];
const allowedIcons = [
  "cloud-rain",
  "droplets",
  "navigation",
  "moon",
  "sparkles",
  "battery",
  "zap",
  "calendar",
  "bell-off",
  "activity",
  "clock",
  "footprints",
  "headphones",
  "check",
] as const;

export const semanticPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "domain",
    "state",
    "emphasis",
    "title",
    "visualization",
    "icon",
    "value",
    "unit",
    "label",
    "detail",
    "progressValue",
    "actionLabel",
    "actionEvent",
    "confidence",
    "rationale",
  ],
  properties: {
    domain: { type: "string", enum: domains },
    state: { type: "string", minLength: 1, maxLength: 24 },
    emphasis: { type: "string", enum: emphases },
    title: { type: "string", minLength: 1, maxLength: 18 },
    visualization: { type: "string", enum: visualizations },
    icon: { type: "string", enum: allowedIcons },
    value: { type: "string", minLength: 1, maxLength: 16 },
    unit: { type: "string", maxLength: 8 },
    label: { type: "string", minLength: 1, maxLength: 18 },
    detail: { type: "string", maxLength: 30 },
    progressValue: { anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }] },
    actionLabel: { type: "string", minLength: 1, maxLength: 12 },
    actionEvent: { type: "string", pattern: "^[a-z][A-Za-z0-9]{2,31}$" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    rationale: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 60 },
    },
  },
} as const;

function clampText(value: unknown, fallback: string, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback).slice(0, maxLength);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeMetricParts(value: unknown, unit: unknown) {
  const normalizedUnit = clampText(unit, "", 8);
  let normalizedValue = clampText(value, "—", 16);

  // Some chat models naturally return a display-ready value such as "18%"
  // even though the schema separates value and unit. Keep the internal plan
  // canonical so the renderer never produces strings such as "18%%".
  if (normalizedUnit && normalizedValue.endsWith(normalizedUnit)) {
    normalizedValue = normalizedValue.slice(0, -normalizedUnit.length).trim() || "—";
  }

  return { value: normalizedValue, unit: normalizedUnit };
}

export function normalizeSemanticPlan(value: unknown): SemanticPlan {
  const raw = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
  const domain = domains.includes(raw.domain as VisualDomain)
    ? raw.domain as VisualDomain
    : "generic";
  const emphasis = emphases.includes(raw.emphasis as VisualEmphasis)
    ? raw.emphasis as VisualEmphasis
    : "standard";
  const visualization = visualizations.includes(raw.visualization as SemanticVisualization)
    ? raw.visualization as SemanticVisualization
    : "heroMetric";
  const icon = allowedIcons.includes(raw.icon as typeof allowedIcons[number])
    ? raw.icon as string
    : "sparkles";
  const progressValue = raw.progressValue === null
    ? null
    : clampNumber(raw.progressValue, 50, 0, 100);
  const rawRationale = Array.isArray(raw.rationale)
    ? raw.rationale.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const metric = normalizeMetricParts(raw.value, raw.unit);

  return {
    domain,
    state: clampText(raw.state, "informative", 24),
    emphasis,
    title: clampText(raw.title, "智能摘要", 18),
    visualization,
    icon,
    value: metric.value,
    unit: metric.unit,
    label: clampText(raw.label, "当前状态", 18),
    detail: clampText(raw.detail, "根据输入内容生成", 30),
    progressValue: visualization === "heroMetric" ? null : progressValue,
    actionLabel: clampText(raw.actionLabel, "查看详情", 12),
    actionEvent: /^[a-z][A-Za-z0-9]{2,31}$/.test(String(raw.actionEvent ?? ""))
      ? String(raw.actionEvent)
      : "openDetail",
    confidence: clampNumber(raw.confidence, 0.72, 0, 1),
    rationale: (rawRationale.length >= 2
      ? rawRationale
      : ["识别核心主题与主指标", "根据状态选择视觉强调级别"])
      .slice(0, 4)
      .map((item) => item.slice(0, 60)),
  };
}

export function planToDSL(plan: SemanticPlan): ElementDSL {
  const context: VisualContext = {
    domain: plan.domain,
    state: plan.state,
    emphasis: plan.emphasis,
  };
  const base = {
    id: "primary",
    icon: plan.icon,
    label: plan.label,
    detail: plan.detail || undefined,
    priority: 100,
  };
  let primary: HeroMetricElement | ProgressRingElement | MiniProgressElement;

  if (plan.visualization === "progressRing") {
    primary = {
      ...base,
      type: "progressRing",
      value: plan.progressValue ?? 50,
      displayValue: `${plan.value}${plan.unit}`,
    };
  } else if (plan.visualization === "miniProgress") {
    primary = {
      ...base,
      type: "miniProgress",
      value: plan.progressValue ?? 50,
      displayValue: `${plan.value}${plan.unit}`,
    };
  } else {
    primary = {
      ...base,
      type: "heroMetric",
      value: plan.value,
      unit: plan.unit || undefined,
    };
  }

  return {
    version: "4.0",
    type: "adaptive-card",
    context,
    elements: [
      {
        id: "title",
        type: "text",
        role: "title",
        text: plan.title,
        priority: 95,
      },
      {
        id: "app",
        type: "appIcon",
        icon: plan.icon,
        label: `${plan.title}服务`,
        priority: 82,
      },
      primary,
      {
        id: "action",
        type: "capsuleButton",
        icon: actionIcon(plan.domain),
        label: plan.actionLabel,
        event: plan.actionEvent,
        priority: 100,
      },
    ],
  };
}

function actionIcon(domain: VisualDomain) {
  if (domain === "energy") return "zap";
  if (domain === "productivity") return "calendar";
  if (domain === "weather" || domain === "environment") return "navigation";
  if (domain === "fitness") return "activity";
  if (domain === "wellness") return "moon";
  return "sparkles";
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferDomain(text: string): VisualDomain {
  if (includesAny(text, ["天气", "下雨", "降雨", "气温", "温度", "晴天"])) return "weather";
  if (includesAny(text, ["空气", "aqi", "污染", "湿度", "环境"])) return "environment";
  if (includesAny(text, ["睡眠", "健康", "心率", "血氧"])) return "wellness";
  if (includesAny(text, ["运动", "步数", "跑步", "训练", "卡路里"])) return "fitness";
  if (includesAny(text, ["电量", "电池", "充电", "省电"])) return "energy";
  if (includesAny(text, ["会议", "日程", "任务", "待办", "专注", "提醒"])) return "productivity";
  if (includesAny(text, ["内存", "设备", "耳机", "连接", "系统"])) return "system";
  return "generic";
}

function inferState(text: string) {
  if (includesAny(text, ["紧急", "严重", "危险", "不足", "只剩", "过低"])) return "warning";
  if (includesAny(text, ["优秀", "状态优", "正常", "充足", "良好"])) return "good";
  if (includesAny(text, ["今晚", "夜间", "深夜"])) return "night";
  if (includesAny(text, ["下雨", "小雨", "降雨"])) return "rain";
  if (includesAny(text, ["明天", "稍后", "即将", "下午", "上午"])) return "upcoming";
  return "informative";
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function inferProgress(text: string) {
  const raw = firstMatch(text, [/(\d{1,3})\s*%/, /(?:得分|评分|aqi)\s*(\d{1,3})/i]);
  return raw ? clampNumber(Number(raw), 50, 0, 100) : null;
}

function inferValue(text: string, domain: VisualDomain) {
  if (domain === "environment") {
    return { value: firstMatch(text, [/(?:aqi|空气质量(?:为|是)?)\s*(\d{1,3})/i]) ?? "42", unit: "" };
  }
  if (domain === "weather") {
    return { value: firstMatch(text, [/(\d{1,2})\s*(?:°c|℃|度)/i]) ?? "24", unit: "°C" };
  }
  if (domain === "energy") {
    return { value: firstMatch(text, [/(\d{1,3})\s*%/]) ?? "68", unit: "%" };
  }
  if (domain === "wellness") {
    return { value: firstMatch(text, [/(?:得分|评分)\s*(\d{1,3})/]) ?? "82", unit: "" };
  }
  if (domain === "fitness") {
    return { value: firstMatch(text, [/(\d[\d,]*)\s*(?:步|步数)/]) ?? "6,820", unit: "" };
  }
  if (domain === "productivity") {
    const time = firstMatch(text, [/(\d{1,2}:\d{2})/, /(?:下午|上午)?\s*(\d{1,2})\s*点/]);
    return { value: time ? (time.includes(":") ? time : `${time}:00`) : "待办", unit: "" };
  }
  const number = firstMatch(text, [/(\d+(?:\.\d+)?%?)/]);
  return { value: number ?? "就绪", unit: "" };
}

function domainCopy(domain: VisualDomain, text: string) {
  const maps: Record<VisualDomain, { title: string; label: string; icon: string; action: string; event: string }> = {
    weather: { title: "今日天气", label: includesAny(text, ["雨", "降雨"]) ? "有雨" : "天气状态", icon: "cloud-rain", action: "查看天气", event: "openWeather" },
    environment: { title: "空气质量", label: includesAny(text, ["优", "良好"]) ? "空气质量优" : "环境状态", icon: "droplets", action: "查看趋势", event: "openTrend" },
    wellness: { title: "健康摘要", label: includesAny(text, ["睡眠"]) ? "睡眠评分" : "健康状态", icon: "moon", action: "查看详情", event: "openWellness" },
    fitness: { title: "运动摘要", label: includesAny(text, ["步"]) ? "今日步数" : "训练进度", icon: "activity", action: "运动详情", event: "openActivity" },
    system: { title: "设备状态", label: "当前状态", icon: "sparkles", action: "系统设置", event: "openSettings" },
    energy: { title: "手机电量", label: includesAny(text, ["只剩", "不足", "低"]) ? "电量偏低" : "当前电量", icon: "battery", action: "省电模式", event: "enableSaving" },
    productivity: { title: includesAny(text, ["会议"]) ? "会议日程" : "任务提醒", label: includesAny(text, ["会议"]) ? "项目例会" : "待处理任务", icon: "calendar", action: includesAny(text, ["专注"]) ? "专注模式" : "打开任务", event: "openTask" },
    generic: { title: "智能摘要", label: "当前状态", icon: "sparkles", action: "查看详情", event: "openDetail" },
  };
  return maps[domain];
}

export function interpretLocally(input: string): SemanticPlan {
  const text = input.trim().toLowerCase();
  const domain = inferDomain(text);
  const state = inferState(text);
  const copy = domainCopy(domain, text);
  const extracted = inferValue(text, domain);
  const progressValue = inferProgress(text);
  const visualization: SemanticVisualization = domain === "energy" || includesAny(text, ["进度", "完成"])
    ? "miniProgress"
    : domain === "wellness" || includesAny(text, ["得分", "评分"])
      ? "progressRing"
      : "heroMetric";
  const emphasis: VisualEmphasis = state === "warning" || includesAny(text, ["紧急", "立即"])
    ? "high"
    : state === "night" || domain === "wellness"
      ? "quiet"
      : "standard";
  const detail = input.trim().replace(/[。！？!?]/g, " · ").slice(0, 30);

  return normalizeSemanticPlan({
    domain,
    state,
    emphasis,
    title: copy.title,
    visualization,
    icon: copy.icon,
    value: extracted.value,
    unit: extracted.unit,
    label: copy.label,
    detail,
    progressValue,
    actionLabel: copy.action,
    actionEvent: copy.event,
    confidence: domain === "generic" ? 0.58 : 0.82,
    rationale: [
      `关键词将内容识别为 ${domain} 领域`,
      `状态 ${state} 映射为 ${emphasis} 强调级别`,
      `${visualization} 最适合承载核心值 ${extracted.value}${extracted.unit}`,
    ],
  });
}
