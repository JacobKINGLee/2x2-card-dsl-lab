"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  type CardElement,
  type ElementDSL,
  type LayoutResult,
  parseElementDSL,
  solveLayout,
} from "./layout-engine";

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
      version: "2.0",
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
      version: "2.0",
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
      version: "2.0",
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
      version: "2.0",
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
      ],
    },
  },
  {
    name: "图片内容",
    description: "填充最大可用矩形",
    dsl: {
      version: "2.0",
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
  element: CardElement,
  onAction: (event: string) => void,
) {
  switch (element.type) {
    case "text":
      return (
        <div className={`render-text role-${element.role}`}>
          <span>{element.text}</span>
          {element.supporting && <small>{element.supporting}</small>}
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
            {renderElement(node.element, onAction)}
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
        <span>ELEMENT</span><span>X</span><span>Y</span><span>W</span><span>H</span>
      </div>
      {layout.nodes.map((node) => (
        <div className="coordinate-row" key={node.id}>
          <strong>{node.id}</strong>
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
  const parsed = useMemo(() => parseElementDSL(source), [source]);
  const layout = useMemo(
    () => (parsed.data ? solveLayout(parsed.data) : null),
    [parsed.data],
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
        nodes: layout.nodes.map(({ id, x, y, width, height }) => ({
          id,
          x,
          y,
          width,
          height,
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
          <span className="version-badge">LAYOUT ENGINE · V0.2</span>
        </div>
      </nav>

      <header className="intro">
        <div>
          <p className="kicker">CONSTRAINT-DRIVEN GENERATIVE UI</p>
          <h1>不给模板，只给元素。<br /><em>让规则算出坐标。</em></h1>
        </div>
        <div className="intro-side">
          <p>
            DSL只描述元素、语义和操作偏好。布局引擎枚举候选位置，
            过滤越界与重叠结果，再输出可直接渲染的坐标 Layout IR。
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
              </div>

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

      <section className="architecture-strip" aria-label="方案对比">
        <div>
          <span className="architecture-version">V1 · TEMPLATE</span>
          <strong>DSL选择预定义布局</strong>
          <code>content.layout = &quot;single&quot;</code>
        </div>
        <span className="architecture-arrow">→</span>
        <div className="current">
          <span className="architecture-version">V2 · CONSTRAINT</span>
          <strong>DSL只给元素，引擎输出坐标</strong>
          <code>elements[] → x / y / w / h</code>
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
