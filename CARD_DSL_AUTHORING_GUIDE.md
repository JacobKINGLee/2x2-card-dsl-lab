# 2×2 自适应卡片 DSL 撰写指南

> 适用对象：需要手工编写卡片 DSL 的设计师、开发者，以及需要根据自然语言生成卡片 DSL 的 AI。
>
> 当前推荐版本：`4.0`

配套网页图鉴：运行本项目后访问 `/catalog`，可以独立查看全部 domain、emphasis、组件、色彩与内置图标。

## 1. DSL 是什么

本项目的 DSL（Domain-Specific Language，领域专用语言）用于描述一张 2×2 微型卡片“包含什么内容”，而不是描述元素的具体坐标和 CSS。

一份 DSL 主要描述：

- 卡片属于什么领域；
- 当前是什么状态；
- 信息需要多强的视觉强调；
- 卡片包含哪些文字、图标、指标、图片和操作；
- 各元素的重要程度以及是否允许在空间不足时隐藏。

DSL 不负责描述：

- `x`、`y` 坐标；
- `width`、`height` 尺寸；
- CSS 样式；
- 颜色值；
- 元素的最终构图位置。

这些内容由布局引擎和视觉引擎自动计算。

```text
人类或 AI 编写 DSL
  → DSL Validator
  → Layout Solver
  → Visual Resolver
  → Quality Gate
  → Renderer
```

## 2. 最小合法 DSL

```json
{
  "version": "4.0",
  "type": "adaptive-card",
  "elements": [
    {
      "id": "title",
      "type": "text",
      "role": "title",
      "text": "智能摘要"
    }
  ]
}
```

根节点必须是 JSON 对象，并且至少包含：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `version` | string | 是 | DSL 版本，推荐使用 `4.0` |
| `type` | string | 是 | 固定为 `adaptive-card` |
| `context` | object | 否 | 卡片的语义环境 |
| `elements` | array | 是 | 卡片中的可见元素，数量为 1–8 |

`version` 当前允许：

```text
2.0
3.0
4.0
```

新卡片应统一使用：

```json
"version": "4.0"
```

## 3. 推荐的完整结构

下例成立的前提是：宿主已提供真实的单一应用身份资源，并注册且启用了 `enableSaving`。缺少这些上下文时应省略 `appIcon`，或对必要动作返回 `unsupported`，不能照抄资源和事件。

```json
{
  "version": "4.0",
  "type": "adaptive-card",
  "context": {
    "domain": "energy",
    "state": "warning",
    "emphasis": "high"
  },
  "elements": [
    {
      "id": "title",
      "type": "text",
      "role": "title",
      "text": "手机电量",
      "priority": 95
    },
    {
      "id": "app",
      "type": "appIcon",
      "icon": "battery",
      "label": "电量服务",
      "priority": 80
    },
    {
      "id": "primary",
      "type": "miniProgress",
      "value": 18,
      "displayValue": "18%",
      "label": "电量偏低",
      "detail": "预计还能使用 2 小时",
      "priority": 100
    },
    {
      "id": "action",
      "type": "capsuleButton",
      "icon": "zap",
      "label": "省电模式",
      "event": "enableSaving",
      "priority": 100
    }
  ]
}
```

## 4. context：描述卡片语义

### 4.1 `domain`

`domain` 表示卡片内容属于什么领域，是 `context` 中唯一必须填写的字段。

| 值 | 中文含义 | 示例内容 | 优先视觉色彩 |
| --- | --- | --- | --- |
| `weather` | 天气 | 温度、降雨、天气预报 | 天空蓝、靛蓝 |
| `wellness` | 健康与睡眠 | 睡眠评分、心率、健康状态 | 紫色、靛蓝 |
| `fitness` | 运动健身 | 步数、训练、运动目标 | 橙色、琥珀色 |
| `system` | 系统与设备 | 内存、耳机、设备连接 | 薄荷绿、天空蓝 |
| `energy` | 电量与能源 | 电池、充电、省电 | 琥珀色、橙色 |
| `productivity` | 日程与效率 | 会议、任务、提醒 | 靛蓝、天空蓝 |
| `environment` | 环境 | AQI、空气质量、湿度 | 薄荷绿、天空蓝 |
| `generic` | 通用内容 | 无法明确归类的信息 | 石墨灰、靛蓝 |

示例：

```json
"domain": "system"
```

### 4.2 `state`

`state` 表示当前业务状态，为可选字符串。

技术上允许任意字符串，但建议使用统一词汇：

