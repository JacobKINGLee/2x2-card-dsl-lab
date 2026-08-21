"use client";

import { useMemo, useState } from "react";

type TextItem = { type: "text"; eyebrow?: string; text: string; detail?: string };
type ImageItem = { type: "image"; src: string; alt: string };
type MetricItem = { type: "metric"; label: string; value: string; detail?: string };

type CardDSL = {
  version: "1.0";
  type: "card";
  title?: { primary: string; secondary?: string; icon?: string };
  content:
    | { layout: "single"; item: TextItem | ImageItem }
    | { layout: "split"; items: [TextItem | MetricItem, TextItem | MetricItem] };
  action?:
    | { type: "capsule"; text: string; event: string }
    | { type: "icon"; icon: string; label: string; event: string };
};

type ValidationResult = { data: CardDSL | null; errors: string[] };

const presets: Array<{ name: string; description: string; dsl: CardDSL }> = [
  {
    name: "胶囊按钮",
    description: "标题 + 文本 + 核心操作",
    dsl: {
      version: "1.0",
      type: "card",
      title: { primary: "今日天气", secondary: "北京市", icon: "晴" },
      content: {
        layout: "single",
        item: { type: "text", eyebrow: "当前温度", text: "28℃ 晴", detail: "空气质量优" },
      },
      action: { type: "capsule", text: "查看详情", event: "openWeatherDetail" },
    },
  },
  {
    name: "图标按钮",
    description: "文本信息 + 轻量操作",
    dsl: {
      version: "1.0",
      type: "card",
      title: { primary: "待办事项", icon: "办" },
      content: {
        layout: "single",
        item: { type: "text", eyebrow: "今天", text: "完成方案评审", detail: "14:30 · 会议室 A" },
      },
      action: { type: "icon", icon: "✓", label: "标记为完成", event: "completeTodo" },
    },
  },
  {
    name: "纯图片",
    description: "无按钮时横向撑满",
    dsl: {
      version: "1.0",
      type: "card",
      title: { primary: "本周回忆" },
      content: {
        layout: "single",
        item: {
          type: "image",
          src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=420&q=80",
          alt: "山谷中的自然风景",
        },
      },
    },
  },
  {
    name: "二分区域",
    description: "两个并行信息，无标题与按钮",
    dsl: {
      version: "1.0",
      type: "card",
      content: {
        layout: "split",
        items: [
          { type: "metric", label: "左耳", value: "82%", detail: "电量" },
          { type: "metric", label: "右耳", value: "76%", detail: "电量" },
        ],
      },
    },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateDSL(source: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知 JSON 错误";
    return { data: null, errors: [`JSON 语法错误：${message}`] };
  }

  if (!isRecord(raw)) return { data: null, errors: ["根节点必须是一个 JSON 对象"] };
  const errors: string[] = [];

  if (raw.version !== "1.0") errors.push('version 必须为 "1.0"');
  if (raw.type !== "card") errors.push('type 必须为 "card"');
  if ("style" in raw) errors.push("不允许在 DSL 中声明 style，视觉规则由 Renderer 统一控制");

  if (raw.title !== undefined) {
    if (!isRecord(raw.title)) {
      errors.push("title 必须是一个对象");
    } else {
      if (typeof raw.title.primary !== "string" || !raw.title.primary.trim()) {
        errors.push("title.primary 为必填字符串");
      }
      if (raw.title.secondary !== undefined && typeof raw.title.secondary !== "string") {
        errors.push("title.secondary 必须是字符串");
      }
      if (raw.title.icon !== undefined && typeof raw.title.icon !== "string") {
        errors.push("title.icon 必须是字符串");
      }
    }
  }

  if (!isRecord(raw.content)) {
    errors.push("content 为必填对象");
  } else if (raw.content.layout === "single") {
    if (!isRecord(raw.content.item)) {
      errors.push("single 布局必须包含 item 对象");
    } else if (raw.content.item.type === "text") {
      if (typeof raw.content.item.text !== "string" || !raw.content.item.text.trim()) {
        errors.push("文本内容必须包含非空的 text");
      }
    } else if (raw.content.item.type === "image") {
      if (typeof raw.content.item.src !== "string" || !raw.content.item.src.trim()) {
        errors.push("图片内容必须包含 src");
      }
      if (typeof raw.content.item.alt !== "string" || !raw.content.item.alt.trim()) {
        errors.push("图片内容必须包含 alt 文本");
      }
    } else {
      errors.push("single.item.type 仅支持 text 或 image");
    }
  } else if (raw.content.layout === "split") {
    if (raw.title !== undefined) errors.push("split 布局不能包含 title");
    if (raw.action !== undefined) errors.push("split 布局不能包含 action");
    if (!Array.isArray(raw.content.items) || raw.content.items.length !== 2) {
      errors.push("split 布局必须且只能包含两个 items");
    } else {
      raw.content.items.forEach((item, index) => {
        if (!isRecord(item)) {
          errors.push(`items[${index}] 必须是对象`);
        } else if (item.type === "metric") {
          if (typeof item.label !== "string" || typeof item.value !== "string") {
            errors.push(`items[${index}] 的 metric 必须包含 label 和 value`);
          }
        } else if (item.type === "text") {
          if (typeof item.text !== "string" || !item.text.trim()) {
            errors.push(`items[${index}] 的 text 不能为空`);
          }
        } else {
          errors.push(`items[${index}].type 仅支持 metric 或 text`);
        }
      });
    }
  } else {
    errors.push("content.layout 仅支持 single 或 split");
  }

  if (raw.action !== undefined) {
    if (!isRecord(raw.action)) {
      errors.push("action 必须是一个对象");
    } else if (raw.action.type === "capsule") {
      if (typeof raw.action.text !== "string" || !raw.action.text.trim()) {
        errors.push("capsule action 必须包含 text");
      }
      if (typeof raw.action.event !== "string" || !raw.action.event.trim()) {
        errors.push("capsule action 必须包含 event");
      }
    } else if (raw.action.type === "icon") {
      if (typeof raw.action.icon !== "string" || !raw.action.icon.trim()) {
        errors.push("icon action 必须包含 icon");
      }
      if (typeof raw.action.label !== "string" || !raw.action.label.trim()) {
        errors.push("icon action 必须包含无障碍 label");
      }
      if (typeof raw.action.event !== "string" || !raw.action.event.trim()) {
        errors.push("icon action 必须包含 event");
      }
    } else {
      errors.push("action.type 仅支持 capsule 或 icon");
    }
  }

  return errors.length ? { data: null, errors } : { data: raw as CardDSL, errors: [] };
}

function CardPreview({ dsl, onAction }: { dsl: CardDSL; onAction: (event: string) => void }) {
  const contentClass = [
    "ux-content",
    dsl.content.layout === "split" ? "is-split" : "is-single",
    dsl.action?.type === "icon" ? "has-icon-action" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className="ux-card" aria-label="2×2 卡片预览">
      {dsl.title && (
        <header className={`ux-title ${dsl.title.secondary ? "has-secondary" : ""}`}>
          <div className="ux-title-copy">
            <strong>{dsl.title.primary}</strong>
            {dsl.title.secondary && <span>{dsl.title.secondary}</span>}
          </div>
          {dsl.title.icon && <span className="ux-app-icon" aria-hidden="true">{dsl.title.icon}</span>}
        </header>
      )}

      <section className={contentClass}>
        {dsl.content.layout === "single" ? (
          dsl.content.item.type === "text" ? (
            <div className="ux-text-content">
              {dsl.content.item.eyebrow && <span className="ux-eyebrow">{dsl.content.item.eyebrow}</span>}
              <p>{dsl.content.item.text}</p>
              {dsl.content.item.detail && <small>{dsl.content.item.detail}</small>}
            </div>
          ) : (
            <div className="ux-image-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dsl.content.item.src} alt={dsl.content.item.alt} />
            </div>
          )
        ) : (
          dsl.content.items.map((item, index) => (
            <div className="ux-split-item" key={`${item.type}-${index}`}>
              {item.type === "metric" ? (
                <>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  {item.detail && <small>{item.detail}</small>}
                </>
              ) : <p>{item.text}</p>}
            </div>
          ))
        )}
      </section>

      {dsl.action?.type === "capsule" && (
        <button className="ux-capsule" type="button" onClick={() => onAction(dsl.action!.event)}>
          {dsl.action.text}
        </button>
      )}
      {dsl.action?.type === "icon" && (
        <button
          className="ux-icon-button"
          type="button"
          aria-label={dsl.action.label}
          onClick={() => onAction(dsl.action!.event)}
        >
          {dsl.action.icon}
        </button>
      )}
    </article>
  );
}

export default function Home() {
  const [activePreset, setActivePreset] = useState(0);
  const [source, setSource] = useState(() => JSON.stringify(presets[0].dsl, null, 2));
  const [toast, setToast] = useState("");
  const validation = useMemo(() => validateDSL(source), [source]);

  function selectPreset(index: number) {
    setActivePreset(index);
    setSource(JSON.stringify(presets[index].dsl, null, 2));
  }

  function formatSource() {
    try {
      setSource(JSON.stringify(JSON.parse(source), null, 2));
    } catch {
      setToast("JSON 尚未通过语法校验");
      window.setTimeout(() => setToast(""), 1800);
    }
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      setToast("DSL 已复制");
    } catch {
      setToast("复制失败，请手动选择文本");
    }
    window.setTimeout(() => setToast(""), 1800);
  }

  function handleAction(event: string) {
    setToast(`已触发事件：${event}`);
    window.setTimeout(() => setToast(""), 2200);
  }

  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="Demo 导航">
        <div className="brand">
          <span className="brand-grid" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>DSL LAB</span>
        </div>
        <div className="topbar-meta">
          <span>2×2 CARD</span>
          <span className="version-badge">UX SPEC · V0.1</span>
        </div>
      </nav>

      <header className="intro">
        <div>
          <p className="kicker">GENERATIVE UI PROTOTYPE</p>
          <h1>把设计规范，变成<br /><em>可执行的界面语言。</em></h1>
        </div>
        <p className="intro-copy">
          编辑 JSON DSL，Renderer 会锁定安全边距、排版和布局规则，
          并即时生成符合规范的160×160vp卡片。
        </p>
      </header>

      <section className="workspace" aria-label="DSL 编辑与卡片预览">
        <section className="panel editor-panel">
          <div className="panel-heading">
            <div><span className="step-label">01 / INPUT</span><h2>DSL 编辑器</h2></div>
            <div className="editor-actions">
              <button type="button" onClick={formatSource}>格式化</button>
              <button type="button" onClick={copySource}>复制</button>
            </div>
          </div>

          <div className="preset-tabs" role="tablist" aria-label="DSL 示例">
            {presets.map((preset, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={activePreset === index}
                className={activePreset === index ? "active" : ""}
                onClick={() => selectPreset(index)}
                key={preset.name}
              >
                <strong>{preset.name}</strong><span>{preset.description}</span>
              </button>
            ))}
          </div>

          <div className="code-shell">
            <div className="code-toolbar">
              <span><i /> card.dsl.json</span><span>JSON</span>
            </div>
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              spellCheck={false}
              aria-label="JSON DSL 编辑器"
            />
          </div>

          <div className={`validation ${validation.errors.length ? "invalid" : "valid"}`}>
            <div className="validation-title">
              <span className="status-dot" />
              <strong>{validation.errors.length ? "Schema 校验未通过" : "Schema 校验通过"}</strong>
              <span>{validation.errors.length ? `${validation.errors.length} 个问题` : "可安全渲染"}</span>
            </div>
            {validation.errors.length > 0 ? (
              <ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul>
            ) : <p>结构合法，所有视觉参数将由 Renderer 注入。</p>}
          </div>
        </section>

        <aside className="panel preview-panel">
          <div className="panel-heading">
            <div><span className="step-label">02 / OUTPUT</span><h2>实时预览</h2></div>
            <span className={`live-pill ${validation.data ? "is-live" : ""}`}>
              <i /> {validation.data ? "LIVE" : "PAUSED"}
            </span>
          </div>

          <div className="preview-stage">
            <div className="ruler ruler-x"><span>160vp</span></div>
            <div className="ruler ruler-y"><span>160vp</span></div>
            <div className="card-scale">
              {validation.data ? (
                <CardPreview dsl={validation.data} onAction={handleAction} />
              ) : (
                <div className="render-blocked">
                  <span>!</span><strong>渲染已暂停</strong><p>修复左侧 DSL 后自动恢复预览</p>
                </div>
              )}
            </div>
          </div>

          <div className="token-section">
            <div className="section-caption">
              <span>RENDERER TOKENS</span><span>固定规则，不由 DSL 修改</span>
            </div>
            <dl className="token-grid">
              <div><dt>卡片尺寸</dt><dd>160 × 160vp</dd></div>
              <div><dt>安全边距</dt><dd>12vp</dd></div>
              <div><dt>卡片圆角</dt><dd>20vp</dd></div>
              <div><dt>区域间距</dt><dd>8vp</dd></div>
              <div><dt>按钮高度</dt><dd>36vp</dd></div>
              <div><dt>内容字号</dt><dd>14fp / 20fp</dd></div>
            </dl>
          </div>

          <div className="rule-note">
            <span>RULE</span><p>二分区域固定为两个并行内容，并自动禁用标题和按钮。</p>
          </div>
        </aside>
      </section>

      <footer>
        <span>UX SPEC → DSL → VALIDATOR → RENDERER</span>
        <span>2×2 CARD PROOF OF CONCEPT</span>
      </footer>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
