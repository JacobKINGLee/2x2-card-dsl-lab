"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  type ElementDSL,
  type LayoutNode,
  type LayoutResult,
  applyVisualDecision,
  createCanvasTextMeasurer,
  estimatedTextMeasurer,
  parseElementDSL,
  solveLayout,
  solveLayoutVariants,
} from "./layout-engine";
import { runBenchmark } from "./layout-benchmark";
import {
  resolveVisualCandidates,
  selectDiverseVisuals,
} from "./visual-resolver";
import type { SemanticInterpretation } from "./semantic-interpreter";
import { SemanticIcon } from "./card-icons";

type Preset = {
  name: string;
  description: string;
  dsl: ElementDSL;
};

const presets: Preset[] = [
  {
    name: "雨天出行",
    description: "天气语义生成蓝色渐变",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "weather", state: "rain", emphasis: "high" },
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "雨天叫车",
          priority: 100,
        },
        {
          id: "app",
          type: "appIcon",
          icon: "cloud-rain",
          label: "天气服务",
          priority: 90,
        },
        {
          id: "temperature",
          type: "heroMetric",
          icon: "droplets",
          value: "29",
          unit: "°C",
          label: "小雨",
          detail: "建议提前叫车",
          priority: 95,
        },
        {
          id: "navigate",
          type: "capsuleButton",
          icon: "navigation",
          label: "导航回家",
          event: "navigateHome",
          priority: 100,
        },
      ],
    },
  },
  {
    name: "睡眠得分",
    description: "健康语义生成紫色进度环",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "wellness", state: "rested", emphasis: "high" },
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "昨晚睡眠",
        },
        {
          id: "app",
          type: "appIcon",
          icon: "moon",
          label: "睡眠助手",
        },
        {
          id: "score",
          type: "progressRing",
          icon: "moon",
          value: 82,
          displayValue: "82",
          label: "睡眠评分",
          detail: "比昨日提升 6 分",
        },
        {
          id: "detail",
          type: "capsuleButton",
          icon: "moon",
          label: "睡眠详情",
          event: "openSleepDetail",
        },
      ],
    },
  },
  {
    name: "内存优化",
    description: "系统语义生成薄荷色卡片",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "system", state: "healthy", emphasis: "quiet" },
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "内存优化",
        },
        {
          id: "app",
          type: "appIcon",
          icon: "sparkles",
          label: "系统管家",
        },
        {
          id: "memory",
          type: "progressRing",
          icon: "sparkles",
          value: 55,
          displayValue: "4.50G",
          label: "已用内存",
          detail: "总内存 8.00GB",
        },
        {
          id: "clean",
          type: "capsuleButton",
          icon: "sparkles",
          label: "一键清理",
          event: "cleanMemory",
        },
      ],
    },
  },
  {
    name: "手机电量",
    description: "能源语义生成状态进度条",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "energy", state: "good", emphasis: "standard" },
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "手机电量",
        },
        {
          id: "app",
          type: "appIcon",
          icon: "battery",
          label: "电池管理",
        },
        {
          id: "battery",
          type: "miniProgress",
          value: 68,
          displayValue: "68%",
          label: "当前电量",
          detail: "预计可用 8 小时",
        },
        {
          id: "saving",
          type: "capsuleButton",
          icon: "zap",
          label: "省电模式",
          event: "enableSaving",
        },
      ],
    },
  },
  {
    name: "会议日程",
    description: "生产力语义生成沉静蓝卡",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "productivity", state: "upcoming", emphasis: "quiet" },
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "会议日程",
        },
        {
          id: "app",
          type: "appIcon",
          icon: "calendar",
          label: "日历",
        },
        {
          id: "meeting",
          type: "heroMetric",
          icon: "calendar",
          value: "14:00",
          label: "项目例会",
          detail: "第三会议室 · 45 分钟",
        },
        {
          id: "focus",
          type: "capsuleButton",
          icon: "bell-off",
          label: "专注模式",
          event: "enableFocus",
        },
      ],
    },
  },
  {
    name: "长文修复",
    description: "触发紧凑文案与受控截断",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "productivity", state: "busy", emphasis: "standard" },
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "项目进度提醒",
          priority: 100,
        },
        {
          id: "caption",
          type: "text",
          role: "caption",
          text: "今天 17:30 前",
          priority: 36,
          optional: true,
        },
        {
          id: "summary",
          type: "text",
          role: "body",
          text: "完成生成式界面实验数据整理并提交阶段性研究报告",
          supporting: "包含评价指标、失败样本与下一轮实验计划",
          maxLines: 3,
          priority: 94,
        },
        {
          id: "submit",
          type: "capsuleButton",
          icon: "calendar",
          label: "打开任务",
          event: "openTask",
          priority: 100,
        },
      ],
    },
  },
  {
    name: "图片内容",
    description: "填充最大可用矩形",
    dsl: {
      version: "3.0",
      type: "adaptive-card",
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "本周回忆",
        },
        {
          id: "photo",
          type: "image",
          src: "/og.png",
          alt: "2×2 Card DSL Lab 本地示例图",
        },
      ],
    },
  },
];

