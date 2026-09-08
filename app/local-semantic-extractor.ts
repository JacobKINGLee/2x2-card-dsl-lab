import type {
  SemanticActionRequest,
  SemanticDataType,
  SemanticDocument,
  SemanticFact,
} from "./semantic-protocol";
import type { VisualDomain, VisualEmphasis } from "./visual-resolver";

type FactInput = Partial<SemanticFact> & Pick<SemanticFact, "id" | "subject" | "label" | "value" | "dataType" | "source">;

function fact(input: FactInput): SemanticFact {
  return {
    unit: "",
    progressSemantics: "none",
    scale: null,
    polarity: "asserted",
    status: input.value === null ? "missing" : "current",
    role: "primary",
    required: true,
    ...input,
  };
}

function normalizeNumber(value: string) {
  return value.replace(/[−－]/g, "-");
}

function includesAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function inferDomain(text: string): VisualDomain {
  // Explicit correction is resolved by the extractor before generic keyword
  // precedence, so a negated battery phrase cannot keep the energy domain.
  if (/不是(?:电量|电池).*?(?:是|而是)\s*内存/i.test(text)) return "system";
  if (includesAny(text, ["气温", "温度", "天气", "降雨", "下雨"])) return "weather";
  if (includesAny(text, ["aqi", "空气", "湿度", "pm2.5", "二氧化碳"])) return "environment";
  if (includesAny(text, ["睡眠", "心率", "血氧", "健康"])) return "wellness";
  if (includesAny(text, ["运动", "目标", "步数", "训练", "跑步"])) return "fitness";
  if (includesAny(text, ["电池", "电量", "续航", "充电", "省电"])) return "energy";
  if (includesAny(text, ["会议", "日程", "待办", "专注"])) return "productivity";
  if (includesAny(text, ["cpu", "内存", "磁盘", "设备", "播放", "耳机"])) return "system";
  return "generic";
}

function inferState(text: string): { state: string; emphasis: VisualEmphasis } {
  if (includesAny(text, ["紧急", "严重", "危险", "不足", "只剩", "过低", "偏低"])) return { state: "warning", emphasis: "high" };
  if (includesAny(text, ["正常", "良好", "优秀"])) return { state: "good", emphasis: "standard" };
  if (includesAny(text, ["降雨", "下雨"])) return { state: "rain", emphasis: "standard" };
  if (includesAny(text, ["明天", "即将"])) return { state: "upcoming", emphasis: "standard" };
  return { state: "informative", emphasis: "standard" };
}

function topicFor(domain: VisualDomain, text: string) {
  if (domain === "energy") return "手机电量";
  if (domain === "weather") return "当前气温";
  if (domain === "environment") return /aqi/i.test(text) ? "空气质量" : "环境状态";
  if (domain === "wellness") return text.includes("心率") ? "设备心率" : "健康摘要";
  if (domain === "fitness") return "运动进度";
  if (domain === "productivity") return text.includes("会议") ? "会议日程" : text.includes("专注") ? "专注计时" : "任务提醒";
  if (domain === "system") return text.includes("内存") ? "内存状态" : "设备状态";
  return "信息摘要";
}

const actionDefinitions: Array<{
  intent: string;
  label: string;
  target: string;
  positive: RegExp;
  negative: RegExp;
}> = [
  { intent: "enableSaving", label: "开启省电", target: "battery", positive: /(?:开启|打开|启用)\s*(?:省电|低电量)(?:模式)?/i, negative: /(?:不要|不准|禁止)(?:开启|打开|启用)?\s*(?:省电|低电量)(?:模式)?/i },
  { intent: "viewBatteryDetail", label: "查看电池详情", target: "battery", positive: /(?:查看|打开)\s*(?:电池|电量)(?:的)?详情/i, negative: /(?:不要|禁止)(?:查看|打开)\s*(?:电池|电量)(?:的)?详情/i },
  { intent: "pauseMedia", label: "暂停播放", target: "media", positive: /暂停(?:当前)?(?:播放|音乐|音频)/i, negative: /(?:不要|禁止)暂停(?:当前)?(?:播放|音乐|音频)/i },
  { intent: "pauseFocus", label: "暂停专注", target: "focus", positive: /暂停(?:当前)?专注/i, negative: /(?:不要|禁止)暂停(?:当前)?专注/i },
  { intent: "cleanMemory", label: "清理内存", target: "memory", positive: /清理(?:设备)?内存/i, negative: /(?:不要|禁止|无需)清理(?:设备)?内存/i },
  { intent: "openTrend", label: "查看趋势", target: "trend", positive: /(?:查看|打开)(?:未来)?趋势/i, negative: /(?:不要|禁止)(?:查看|打开)(?:未来)?趋势/i },
  { intent: "openDetail", label: "查看详情", target: "content", positive: /(?:查看|打开)详情/i, negative: /(?:不要|禁止)(?:查看|打开)详情/i },
];

