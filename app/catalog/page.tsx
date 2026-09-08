import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { CARD_ICONS, SemanticIcon } from "../card-icons";
import {
  DOMAIN_PALETTES,
  resolveVisualCandidates,
  type VisualDomain,
  type VisualEmphasis,
  type VisualPalette,
} from "../visual-resolver";
import styles from "./catalog.module.css";

export const metadata: Metadata = {
  title: "Card DSL 组件与视觉语法图鉴",
  description: "独立查看 2×2 Card DSL 的所有 domain、emphasis、组件、颜色与内置图标。",
};

const domains: Array<{
  id: VisualDomain;
  label: string;
  description: string;
  example: string;
  icon: string;
}> = [
  { id: "weather", label: "天气", description: "温度、降雨与天气预报", example: "上海 29°C · 下午有雨", icon: "cloud-rain" },
  { id: "wellness", label: "健康与睡眠", description: "睡眠评分、心率与健康状态", example: "睡眠得分 82", icon: "moon" },
  { id: "fitness", label: "运动健身", description: "步数、训练与运动目标", example: "今日 6,820 步", icon: "activity" },
  { id: "system", label: "系统与设备", description: "内存、耳机与设备连接", example: "设备运行正常", icon: "sparkles" },
  { id: "energy", label: "电量与能源", description: "电池、充电与省电提醒", example: "剩余电量 18%", icon: "battery" },
  { id: "productivity", label: "日程与效率", description: "会议、任务与提醒", example: "15:00 项目例会", icon: "calendar" },
  { id: "environment", label: "环境", description: "AQI、空气质量与湿度", example: "空气质量 AQI 42", icon: "droplets" },
  { id: "generic", label: "通用内容", description: "无法明确归类的信息摘要", example: "当前状态正常", icon: "sparkles" },
];

const emphases: Array<{
  id: VisualEmphasis;
  label: string;
  description: string;
  use: string;
  order: string;
}> = [
  { id: "quiet", label: "低强调", description: "降低视觉噪声，优先浅色和留白", use: "睡眠、正常状态、柔和提示", order: "tint → neutral → gradient → dark" },
  { id: "standard", label: "标准强调", description: "兼顾信息层级与日常可读性", use: "普通信息与默认状态", order: "tint → gradient → solid → neutral" },
  { id: "high", label: "高强调", description: "使用强对比 surface 突出关键指标", use: "警告、紧急、重要指标", order: "gradient → solid → tint → dark" },
];

const palettes: Array<{
  id: VisualPalette;
  label: string;
  solid: string;
  deep: string;
  soft: string;
}> = [
  { id: "sky", label: "天空蓝", solid: "#1388ED", deep: "#0751C8", soft: "#E3F3FF" },
  { id: "violet", label: "紫罗兰", solid: "#A32BF4", deep: "#6516D1", soft: "#F5E8FF" },
  { id: "orange", label: "活力橙", solid: "#F07200", deep: "#B63700", soft: "#FFF0DF" },
  { id: "mint", label: "薄荷绿", solid: "#23AA67", deep: "#0B7440", soft: "#E6F6E8" },
  { id: "amber", label: "琥珀黄", solid: "#E99508", deep: "#A94F00", soft: "#FFF4D9" },
  { id: "indigo", label: "靛蓝", solid: "#4265DD", deep: "#2443B5", soft: "#E9EFFF" },
  { id: "graphite", label: "石墨灰", solid: "#48505D", deep: "#20242D", soft: "#EDF0F4" },
];