const galleryExtras: Preset[] = [
  {
    name: "运动倒计时",
    description: "高强调运动状态",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "fitness", state: "active", emphasis: "high" },
      elements: [
        { id: "title", type: "text", role: "title", text: "运动倒计时" },
        { id: "app", type: "appIcon", icon: "activity", label: "运动助手" },
        { id: "countdown", type: "heroMetric", icon: "activity", value: "30", label: "天后开跑", detail: "马拉松训练计划" },
        { id: "plan", type: "capsuleButton", icon: "calendar", label: "训练计划", event: "openTraining" },
      ],
    },
  },
  {
    name: "深夜天气",
    description: "夜间状态触发暗色表面",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "weather", state: "night", emphasis: "standard" },
      elements: [
        { id: "title", type: "text", role: "title", text: "夜间天气" },
        { id: "app", type: "appIcon", icon: "moon", label: "天气服务" },
        { id: "temperature", type: "heroMetric", icon: "moon", value: "22", unit: "°C", label: "晴朗", detail: "湿度 61%" },
        { id: "detail", type: "capsuleButton", icon: "navigation", label: "查看天气", event: "openWeather" },
      ],
    },
  },
  {
    name: "耳机连接",
    description: "设备连接状态",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "system", state: "connected", emphasis: "quiet" },
      elements: [
        { id: "title", type: "text", role: "title", text: "耳机播控" },
        { id: "app", type: "appIcon", icon: "headphones", label: "耳机" },
        { id: "status", type: "heroMetric", icon: "headphones", value: "已连接", label: "FreeBuds Pro", detail: "电量 76%" },
        { id: "settings", type: "capsuleButton", icon: "sparkles", label: "蓝牙设置", event: "openBluetooth" },
      ],
    },
  },
  {
    name: "今日专注",
    description: "低干扰生产力卡片",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "productivity", state: "focused", emphasis: "quiet" },
      elements: [
        { id: "title", type: "text", role: "title", text: "今日专注" },
        { id: "app", type: "appIcon", icon: "clock", label: "专注助手" },
        { id: "focus", type: "miniProgress", value: 42, displayValue: "25分钟", label: "已完成", detail: "今日目标 60 分钟" },
        { id: "start", type: "capsuleButton", icon: "clock", label: "继续专注", event: "startFocus" },
      ],
    },
  },
  {
    name: "通勤步数",
    description: "运动摘要大指标",
    dsl: {
      version: "4.0",
      type: "adaptive-card",
      context: { domain: "fitness", state: "daily", emphasis: "standard" },
      elements: [
        { id: "title", type: "text", role: "title", text: "今日步数" },
        { id: "app", type: "appIcon", icon: "footprints", label: "健康运动" },
        { id: "steps", type: "heroMetric", icon: "footprints", value: "6,820", label: "步", detail: "目标完成 68%" },
        { id: "detail", type: "capsuleButton", icon: "activity", label: "运动详情", event: "openActivity" },
      ],
    },
  },
];

const galleryPresets = [...presets.slice(0, 5), ...galleryExtras];

const contentExamples = [
  {
    label: "空气质量",
    text: "今天上海空气质量 AQI 42，状态优，可以查看未来趋势。",
  },
  {
    label: "低电量",
    text: "手机电量只剩 18%，预计还能使用 2 小时，开启省电模式。",
  },
  {
    label: "会议提醒",
    text: "明天下午 3 点项目例会，地点在第三会议室，打开专注模式。",
  },
  {
    label: "睡眠得分",
    text: "昨晚睡眠得分 82，比昨天高 6 分，查看睡眠详情。",
  },
];

function combineDesignCandidates(
  layoutVariants: LayoutResult[],
  visualCandidates: LayoutResult["visual"][],
): LayoutResult[] {
  const accessibleCandidates = visualCandidates.filter((candidate) => candidate.contrastRatio >= 4.5);
  const usedSurfaces = new Set<string>();
  const firstPalette = accessibleCandidates[0]?.palette;
  return layoutVariants.slice(0, 3).map((layoutVariant, index) => {
    const visual = accessibleCandidates.find((candidate) =>
      !usedSurfaces.has(candidate.surface) &&
      (index < 2 || candidate.palette !== firstPalette),
    ) ?? accessibleCandidates[index] ?? layoutVariant.visual;
    usedSurfaces.add(visual.surface);
    return applyVisualDecision(layoutVariant, visual);
  });
}

function designScore(layout: LayoutResult) {
  return Math.round(layout.score * 0.52 + layout.visual.score * 0.48);
}

function renderElement(
  node: LayoutNode,
  onAction: (event: string) => void,
) {
  const element = node.element;
  switch (element.type) {
    case "text":
      return (
        <div
          className={`render-text role-${element.role} is-${node.presentation} ${node.truncated ? "is-truncated" : ""}`}
        >
          <span style={{ WebkitLineClamp: node.lineCount }}>{element.text}</span>
          {element.supporting && node.presentation === "full" && (
            <small>{element.supporting}</small>
          )}
        </div>
      );
    case "appIcon":
      return (
        <span className="render-app-icon" aria-label={element.label}>
          {element.icon ? <SemanticIcon name={element.icon} size={17} /> : element.symbol}
        </span>
      );
    case "iconButton":
      return (
        <button
          className="render-icon-button"
          type="button"
          aria-label={element.label}
          onClick={() => onAction(element.event)}
        >
          <SemanticIcon name={element.icon === "✓" ? "check" : element.icon} size={19} />
        </button>
      );
    case "capsuleButton":
      return (
        <button
          className="render-capsule-button"
          type="button"
          onClick={() => onAction(element.event)}
        >
          {element.icon && <SemanticIcon name={element.icon} size={14} />}
          <span>{element.label}</span>
        </button>
      );
    case "metric":
      return (
        <div className="render-metric">
          <span>{element.label}</span>
          <strong>{element.value}</strong>
          {element.detail && <small>{element.detail}</small>}
        </div>
      );
    case "heroMetric":
      return (
        <div className="render-hero-metric">
          {element.icon && <span className="hero-icon"><SemanticIcon name={element.icon} size={28} /></span>}
          <div className="hero-copy">
            <strong>{element.value}<em>{element.unit}</em></strong>
            <span>{element.label}</span>
            {element.detail && <small>{element.detail}</small>}
          </div>
        </div>
      );
    case "progressRing": {
      const progressStyle = { "--progress": element.value } as CSSProperties;
      return (
        <div className="render-progress-ring" style={progressStyle}>
          <div className="ring-visual">
            <svg viewBox="0 0 52 52" aria-hidden="true">
              <circle className="ring-track" cx="26" cy="26" r="21" />
              <circle className="ring-value" cx="26" cy="26" r="21" pathLength="100" />
            </svg>
            {element.icon && <span><SemanticIcon name={element.icon} size={22} /></span>}
          </div>
          <div className="hero-copy">
            <strong>{element.displayValue}</strong>
            <span>{element.label}</span>
            {element.detail && <small>{element.detail}</small>}
          </div>
        </div>
      );
    }
    case "miniProgress": {
      const progressStyle = { "--progress-width": `${element.value}%` } as CSSProperties;
      return (
        <div className="render-mini-progress" style={progressStyle}>
          <div className="mini-progress-heading">
            <span>{element.label}</span>
            <strong>{element.displayValue}</strong>
          </div>
          <div className="mini-progress-track"><i /></div>
          {element.detail && <small>{element.detail}</small>}
        </div>
      );
    }
    case "image":
      return (
        <div className="render-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={element.src} alt={element.alt} />
        </div>
      );
  }
}