function extractActions(text: string): SemanticDocument["actions"] {
  if (/不要(?:任何)?按钮|(?:只|仅)展示(?:信息)?(?:[，,。\s]|$)/i.test(text)) {
    return { mode: "forbidden_all", requests: [], forbiddenIntents: [] };
  }
  const requests: SemanticActionRequest[] = [];
  const forbiddenIntents: string[] = [];
  for (const definition of actionDefinitions) {
    if (definition.negative.test(text)) forbiddenIntents.push(definition.intent);
    if (definition.positive.test(text) && !definition.negative.test(text)) {
      requests.push({ intent: definition.intent, label: definition.label, target: definition.target, required: true });
    }
  }
  return {
    mode: requests.length || forbiddenIntents.length ? "specified" : "unmentioned",
    requests,
    forbiddenIntents,
  };
}

function metricFacts(text: string): SemanticFact[] {
  const definitions: Array<{ id: string; subject: string; label: string; pattern: RegExp; dataType: SemanticDataType }> = [
    { id: "cpu", subject: "cpu", label: "CPU", pattern: /cpu\s*(?:占用|使用率)?\s*(?:为|是)?\s*([−－-]?\d+(?:\.\d+)?)\s*(%)/i, dataType: "percentage" },
    { id: "memory", subject: "memory", label: "内存", pattern: /内存(?:占用|使用率)?\s*(?:为|是)?\s*([−－-]?\d+(?:\.\d+)?)\s*(gb|mb|%)/i, dataType: "capacity" },
    { id: "disk", subject: "disk", label: "磁盘", pattern: /磁盘(?:占用|使用率)?\s*(?:为|是)?\s*([−－-]?\d+(?:\.\d+)?)\s*(gb|tb|%)/i, dataType: "capacity" },
  ];
  return definitions.flatMap((definition) => {
    const match = text.match(definition.pattern);
    if (!match) return [];
    const unit = match[2].toUpperCase();
    return [fact({
      id: definition.id,
      subject: definition.subject,
      label: definition.label,
      value: normalizeNumber(match[1]),
      unit,
      dataType: unit === "%" ? "percentage" : definition.dataType,
      progressSemantics: unit === "%" ? "bounded_measurement" : "none",
      role: "parallel",
      source: match[0],
    })];
  });
}

