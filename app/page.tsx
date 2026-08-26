"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  type ElementDSL,
  type LayoutNode,
  type LayoutResult,
  createCanvasTextMeasurer,
  estimatedTextMeasurer,
  parseElementDSL,
  solveLayout,
} from "./layout-engine";
import { runBenchmark } from "./layout-benchmark";

type Preset = {
  name: string;
  description: string;
  dsl: ElementDSL;
};

const presets: Preset[] = [
  {
    name: "自动求解",
    description: "引擎比较左右锚点",
    dsl: {
      version: "3.0",
      type: "adaptive-card",
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "待办事项",
          priority: 100,
        },
        {
          id: "app",
          type: "appIcon",
          symbol: "办",
          label: "待办应用",
          priority: 90,
        },
        {
          id: "date",
          type: "text",
          role: "caption",
          text: "今天",
          priority: 70,
        },
        {
          id: "task",
          type: "text",
          role: "body",
          text: "完成方案评审",
          supporting: "14:30 · 会议室 A",
          priority: 95,
        },
        {
          id: "complete",
          type: "iconButton",
          icon: "✓",
          label: "标记为完成",
          event: "completeTodo",
          placement: "auto",
          priority: 100,
        },
      ],
    },
  },
  {
    name: "左下操作",
    description: "语义偏好指定左下",
    dsl: {
      version: "3.0",
      type: "adaptive-card",
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "待办事项",
        },
        {
          id: "date",
          type: "text",
          role: "caption",
          text: "今天",
        },
        {
          id: "task",
          type: "text",
          role: "body",
          text: "完成方案评审",
          supporting: "14:30 · 会议室 A",
        },
        {
          id: "complete",
          type: "iconButton",
          icon: "✓",
          label: "标记为完成",
          event: "completeTodo",
          placement: "bottom-start",
        },
      ],
    },
  },
  {
    name: "胶囊操作",
    description: "操作区占据底部通栏",
    dsl: {
      version: "3.0",
      type: "adaptive-card",
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "今日天气",
        },
        {
          id: "app",
          type: "appIcon",
          symbol: "晴",
          label: "天气应用",
        },
        {
          id: "location",
          type: "text",
          role: "caption",
          text: "北京市",
        },
        {
          id: "weather",
          type: "text",
          role: "body",
          text: "28℃ 晴",
          supporting: "空气质量优",
        },
        {
          id: "detail",
          type: "capsuleButton",
          label: "查看详情",
          event: "openWeatherDetail",
        },
      ],
    },
  },
  {
    name: "并行指标",
    description: "同类元素自动等分",
    dsl: {
      version: "3.0",
      type: "adaptive-card",
      elements: [
        {
          id: "left-ear",
          type: "metric",
          label: "左耳",
          value: "82%",
          detail: "电量",
        },
        {
          id: "right-ear",
          type: "metric",
          label: "右耳",
          value: "76%",
          detail: "电量",
        },
        {
          id: "case",
          type: "metric",
          label: "充电盒",
          value: "64%",
          detail: "电量",
        },
        {
          id: "signal",
          type: "metric",
          label: "连接",
          value: "稳定",
          detail: "状态",
        },
      ],
    },
  },
  {
    name: "优先级降级",
    description: "空间不足时压缩或舍弃",
    dsl: {
      version: "3.0",
      type: "adaptive-card",
      elements: [
        {
          id: "title",
          type: "text",
          role: "title",
          text: "研究计划",
          priority: 90,
        },
        {
          id: "date",
          type: "text",
          role: "caption",
          text: "今天 14:30",
          priority: 35,
          optional: true,
        },
        {
          id: "primary",
          type: "text",
          role: "body",
          text: "完成生成式界面约束布局引擎的阶段评审",
          supporting: "核心任务 · 会议室 A",
          maxLines: 3,
          priority: 96,
        },
        {
          id: "secondary",
          type: "text",
          role: "body",
          text: "整理随机测试数据与失败案例",
          supporting: "低优先级补充信息",
          maxLines: 2,
          priority: 20,
          optional: true,
        },
        {
          id: "complete",
          type: "iconButton",
          icon: "✓",
          label: "完成任务",
          event: "completeResearchTask",
          placement: "auto",
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
          src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=420&q=80",
          alt: "山谷中的自然风景",
        },
      ],
    },
  },
];

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
          {element.symbol}
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
          {element.icon}
        </button>
      );
    case "capsuleButton":
      return (
        <button
          className="render-capsule-button"
          type="button"
          onClick={() => onAction(element.event)}
        >
          {element.label}
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
      className={`adaptive-card ${showGuides ? "show-guides" : ""}`}
      aria-label="约束布局生成的2×2卡片"
    >
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

export default function Home() {
  const [activePreset, setActivePreset] = useState(0);
  const [source, setSource] = useState(() =>
    JSON.stringify(presets[0].dsl, null, 2),
  );
  const [showGuides, setShowGuides] = useState(true);
  const [toast, setToast] = useState("");
  const [fontReady, setFontReady] = useState(false);
  const [benchmarkIndex, setBenchmarkIndex] = useState(0);

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
  const layout = useMemo(
    () => (parsed.data ? solveLayout(parsed.data, textMeasurer) : null),
    [parsed.data, textMeasurer],
  );
  const errors = [
    ...parsed.errors,
    ...(layout?.status === "unsatisfied" ? layout.violations : []),
  ];
  const isSolved = parsed.data !== null && layout?.status === "solved";

  const layoutIR = useMemo(() => {
    if (!layout) return "";
    return JSON.stringify(
      {
        card: layout.card,
        score: layout.score,
        measurement: layout.measurement,
        compressedIds: layout.compressedIds,
        droppedIds: layout.droppedIds,
        nodes: layout.nodes.map(({ id, x, y, width, height, presentation, truncated }) => ({
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
  }, [layout]);

  function selectPreset(index: number) {
    setActivePreset(index);
    setSource(JSON.stringify(presets[index].dsl, null, 2));
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
          <span>2×2 CARD</span>
          <span className="version-badge">LAYOUT ENGINE · V0.3</span>
        </div>
      </nav>

      <header className="intro">
        <div>
          <p className="kicker">CONSTRAINT-DRIVEN GENERATIVE UI</p>
          <h1>不给模板，只给元素。<br /><em>让规则算出坐标。</em></h1>
        </div>
        <div className="intro-side">
          <p>
            DSL只描述元素、语义、优先级和操作偏好。布局引擎测量真实文字，
            枚举矩形与降级方案，再输出可直接渲染的坐标 Layout IR。
          </p>
          <div className="pipeline" aria-label="生成流程">
            <span>ELEMENT DSL</span><i>→</i><span>SOLVER</span><i>→</i><span>LAYOUT IR</span>
          </div>
        </div>
      </header>

      <section className="workspace" aria-label="元素DSL与约束布局结果">
        <section className="panel editor-panel">
          <div className="panel-heading">
            <div>
              <span className="step-label">01 / SEMANTIC INPUT</span>
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
              <span className="step-label">02 / COORDINATE OUTPUT</span>
              <h2>约束布局结果</h2>
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
            <div className="stage-label">RENDERED FROM LAYOUT IR · 1.72×</div>
            <div className="ruler ruler-x"><span>160vp</span></div>
            <div className="ruler ruler-y"><span>160vp</span></div>
            <div className="card-scale">
              {isSolved && layout ? (
                <CoordinateCard
                  layout={layout}
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

          {layout && (
            <>
              <div className="solver-summary">
                <div>
                  <span>LAYOUT SCORE</span>
                  <strong>{layout.score}<small>/100</small></strong>
                </div>
                <div>
                  <span>CANDIDATES</span>
                  <strong>{layout.candidateCount}<small> 个</small></strong>
                </div>
                <div>
                  <span>HARD RULES</span>
                  <strong>
                    {layout.checks.filter((check) => check.passed).length}
                    <small>/{layout.checks.length}</small>
                  </strong>
                </div>
                <div>
                  <span>TEXT MEASURE</span>
                  <strong className="measurement-value">
                    {layout.measurement.toUpperCase()}
                  </strong>
                </div>
              </div>

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
                  {layout.checks.map((check) => (
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
                </ol>
              </section>
            </>
          )}
        </aside>
      </section>

      <section className="benchmark-panel" aria-label="随机组合压力测试结果">
        <div className="benchmark-heading">
          <div>
            <span className="step-label">03 / AUTOMATED EVALUATION</span>
            <h2>随机组合压力测试</h2>
          </div>
          <p>
            固定随机种子生成 {benchmark.total} 组文本、图片与 1–4 指标卡片，
            自动统计求解成功率、降级使用率和 UX 违规率。
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
            <span>AVG SCORE</span>
            <strong>{benchmark.averageScore}<small>/100</small></strong>
          </div>
          <div className="benchmark-stat">
            <span>AVG CANDIDATES</span>
            <strong>{benchmark.averageCandidates}</strong>
          </div>
          <div className="benchmark-stat">
            <span>COMPRESSED</span>
            <strong>{benchmark.compressedLayouts}<small> 组</small></strong>
          </div>
          <div className="benchmark-stat">
            <span>DROPPED OPTIONAL</span>
            <strong>{benchmark.droppedLayouts}<small> 组</small></strong>
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
          <span className="architecture-version">V3 · GENERALIZED</span>
          <strong>真实测量 + 优先级降级 + 自动评测</strong>
          <code>elements[] → candidates → Layout IR</code>
        </div>
      </section>

      <footer>
        <span>ELEMENT DSL → VALIDATOR → CONSTRAINT SOLVER → LAYOUT IR → RENDERER</span>
        <span>2×2 CARD RESEARCH PROTOTYPE</span>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