function CoordinateCard({
  layout,
  showGuides,
  onAction,
}: {
  layout: LayoutResult;
  showGuides: boolean;
  onAction: (event: string) => void;
}) {
  return (
    <article
      className={`adaptive-card composition-${layout.composition.id} palette-${layout.visual.palette} surface-${layout.visual.surface} foreground-${layout.visual.foreground} action-${layout.visual.actionStyle}`}
      aria-label="约束布局生成的2×2卡片"
    >
      <div className="card-atmosphere" aria-hidden="true" />
      <div className={showGuides ? "card-layout show-guides" : "card-layout"}>
      <div className="safe-area-guide" aria-hidden="true" />
      {layout.nodes.map((node) => {
        const style: CSSProperties = {
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
        };
        return (
          <div
            className={`layout-node node-${node.element.type}`}
            data-node-id={node.id}
            style={style}
            key={node.id}
          >
            {renderElement(node, onAction)}
          </div>
        );
      })}
      </div>
    </article>
  );
}

function CoordinateTable({ layout }: { layout: LayoutResult }) {
  return (
    <div className="coordinate-table">
      <div className="coordinate-row coordinate-head">
        <span>ELEMENT</span><span>MODE</span><span>X</span><span>Y</span><span>W</span><span>H</span>
      </div>
      {layout.nodes.map((node) => (
        <div className="coordinate-row" key={node.id}>
          <strong>{node.id}</strong>
          <span className={`mode-${node.presentation}`}>
            {node.truncated ? "TRUNC" : node.presentation.toUpperCase()}
          </span>
          <span>{node.x}</span>
          <span>{node.y}</span>
          <span>{node.width}</span>
          <span>{node.height}</span>
        </div>
      ))}
    </div>
  );
}