| 推荐值 | 含义 |
| --- | --- |
| `healthy` / `good` | 健康、良好 |
| `warning` | 警告、偏低、不足 |
| `critical` | 严重、紧急 |
| `night` | 夜间状态 |
| `rain` | 降雨状态 |
| `upcoming` | 即将发生 |
| `informative` | 普通信息 |

示例：

```json
"state": "warning"
```

不要把完整句子写入 `state`：

```json
"state": "手机现在只剩18%的电量，非常危险"
```

应该写成：

```json
"state": "warning"
```

### 4.3 `emphasis`

`emphasis` 表示需要多强的视觉强调。

| 值 | 含义 | 适用场景 |
| --- | --- | --- |
| `quiet` | 低强调 | 正常状态、睡眠、柔和提示 |
| `standard` | 标准强调 | 一般信息 |
| `high` | 高强调 | 警告、紧急、重要指标 |

示例：

```json
"emphasis": "high"
```

推荐关系：

```text
healthy / good      → quiet 或 standard
informative         → standard
warning / critical  → high
night               → quiet
```

## 5. 所有元素共有的字段

所有元素都必须包含：

```json
{
  "id": "uniqueId",
  "type": "componentType"
}
```

并且可以选择填写：

```json
{
  "priority": 80,
  "optional": true
}
```

### 5.1 `id`

- 必填；
- 必须是非空字符串；
- 一张卡片内不能重复；
- 建议使用简短、有意义的英文标识。

推荐：

```text
title
app
primary
battery
memory
action
description
```

不推荐：

```text
a
element1
这个是标题
```

### 5.2 `type`

表示元素类型。当前支持 9 种：

```text
text
appIcon
iconButton
capsuleButton
metric
heroMetric
progressRing
miniProgress
image
```

### 5.3 `priority`

- 可选；
- 数字范围为 0–100；
- 数字越高，空间不足时越优先保留。

建议：

| 元素 | 推荐优先级 |
| --- | ---: |
| 核心指标 | 100 |
| 主要操作 | 90–100 |
| 标题 | 90–95 |
| 应用图标 | 70–85 |
| 正文 | 50–75 |
| 辅助说明 | 30–60 |
| 装饰信息 | 10–30 |

### 5.4 `optional`

- 可选；
- 必须是布尔值；
- `true` 表示空间不足时允许布局引擎隐藏该元素；
- 未填写或填写 `false` 表示应该保留。

示例：

```json
{
  "id": "tip",
  "type": "text",
  "role": "caption",
  "text": "建议定期清理",
  "priority": 30,
  "optional": true
}
```

## 6. `text`：文字组件

作用：显示标题、正文或辅助文字。

```json
{
  "id": "title",
  "type": "text",
  "role": "title",
  "text": "内存优化",
  "supporting": "系统运行状态良好",
  "maxLines": 2,
  "priority": 95
}
```

字段：

| 字段 | 类型 | 必填 | 可选项/说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 唯一标识 |
| `type` | string | 是 | 固定为 `text` |
| `role` | string | 是 | `title`、`body`、`caption` |
| `text` | string | 是 | 主要文字，不能为空 |
| `supporting` | string | 否 | 辅助文字 |
| `maxLines` | number | 否 | 1–4，建议使用整数 |
| `priority` | number | 否 | 0–100 |
| `optional` | boolean | 否 | 是否允许隐藏 |

`role` 的含义：

| 值 | 含义 |
| --- | --- |
| `title` | 主标题，一张卡片最多一个 |
| `body` | 正文 |
| `caption` | 辅助说明、小字 |

## 7. `appIcon`：应用来源图标

作用：表示宿主已验证的真实应用或服务来源。内容领域图标应放在支持图标的内容组件中，不能用来虚构应用身份。

使用内置图标：

```json
{
  "id": "app",
  "type": "appIcon",
  "icon": "sparkles",
  "label": "系统管家"
}
```

使用符号或 Emoji：