const components: Array<{
  type: string;
  label: string;
  purpose: string;
  fields: string;
  variants: string;
  iconSupport: string;
  limit: string;
}> = [
  { type: "text", label: "文字", purpose: "标题、正文与辅助说明", fields: "role · text · supporting · maxLines", variants: "title / body / caption", iconSupport: "0 · 不支持", limit: "title 最多 1 个" },
  { type: "appIcon", label: "应用图标", purpose: "标识应用、服务或业务领域", fields: "icon | symbol · label", variants: "内置图标或 Emoji", iconSupport: "14 · 另支持 symbol", limit: "每卡最多 1 个" },
  { type: "iconButton", label: "图标按钮", purpose: "只有图标的紧凑操作入口", fields: "icon · label · event · placement", variants: "start / end / auto", iconSupport: "14 · 必填", limit: "与 capsuleButton 合计 1 个" },
  { type: "capsuleButton", label: "胶囊按钮", purpose: "带文字的主要操作入口", fields: "icon? · label · event", variants: "soft / glass 由系统决定", iconSupport: "14 · 可选", limit: "与 iconButton 合计 1 个" },
  { type: "metric", label: "普通指标", purpose: "并排显示多个标签与数值", fields: "label · value · detail?", variants: "1–4 列由 Solver 决定", iconSupport: "0 · 不支持", limit: "每卡最多 4 个" },
  { type: "heroMetric", label: "大数值主视觉", purpose: "突出独立核心数值或状态", fields: "icon? · value · unit? · label · detail?", variants: "leading / centered / trailing", iconSupport: "14 · 可选", limit: "主视觉三选一" },
  { type: "progressRing", label: "环形进度", purpose: "表达评分、得分与环形占比", fields: "icon? · value · displayValue · label", variants: "0–100 环形填充", iconSupport: "14 · 可选", limit: "主视觉三选一" },
  { type: "miniProgress", label: "迷你进度条", purpose: "表达百分比、完成度和剩余量", fields: "value · displayValue · label · detail?", variants: "0–100 线性填充", iconSupport: "0 · 不支持", limit: "主视觉三选一" },
  { type: "image", label: "图片", purpose: "展示一张具有无障碍说明的图片", fields: "src · alt", variants: "object-fit: cover", iconSupport: "0 · 不支持", limit: "每卡最多 1 张" },
];

function visualFor(domain: VisualDomain, emphasis: VisualEmphasis) {
  return resolveVisualCandidates(
    { domain, state: "informative", emphasis },
    [{ type: "heroMetric" }],
  )[0];
}

function VisualSurface({
  domain,
  emphasis,
  children,
  className = "",
}: {
  domain: VisualDomain;
  emphasis: VisualEmphasis;
  children: ReactNode;
  className?: string;
}) {
  const visual = visualFor(domain, emphasis);
  return (
    <div className={`${styles.visualSurface} ${styles[className] ?? ""} palette-${visual.palette} surface-${visual.surface}`}>
      {children}
    </div>
  );
}