function VisualCandidateStrip({
  candidates,
  selectedIndex,
  onSelect,
}: {
  candidates: LayoutResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <section className="visual-candidate-section" aria-label="视觉候选比较">
      <div className="section-caption">
        <span>TOP 3 VISUAL CANDIDATES</span>
        <span>同一 DSL，不同构图与视觉语法</span>
      </div>
      <div className="visual-candidate-grid">
        {candidates.slice(0, 3).map((candidate, index) => {
          return (
            <div className={`visual-candidate ${selectedIndex === index ? "is-selected" : ""}`} key={`${candidate.composition.id}-${candidate.visual.id}`}>
              <div className="visual-candidate-preview" aria-hidden="true">
                <CoordinateCard layout={candidate} showGuides={false} onAction={() => undefined} />
              </div>
              <div className="visual-candidate-meta">
                <span>{candidate.composition.label} · {candidate.visual.palette}/{candidate.visual.surface} · {candidate.quality.status === "repaired" ? "REPAIRED" : "PASS"}</span>
                <strong>{designScore(candidate)}<small>/100</small></strong>
              </div>
              <button type="button" onClick={() => onSelect(index)} aria-pressed={selectedIndex === index}>
                {selectedIndex === index ? "当前方案" : "选用方案"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QualityGatePanel({ layout }: { layout: LayoutResult }) {
  const quality = layout.quality;
  return (
    <section className="quality-gate-section" aria-label="自动质量门禁报告">
      <div className="section-caption">
        <span>QUALITY GATE + AUTO REPAIR</span>
        <span>不合格候选自动淘汰并尝试下一方案</span>
      </div>
      <div className="quality-gate-heading">
        <div>
          <span className={`quality-status status-${quality.status}`}>
            {quality.status === "passed" ? "直接通过" : quality.status === "repaired" ? "修复后通过" : "已拒绝"}
          </span>
          <strong>{quality.checks.filter((check) => check.passed).length}/{quality.checks.length} 条硬规则通过</strong>
        </div>
        <p>系统扫描 {quality.evaluatedCandidates} 个布局候选，淘汰 {quality.rejectedCandidates} 个不合格方案。</p>
      </div>
      <div className="quality-metrics">
        <div><span>CONTRAST</span><strong>{quality.contrastRatio.toFixed(2)}<small>:1</small></strong></div>
        <div><span>MIN TYPE</span><strong>{quality.minimumTextSize}<small>vp</small></strong></div>
        <div><span>MIN TOUCH</span><strong>{quality.minimumTouchTarget}</strong></div>
      </div>
      {quality.repairs.length > 0 ? (
        <div className="repair-timeline">
          <span>AUTO REPAIR LOG</span>
          {quality.repairs.map((repair, index) => (
            <div key={repair.id}>
              <i>{index + 1}</i>
              <p><strong>{repair.label}</strong><small>{repair.detail} · {repair.affectedIds.join(" / ")}</small></p>
            </div>
          ))}
        </div>
      ) : (
        <p className="quality-clean-pass">当前方案无需内容降级，直接进入 Renderer。</p>
      )}
      <div className="rejection-summary">
        <span>TOP REJECTION REASONS</span>
        {quality.rejectionReasons.length > 0 ? quality.rejectionReasons.map((reason) => (
          <div key={reason.label}><strong>{reason.count}</strong><span>{reason.label}</span></div>
        )) : <p>候选池中没有触发硬约束淘汰。</p>}
      </div>
    </section>
  );
}

export default function Home() {
  const [viewMode, setViewMode] = useState<"single" | "gallery">("single");
  const [activePreset, setActivePreset] = useState(0);
  const [source, setSource] = useState(() =>
    JSON.stringify(presets[0].dsl, null, 2),
  );
  const [showGuides, setShowGuides] = useState(false);
  const [toast, setToast] = useState("");
  const [fontReady, setFontReady] = useState(false);
  const [benchmarkIndex, setBenchmarkIndex] = useState(0);
  const [visualCandidateIndex, setVisualCandidateIndex] = useState(0);
  const [naturalText, setNaturalText] = useState(contentExamples[0].text);
  const [interpreterMode, setInterpreterMode] = useState<"auto" | "local">("auto");
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<SemanticInterpretation | null>(null);
  const [interpretError, setInterpretError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fontPromise = document.fonts?.ready ?? Promise.resolve();
    void fontPromise.then(() => {
      if (!cancelled) setFontReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const textMeasurer = useMemo(
    () => (fontReady ? createCanvasTextMeasurer() : estimatedTextMeasurer),
    [fontReady],
  );
  const benchmark = useMemo(() => runBenchmark(250, 20260826), []);
  const benchmarkCase = benchmark.cases[benchmarkIndex];
  const benchmarkCaseResult = useMemo(
    () =>
      JSON.stringify(
        {
          status: benchmarkCase.result.status,
          score: benchmarkCase.result.score,
          candidateCount: benchmarkCase.result.candidateCount,
          measurement: benchmarkCase.result.measurement,
          compressedIds: benchmarkCase.result.compressedIds,
          droppedIds: benchmarkCase.result.droppedIds,
          nodes: benchmarkCase.result.nodes.map(
            ({ id, x, y, width, height, presentation, truncated }) => ({
              id,
              x,
              y,
              width,
              height,
              presentation,
              truncated,
            }),
          ),
          violations: benchmarkCase.result.violations,
        },
        null,
        2,
      ),
    [benchmarkCase],
  );
  const parsed = useMemo(() => parseElementDSL(source), [source]);
  const visualCandidates = useMemo(
    () => parsed.data ? resolveVisualCandidates(parsed.data.context, parsed.data.elements) : [],
    [parsed.data],
  );
  const layout = useMemo(
    () => (parsed.data ? solveLayout(parsed.data, textMeasurer) : null),
    [parsed.data, textMeasurer],
  );
  const layoutVariants = useMemo(
    () => parsed.data ? solveLayoutVariants(parsed.data, textMeasurer) : [],
    [parsed.data, textMeasurer],
  );
  const designCandidates = useMemo(
    () => combineDesignCandidates(layoutVariants, visualCandidates),
    [layoutVariants, visualCandidates],
  );
  const errors = [
    ...parsed.errors,
    ...(layout?.status === "unsatisfied"
      ? [...layout.violations, ...layout.quality.issues.map((issue) => issue.message)]
      : []),
  ];
  const isSolved = parsed.data !== null && layout?.status === "solved";
  const displayedLayout = useMemo(
    () => designCandidates[visualCandidateIndex] ?? layout,
    [designCandidates, layout, visualCandidateIndex],
  );
  const galleryLayouts = useMemo(() => {
    const layoutGroups = galleryPresets.map((preset) => solveLayoutVariants(preset.dsl, textMeasurer));
    const diverseVisuals = selectDiverseVisuals(
      galleryPresets.map((preset) => resolveVisualCandidates(preset.dsl.context, preset.dsl.elements)),
    );
    return layoutGroups.map((variants, index) => ({
      ...applyVisualDecision(variants[index % variants.length], diverseVisuals[index]),
    }));
  }, [textMeasurer]);

  const layoutIR = useMemo(() => {
    if (!displayedLayout) return "";
    return JSON.stringify(
      {
        card: displayedLayout.card,
        score: displayedLayout.score,
        measurement: displayedLayout.measurement,
        composition: displayedLayout.composition,
        visual: displayedLayout.visual,
        compressedIds: displayedLayout.compressedIds,
        droppedIds: displayedLayout.droppedIds,
        quality: displayedLayout.quality,
        nodes: displayedLayout.nodes.map(({ id, x, y, width, height, presentation, truncated }) => ({
          id,
          x,
          y,
          width,
          height,
          presentation,
          truncated,
        })),
      },
      null,
      2,
    );
  }, [displayedLayout]);

  function selectPreset(index: number) {
    setActivePreset(index);
    setVisualCandidateIndex(0);
    setInterpretation(null);
    setInterpretError("");
    setSource(JSON.stringify(presets[index].dsl, null, 2));
  }

  function inspectGalleryPreset(preset: Preset) {
    setViewMode("single");
    setActivePreset(presets.findIndex((item) => item.name === preset.name));
    setVisualCandidateIndex(0);
    setInterpretation(null);
    setInterpretError("");
    setSource(JSON.stringify(preset.dsl, null, 2));
  }

  async function interpretContent() {
    const text = naturalText.trim();
    if (text.length < 4) {
      setInterpretError("请至少输入 4 个字符，让系统获得足够语义。");
      return;
    }

    setIsInterpreting(true);
    setInterpretError("");
    try {
      const response = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode: interpreterMode }),
      });
      const payload = await response.json() as SemanticInterpretation & { error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "语义解析失败");
      }
      if (payload.status === "ready") {
        if (!payload.dsl) throw new Error("组件决策为 ready，但没有返回 DSL");
        const validated = parseElementDSL(JSON.stringify(payload.dsl));
        if (!validated.data) {
          throw new Error(`生成的 DSL 未通过校验：${validated.errors.join("；")}`);
        }
        setActivePreset(-1);
        setVisualCandidateIndex(0);
        setSource(JSON.stringify(payload.dsl, null, 2));
      }

      setInterpretation(payload);
      showToast(payload.status === "ready"
        ? payload.source === "llm" ? "LLM 语义理解与组件决策完成" : "本地组件决策完成"
        : payload.decision.message);
    } catch (error) {
      setInterpretError(error instanceof Error ? error.message : "语义解析失败，请稍后重试");
    } finally {
      setIsInterpreting(false);
    }
  }

  function updateNaturalText(text: string) {
    setNaturalText(text.slice(0, 500));
    setInterpretation(null);
    setInterpretError("");
  }

  function selectInterpreterMode(mode: "auto" | "local") {
    setInterpreterMode(mode);
    setInterpretation(null);
    setInterpretError("");
  }

  function showToast(message: string, duration = 1900) {
    setToast(message);
    window.setTimeout(() => setToast(""), duration);
  }

  function formatSource() {
    try {
      setSource(JSON.stringify(JSON.parse(source), null, 2));
    } catch {
      showToast("JSON 尚未通过语法校验");
    }
  }

  async function copyText(value: string, success: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(success);
    } catch {
      showToast("复制失败，请手动选择文本");
    }
  }

  function handleAction(event: string) {
    showToast(`已触发事件：${event}`, 2300);
  }

  function selectBenchmarkCase(index: number) {
    setBenchmarkIndex(Math.min(benchmark.total - 1, Math.max(0, index)));
  }

  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="Demo 导航">
        <div className="brand">
          <span className="brand-grid" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          <span>CONSTRAINT LAB</span>
        </div>
        <div className="topbar-meta">
          <a className="catalog-link" href="/architecture">方案对比</a>
          <a className="catalog-link" href="/catalog">组件图鉴</a>
          <span>2×2 CARD</span>
          <span className="version-badge">CONTENT-DRIVEN GENERATIVE UI · V0.8</span>
        </div>
      </nav>

      <header className="intro">
        <div>
          <p className="kicker">CONSTRAINT-DRIVEN GENERATIVE UI</p>
          <h1>不给模板，只给元素。<br /><em>让规则算出坐标。</em></h1>
        </div>
        <div className="intro-side">
          <p>
            先把任意内容编译成受约束的 Semantic DSL，再由双求解器与质量门禁
            生成稳定、可解释的卡片方案。
          </p>
          <div className="pipeline" aria-label="生成流程">
            <span>CONTENT</span><i>→</i><span>SEMANTIC COMPILER</span><i>→</i><span>DUAL SOLVER</span><i>→</i><span>QUALITY GATE</span><i>→</i><span>RENDER IR</span>
          </div>
        </div>
      </header>

      <div className="view-switch" role="group" aria-label="演示视图">
        <button type="button" className={viewMode === "gallery" ? "active" : ""} onClick={() => setViewMode("gallery")}>
          <span>卡片画廊</span><small>批量生成与多样性约束</small>
        </button>
        <button type="button" className={viewMode === "single" ? "active" : ""} onClick={() => setViewMode("single")}>
          <span>内容生成</span><small>自然语言 → 设计 Top 3</small>
        </button>
      </div>

      <section className={`workspace ${viewMode !== "single" ? "view-hidden" : ""}`} aria-label="元素DSL与约束布局结果">
        <section className="panel semantic-input-panel" aria-label="自然语言语义编译器">
          <div className="semantic-panel-heading">
            <div>
              <span className="step-label">01 / CONTENT-DRIVEN INPUT</span>
              <h2>描述内容，系统生成设计语义</h2>
              <p>LLM 只理解领域、状态、信息层级和操作意图；坐标仍由确定性引擎求解。</p>
            </div>
            <div className="interpreter-mode" role="group" aria-label="语义解析模式">
              <button type="button" className={interpreterMode === "auto" ? "active" : ""} aria-pressed={interpreterMode === "auto"} onClick={() => selectInterpreterMode("auto")}>LLM AUTO</button>
              <button type="button" className={interpreterMode === "local" ? "active" : ""} aria-pressed={interpreterMode === "local"} onClick={() => selectInterpreterMode("local")}>LOCAL</button>
            </div>
          </div>
          <div className="semantic-input-grid">
            <div className="content-composer">
              <label htmlFor="natural-content">用一句话描述你想生成的卡片</label>
              <textarea
                id="natural-content"
                value={naturalText}
                onChange={(event) => updateNaturalText(event.target.value)}
                maxLength={500}
                placeholder="例如：手机电量只剩 18%，预计还能使用 2 小时，开启省电模式。"
              />
              <div className="content-composer-meta">
                <span>{naturalText.length}/500</span>
                <span>{interpreterMode === "auto" ? "优先使用已配置的云模型" : "仅使用本地规则解析"}</span>
              </div>
              <div className="content-examples" aria-label="自然语言示例">
                {contentExamples.map((example) => (
                  <button type="button" onClick={() => updateNaturalText(example.text)} key={example.label}>{example.label}</button>
                ))}
              </div>
              <button className="interpret-button" type="button" disabled={isInterpreting} onClick={() => void interpretContent()}>
                {isInterpreting ? "正在理解内容…" : "理解内容并生成卡片"}
              </button>
              {interpretError && <p className="interpret-error" role="alert">{interpretError}</p>}
            </div>

            <div className={`semantic-result ${interpretation ? "has-result" : ""}`} aria-live="polite">
              {isInterpreting ? (
                <div className="semantic-loading">
                  <i /><strong>正在编译语义计划</strong><p>内容理解完成后，还会继续经过 DSL 校验与质量门禁。</p>
                </div>
              ) : interpretation ? (
                <>
                  <div className="semantic-result-heading">
                    <span className={`parser-source source-${interpretation.source}`}>
                      {interpretation.source === "llm"
                        ? interpretation.provider === "huawei"
                          ? `HUAWEI MAAS · ${interpretation.model}`
                          : interpretation.provider === "aliyun"
                            ? `ALIYUN MAAS · ${interpretation.model}`
                            : `OPENAI · ${interpretation.model}`
                        : "LOCAL FALLBACK"}
                    </span>
                    <strong>{interpretation.status.toUpperCase()}<small> 决策状态</small></strong>
                  </div>
                  <div className="semantic-facts">
                    <div><span>DOMAIN</span><strong>{interpretation.semantics.domain}</strong></div>
                    <div><span>STATE</span><strong>{interpretation.semantics.state}</strong></div>
                    <div><span>FACTS</span><strong>{interpretation.semantics.facts.length}</strong></div>
                    <div><span>COMPONENTS</span><strong>{interpretation.decision.selectedComponents.join(" + ") || "—"}</strong></div>
                  </div>
                  <ol className="semantic-rationale">
                    <li>{interpretation.decision.message}</li>
                    {interpretation.decision.question && <li>{interpretation.decision.question}</li>}
                    <li>命中规则：{interpretation.decision.matchedRules.join(" / ") || "—"}</li>
                    {interpretation.decision.omitted.map((item) => <li key={`${item.item}-${item.reason}`}>省略 {item.item}：{item.reason}</li>)}
                  </ol>
                  <p className="semantic-notice">{interpretation.notice}</p>
                </>
              ) : (
                <div className="semantic-empty">
                  <span>CONTENT → SEMANTIC PLAN → DSL</span>
                  <strong>等待内容输入</strong>
                  <p>系统会解释它识别出的领域、状态、核心组件和强调级别。</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel editor-panel">
          <div className="panel-heading">
            <div>
              <span className="step-label">02 / COMPILED SEMANTIC DSL</span>
              <h2>元素 DSL</h2>
            </div>
            <div className="editor-actions">
              <button type="button" onClick={formatSource}>格式化</button>
              <button type="button" onClick={() => copyText(source, "Element DSL 已复制")}>复制</button>
            </div>
          </div>

          <div className="preset-tabs" role="tablist" aria-label="元素DSL示例">
            {presets.map((preset, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={activePreset === index}
                className={activePreset === index ? "active" : ""}
                onClick={() => selectPreset(index)}
                key={preset.name}
              >
                <strong>{preset.name}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>

          <div className="code-shell">
            <div className="code-toolbar">
              <span><i /> elements.dsl.json</span>
              <span>NO X / Y ALLOWED</span>
            </div>
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              spellCheck={false}
              aria-label="元素DSL编辑器"
            />
          </div>

          <div className={`validation ${errors.length ? "invalid" : "valid"}`}>
            <div className="validation-title">
              <span className="status-dot" />
              <strong>
                {errors.length
                  ? "约束求解失败"
                  : "元素合法，布局已求解"}
              </strong>
              <span>{errors.length ? `${errors.length} 个问题` : "无坐标输入"}</span>
            </div>
            {errors.length > 0 ? (
              <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
            ) : (
              <p>DSL通过语义校验；x、y、width、height全部由布局引擎生成。</p>
            )}
          </div>
        </section>

        <aside className="panel preview-panel">
          <div className="panel-heading">
            <div>
              <span className="step-label">03 / QUALITY-GATED OUTPUT</span>
              <h2>布局、视觉与质量结果</h2>
            </div>
            <div className="preview-actions">
              <button
                type="button"
                className={showGuides ? "active" : ""}
                aria-pressed={showGuides}
                onClick={() => setShowGuides((value) => !value)}
              >
                坐标框
              </button>
              <span className={`live-pill ${isSolved ? "is-live" : ""}`}>
                <i /> {isSolved ? "SOLVED" : "PAUSED"}
              </span>
            </div>
          </div>

          <div className="preview-stage">
            <div className="stage-label">RENDERED FROM LAYOUT + VISUAL IR · 1.72×</div>
            <div className="ruler ruler-x"><span>160vp</span></div>
            <div className="ruler ruler-y"><span>160vp</span></div>
            <div className="card-scale">
              {isSolved && displayedLayout ? (
                <CoordinateCard
                  layout={displayedLayout}
                  showGuides={showGuides}
                  onAction={handleAction}
                />
              ) : (
                <div className="render-blocked">
                  <span>!</span>
                  <strong>无合法布局</strong>
                  <p>修改左侧元素后重新求解</p>
                </div>
              )}
            </div>
          </div>

          {layout && displayedLayout && (
            <>
              <VisualCandidateStrip
                candidates={designCandidates}
                selectedIndex={visualCandidateIndex}
                onSelect={setVisualCandidateIndex}
              />
              <div className="solver-summary">
                <div>
                  <span>LAYOUT SCORE</span>
                  <strong>{layout.score}<small>/100</small></strong>
                </div>
                <div>
                  <span>VISUAL SCORE</span>
                  <strong>{displayedLayout.visual.score}<small>/100</small></strong>
                </div>
                <div>
                  <span>TOTAL CANDIDATES</span>
                  <strong>{layout.candidateCount * displayedLayout.visual.candidateCount}<small> 个</small></strong>
                </div>
                <div>
                  <span>HARD RULES</span>
                  <strong>{displayedLayout.checks.filter((check) => check.passed).length}<small>/{displayedLayout.checks.length}</small></strong>
                </div>
              </div>

              <QualityGatePanel layout={displayedLayout} />

              <section className="degradation-section">
                <div className="section-caption">
                  <span>PRIORITY DEGRADATION</span>
                  <span>优先保留高 priority 元素</span>
                </div>
                <div className="degradation-row">
                  <span className={layout.compressedIds.length ? "is-used" : ""}>
                    COMPRESSED · {layout.compressedIds.length
                      ? layout.compressedIds.join(" / ")
                      : "NONE"}
                  </span>
                  <span className={layout.droppedIds.length ? "is-used dropped" : ""}>
                    DROPPED · {layout.droppedIds.length
                      ? layout.droppedIds.join(" / ")
                      : "NONE"}
                  </span>
                </div>
              </section>

              <section className="constraint-section">
                <div className="section-caption">
                  <span>CONSTRAINT CHECKS</span>
                  <span>硬约束必须全部通过</span>
                </div>
                <div className="constraint-chips">
                  {displayedLayout.checks.map((check) => (
                    <span className={check.passed ? "passed" : "failed"} key={check.id}>
                      <i /> {check.label}
                    </span>
                  ))}
                </div>
              </section>

              <section className="ir-section">
                <div className="section-caption">
                  <span>LAYOUT IR</span>
                  <button type="button" onClick={() => copyText(layoutIR, "Layout IR 已复制")}>复制坐标</button>
                </div>
                <CoordinateTable layout={layout} />
                <details>
                  <summary>查看完整坐标 JSON</summary>
                  <pre>{layoutIR}</pre>
                </details>
              </section>

              <section className="decision-section">
                <div className="section-caption">
                  <span>SOLVER DECISIONS</span>
                  <span>本次求解说明</span>
                </div>
                <ol>
                  {layout.decisions.map((decision) => <li key={decision}>{decision}</li>)}
                  {displayedLayout.visual.reasons.map((reason) => <li key={`visual-${reason}`}>{reason}</li>)}
                </ol>
              </section>
            </>
          )}
        </aside>
      </section>

      <section className={`gallery-panel ${viewMode !== "gallery" ? "view-hidden" : ""}`} aria-label="批量卡片画廊">
        <div className="gallery-heading">
          <div>
            <span className="step-label">02 / DIVERSITY-AWARE BATCH</span>
            <h2>语义卡片画廊</h2>
            <p>每张卡联合生成三种构图与 12 个视觉候选，再用批次多样性惩罚避免结构、色彩和表面重复。</p>
          </div>
          <div className="gallery-stats">
            <div><span>CARDS</span><strong>{galleryLayouts.length}</strong></div>
            <div><span>PALETTES</span><strong>{new Set(galleryLayouts.map((item) => item.visual.palette)).size}</strong></div>
            <div><span>SURFACES</span><strong>{new Set(galleryLayouts.map((item) => item.visual.surface)).size}</strong></div>
          </div>
        </div>
        <div className="card-gallery-grid">
          {galleryPresets.map((preset, index) => {
            const item = galleryLayouts[index];
            return (
              <article className="gallery-item" key={preset.name}>
                <div className="gallery-card-shell">
                  <CoordinateCard layout={item} showGuides={false} onAction={handleAction} />
                </div>
                <div className="gallery-item-meta">
                  <div>
                    <strong>{preset.name}</strong>
                    <span>{preset.dsl.context?.domain} · {item.composition.label} · {item.visual.palette}/{item.visual.surface}</span>
                  </div>
                  <span className="gallery-score">{item.visual.score}</span>
                </div>
                <button type="button" onClick={() => inspectGalleryPreset(preset)}>查看候选与解释</button>
              </article>
            );
          })}
        </div>
      </section>

      <section className={`benchmark-panel ${viewMode !== "single" ? "view-hidden" : ""}`} aria-label="随机组合压力测试结果">
        <div className="benchmark-heading">
          <div>
            <span className="step-label">03 / AUTOMATED EVALUATION</span>
            <h2>随机组合压力测试</h2>
          </div>
          <p>
            固定随机种子生成 {benchmark.total} 组文本、图片与 1–4 指标卡片，
            同时统计布局成功率、视觉得分、对比度通过率和 UX 违规率。
          </p>
        </div>
        <div className="benchmark-grid">
          <div className="benchmark-primary">
            <span>SOLVE RATE</span>
            <strong>{benchmark.successRate}<small>%</small></strong>
            <div className="benchmark-track" aria-label={`成功率${benchmark.successRate}%`}>
              <i style={{ width: `${benchmark.successRate}%` }} />
            </div>
            <p>{benchmark.solved} / {benchmark.total} 组通过全部硬约束</p>
          </div>
          <div className="benchmark-stat">
            <span>AVG LAYOUT SCORE</span>
            <strong>{benchmark.averageScore}<small>/100</small></strong>
          </div>
          <div className="benchmark-stat">
            <span>AVG VISUAL SCORE</span>
            <strong>{benchmark.averageVisualScore}<small>/100</small></strong>
          </div>
          <div className="benchmark-stat">
            <span>CONTRAST PASS</span>
            <strong>{benchmark.visualContrastPassRate}<small>%</small></strong>
          </div>
          <div className="benchmark-stat">
            <span>VISUAL STYLES</span>
            <strong>{benchmark.visualStyles}<small> 种</small></strong>
          </div>
          <div className="benchmark-stat violation-stat">
            <span>UX VIOLATION RATE</span>
            <strong>{benchmark.violationRate}<small>%</small></strong>
          </div>
        </div>
        <div className="violation-list">
          <span>TOP UNSATISFIED REASONS</span>
          {benchmark.topViolations.length ? benchmark.topViolations.map((item) => (
            <div key={item.label}>
              <strong>{item.count}</strong>
              <span>{item.label}</span>
            </div>
          )) : <p>本轮随机组合没有出现硬约束违规。</p>}
        </div>
        <section className="case-browser" aria-label="250组随机测试样本浏览器">
          <div className="case-browser-heading">
            <div>
              <span>TEST CASE BROWSER</span>
              <strong>查看第 {benchmarkCase.index} 组 · {benchmarkCase.category}</strong>
            </div>
            <div className="case-navigation">
              <button
                type="button"
                onClick={() => selectBenchmarkCase(benchmarkIndex - 1)}
                disabled={benchmarkIndex === 0}
                aria-label="上一组测试"
              >
                ←
              </button>
              <label>
                <span>编号</span>
                <input
                  type="number"
                  min="1"
                  max={benchmark.total}
                  value={benchmarkCase.index}
                  onChange={(event) =>
                    selectBenchmarkCase(Number(event.target.value) - 1)
                  }
                />
                <small>/ {benchmark.total}</small>
              </label>
              <button
                type="button"
                onClick={() => selectBenchmarkCase(benchmarkIndex + 1)}
                disabled={benchmarkIndex === benchmark.total - 1}
                aria-label="下一组测试"
              >
                →
              </button>
              <span
                className={`case-status ${benchmarkCase.result.status === "solved" ? "solved" : "unsatisfied"}`}
              >
                {benchmarkCase.result.status.toUpperCase()}
              </span>
            </div>
          </div>
          <input
            className="case-range"
            type="range"
            min="0"
            max={benchmark.total - 1}
            value={benchmarkIndex}
            onChange={(event) => selectBenchmarkCase(Number(event.target.value))}
            aria-label="选择测试样本"
          />
          <div className="case-render-row">
            <div
              className={`case-render-stage ${benchmarkCase.result.status === "solved" ? "is-solved" : "is-rejected"}`}
            >
              <span className="case-render-label">RENDERER PREVIEW · 160×160vp</span>
              <div className="case-card-shell">
                <CoordinateCard
                  layout={benchmarkCase.result}
                  showGuides={true}
                  onAction={handleAction}
                />
                {benchmarkCase.result.status === "unsatisfied" && (
                  <span className="rejected-layout-badge">REJECTED CANDIDATE</span>
                )}
              </div>
            </div>
            <div className="case-render-report">
              <div className="case-report-stats">
                <div>
                  <span>STATUS</span>
                  <strong>{benchmarkCase.result.status.toUpperCase()}</strong>
                </div>
                <div>
                  <span>SCORE</span>
                  <strong>{benchmarkCase.result.score}<small>/100</small></strong>
                </div>
                <div>
                  <span>NODES</span>
                  <strong>{benchmarkCase.result.nodes.length}</strong>
                </div>
                <div>
                  <span>CANDIDATES</span>
                  <strong>{benchmarkCase.result.candidateCount}</strong>
                </div>
              </div>
              <div className="case-degradation-summary">
                <span>
                  COMPRESSED · {benchmarkCase.result.compressedIds.length
                    ? benchmarkCase.result.compressedIds.join(" / ")
                    : "NONE"}
                </span>
                <span>
                  DROPPED · {benchmarkCase.result.droppedIds.length
                    ? benchmarkCase.result.droppedIds.join(" / ")
                    : "NONE"}
                </span>
              </div>
              <div className="case-violation-summary">
                <span>UX CHECK RESULT</span>
                {benchmarkCase.result.violations.length ? (
                  <ul>
                    {benchmarkCase.result.violations.map((violation) => (
                      <li key={violation}>{violation}</li>
                    ))}
                  </ul>
                ) : (
                  <p>所有硬约束均通过，这张卡片可以交给 Renderer 使用。</p>
                )}
              </div>
            </div>
          </div>
          <div className="case-code-grid">
            <div>
              <div className="case-code-label">
                <span>GENERATED ELEMENT DSL</span>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      JSON.stringify(benchmarkCase.dsl, null, 2),
                      `第 ${benchmarkCase.index} 组 DSL 已复制`,
                    )
                  }
                >
                  复制
                </button>
              </div>
              <pre>{JSON.stringify(benchmarkCase.dsl, null, 2)}</pre>
            </div>
            <div>
              <div className="case-code-label">
                <span>SOLVER RESULT / LAYOUT IR</span>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      benchmarkCaseResult,
                      `第 ${benchmarkCase.index} 组结果已复制`,
                    )
                  }
                >
                  复制
                </button>
              </div>
              <pre>{benchmarkCaseResult}</pre>
            </div>
          </div>
        </section>
      </section>

      <section className="architecture-strip" aria-label="方案对比">
        <div>
          <span className="architecture-version">V1 · TEMPLATE</span>
          <strong>DSL选择预定义布局</strong>
          <code>content.layout = &quot;single&quot;</code>
        </div>
        <span className="architecture-arrow">→</span>
        <div className="current">
          <span className="architecture-version">V5 · CONTENT-DRIVEN</span>
          <strong>LLM 语义编译 + 确定性设计求解</strong>
          <code>content → semantic DSL → quality-gated IR</code>
        </div>
      </section>

      <footer>
        <span>CONTENT → LLM / LOCAL SEMANTIC COMPILER → DSL → DUAL SOLVER → QUALITY GATE → RENDERER</span>
        <span>2×2 CARD RESEARCH PROTOTYPE</span>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
