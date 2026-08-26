export const CARD_SIZE = 160;
export const SAFE_MARGIN = 12;
export const INNER_SIZE = CARD_SIZE - SAFE_MARGIN * 2;
export const REGION_GAP = 8;

type ElementBase = {
  id: string;
  priority?: number;
  optional?: boolean;
};

export type TextElement = ElementBase & {
  type: "text";
  role: "title" | "body" | "caption";
  text: string;
  supporting?: string;
  maxLines?: number;
};

export type AppIconElement = ElementBase & {
  type: "appIcon";
  symbol: string;
  label: string;
};

export type IconButtonElement = ElementBase & {
  type: "iconButton";
  icon: string;
  label: string;
  event: string;
  placement?: "auto" | "bottom-start" | "bottom-end";
};

export type CapsuleButtonElement = ElementBase & {
  type: "capsuleButton";
  label: string;
  event: string;
};

export type MetricElement = ElementBase & {
  type: "metric";
  label: string;
  value: string;
  detail?: string;
};

export type ImageElement = ElementBase & {
  type: "image";
  src: string;
  alt: string;
};

export type CardElement =
  | TextElement
  | AppIconElement
  | IconButtonElement
  | CapsuleButtonElement
  | MetricElement
  | ImageElement;

export type ElementDSL = {
  version: "2.0" | "3.0";
  type: "adaptive-card";
  elements: CardElement[];
};

export type PresentationMode = "full" | "compact";

export type LayoutNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  element: CardElement;
  reason: string;
  presentation: PresentationMode;
  truncated: boolean;
  lineCount: number;
};

export type ConstraintCheck = {
  id: string;
  label: string;
  passed: boolean;
};

export type LayoutResult = {
  status: "solved" | "unsatisfied";
  card: { width: number; height: number; safeMargin: number };
  nodes: LayoutNode[];
  violations: string[];
  decisions: string[];
  checks: ConstraintCheck[];
  candidateCount: number;
  score: number;
  compressedIds: string[];
  droppedIds: string[];
  measurement: "canvas" | "estimate";
};

export type ParseResult = {
  data: ElementDSL | null;
  errors: string[];
};

export type TextMeasurer = {
  kind: "canvas" | "estimate";
  measure: (text: string, font: string) => number;
};

