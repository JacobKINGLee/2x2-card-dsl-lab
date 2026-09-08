"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { SemanticIcon } from "../card-icons";
import { compileComponentDecision, type DecisionHostContext } from "../component-decision";
import { applyDeliveryGate } from "../delivery-gate";
import {
  type CardElement,
  type ElementDSL,
  type LayoutNode,
  type LayoutResult,
  solveLayout,
} from "../layout-engine";
import { extractSemanticsLocally } from "../local-semantic-extractor";
import { interpretLocally, planToDSL } from "../semantic-interpreter";
import styles from "./architecture.module.css";

type Example = {
  id: string;
  eyebrow: string;
  title: string;
  input: string;
  finding: string;
  context?: DecisionHostContext;
};

const examples: Example[] = [
  {
    id: "battery-saving",
    eyebrow: "电量与操作",
    title: "低电量、预计续航和省电入口",
    input: "手机电量只剩18%，预计还能使用2小时。我希望能点“开启省电模式”。",
    finding: "这是典型的正常需求：一个主指标、一个辅助事实和一个明确动作。v2 会分别保存电量、预计续航和动作意图，再验证宿主是否真的支持省电模式。",
    context: {
      version: "mentor-demo-v2",
      actions: [{
        id: "power-saving",
        intents: ["enableSaving"],
        label: "开启省电模式",
        event: "enablePowerSaving",
        available: true,
        target: "battery",
        icon: "zap",
        iconReviewed: true,
      }],
    },
  },
  {
    id: "focus-session",
    eyebrow: "专注计时",
    title: "展示时长并提供暂停操作",
    input: "我正在专注，已经进行了25分钟，希望卡片上有“暂停专注”按钮。",
    finding: "v2 把 25 分钟识别为 duration，并把暂停专注作为独立动作意图；组件与可执行事件都由后续层决定。",
    context: {
      version: "mentor-demo-v2",
      actions: [{
        id: "pause-focus",
        intents: ["pauseFocus"],
        label: "暂停专注",
        event: "pauseFocusSession",
        available: true,
        target: "focus",
        icon: "clock",
        iconReviewed: true,
      }],
    },
  },
  {
    id: "system-metrics",
    eyebrow: "并列指标",
    title: "CPU 与内存同时展示",
    input: "当前CPU占用35%，内存占用62%，请在一张卡片里并排展示。",
    finding: "v1 的单主值协议只能挑一个指标；v2 可以把 CPU 和内存标记为 parallel，规则再选择两个 metric 并排布局。",
  },
];

const differences = [
  ["模型职责", "理解内容，同时选择组件和事件", "只提取事实、动作语义、偏好与歧义"],
  ["中间协议", "单一成品计划 SemanticPlan", "可审计语义文档 SemanticDocument"],
  ["规则输入", "模型计划，过渡期还会重读原句", "结构化语义 + 宿主能力，不接收原句"],
  ["动作安全", "模型给出 actionEvent，默认补一个按钮", "模型只给 intent，宿主验证后才生成 event"],
  ["异常处理", "规范化、截断或补默认值后继续出卡", "澄清、不支持或不出卡，不修改关键事实"],
  ["ready 含义", "已经生成卡片计划", "DSL、布局、质量和信息完整性全部通过"],
  ["可评测性", "最终错了，很难定位是哪一层", "模型理解、规则决策、端到端分别评分"],
] as const;

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function JsonDetails({ title, summary, children, tone = "neutral" }: {
  title: string;
  summary: string;
  children: ReactNode;
  tone?: "neutral" | "old" | "new";
}) {
  return (
    <details className={`${styles.stage} ${styles[`stage_${tone}`]}`}>
      <summary>
        <span>{title}</span>
        <strong>{summary}</strong>
      </summary>
      <div className={styles.stageBody}>{children}</div>
    </details>
  );
}