function extractFacts(text: string, domain: VisualDomain): { facts: SemanticFact[]; ambiguities: SemanticDocument["ambiguities"] } {
  const ambiguities: SemanticDocument["ambiguities"] = [];
  const correctedMetric = text.match(/不是(?:电量|电池)(?:占用)?\s*([−－-]?\d+(?:\.\d+)?)\s*%.*?(?:是|而是)\s*内存(?:占用)?\s*([−－-]?\d+(?:\.\d+)?)\s*%/i);
  if (correctedMetric) return {
    facts: [
      fact({ id: "batteryOld", subject: "battery", label: "电量", value: normalizeNumber(correctedMetric[1]), unit: "%", dataType: "percentage", progressSemantics: "bounded_measurement", polarity: "negated", status: "superseded", role: "secondary", source: correctedMetric[0] }),
      fact({ id: "memory", subject: "memory", label: "内存占用", value: normalizeNumber(correctedMetric[2]), unit: "%", dataType: "percentage", progressSemantics: "bounded_measurement", source: correctedMetric[0] }),
    ],
    ambiguities,
  };

  const correctedTime = text.match(/(?:从|原定)\s*(\d{1,2}:\d{2}).*?(?:改(?:为|到)|调整(?:为|到)|已改为)\s*(\d{1,2}:\d{2})/i);
  if (correctedTime) return {
    facts: [
      fact({ id: "meetingOld", subject: "meeting", label: "原定时间", value: correctedTime[1], dataType: "time", status: "superseded", role: "secondary", source: correctedTime[0] }),
      fact({ id: "meetingTime", subject: "meeting", label: "会议时间", value: correctedTime[2], dataType: "time", source: correctedTime[0] }),
    ],
    ambiguities,
  };

  if (/暂无数据|没有数据|无数据|未获取到|数据缺失/i.test(text)) return {
    facts: [fact({ id: "missing", subject: domain === "wellness" ? "heartRate" : "content", label: text.includes("心率") ? "心率" : "数据", value: null, dataType: "missing", status: "missing", source: text.slice(0, 160) })],
    ambiguities,
  };

  const metrics = metricFacts(text);
  if (metrics.length > 1) {
    if (/(?:照片|图片)/i.test(text)) metrics.push(fact({ id: "image", subject: "image", label: "图片", value: null, dataType: "image", status: "current", source: text.slice(0, 160) }));
    return { facts: metrics, ambiguities };
  }

  const percentages = [...text.matchAll(/([−－-]?\d+(?:\.\d+)?)\s*%/g)];
  if (domain === "energy" && percentages.length > 1 && /不确定|无法确认|不能确认|哪个(?:才)?(?:对|正确)|矛盾/i.test(text)) {
    const facts = percentages.slice(0, 2).map((match, index) => fact({
      id: `battery${index + 1}`,
      subject: "battery",
      label: "当前电量",
      value: normalizeNumber(match[1]),
      unit: "%",
      dataType: "percentage",
      progressSemantics: "bounded_measurement",
      status: "conflicting",
      source: match[0],
    }));
    ambiguities.push({ code: "conflicting_fact", factIds: facts.map((item) => item.id), question: `当前电量应使用 ${facts.map((item) => `${item.value}%`).join(" 还是 ")}？` });
    return { facts, ambiguities };
  }

  const endurance = text.match(/(?:(?:预计)?(?:还|仍)?能(?:够)?使用|还可用|续航(?:为|是)?|剩余续航)\s*([−－-]?\d+(?:\.\d+)?)\s*(小时|分钟)/i);
  if (endurance) {
    const preferEndurance = /突出续航|续航(?:为)?主|重点.*续航/i.test(text);
    const battery = text.match(/(?:手机)?电量\s*(?:只剩|剩余|为|是)?\s*([−－-]?\d+(?:\.\d+)?)\s*%/i);
    const facts = [fact({
      id: "endurance",
      subject: "battery",
      label: "预计可用",
      value: normalizeNumber(endurance[1]),
      unit: endurance[2],
      dataType: "duration",
      role: battery && !preferEndurance ? "secondary" : "primary",
      source: endurance[0],
    })];
    if (battery) facts.push(fact({
      id: "battery",
      subject: "battery",
      label: "剩余电量",
      value: normalizeNumber(battery[1]),
      unit: "%",
      dataType: "percentage",
      progressSemantics: "bounded_measurement",
      role: preferEndurance ? "secondary" : "primary",
      source: battery[0],
    }));
    return { facts, ambiguities };
  }

  const score = text.match(/(?:(?:睡眠\s*)?(?:评分|得分)\s*|睡眠\s*)(\d+(?:\.\d+)?)\s*分(?!钟)/i);
  if (score) {
    const maximum = text.match(/满分\s*(\d+(?:\.\d+)?)/i);
    return { facts: [fact({ id: "score", subject: text.includes("睡眠") ? "sleep" : "rating", label: text.includes("睡眠") ? "睡眠评分" : "评分", value: score[1], unit: "分", dataType: "score", scale: maximum ? { min: 0, max: Number(maximum[1]) } : null, source: score[0] })], ambiguities };
  }

  const duration = text.match(/([−－-]?\d+(?:\.\d+)?)\s*(小时|分钟)/i);
  if (duration) return { facts: [fact({ id: "duration", subject: text.includes("专注") ? "focus" : "duration", label: text.includes("专注") ? "专注时长" : "时长", value: normalizeNumber(duration[1]), unit: duration[2], dataType: "duration", source: duration[0] })], ambiguities };

  const belowZero = text.match(/零下\s*(\d+(?:\.\d+)?)\s*(?:摄氏度|度|°c|℃)?/i);
  const temperature = belowZero ?? text.match(/([−－-]?\d+(?:\.\d+)?)\s*(?:摄氏度|°c|℃)/i);
  if (temperature) return { facts: [fact({ id: "temperature", subject: "temperature", label: "当前气温", value: belowZero ? `-${temperature[1]}` : normalizeNumber(temperature[1]), unit: "°C", dataType: "absolute", source: temperature[0] })], ambiguities };

  const aqi = text.match(/aqi\s*(?:为|是)?\s*([−－-]?\d+(?:\.\d+)?)/i);
  if (aqi) return { facts: [fact({ id: "aqi", subject: "airQuality", label: "AQI", value: normalizeNumber(aqi[1]), dataType: "absolute", source: aqi[0] })], ambiguities };

  const time = [...text.matchAll(/(\d{1,2}:\d{2})/g)].at(-1)?.[1];
  if (time) return { facts: [fact({ id: "time", subject: domain === "productivity" ? "meeting" : "time", label: domain === "productivity" ? "会议时间" : "时间", value: time, dataType: "time", source: time })], ambiguities };

  if (percentages.length > 0) {
    const match = percentages[0];
    const completion = /完成|进度|目标/i.test(text);
    const subject = domain === "energy" ? "battery" : metrics[0]?.subject ?? domain;
    return { facts: [fact({ id: "percentage", subject, label: domain === "energy" ? "剩余电量" : completion ? "目标完成度" : "当前比例", value: normalizeNumber(match[1]), unit: "%", dataType: "percentage", progressSemantics: completion ? "completion" : "bounded_measurement", source: match[0] })], ambiguities };
  }

  if (metrics.length === 1) return { facts: metrics.map((item) => ({ ...item, role: "primary" })), ambiguities };

  if (/(?:照片|图片)/i.test(text)) return { facts: [fact({ id: "image", subject: "image", label: "图片", value: null, dataType: "image", status: "current", source: text.slice(0, 160) })], ambiguities };

  return { facts: [fact({ id: "message", subject: "message", label: "通知", value: text, dataType: "text", source: text.slice(0, 160) })], ambiguities };
}