type AnchorPlacement = "bottom-start" | "bottom-end";
type InternalMode = PresentationMode | "hidden";
type PresentationPlan = Record<string, InternalMode>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalStringIsValid(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

export function parseElementDSL(source: string): ParseResult {
  let raw: unknown;

  try {
    raw = JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知 JSON 错误";
    return { data: null, errors: [`JSON 语法错误：${message}`] };
  }

  if (!isRecord(raw)) {
    return { data: null, errors: ["根节点必须是一个 JSON 对象"] };
  }

  const errors: string[] = [];
  if (raw.version !== "2.0" && raw.version !== "3.0") {
    errors.push('version 必须为 "2.0" 或 "3.0"');
  }
  if (raw.type !== "adaptive-card") errors.push('type 必须为 "adaptive-card"');
  if ("style" in raw || "layout" in raw) {
    errors.push("输入 DSL 不能包含 style 或 layout；坐标由布局引擎生成");
  }

  if (!Array.isArray(raw.elements)) {
    errors.push("elements 为必填数组");
    return { data: null, errors };
  }

  if (raw.elements.length < 1 || raw.elements.length > 8) {
    errors.push("elements 数量必须在1到8个之间");
  }

  const ids = new Set<string>();
  let actionCount = 0;
  let appIconCount = 0;
  let metricCount = 0;
  let imageCount = 0;
  let titleCount = 0;

  raw.elements.forEach((element, index) => {
    const path = `elements[${index}]`;
    if (!isRecord(element)) {
      errors.push(`${path} 必须是对象`);
      return;
    }

    if (!isNonEmptyString(element.id)) {
      errors.push(`${path}.id 为必填字符串`);
    } else if (ids.has(element.id)) {
      errors.push(`${path}.id 与其他元素重复`);
    } else {
      ids.add(element.id);
    }

    if (
      "x" in element ||
      "y" in element ||
      "width" in element ||
      "height" in element ||
      "style" in element
    ) {
      errors.push(`${path} 不能直接声明坐标、尺寸或样式`);
    }

    if (
      element.priority !== undefined &&
      (typeof element.priority !== "number" ||
        element.priority < 0 ||
        element.priority > 100)
    ) {
      errors.push(`${path}.priority 必须是0到100之间的数字`);
    }
    if (element.optional !== undefined && typeof element.optional !== "boolean") {
      errors.push(`${path}.optional 必须是布尔值`);
    }

    switch (element.type) {
      case "text": {
        const roles = ["title", "body", "caption"];
        if (!roles.includes(String(element.role))) {
          errors.push(`${path}.role 仅支持 title、body 或 caption`);
        }
        if (!isNonEmptyString(element.text)) {
          errors.push(`${path}.text 为必填字符串`);
        }
        if (!optionalStringIsValid(element.supporting)) {
          errors.push(`${path}.supporting 必须是字符串`);
        }
        if (
          element.maxLines !== undefined &&
          (typeof element.maxLines !== "number" ||
            element.maxLines < 1 ||
            element.maxLines > 4)
        ) {
          errors.push(`${path}.maxLines 必须是1到4之间的数字`);
        }
        if (element.role === "title") titleCount += 1;
        break;
      }
      case "appIcon":
        appIconCount += 1;
        if (!isNonEmptyString(element.symbol)) {
          errors.push(`${path}.symbol 为必填字符串`);
        }
        if (!isNonEmptyString(element.label)) {
          errors.push(`${path}.label 为必填字符串`);
        }
        break;
      case "iconButton": {
        actionCount += 1;
        const placements = ["auto", "bottom-start", "bottom-end"];
        if (!isNonEmptyString(element.icon)) {
          errors.push(`${path}.icon 为必填字符串`);
        }
        if (!isNonEmptyString(element.label)) {
          errors.push(`${path}.label 为必填字符串`);
        }
        if (!isNonEmptyString(element.event)) {
          errors.push(`${path}.event 为必填字符串`);
        }
        if (
          element.placement !== undefined &&
          !placements.includes(String(element.placement))
        ) {
          errors.push(`${path}.placement 仅支持 auto、bottom-start 或 bottom-end`);
        }
        break;
      }
      case "capsuleButton":
        actionCount += 1;
        if (!isNonEmptyString(element.label)) {
          errors.push(`${path}.label 为必填字符串`);
        }
        if (!isNonEmptyString(element.event)) {
          errors.push(`${path}.event 为必填字符串`);
        }
        break;
      case "metric":
        metricCount += 1;
        if (!isNonEmptyString(element.label) || !isNonEmptyString(element.value)) {
          errors.push(`${path} 的 metric 必须包含 label 和 value`);
        }
        if (!optionalStringIsValid(element.detail)) {
          errors.push(`${path}.detail 必须是字符串`);
        }
        break;
      case "image":
        imageCount += 1;
        if (!isNonEmptyString(element.src) || !isNonEmptyString(element.alt)) {
          errors.push(`${path} 的 image 必须包含 src 和 alt`);
        }
        break;
      default:
        errors.push(
          `${path}.type 仅支持 text、appIcon、iconButton、capsuleButton、metric 或 image`,
        );
    }
  });

  if (actionCount > 1) errors.push("一张卡片最多包含一个操作按钮");
  if (appIconCount > 1) errors.push("一张卡片最多包含一个应用图标");
  if (metricCount > 4) errors.push("当前2×2卡片最多支持四个并行指标");
  if (imageCount > 1) errors.push("一张卡片最多包含一张图片");
  if (titleCount > 1) errors.push("一张卡片最多包含一个主标题");
  if (metricCount > 0 && imageCount > 0) {
    errors.push("指标和图片不能同时出现在当前2×2卡片中");
  }

  return errors.length
    ? { data: null, errors }
    : { data: raw as unknown as ElementDSL, errors: [] };
}

export const estimatedTextMeasurer: TextMeasurer = {
  kind: "estimate",
  measure(text, font) {
    const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
    const fontSize = sizeMatch ? Number(sizeMatch[1]) : 12;
    return [...text].reduce((width, character) => {
      const isWide = /[^\u0000-\u00ff]/.test(character);
      return width + fontSize * (isWide ? 1 : 0.56);
    }, 0);
  },
};

export function createCanvasTextMeasurer(): TextMeasurer {
  if (typeof document === "undefined") return estimatedTextMeasurer;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return estimatedTextMeasurer;
  return {
    kind: "canvas",
    measure(text, font) {
      context.font = font;
      return context.measureText(text).width;
    },
  };
}

function defaultPriority(element: CardElement): number {
  if (element.type === "iconButton" || element.type === "capsuleButton") return 100;
  if (element.type === "text" && element.role === "title") return 90;
  if (element.type === "text" && element.role === "body") return 80;
  if (element.type === "metric") return 75;
  if (element.type === "appIcon") return 65;
  if (element.type === "text" && element.role === "caption") return 50;
  return 40;
}

function elementPriority(element: CardElement): number {
  return element.priority ?? defaultPriority(element);
}

function fontFor(element: TextElement): string {
  if (element.role === "title") return '600 12px Arial, "Microsoft YaHei"';
  if (element.role === "caption") return '500 12px Arial, "Microsoft YaHei"';
  return '700 14px Arial, "Microsoft YaHei"';
}

function measureTextBlock(
  element: TextElement,
  width: number,
  mode: PresentationMode,
  measurer: TextMeasurer,
): { height: number; lineCount: number; truncated: boolean } {
  const measuredWidth = measurer.measure(element.text, fontFor(element));
  const naturalLines = Math.max(1, Math.ceil(measuredWidth / Math.max(width, 1)));
  const roleMax = element.role === "body" ? 3 : 1;
  const requestedMax = Math.min(element.maxLines ?? roleMax, roleMax);
  const maxLines = mode === "compact" ? 1 : requestedMax;
  const lineCount = Math.min(naturalLines, maxLines);
  const showSupporting = mode === "full" && Boolean(element.supporting);
  const lineHeight = element.role === "caption" ? 16 : 20;
  const height = lineCount * lineHeight + (showSupporting ? 16 : 0);
  return {
    height,
    lineCount,
    truncated:
      naturalLines > maxLines || (Boolean(element.supporting) && !showSupporting),
  };
}

function overlaps(a: LayoutNode, b: LayoutNode): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function insideSafeArea(node: LayoutNode): boolean {
  return (
    node.x >= SAFE_MARGIN &&
    node.y >= SAFE_MARGIN &&
    node.x + node.width <= CARD_SIZE - SAFE_MARGIN &&
    node.y + node.height <= CARD_SIZE - SAFE_MARGIN
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function makeNode(
  element: CardElement,
  x: number,
  y: number,
  width: number,
  height: number,
  reason: string,
  presentation: PresentationMode = "full",
  truncated = false,
  lineCount = 1,
): LayoutNode {
  return {
    id: element.id,
    x,
    y,
    width,
    height,
    element,
    reason,
    presentation,
    truncated,
    lineCount,
  };
}

function planKey(dsl: ElementDSL, plan: PresentationPlan): string {
  return dsl.elements.map((element) => `${element.id}:${plan[element.id]}`).join("|");
}

function buildPresentationPlans(dsl: ElementDSL): PresentationPlan[] {
  const base = Object.fromEntries(
    dsl.elements.map((element) => [element.id, "full" as InternalMode]),
  );
  const plans: PresentationPlan[] = [];
  const seen = new Set<string>();
  const add = (plan: PresentationPlan) => {
    const key = planKey(dsl, plan);
    if (!seen.has(key)) {
      seen.add(key);
      plans.push({ ...plan });
    }
  };

  add(base);

  const degradableText = dsl.elements
    .filter(
      (element): element is TextElement =>
        element.type === "text" &&
        (element.role === "body" || Boolean(element.supporting)),
    )
    .sort((a, b) => elementPriority(a) - elementPriority(b));

  let compactCumulative = { ...base };
  degradableText.forEach((element) => {
    add({ ...base, [element.id]: "compact" });
    compactCumulative = { ...compactCumulative, [element.id]: "compact" };
    add(compactCumulative);
  });

  const optionalElements = dsl.elements
    .filter((element) => element.optional)
    .sort((a, b) => elementPriority(a) - elementPriority(b));

  let hiddenFromFull = { ...base };
  optionalElements.forEach((element) => {
    hiddenFromFull = { ...hiddenFromFull, [element.id]: "hidden" };
    add(hiddenFromFull);
  });

  let hiddenFromCompact = { ...compactCumulative };
  optionalElements.forEach((element) => {
    hiddenFromCompact = { ...hiddenFromCompact, [element.id]: "hidden" };
    add(hiddenFromCompact);
  });

  return plans.slice(0, 64);
}

function attemptLayout(
  dsl: ElementDSL,
  actionPlacement: AnchorPlacement,
  plan: PresentationPlan,
  metricColumns: number,
  measurer: TextMeasurer,
): Omit<LayoutResult, "candidateCount"> {
  const violations: string[] = [];
  const decisions: string[] = [];
  const nodes: LayoutNode[] = [];
  const droppedIds = dsl.elements
    .filter((element) => plan[element.id] === "hidden")
    .map((element) => element.id);
  const visibleElements = dsl.elements.filter(
    (element) => plan[element.id] !== "hidden",
  );
  const action = visibleElements.find(
    (element) =>
      element.type === "iconButton" || element.type === "capsuleButton",
  );
  const appIcon = visibleElements.find(
    (element): element is AppIconElement => element.type === "appIcon",
  );

  let contentBottom = CARD_SIZE - SAFE_MARGIN;

  if (action?.type === "capsuleButton") {
    const node = makeNode(
      action,
      SAFE_MARGIN,
      CARD_SIZE - SAFE_MARGIN - 36,
      INNER_SIZE,
      36,
      "固定36vp高度，横向撑满安全区域",
    );
    nodes.push(node);
    contentBottom = node.y - REGION_GAP;
    decisions.push(`${action.id}：胶囊按钮固定在底部通栏`);
  }

  if (action?.type === "iconButton") {
    const x =
      actionPlacement === "bottom-start"
        ? SAFE_MARGIN
        : CARD_SIZE - SAFE_MARGIN - 36;
    const node = makeNode(
      action,
      x,
      CARD_SIZE - SAFE_MARGIN - 36,
      36,
      36,
      actionPlacement === "bottom-start"
        ? "候选锚点：左下角"
        : "候选锚点：右下角",
    );
    nodes.push(node);
    contentBottom = node.y - REGION_GAP;
    decisions.push(
      `${action.id}：选择${actionPlacement === "bottom-start" ? "左下" : "右下"}锚点`,
    );
  }

  if (appIcon) {
    nodes.push(
      makeNode(
        appIcon,
        CARD_SIZE - SAFE_MARGIN - 20,
        SAFE_MARGIN,
        20,
        20,
        "应用图标遵循右上角硬约束",
      ),
    );
    decisions.push(`${appIcon.id}：固定20×20vp并置于右上角`);
  }

  const textElements = visibleElements.filter(
    (element): element is TextElement => element.type === "text",
  );
  let cursorY = SAFE_MARGIN;
  let previousText: TextElement | null = null;

  textElements.forEach((element) => {
    const gap =
      previousText === null
        ? 0
        : previousText.role === "title" || element.role === "title"
          ? REGION_GAP
          : 4;
    const y = cursorY + gap;
    const iconOverlapsRow =
      Boolean(appIcon) && y < SAFE_MARGIN + 20 && y + 20 > SAFE_MARGIN;
    const width = iconOverlapsRow ? 112 : INNER_SIZE;
    const mode =
      plan[element.id] === "compact" ? "compact" : "full";
    const measurement = measureTextBlock(element, width, mode, measurer);

    if (y + measurement.height > contentBottom) {
      violations.push(
        `${element.id}：真实文本高度超出可用内容区域`,
      );
      return;
    }

    nodes.push(
      makeNode(
        element,
        SAFE_MARGIN,
        y,
        width,
        measurement.height,
        iconOverlapsRow
          ? "为右上角应用图标预留4vp间距"
          : `按语义顺序排列，使用${measurer.kind === "canvas" ? "Canvas" : "估算"}文字测量`,
        mode,
        measurement.truncated,
        measurement.lineCount,
      ),
    );
    cursorY = y + measurement.height;
    previousText = element;
  });

  const metrics = visibleElements.filter(
    (element): element is MetricElement => element.type === "metric",
  );
  const image = visibleElements.find(
    (element): element is ImageElement => element.type === "image",
  );

  if (metrics.length > 0 || image) {
    let flexibleTop = textElements.length > 0 ? cursorY + REGION_GAP : SAFE_MARGIN;
    if (appIcon && flexibleTop < SAFE_MARGIN + 20 + REGION_GAP) {
      flexibleTop = SAFE_MARGIN + 20 + REGION_GAP;
    }
    const flexibleHeight = contentBottom - flexibleTop;

    if (image) {
      if (flexibleHeight < 44) {
        violations.push("图片剩余高度不足44vp");
      } else {
        nodes.push(
          makeNode(
            image,
            SAFE_MARGIN,
            flexibleTop,
            INNER_SIZE,
            flexibleHeight,
            "图片填充约束求解后的最大剩余矩形",
          ),
        );
        decisions.push(`${image.id}：填充最大可用内容矩形`);
      }
    }

    if (metrics.length > 0) {
      const columns = Math.max(1, Math.min(metricColumns, metrics.length));
      const rows = Math.ceil(metrics.length / columns);
      const cellWidth =
        (INNER_SIZE - REGION_GAP * (columns - 1)) / columns;
      const cellHeight =
        (flexibleHeight - REGION_GAP * (rows - 1)) / rows;

      if (cellWidth < 40 || cellHeight < 38) {
        violations.push(
          `${metrics.length}个指标采用${columns}列时，候选矩形小于40×38vp`,
        );
      } else {
        metrics.forEach((metric, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          nodes.push(
            makeNode(
              metric,
              SAFE_MARGIN + column * (cellWidth + REGION_GAP),
              flexibleTop + row * (cellHeight + REGION_GAP),
              cellWidth,
              cellHeight,
              `${metrics.length}个指标的${columns}列候选网格`,
            ),
          );
        });
        decisions.push(
          `${metrics.length}个metric：选择${columns}列×${rows}行候选矩形`,
        );
      }
    }
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  dsl.elements.forEach((element) => {
    if (!element.optional && !nodeIds.has(element.id)) {
      violations.push(`${element.id}：必选元素未能获得坐标`);
    }
  });

  nodes.forEach((node) => {
    if (!insideSafeArea(node)) {
      violations.push(`${node.id}：超出12vp安全区域`);
    }
  });

  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      if (overlaps(nodes[first], nodes[second])) {
        violations.push(
          `${nodes[first].id} 与 ${nodes[second].id} 发生重叠`,
        );
      }
    }
  }

  const orderedNodes = [...nodes].sort(
    (a, b) =>
      dsl.elements.findIndex((element) => element.id === a.id) -
      dsl.elements.findIndex((element) => element.id === b.id),
  );
  const cleanViolations = unique(violations);
  const compressedIds = orderedNodes
    .filter((node) => node.presentation === "compact" || node.truncated)
    .map((node) => node.id);
  const explicitPlacement =
    action?.type === "iconButton" &&
    action.placement !== undefined &&
    action.placement !== "auto";

  const totalPriority = dsl.elements.reduce(
    (sum, element) => sum + elementPriority(element),
    0,
  );
  const retainedPriority = dsl.elements.reduce((sum, element) => {
    const node = orderedNodes.find((item) => item.id === element.id);
    if (!node) return sum;
    const retention =
      node.presentation === "compact"
        ? 0.72
        : node.truncated
          ? 0.86
          : 1;
    return sum + elementPriority(element) * retention;
  }, 0);
  const utility = totalPriority > 0 ? retainedPriority / totalPriority : 0;
  let score = Math.round(utility * 82);
  if (cleanViolations.length === 0) score += 10;
  if (action?.type === "iconButton") {
    if (explicitPlacement) score += 5;
    else if (actionPlacement === "bottom-end") score += 5;
    else score += 3;
  } else {
    score += 5;
  }
  if (metrics.length > 0) {
    const metricNodes = orderedNodes.filter((node) => node.element.type === "metric");
    const averageAspect =
      metricNodes.reduce(
        (sum, node) =>
          sum + Math.min(node.width, node.height) / Math.max(node.width, node.height),
        0,
      ) / Math.max(metricNodes.length, 1);
    score += Math.round(averageAspect * 3);
  } else {
    score += 3;
  }
  score = Math.min(100, Math.max(0, score - cleanViolations.length * 22));

  const checks: ConstraintCheck[] = [
    {
      id: "safe-area",
      label: "12vp安全区域",
      passed: orderedNodes.every(insideSafeArea),
    },
    {
      id: "no-overlap",
      label: "元素不重叠",
      passed: !cleanViolations.some((item) => item.includes("重叠")),
    },
    {
      id: "region-gap",
      label: "内容与操作区≥8vp",
      passed: !cleanViolations.some(
        (item) => item.includes("可用内容区域") || item.includes("8vp"),
      ),
    },
    {
      id: "fixed-controls",
      label: "控件固定尺寸",
      passed: orderedNodes
        .filter(
          (node) =>
            node.element.type === "iconButton" ||
            node.element.type === "capsuleButton" ||
            node.element.type === "appIcon",
        )
        .every((node) => {
          if (node.element.type === "appIcon") {
            return node.width === 20 && node.height === 20;
          }
          return node.height === 36;
        }),
    },
    {
      id: "required-placed",
      label: "必选元素全部布局",
      passed: dsl.elements
        .filter((element) => !element.optional)
        .every((element) => nodeIds.has(element.id)),
    },
  ];

  if (compressedIds.length > 0) {
    decisions.push(`压缩/截断：${compressedIds.join("、")}`);
  }
  if (droppedIds.length > 0) {
    decisions.push(`显式舍弃低优先级可选元素：${droppedIds.join("、")}`);
  }
  decisions.push("输入DSL不含x/y；全部坐标由Layout Engine生成");

  return {
    status: cleanViolations.length === 0 ? "solved" : "unsatisfied",
    card: {
      width: CARD_SIZE,
      height: CARD_SIZE,
      safeMargin: SAFE_MARGIN,
    },
    nodes: orderedNodes,
    violations: cleanViolations,
    decisions,
    checks,
    score,
    compressedIds: unique(compressedIds),
    droppedIds: unique(droppedIds),
    measurement: measurer.kind,
  };
}

export function solveLayout(
  dsl: ElementDSL,
  measurer: TextMeasurer = estimatedTextMeasurer,
): LayoutResult {
  const action = dsl.elements.find(
    (element): element is IconButtonElement => element.type === "iconButton",
  );
  const placements: AnchorPlacement[] =
    action?.placement === "bottom-start"
      ? ["bottom-start"]
      : action?.placement === "bottom-end"
        ? ["bottom-end"]
        : action
          ? ["bottom-end", "bottom-start"]
          : ["bottom-end"];
  const presentationPlans = buildPresentationPlans(dsl);
  const candidates: Array<Omit<LayoutResult, "candidateCount">> = [];

  presentationPlans.forEach((plan) => {
    const visibleMetricCount = dsl.elements.filter(
      (element) => element.type === "metric" && plan[element.id] !== "hidden",
    ).length;
    const columnChoices =
      visibleMetricCount > 0
        ? Array.from(
            { length: visibleMetricCount },
            (_, index) => index + 1,
          )
        : [1];
    placements.forEach((placement) => {
      columnChoices.forEach((columns) => {
        candidates.push(
          attemptLayout(dsl, placement, plan, columns, measurer),
        );
      });
    });
  });

  const solvedCandidates = candidates.filter(
    (candidate) => candidate.status === "solved",
  );
  const best =
    solvedCandidates.sort((a, b) => b.score - a.score)[0] ??
    candidates.sort(
      (a, b) =>
        a.violations.length - b.violations.length || b.score - a.score,
    )[0];

  return {
    ...best,
    candidateCount: candidates.length,
  };
}
