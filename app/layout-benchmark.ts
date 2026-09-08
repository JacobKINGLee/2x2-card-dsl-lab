import {
  type CardElement,
  type ElementDSL,
  type LayoutResult,
  estimatedTextMeasurer,
  solveLayout,
} from "./layout-engine";

export type BenchmarkResult = {
  total: number;
  solved: number;
  successRate: number;
  averageScore: number;
  averageVisualScore: number;
  visualContrastPassRate: number;
  visualStyles: number;
  averageCandidates: number;
  compressedLayouts: number;
  droppedLayouts: number;
  violationRate: number;
  topViolations: Array<{ label: string; count: number }>;
  cases: BenchmarkCase[];
};

export type BenchmarkCase = {
  index: number;
  category: "文本组合" | "指标组合" | "图片组合";
  dsl: ElementDSL;
  result: LayoutResult;
};

const shortTexts = ["今天", "设备", "待办", "空气", "本周", "会议"];
const bodyTexts = [
  "完成方案评审",
  "确认下一阶段实验范围",
  "整理生成式界面的研究结论",
  "下午三点与导师讨论约束布局引擎",
  "根据真实内容动态计算元素矩形与坐标",
];

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(values: T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}

function chance(random: () => number, probability: number): boolean {
  return random() < probability;
}

function generateTextScenario(index: number, random: () => number): ElementDSL {
  const elements: CardElement[] = [
    {
      id: `title-${index}`,
      type: "text",
      role: "title",
      text: pick(shortTexts, random),
      priority: 90,
    },
    {
      id: `body-${index}`,
      type: "text",
      role: "body",
      text: pick(bodyTexts, random),
      supporting: chance(random, 0.72) ? "14:30 · 会议室 A" : undefined,
      maxLines: chance(random, 0.45) ? 2 : 3,
      priority: 95,
    },
  ];

  if (chance(random, 0.75)) {
    elements.splice(1, 0, {
      id: `caption-${index}`,
      type: "text",
      role: "caption",
      text: pick(shortTexts, random),
      priority: 42,
      optional: true,
    });
  }
  if (chance(random, 0.62)) {
    elements.push({
      id: `extra-${index}`,
      type: "text",
      role: "body",
      text: pick(bodyTexts, random),
      supporting: "较低优先级补充信息",
      priority: 24,
      optional: true,
      maxLines: 2,
    });
  }
  if (chance(random, 0.48)) {
    elements.push({
      id: `icon-${index}`,
      type: "appIcon",
      symbol: "研",
      label: "研究应用",
      priority: 55,
      optional: true,
    });
  }
  if (chance(random, 0.72)) {
    elements.push({
      id: `action-${index}`,
      type: "iconButton",
      icon: "✓",
      label: "确认",
      event: "confirm",
      placement: chance(random, 0.68) ? "auto" : "bottom-start",
      priority: 100,
    });
  }

  return {
    version: "4.0",
    type: "adaptive-card",
    context: { domain: "productivity", state: "generated", emphasis: "quiet" },
    elements,
  };
}

function generateMetricScenario(index: number, random: () => number): ElementDSL {
  const count = 1 + Math.floor(random() * 4);
  const elements: CardElement[] = chance(random, 0.72)
    ? [
        {
          id: `title-${index}`,
          type: "text",
          role: "title",
          text: pick(["设备电量", "环境指标", "运动摘要"], random),
          priority: 90,
        },
      ]
    : [];

  for (let metric = 0; metric < count; metric += 1) {
    elements.push({
      id: `metric-${index}-${metric}`,
      type: "metric",
      label: pick(["左耳", "右耳", "温度", "湿度", "步数"], random),
      value: pick(["82%", "24℃", "6,820", "优"], random),
      detail: chance(random, 0.7) ? "实时" : undefined,
      priority: 70 + metric,
    });
  }

  if (chance(random, 0.38) && elements.length < 8) {
    elements.push({
      id: `action-${index}`,
      type: "iconButton",
      icon: "↗",
      label: "打开详情",
      event: "openMetrics",
      placement: "auto",
      priority: 100,
    });
  }

  return {
    version: "4.0",
    type: "adaptive-card",
    context: { domain: "system", state: "generated", emphasis: "high" },
    elements,
  };
}

function generateImageScenario(index: number, random: () => number): ElementDSL {
  const elements: CardElement[] = [
    {
      id: `title-${index}`,
      type: "text",
      role: "title",
      text: pick(["本周回忆", "今日推荐", "附近风景"], random),
      priority: 90,
    },
    {
      id: `image-${index}`,
      type: "image",
      src: "/og.png",
      alt: "随机测试图片",
      priority: 70,
    },
  ];
  if (chance(random, 0.5)) {
    elements.splice(1, 0, {
      id: `caption-${index}`,
      type: "text",
      role: "caption",
      text: pick(shortTexts, random),
      priority: 30,
      optional: true,
    });
  }
  if (chance(random, 0.45)) {
    elements.push({
      id: `action-${index}`,
      type: "capsuleButton",
      label: "查看详情",
      event: "openImage",
      priority: 100,
    });
  }
  return {
    version: "4.0",
    type: "adaptive-card",
    context: { domain: "generic", state: "generated", emphasis: "standard" },
    elements,
  };
}

export function runBenchmark(total = 250, seed = 20260826): BenchmarkResult {
  const random = seededRandom(seed);
  const cases: BenchmarkCase[] = Array.from({ length: total }, (_, index) => {
    const scenario = index % 3;
    const dsl =
      scenario === 0
        ? generateTextScenario(index, random)
        : scenario === 1
          ? generateMetricScenario(index, random)
          : generateImageScenario(index, random);
    return {
      index: index + 1,
      category:
        scenario === 0
          ? "文本组合"
          : scenario === 1
            ? "指标组合"
            : "图片组合",
      dsl,
      result: solveLayout(dsl, estimatedTextMeasurer),
    };
  });
  const results = cases.map((item) => item.result);

  const violationCounts = new Map<string, number>();
  results.forEach((result) => {
    result.violations.forEach((violation) => {
      const label = violation
        .replace(/^.+?：/, "")
        .replace(/^.+? 与 .+? /, "元素 ");
      violationCounts.set(label, (violationCounts.get(label) ?? 0) + 1);
    });
  });

  const solved = results.filter((result) => result.status === "solved").length;
  const compressedLayouts = results.filter(
    (result) => result.compressedIds.length > 0,
  ).length;
  const droppedLayouts = results.filter(
    (result) => result.droppedIds.length > 0,
  ).length;
  const visualStyles = new Set(
    results.map((result) => `${result.visual.palette}/${result.visual.surface}`),
  ).size;
  const visualContrastPassed = results.filter(
    (result) => result.quality.checks.find((check) => check.id === "contrast")?.passed,
  ).length;

  return {
    total,
    solved,
    successRate: Math.round((solved / total) * 1000) / 10,
    averageScore:
      Math.round(
        (results.reduce((sum, result) => sum + result.score, 0) / total) * 10,
      ) / 10,
    averageVisualScore:
      Math.round(
        (results.reduce((sum, result) => sum + result.visual.score, 0) / total) * 10,
      ) / 10,
    visualContrastPassRate: Math.round((visualContrastPassed / total) * 1000) / 10,
    visualStyles,
    averageCandidates:
      Math.round(
        (results.reduce((sum, result) => sum + result.candidateCount, 0) /
          total) *
          10,
      ) / 10,
    compressedLayouts,
    droppedLayouts,
    violationRate: Math.round(((total - solved) / total) * 1000) / 10,
    topViolations: [...violationCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count })),
    cases,
  };
}