export function extractSemanticsLocally(input: string): SemanticDocument {
  const text = input.trim().replace(/[−－]/g, "-");
  if (/写(?:一首|首)?.*诗|作诗|写代码|翻译/i.test(text)) return {
    version: "2.0",
    task: "non_card",
    domain: "generic",
    topic: "非卡片任务",
    state: "informative",
    emphasis: "standard",
    facts: [],
    actions: { mode: "unmentioned", requests: [], forbiddenIntents: [] },
    presentation: { title: "default", primaryVisual: "default", button: "default" },
    ambiguities: [],
  };

  const normalized = text.toLowerCase();
  const domain = inferDomain(normalized);
  const state = inferState(normalized);
  const extracted = extractFacts(normalized, domain);
  return {
    version: "2.0",
    task: "card",
    domain,
    topic: topicFor(domain, normalized),
    state: state.state,
    emphasis: state.emphasis,
    facts: extracted.facts,
    actions: extractActions(normalized),
    presentation: {
      title: /不要标题|隐藏标题/i.test(normalized) ? "hide" : "default",
      primaryVisual: /只要大数字|不要进度条|不用进度条/i.test(normalized) ? "big_number" : /环形|圆环/i.test(normalized) ? "ring" : "default",
      button: /(?:用|使用|要)(?:纯)?图标按钮|icon\s*button/i.test(normalized) ? "icon" : "default",
    },
    ambiguities: extracted.ambiguities,
  };
}