function renderElement(node: LayoutNode) {
  const element = node.element;
  switch (element.type) {
    case "text":
      return (
        <div className={`render-text role-${element.role} is-${node.presentation} ${node.truncated ? "is-truncated" : ""}`}>
          <span style={{ WebkitLineClamp: node.lineCount }}>{element.text}</span>
          {element.supporting && node.presentation === "full" && <small>{element.supporting}</small>}
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
        <button className="render-icon-button" type="button" aria-label={element.label}>
          <SemanticIcon name={element.icon === "✓" ? "check" : element.icon} size={19} />
        </button>
      );
    case "capsuleButton":
      return (
        <button className="render-capsule-button" type="button">
          {element.icon && <SemanticIcon name={element.icon} size={14} />}
          <span>{element.label}</span>
        </button>
      );
    case "metric":
      return (
        <div className="render-metric">
          <span>{element.label}</span><strong>{element.value}</strong>{element.detail && <small>{element.detail}</small>}
        </div>
      );
    case "heroMetric":
      return (
        <div className="render-hero-metric">
          {element.icon && <span className="hero-icon"><SemanticIcon name={element.icon} size={28} /></span>}
          <div className="hero-copy">
            <strong>{element.value}<em>{element.unit}</em></strong>
            <span>{element.label}</span>{element.detail && <small>{element.detail}</small>}
          </div>
        </div>
      );
    case "progressRing": {
      const progressStyle = { "--progress": element.value } as CSSProperties;
      return (
        <div className="render-progress-ring" style={progressStyle}>
          <div className="ring-visual">
            <svg viewBox="0 0 52 52" aria-hidden="true"><circle className="ring-track" cx="26" cy="26" r="21" /><circle className="ring-value" cx="26" cy="26" r="21" pathLength="100" /></svg>
            {element.icon && <span><SemanticIcon name={element.icon} size={22} /></span>}
          </div>
          <div className="hero-copy"><strong>{element.displayValue}</strong><span>{element.label}</span>{element.detail && <small>{element.detail}</small>}</div>
        </div>
      );
    }
    case "miniProgress": {
      const progressStyle = { "--progress-width": `${element.value}%` } as CSSProperties;
      return (
        <div className="render-mini-progress" style={progressStyle}>
          <div className="mini-progress-heading"><span>{element.label}</span><strong>{element.displayValue}</strong></div>
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

function RenderedCard({ dsl, emptyTitle, emptyMessage }: {
  dsl: ElementDSL | null;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  const layout = useMemo<LayoutResult | null>(() => dsl ? solveLayout(dsl) : null, [dsl]);
  if (!layout || layout.status !== "solved") {
    return (
      <div className={styles.nonReady}>
        <span>NON-READY</span>
        <strong>{emptyTitle ?? "未生成卡片"}</strong>
        <p>{emptyMessage ?? "当前结果不会进入最终渲染。"}</p>
      </div>
    );
  }
  return (
    <article className={`adaptive-card composition-${layout.composition.id} palette-${layout.visual.palette} surface-${layout.visual.surface} foreground-${layout.visual.foreground} action-${layout.visual.actionStyle}`} aria-label="2×2 卡片渲染结果">
      <div className="card-atmosphere" aria-hidden="true" />
      <div className="card-layout">
        {layout.nodes.map((node) => (
          <div className={`layout-node node-${node.element.type}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height }} key={node.id}>
            {renderElement(node)}
          </div>
        ))}
      </div>
    </article>
  );
}

function SchemePanel({ version, eyebrow, title, thesis, flow, responsibilities, accent }: {
  version: string;
  eyebrow: string;
  title: string;
  thesis: string;
  flow: string[];
  responsibilities: string[];
  accent: "old" | "new";
}) {
  return (
    <article className={`${styles.scheme} ${styles[`scheme_${accent}`]}`}>
      <div className={styles.schemeHeading}>
        <div><span>{eyebrow}</span><h2>{title}</h2></div>
        <b>{version}</b>
      </div>
      <p className={styles.schemeThesis}>{thesis}</p>
      <div className={styles.flow} aria-label={`${title}处理流程`}>
        {flow.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>)}
      </div>
      <ul>{responsibilities.map((item) => <li key={item}>{item}</li>)}</ul>
    </article>
  );
}

export default function ArchitectureComparison() {
  const [selectedId, setSelectedId] = useState(examples[0].id);
  const selected = examples.find((item) => item.id === selectedId) ?? examples[0];
  const run = useMemo(() => {
    const oldPlan = interpretLocally(selected.input);
    const oldDsl = planToDSL(oldPlan);
    const semantics = extractSemanticsLocally(selected.input);
    const componentDecision = compileComponentDecision(semantics, selected.context);
    const delivery = applyDeliveryGate(componentDecision);
    const componentDecisionMeta = { status: componentDecision.status, decision: componentDecision.decision };
    return { oldPlan, oldDsl, semantics, componentDecisionMeta, delivery };
  }, [selected]);

  const oldElements = run.oldDsl.elements.map((element: CardElement) => element.type).join(" + ");
  const newElements = run.delivery.dsl?.elements.map((element: CardElement) => element.type).join(" + ") ?? "无 DSL";

  return (
    <main className={styles.shell}>
      <nav className={styles.topbar} aria-label="方案对比页导航">
        <Link className={styles.brand} href="/"><span className={styles.brandMark} aria-hidden="true"><i /><i /><i /><i /></span><span>CONSTRAINT LAB</span></Link>
        <div><Link href="/">实验台</Link><Link href="/catalog">组件图鉴</Link><span>ARCHITECTURE · V1→V2</span></div>
      </nav>

      <header className={styles.hero}>
        <p>SEMANTIC ARCHITECTURE EVOLUTION</p>
        <h1>不是换一套提示词，<br /><em>而是重新划分系统责任。</em></h1>
        <div className={styles.heroFoot}>
          <p>第一版让模型直接产出接近成品的卡片计划；第二版让模型只提交可审计语义，再由规则、宿主能力和交付门禁共同完成卡片。</p>
          <div><span>01 理解</span><i>→</i><span>02 决策</span><i>→</i><span>03 交付</span></div>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="schemes-title">
        <div className={styles.sectionHeading}><span>01 / 两套技术方案</span><h2 id="schemes-title">先看职责怎么分</h2></div>
        <div className={styles.schemeGrid}>
          <SchemePanel
            version="SemanticPlan v1"
            eyebrow="第一版 · 模型主导"
            title="模型直接设计卡片"
            thesis="一次输出同时回答“用户说了什么”和“卡片应该长什么样”。链路短，但语义理解和 UI 决策无法拆开验证。"
            flow={["自然语言", "模型 / 正则", "成品计划", "planToDSL", "卡片"]}
            responsibilities={["模型选择 visualization、icon 和 actionEvent", "协议固定为一个主值、一套标题和一个动作", "后端主要负责校验格式与计算布局"]}
            accent="old"
          />
          <SchemePanel
            version="SemanticDocument 2.0"
            eyebrow="第二版 · 分层协作"
            title="模型理解，规则决策"
            thesis="模型只保留事实与意图；确定性规则选择组件；宿主证明资源和能力；交付门禁负责最后的可用性。"
            flow={["自然语言", "语义事实", "规则 + 宿主", "DSL", "交付门禁"]}
            responsibilities={["模型提取 facts、actions、preferences、ambiguities", "规则只消费结构化语义，不再重读用户原句", "ready 必须通过 DSL、布局、质量和信息完整性检查"]}
            accent="new"
          />
        </div>
        <aside className={styles.transitionNote}>
          <span>过渡实现</span>
          <p>中间版本虽然增加了组件规则，但规则仍接收原句并用正则重新理解自然语言，因此模型与规则的责任依然重叠。第二版才真正切断了这条旁路。</p>
        </aside>
      </section>

      <section className={styles.section} aria-labelledby="difference-title">
        <div className={styles.sectionHeading}><span>02 / 核心差异</span><h2 id="difference-title">从“生成结果”转向“保存事实”</h2></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>比较维度</th><th>第一版</th><th>第二版</th></tr></thead>
            <tbody>{differences.map(([dimension, oldValue, newValue]) => <tr key={dimension}><th>{dimension}</th><td>{oldValue}</td><td>{newValue}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="examples-title">
        <div className={styles.sectionHeading}><span>03 / 端到端对比</span><h2 id="examples-title">同一句话，两条流水线</h2></div>
        <div className={styles.exampleTabs} role="tablist" aria-label="选择对比案例">
          {examples.map((example, index) => (
            <button key={example.id} data-example-id={example.id} type="button" role="tab" aria-selected={selected.id === example.id} className={selected.id === example.id ? styles.activeTab : ""} onClick={() => setSelectedId(example.id)}>
              <span>0{index + 1}</span><strong>{example.eyebrow}</strong><small>{example.title}</small>
            </button>
          ))}
        </div>

        <div className={styles.exampleIntro}>
          <div><span>USER INPUT</span><q>{selected.input}</q></div>
          <p>{selected.finding}</p>
        </div>

        <div className={styles.laneGrid}>
          <article className={`${styles.lane} ${styles.oldLane}`} data-pipeline="v1">
            <header><div><span>PIPELINE A</span><h3>第一版</h3></div><b>模型输出接近成品</b></header>
            <div className={styles.steps}>
              <JsonDetails title="01 · 输入" summary="自然语言" tone="old"><pre>{selected.input}</pre></JsonDetails>
              <JsonDetails title="02 · 语义编译" summary="SemanticPlan" tone="old"><pre>{json(run.oldPlan)}</pre></JsonDetails>
              <JsonDetails title="03 · 组件决策" summary="没有独立边界" tone="old"><p>visualization、icon、标题和 actionEvent 已由上一步决定；这一层只执行 <code>planToDSL</code>。</p></JsonDetails>
              <JsonDetails title="04 · DSL" summary={oldElements} tone="old"><pre>{json(run.oldDsl)}</pre></JsonDetails>
              <JsonDetails title="05 · 交付判断" summary="只要能布局就渲染" tone="old"><p>没有独立的信息完整性门禁。语义即使错了，也可能得到结构合法、视觉完整的卡片。</p></JsonDetails>
            </div>
            <div className={styles.previewHeading}><span>FINAL RENDER</span><strong>旧版输出</strong></div>
            <div className={styles.cardFrame} data-card-output="v1"><RenderedCard dsl={run.oldDsl} /></div>
          </article>

          <article className={`${styles.lane} ${styles.newLane}`} data-pipeline="v2">
            <header><div><span>PIPELINE B</span><h3>第二版</h3></div><b>模型只输出语义</b></header>
            <div className={styles.steps}>
              <JsonDetails title="01 · 输入" summary="自然语言" tone="new"><pre>{selected.input}</pre></JsonDetails>
              <JsonDetails title="02 · 语义提取" summary="SemanticDocument 2.0" tone="new"><pre>{json(run.semantics)}</pre></JsonDetails>
              <JsonDetails title="03 · 规则决策" summary={`${run.componentDecisionMeta.status} · ${run.componentDecisionMeta.decision.code}`} tone="new"><pre>{json(run.componentDecisionMeta)}</pre></JsonDetails>
              <JsonDetails title="04 · DSL" summary={newElements} tone="new"><pre>{run.delivery.dsl ? json(run.delivery.dsl) : "null"}</pre></JsonDetails>
              <JsonDetails title="05 · 交付门禁" summary={`${run.delivery.status} · ${run.delivery.delivery.status}`} tone="new"><pre>{json(run.delivery.delivery)}</pre></JsonDetails>
            </div>
            <div className={styles.previewHeading}><span>FINAL RENDER</span><strong>新版输出</strong></div>
            <div className={styles.cardFrame} data-card-output="v2">
              <RenderedCard dsl={run.delivery.dsl} emptyTitle={run.delivery.status === "needs_clarification" ? "需要用户确认" : "不生成卡片"} emptyMessage={run.delivery.decision.question ?? run.delivery.decision.message} />
            </div>
          </article>
        </div>
      </section>

      <section className={styles.conclusion} aria-labelledby="conclusion-title">
        <span>04 / 汇报结论</span>
        <h2 id="conclusion-title">第一版验证“小模型能不能直接设计卡片”；第二版验证“小模型能不能可靠提取语义”。</h2>
        <div>
          <p>模型理解错误、规则错误和布局错误现在可以分别定位。</p>
          <p>错误事实不再因为 DSL 合法就被包装成 ready 卡片。</p>
          <p>下一步是把真实 Qwen 输出接入冻结的独立新输入集。</p>
        </div>
      </section>
    </main>
  );
}