function ComponentPreview({ type }: { type: string }) {
  if (type === "text") {
    return (
      <div className={styles.textPreview}>
        <strong>设备状态</strong>
        <span>系统运行状态良好</span>
        <small>最后更新于 10:24</small>
      </div>
    );
  }
  if (type === "appIcon") {
    return <span className={styles.appIconPreview}><SemanticIcon name="sparkles" size={30} /></span>;
  }
  if (type === "iconButton") {
    return <button className={styles.iconButtonPreview} type="button" aria-label="确认完成"><SemanticIcon name="check" size={24} /></button>;
  }
  if (type === "capsuleButton") {
    return <button className={styles.capsulePreview} type="button"><SemanticIcon name="zap" size={17} />省电模式</button>;
  }
  if (type === "metric") {
    return <div className={styles.metricPreview}><span>已用内存</span><strong>4.50GB</strong><small>运行正常</small></div>;
  }
  if (type === "heroMetric") {
    return <div className={styles.heroPreview}><span><SemanticIcon name="cloud-rain" size={32} /></span><div><strong>29<em>°C</em></strong><small>当前温度 · 下午有雨</small></div></div>;
  }
  if (type === "progressRing") {
    return (
      <div className={styles.ringPreview}>
        <div className={styles.ringGraphic} style={{ "--catalog-progress": 82 } as CSSProperties}><SemanticIcon name="moon" size={24} /></div>
        <div><strong>82</strong><small>睡眠得分</small></div>
      </div>
    );
  }
  if (type === "miniProgress") {
    return <div className={styles.progressPreview}><div><span>剩余电量</span><strong>18%</strong></div><i><b style={{ width: "18%" }} /></i><small>预计还能使用 2 小时</small></div>;
  }
  return (
    <div className={styles.imagePreview}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/og.png" alt="2×2 Card DSL Lab 预览图" />
      <span>image · cover</span>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <main className={styles.shell}>
      <nav className={styles.topbar} aria-label="图鉴导航">
        <a className={styles.brand} href="/">
          <span className={styles.brandGrid} aria-hidden="true"><i /><i /><i /><i /></span>
          <span>CONSTRAINT LAB</span>
        </a>
        <div className={styles.navLinks}>
          <a href="#domains">DOMAINS</a>
          <a href="#components">COMPONENTS</a>
          <a href="#icons">ICONS</a>
          <a className={styles.backLink} href="/">返回生成实验室 ↗</a>
        </div>
      </nav>

      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>CARD DSL AUTHORING GUIDE · VISUAL CATALOG</p>
          <h1>组件与视觉语法，<br /><em>全部摊开来看。</em></h1>
        </div>
        <div className={styles.heroCopy}>
          <p>这不是另一套设计，而是当前 DSL、Visual Resolver 与 Renderer 的可视化索引。每一种 domain、强调程度、组件和图标都在这里独立展示。</p>
          <div className={styles.stats}>
            <div><strong>8</strong><span>DOMAINS</span></div>
            <div><strong>3</strong><span>EMPHASIS</span></div>
            <div><strong>9</strong><span>COMPONENTS</span></div>
            <div><strong>{CARD_ICONS.length}</strong><span>ICONS</span></div>
          </div>
        </div>
      </header>

      <section className={styles.section} id="domains">
        <div className={styles.sectionHeading}>
          <div><span>01 / SEMANTIC DOMAINS</span><h2>8 个内容领域</h2></div>
          <p>domain 决定候选色彩族的优先顺序；它表达语义，不直接指定十六进制颜色。</p>
        </div>
        <div className={styles.domainGrid}>
          {domains.map((domain) => (
            <article className={styles.domainCard} key={domain.id}>
              <div className={styles.domainTop}>
                <span className={`palette-${DOMAIN_PALETTES[domain.id][0]} ${styles.domainIcon}`}><SemanticIcon name={domain.icon} size={25} /></span>
                <code>{domain.id}</code>
              </div>
              <h3>{domain.label}</h3>
              <p>{domain.description}</p>
              <strong>{domain.example}</strong>
              <div className={styles.paletteSequence} aria-label={`${domain.label}色彩优先顺序`}>
                {DOMAIN_PALETTES[domain.id].map((palette, index) => (
                  <span className={`palette-${palette}`} key={palette} title={palette}>
                    <i />{index + 1}. {palette}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="palette">
        <div className={styles.sectionHeading}>
          <div><span>02 / COLOR SYSTEM</span><h2>7 个色彩族 · 5 个 Surface</h2></div>
          <p>palette 提供颜色变量，surface 决定这些变量以浅色、实色、渐变或深色方式组成背景。</p>
        </div>
        <div className={styles.paletteGrid}>
          {palettes.map((palette) => (
            <article className={`palette-${palette.id} ${styles.paletteCard}`} key={palette.id}>
              <div className={styles.paletteSwatch}><i /><i /><i /></div>
              <div><strong>{palette.label}</strong><code>{palette.id}</code></div>
              <dl><div><dt>SOLID</dt><dd>{palette.solid}</dd></div><div><dt>DEEP</dt><dd>{palette.deep}</dd></div><div><dt>SOFT</dt><dd>{palette.soft}</dd></div></dl>
            </article>
          ))}
        </div>
        <div className={styles.surfaceGrid}>
          {(["neutral", "tint", "solid", "gradient", "dark"] as const).map((surface) => (
            <div className={`palette-indigo surface-${surface} ${styles.surfaceCard}`} key={surface}>
              <span><SemanticIcon name="sparkles" size={22} /></span>
              <strong>{surface}</strong>
              <small>surface-{surface}</small>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} id="emphasis">
        <div className={styles.sectionHeading}>
          <div><span>03 / EMPHASIS</span><h2>3 档视觉强调</h2></div>
          <p>emphasis 调整 surface 候选的排序与匹配分，不改变业务内容本身。</p>
        </div>
        <div className={styles.emphasisGrid}>
          {emphases.map((emphasis) => {
            const visual = visualFor("energy", emphasis.id);
            return (
              <article className={styles.emphasisCard} key={emphasis.id}>
                <VisualSurface domain="energy" emphasis={emphasis.id} className="emphasisVisual">
                  <span className={styles.sampleEyebrow}>{emphasis.id.toUpperCase()}</span>
                  <SemanticIcon name="battery" size={30} />
                  <strong>18%</strong>
                  <small>剩余电量</small>
                </VisualSurface>
                <div className={styles.emphasisCopy}>
                  <div><code>{emphasis.id}</code><span>{emphasis.label}</span></div>
                  <h3>{emphasis.description}</h3>
                  <p>{emphasis.use}</p>
                  <dl><div><dt>本例输出</dt><dd>{visual.palette} / {visual.surface}</dd></div><div><dt>Surface 顺序</dt><dd>{emphasis.order}</dd></div></dl>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.matrixHeading}><strong>DOMAIN × EMPHASIS</strong><span>24 种组合的当前首选视觉</span></div>
        <div className={styles.matrix}>
          {domains.flatMap((domain) => emphases.map((emphasis) => {
            const visual = visualFor(domain.id, emphasis.id);
            return (
              <VisualSurface domain={domain.id} emphasis={emphasis.id} className="matrixCell" key={`${domain.id}-${emphasis.id}`}>
                <div><SemanticIcon name={domain.icon} size={19} /><strong>{domain.id}</strong></div>
                <span>{emphasis.id}</span>
                <small>{visual.palette} · {visual.surface} · {visual.score}/100</small>
              </VisualSurface>
            );
          }))}
        </div>
      </section>

      <section className={styles.section} id="components">
        <div className={styles.sectionHeading}>
          <div><span>04 / COMPONENT INVENTORY</span><h2>9 类 DSL 组件</h2></div>
          <p>每个组件独立展示。所有组件共享 id、priority 与 optional，坐标和颜色不属于 DSL 字段。</p>
        </div>
        <div className={styles.componentGrid}>
          {components.map((component, index) => (
            <article className={styles.componentCard} key={component.type}>
              <div className={styles.componentNumber}>{String(index + 1).padStart(2, "0")}</div>
              <div className={styles.componentPreview}><ComponentPreview type={component.type} /></div>
              <div className={styles.componentBody}>
                <div className={styles.componentTitle}><div><code>{component.type}</code><h3>{component.label}</h3></div><span>{component.iconSupport}</span></div>
                <p>{component.purpose}</p>
                <dl>
                  <div><dt>FIELDS</dt><dd>{component.fields}</dd></div>
                  <div><dt>VARIANTS</dt><dd>{component.variants}</dd></div>
                  <div><dt>LIMIT</dt><dd>{component.limit}</dd></div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="icons">
        <div className={styles.sectionHeading}>
          <div><span>05 / ICON LIBRARY</span><h2>{CARD_ICONS.length} 个内置语义图标</h2></div>
          <p>appIcon 与 iconButton 可以使用全部图标；capsuleButton、heroMetric 和 progressRing 可选使用。</p>
        </div>
        <div className={styles.iconGrid}>
          {CARD_ICONS.map((icon, index) => (
            <article className={styles.iconCard} key={icon.name}>
              <span className={`palette-${palettes[index % palettes.length].id}`}><SemanticIcon name={icon.name} size={29} /></span>
              <div><strong>{icon.label}</strong><code>{icon.name}</code><small>{icon.usage}</small></div>
            </article>
          ))}
        </div>
        <div className={styles.iconSupportTable}>
          <div><strong>appIcon</strong><span>14 个内置图标 + symbol / Emoji</span></div>
          <div><strong>iconButton</strong><span>14 个内置图标，icon 必填</span></div>
          <div><strong>capsuleButton</strong><span>14 个内置图标，icon 可选</span></div>
          <div><strong>heroMetric</strong><span>14 个内置图标，icon 可选</span></div>
          <div><strong>progressRing</strong><span>14 个内置图标，icon 可选</span></div>
          <div><strong>其他 4 类组件</strong><span>不接受 icon 字段</span></div>
        </div>
      </section>

      <section className={styles.rulesSection}>
        <div><span>AUTHORING RULE 01</span><strong>描述语义，<br />不描述坐标。</strong></div>
        <div><span>AUTHORING RULE 02</span><strong>表达优先级，<br />不手排布局。</strong></div>
        <div><span>AUTHORING RULE 03</span><strong>只用受支持组件，<br />让 Solver 完成设计。</strong></div>
      </section>

      <footer className={styles.footer}>
        <span>CARD DSL VISUAL CATALOG · V1</span>
        <a href="/">返回 2×2 Card DSL Lab</a>
      </footer>
    </main>
  );
}