```json
{
  "id": "app",
  "type": "appIcon",
  "symbol": "🧹",
  "label": "系统管家"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 唯一标识 |
| `type` | string | 是 | 固定为 `appIcon` |
| `icon` | string | 条件必填 | 与 `symbol` 至少填写一个 |
| `symbol` | string | 条件必填 | 与 `icon` 至少填写一个 |
| `label` | string | 是 | 图标的语义和无障碍说明 |

推荐内置图标：

| 图标值 | 含义 |
| --- | --- |
| `cloud-rain` | 云雨、天气 |
| `droplets` | 水滴、湿度、空气 |
| `navigation` | 导航 |
| `moon` | 睡眠、夜间 |
| `sparkles` | 智能、优化、清理 |
| `battery` | 电池 |
| `zap` | 能源、闪电 |
| `calendar` | 日程、会议 |
| `bell-off` | 关闭通知 |
| `activity` | 健康、运动 |
| `headphones` | 耳机 |
| `clock` | 时间 |
| `footprints` | 步数 |
| `check` | 完成、确认 |

如果 `icon` 不是内置名称，当前渲染器会显示该名称的文字回退。因此应优先使用宿主已经适配并验证的资源；来源未知、多来源或资源未适配时省略 `appIcon`。

## 8. `iconButton`：纯图标操作按钮

作用：提供只有图标的操作入口。

```json
{
  "id": "action",
  "type": "iconButton",
  "icon": "check",
  "label": "确认完成",
  "event": "confirmTask",
  "placement": "bottom-end",
  "priority": 100
}
```

字段：

| 字段 | 类型 | 必填 | 可选项/说明 |
| --- | --- | --- | --- |
| `icon` | string | 是 | 推荐使用内置图标 |
| `label` | string | 是 | 无障碍操作名称 |
| `event` | string | 是 | 点击后发送的事件名称 |
| `placement` | string | 否 | `auto`、`bottom-start`、`bottom-end` |

`event` 推荐使用小驼峰命名：

```text
openDetail
cleanMemory
enableSaving
confirmTask
```

注意：`event` 必须来自接收 DSL 的应用能力注册表。符合小驼峰格式只代表结构合法，不代表对应处理器存在。没有动作请求时不生成按钮；必要动作未注册或不可用时返回 `unsupported`。

## 9. `capsuleButton`：胶囊按钮

作用：提供带文字、可选图标的主要操作。

```json
{
  "id": "clean",
  "type": "capsuleButton",
  "icon": "sparkles",
  "label": "一键清理",
  "event": "cleanMemory",
  "priority": 100
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `icon` | string | 否 | 按钮图标 |
| `label` | string | 是 | 按钮显示文字 |
| `event` | string | 是 | 点击事件名称 |

一张卡片中的 `iconButton` 与 `capsuleButton` 合计最多一个。

## 10. `metric`：普通并行指标

作用：显示一个普通的“标签 + 数值”，适合在一张卡片中并排显示多个指标。

```json
{
  "id": "used",
  "type": "metric",
  "label": "已用内存",
  "value": "4.50GB",
  "detail": "运行正常",
  "priority": 80
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `label` | string | 是 | 指标名称 |
| `value` | string | 是 | 显示值 |
| `detail` | string | 否 | 辅助说明 |

一张卡片最多包含 4 个 `metric`。

适合：

```text
CPU / 内存
最高温 / 最低温
步数 / 卡路里
已完成 / 待处理
```

## 11. `heroMetric`：大数值主视觉

作用：突出展示一个核心数值或状态。

```json
{
  "id": "temperature",
  "type": "heroMetric",
  "icon": "cloud-rain",
  "value": "29",
  "unit": "°C",
  "label": "当前温度",
  "detail": "多云有雨",
  "priority": 100
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `icon` | string | 否 | 主指标图标 |
| `value` | string | 是 | 核心值 |
| `unit` | string | 否 | 单位 |
| `label` | string | 是 | 指标名称 |
| `detail` | string | 否 | 辅助说明 |

适合：

```text
温度 29°C
AQI 42
今日步数 6820
会议时间 15:00
设备状态 已连接
```

## 12. `progressRing`：环形进度或评分

作用：使用环形图表示 0–100 的进度、占比或评分，同时显示面向用户的文字值。

```json
{
  "id": "memory",
  "type": "progressRing",
  "icon": "sparkles",
  "value": 56.25,
  "displayValue": "4.50G",
  "label": "已用内存",
  "detail": "总内存 8.00GB",
  "priority": 100
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `icon` | string | 否 | 环形主视觉图标 |
| `value` | number | 是 | 圆环进度，范围 0–100 |
| `displayValue` | string | 是 | 实际显示给用户的值 |
| `label` | string | 是 | 指标名称 |
| `detail` | string | 否 | 辅助说明 |

`value` 和 `displayValue` 的职责不同：

```text
value        → 控制圆环填充比例
displayValue → 显示给用户阅读
```

例如：

```json
{
  "value": 82,
  "displayValue": "82分"
}
```

## 13. `miniProgress`：横向迷你进度条

作用：展示百分比、完成度、剩余量或占用率。

```json
{
  "id": "battery",
  "type": "miniProgress",
  "value": 18,
  "displayValue": "18%",
  "label": "剩余电量",
  "detail": "预计还能使用 2 小时",
  "priority": 100
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `value` | number | 是 | 进度，范围 0–100 |
| `displayValue` | string | 是 | 显示给用户的值 |
| `label` | string | 是 | 指标名称 |
| `detail` | string | 否 | 辅助说明 |

当前 `miniProgress` 不支持 `icon` 字段。

## 14. `image`：图片组件

作用：显示一张图片。

```json
{
  "id": "cover",
  "type": "image",
  "src": "/weather-cover.png",
  "alt": "阴雨天气",
  "priority": 70
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `src` | string | 是 | 图片地址 |
| `alt` | string | 是 | 图片内容的无障碍说明 |

一张卡片最多包含一张图片。

## 15. 主视觉组件如何选择

下面三种组件都属于主视觉指标，一张卡片最多只能选择一个：

```text
heroMetric
progressRing
miniProgress
```

选择原则：

| 数据类型 | 推荐组件 | 示例 |
| --- | --- | --- |
| 独立核心数值或状态 | `heroMetric` | 29°C、AQI 42、15:00、已连接 |
| 评分、得分、环形占比 | `progressRing` | 睡眠得分 82、内存占用 56% |
| 百分比、线性进度、剩余量 | `miniProgress` | 电量 18%、任务完成 70% |

不要同时写：

```json
[
  { "type": "heroMetric" },
  { "type": "miniProgress" }
]
```

## 16. 组件组合限制

当前 2×2 卡片的硬性限制如下：

| 规则 | 限制 |
| --- | --- |
| 元素总数 | 1–8 |
| 主标题 `text/title` | 最多 1 个 |
| `appIcon` | 最多 1 个 |
| 操作按钮 | `iconButton` 与 `capsuleButton` 合计最多 1 个 |
| 主视觉指标 | `heroMetric`、`progressRing`、`miniProgress` 合计最多 1 个 |
| 普通 `metric` | 最多 4 个 |
| `image` | 最多 1 张 |

禁止的组合：

```text
metric + image
主视觉指标 + metric
主视觉指标 + image
```

因此卡片内容主体应在以下三种模式中选择一种：

```text
模式 A：一个主视觉指标
模式 B：1–4 个普通 metric
模式 C：一张 image
```

标题、应用图标和操作按钮可以按规则与上述模式组合。

## 17. 严禁写入 DSL 的字段

根节点不能包含：

```text
style
layout
```

元素不能包含：

```text
x
y
width
height
style
```

错误示例：

```json
{
  "id": "title",
  "type": "text",
  "role": "title",
  "text": "今日天气",
  "x": 12,
  "y": 12,
  "style": {
    "color": "blue"
  }
}
```

正确写法：

```json
{
  "id": "title",
  "type": "text",
  "role": "title",
  "text": "今日天气",
  "priority": 95
}
```

布局和颜色由系统根据语义自动决定。

## 18. 人类作者的标准撰写流程

### 第一步：用一句话明确卡片目的

例如：

```text
告诉用户手机只剩 18% 电量，并提供省电模式入口。
```

### 第二步：选择 `domain`

```text
电量 → energy
```

### 第三步：确定状态和强调程度

```text
只剩 18% → warning + high
```

### 第四步：确定核心指标

```text
18% 是百分比 → miniProgress
```

### 第五步：决定操作意图

```text
用户请求：省电模式
宿主注册表唯一匹配：enableSaving
```

若用户没有请求动作，默认跳过按钮。若宿主无法验证事件，不要继续生成一张静默省略必要动作的正常卡片。

### 第六步：添加标题和图标

```text
标题：手机电量
图标：battery
```

### 第七步：设置优先级

```text
核心指标和按钮：100
标题：95
应用图标：80
```

### 第八步：检查组合限制

- 是否超过 8 个元素；
- 是否存在两个主视觉；
- 是否存在两个按钮；
- 是否同时使用了主视觉和普通 metric；
- 是否包含坐标或 CSS。

### 第九步：输出纯 JSON

JSON 中不能包含注释，字符串必须使用双引号。

## 19. 给 AI 的推荐提示词

可以把下面的提示词交给 AI：

```text
你是 2×2 自适应卡片 DSL 编译器。

请把用户提供的内容转换成一份合法 JSON DSL。

根节点规则：
1. version 固定为 "4.0"。
2. type 固定为 "adaptive-card"。
3. context.domain 只能是 weather、wellness、fitness、system、energy、productivity、environment、generic。
4. context.emphasis 只能是 quiet、standard、high。
5. elements 数量必须为 1–8。

组件规则：
1. 支持 text、appIcon、iconButton、capsuleButton、metric、heroMetric、progressRing、miniProgress、image。
2. 每个元素必须有唯一 id 和合法 type。
3. 一张卡片最多一个 title、一个 appIcon、一个操作按钮和一个主视觉指标。
4. heroMetric、progressRing、miniProgress 三者最多选择一个。
5. metric 最多四个。
6. image 最多一张。
7. metric 不能和 image 同时使用。
8. 主视觉指标不能与 metric 或 image 同时使用。

设计原则：
1. 评分使用 progressRing。
2. 百分比、完成度和剩余量使用 miniProgress。
3. 温度、时间、AQI、步数或普通核心值使用 heroMetric。
4. 标题和按钮使用简短中文。
5. event 使用英文小驼峰命名。
6. 核心指标 priority 设为 100，标题约 95，应用图标约 80。
7. 只有确实允许隐藏的辅助元素才能设置 optional: true。

禁止规则：
1. 不得输出 x、y、width、height、style 或 layout。
2. 不得创造未支持的组件类型。
3. 不得输出 Markdown 代码围栏、解释或前后缀。
4. 只输出一个可被 JSON.parse 解析的 JSON 对象。

用户内容：
{{在这里填写用户的一句话}}
```

如果使用 Function Calling，建议让 AI 先输出受约束的 Semantic Plan，再由程序确定性转换为 DSL，而不是完全依赖自由文本提示词。

## 20. AI 生成时的内部检查清单

AI 在输出前应该依次检查：

```text
□ 是否输出纯 JSON？
□ version 是否为 4.0？
□ type 是否为 adaptive-card？
□ domain 和 emphasis 是否属于允许枚举？
□ elements 是否为 1–8 个？
□ 每个 id 是否唯一？
□ 所有必填字段是否存在？
□ value 类型是否正确？
□ progressRing/miniProgress 的 value 是否在 0–100？
□ 是否最多只有一个主视觉？
□ 是否最多只有一个操作按钮？
□ 是否避免了冲突组件组合？
□ 是否完全没有坐标、尺寸和 CSS？
□ 核心信息是否使用较高 priority？
□ optional 是否只用于可删除的辅助信息？
```

## 21. 完整示例一：天气卡片

需求：

```text
上海今天 29°C，下午有雨，提供天气详情入口。
```

DSL：

```json
{
  "version": "4.0",
  "type": "adaptive-card",
  "context": {
    "domain": "weather",
    "state": "rain",
    "emphasis": "standard"
  },
  "elements": [
    {
      "id": "title",
      "type": "text",
      "role": "title",
      "text": "上海天气",
      "priority": 95
    },
    {
      "id": "app",
      "type": "appIcon",
      "icon": "cloud-rain",
      "label": "天气服务",
      "priority": 80
    },
    {
      "id": "temperature",
      "type": "heroMetric",
      "icon": "cloud-rain",
      "value": "29",
      "unit": "°C",
      "label": "下午有雨",
      "detail": "外出记得带伞",
      "priority": 100
    },
    {
      "id": "action",
      "type": "capsuleButton",
      "icon": "navigation",
      "label": "天气详情",
      "event": "openWeather",
      "priority": 100
    }
  ]
}
```

## 22. 完整示例二：睡眠评分卡片

需求：

```text
昨晚睡眠得分 82，比昨天提高 6 分，查看睡眠详情。
```

DSL：

```json
{
  "version": "4.0",
  "type": "adaptive-card",
  "context": {
    "domain": "wellness",
    "state": "good",
    "emphasis": "quiet"
  },
  "elements": [
    {
      "id": "title",
      "type": "text",
      "role": "title",
      "text": "昨晚睡眠",
      "priority": 95
    },
    {
      "id": "app",
      "type": "appIcon",
      "icon": "moon",
      "label": "睡眠服务",
      "priority": 80
    },
    {
      "id": "score",
      "type": "progressRing",
      "icon": "moon",
      "value": 82,
      "displayValue": "82",
      "label": "睡眠得分",
      "detail": "比昨天提高 6 分",
      "priority": 100
    },
    {
      "id": "action",
      "type": "capsuleButton",
      "icon": "moon",
      "label": "睡眠详情",
      "event": "openSleepDetail",
      "priority": 100
    }
  ]
}
```

## 23. 完整示例三：多指标系统卡片

需求：

```text
显示 CPU 32%、内存 4.5GB 和磁盘 68%，不需要主视觉。
```

DSL：

```json
{
  "version": "4.0",
  "type": "adaptive-card",
  "context": {
    "domain": "system",
    "state": "healthy",
    "emphasis": "quiet"
  },
  "elements": [
    {
      "id": "title",
      "type": "text",
      "role": "title",
      "text": "设备状态",
      "priority": 95
    },
    {
      "id": "app",
      "type": "appIcon",
      "icon": "sparkles",
      "label": "系统管家",
      "priority": 80
    },
    {
      "id": "cpu",
      "type": "metric",
      "label": "CPU",
      "value": "32%",
      "priority": 85
    },
    {
      "id": "memory",
      "type": "metric",
      "label": "内存",
      "value": "4.5GB",
      "priority": 85
    },
    {
      "id": "disk",
      "type": "metric",
      "label": "磁盘",
      "value": "68%",
      "priority": 75
    },
    {
      "id": "action",
      "type": "capsuleButton",
      "icon": "sparkles",
      "label": "系统详情",
      "event": "openSystemDetail",
      "priority": 100
    }
  ]
}
```

## 24. 常见错误

### 错误一：JSON 使用单引号

错误：

```text
{'version': '4.0'}
```

正确：

```json
{"version": "4.0"}
```

### 错误二：重复 id

错误：

```json
[
  { "id": "metric", "type": "metric", "label": "CPU", "value": "32%" },
  { "id": "metric", "type": "metric", "label": "内存", "value": "4.5GB" }
]
```

应该使用：

```text
cpu
memory
```

### 错误三：进度值使用字符串

错误：

```json
"value": "82"
```

`progressRing` 和 `miniProgress` 的 `value` 必须是数字：

```json
"value": 82
```

### 错误四：把显示值当作进度值

错误：

```json
{
  "value": 4500,
  "displayValue": "4.50GB"
}
```

进度必须为 0–100：

```json
{
  "value": 56.25,
  "displayValue": "4.50GB"
}
```

### 错误五：两个主视觉同时出现

错误：

```text
progressRing + miniProgress
```

应该根据数据表达方式选择其中一个。

### 错误六：同时使用主视觉和普通指标

错误：

```text
heroMetric + metric
```

应该选择“一个主视觉”或“多个普通指标”之一。

### 错误七：直接指定颜色

错误：

```json
"color": "#ff0000"
```

正确做法是通过语义表达：

```json
{
  "domain": "energy",
  "state": "warning",
  "emphasis": "high"
}
```

### 错误八：event 使用中文句子

不推荐：

```json
"event": "点击之后打开省电模式"
```

推荐：

```json
"event": "enableSaving"
```

## 25. 最终提交检查表

提交 DSL 前，请确认：

- [ ] 根节点是 JSON 对象；
- [ ] `version` 为 `4.0`；
- [ ] `type` 为 `adaptive-card`；
- [ ] `context.domain` 属于允许领域；
- [ ] `context.emphasis` 属于允许枚举；
- [ ] `elements` 数量为 1–8；
- [ ] 每个元素都有唯一 `id`；
- [ ] 每个元素都有受支持的 `type`；
- [ ] 所有组件必填字段都已填写；
- [ ] `priority` 在 0–100；
- [ ] 进度类 `value` 在 0–100；
- [ ] 最多一个主标题；
- [ ] 最多一个应用图标；
- [ ] 最多一个操作按钮；
- [ ] 最多一个主视觉指标；
- [ ] 没有冲突的组件组合；
- [ ] 没有 `x`、`y`、`width`、`height`、`style`、`layout`；
- [ ] 按钮 `event` 使用简短英文标识；
- [ ] 核心信息设置了较高优先级；
- [ ] 只有可舍弃的辅助元素使用 `optional: true`；
- [ ] 最终内容可以被标准 `JSON.parse()` 解析。

## 26. 核心原则

撰写本 DSL 时，应始终遵守三条原则：

1. **描述语义，不描述坐标。**
2. **表达重要程度，不手工安排布局。**
3. **只使用受支持的组件，让确定性引擎完成设计。**

一句话总结：

> 人类或 AI 负责说明“卡片里应该有什么”，布局、颜色、修复和最终渲染由系统负责。
