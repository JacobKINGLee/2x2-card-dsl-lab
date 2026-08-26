export const CARD_SIZE = 160;
export const SAFE_MARGIN = 12;
export const INNER_SIZE = CARD_SIZE - SAFE_MARGIN * 2;
export const REGION_GAP = 8;

export type Placement =
  | "auto"
  | "top-end"
  | "bottom-start"
  | "bottom-end";

type ElementBase = {
  id: string;
  priority?: number;
};

export type TextElement = ElementBase & {
  type: "text";
  role: "title" | "body" | "caption";
  text: string;
  supporting?: string;
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
  version: "2.0";
  type: "adaptive-card";
  elements: CardElement[];
};

export type LayoutNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  element: CardElement;
  reason: string;
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
};

export type ParseResult = {
  data: ElementDSL | null;
  errors: string[];
};

type AnchorPlacement = "bottom-start" | "bottom-end";

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
  if (raw.version !== "2.0") errors.push('version 必须为 "2.0"');
  if (raw.type !== "adaptive-card") errors.push('type 必须为 "adaptive-card"');
  if ("style" in raw || "layout" in raw) {
    errors.push("输入 DSL 不能包含 style 或 layout；坐标由布局引擎生成");
  }

  if (!Array.isArray(raw.elements)) {
    errors.push("elements 为必填数组");
    return { data: null, errors };
  }

  if (raw.elements.length < 1 || raw.elements.length > 6) {
    errors.push("elements 数量必须在1到6个之间");
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
  if (metricCount > 2) errors.push("当前2×2卡片最多支持两个并行指标");
  if (imageCount > 1) errors.push("一张卡片最多包含一张图片");
  if (titleCount > 1) errors.push("一张卡片最多包含一个主标题");
  if (metricCount > 0 && imageCount > 0) {
    errors.push("指标和图片不能同时出现在当前2×2卡片中");
  }

  return errors.length
    ? { data: null, errors }
    : { data: raw as unknown as ElementDSL, errors: [] };
}

function textHeight(element: TextElement): number {
  if (element.role === "title") return 20;
  if (element.role === "caption") return 16;
  return element.supporting ? 40 : 20;
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
): LayoutNode {
  return { id: element.id, x, y, width, height, element, reason };
}

function attemptLayout(
  dsl: ElementDSL,
  actionPlacement: AnchorPlacement,
): Omit<LayoutResult, "candidateCount"> {
  const violations: string[] = [];
  const decisions: string[] = [];
  const nodes: LayoutNode[] = [];
  const action = dsl.elements.find(
    (element) =>
      element.type === "iconButton" || element.type === "capsuleButton",
  );
  const appIcon = dsl.elements.find(
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

  const textElements = dsl.elements.filter(
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
    const height = textHeight(element);
    const iconOverlapsRow =
      Boolean(appIcon) &&
      y < SAFE_MARGIN + 20 &&
      y + height > SAFE_MARGIN;
    const width = iconOverlapsRow ? 112 : INNER_SIZE;

    if (y + height > contentBottom) {
      violations.push(
        `${element.id}：剩余纵向空间不足，无法保持与操作区8vp间距`,
      );
      return;
    }

    nodes.push(
      makeNode(
        element,
        SAFE_MARGIN,
        y,
        width,
        height,
        iconOverlapsRow
          ? "为右上角应用图标预留4vp间距"
          : "按语义阅读顺序左对齐排列",
      ),
    );
    cursorY = y + height;
    previousText = element;
  });

  const metrics = dsl.elements.filter(
    (element): element is MetricElement => element.type === "metric",
  );
  const image = dsl.elements.find(
    (element): element is ImageElement => element.type === "image",
  );

  if (metrics.length > 0 || image) {
    let flexibleTop = textElements.length > 0 ? cursorY + REGION_GAP : SAFE_MARGIN;
    if (appIcon && flexibleTop < SAFE_MARGIN + 20 + REGION_GAP) {
      flexibleTop = SAFE_MARGIN + 20 + REGION_GAP;
    }
    const flexibleHeight = contentBottom - flexibleTop;

    if (flexibleHeight < 44) {
      violations.push("内容区剩余高度不足44vp，无法生成稳定布局");
    } else if (image) {
      nodes.push(
        makeNode(
          image,
          SAFE_MARGIN,
          flexibleTop,
          INNER_SIZE,
          flexibleHeight,
          "图片占用约束求解后的最大剩余内容区域",
        ),
      );
      decisions.push(`${image.id}：填充最大可用内容矩形`);
    } else if (metrics.length === 1) {
      nodes.push(
        makeNode(
          metrics[0],
          SAFE_MARGIN,
          flexibleTop,
          INNER_SIZE,
          flexibleHeight,
          "单指标占用完整剩余内容区域",
        ),
      );
      decisions.push(`${metrics[0].id}：使用完整内容宽度`);
    } else if (metrics.length === 2) {
      const metricWidth = (INNER_SIZE - REGION_GAP) / 2;
      nodes.push(
        makeNode(
          metrics[0],
          SAFE_MARGIN,
          flexibleTop,
          metricWidth,
          flexibleHeight,
          "两个同类指标并行分配等宽区域",
        ),
        makeNode(
          metrics[1],
          SAFE_MARGIN + metricWidth + REGION_GAP,
          flexibleTop,
          metricWidth,
          flexibleHeight,
          "两个同类指标并行分配等宽区域",
        ),
      );
      decisions.push("两个metric：并行分配等宽区域并保持8vp间距");
    }
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  dsl.elements.forEach((element) => {
    if (!nodeIds.has(element.id)) {
      violations.push(`${element.id}：布局引擎未能分配坐标`);
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
  const explicitPlacement =
    action?.type === "iconButton" &&
    action.placement !== undefined &&
    action.placement !== "auto";
  let score = 88;
  if (cleanViolations.length === 0) score += 6;
  if (appIcon) score += 2;
  if (action?.type === "iconButton") {
    if (explicitPlacement) score += 4;
    else if (actionPlacement === "bottom-end") score += 4;
    else score += 2;
  } else {
    score += 4;
  }
  score = Math.min(100, Math.max(0, score - cleanViolations.length * 20));

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
      passed: !cleanViolations.some((item) => item.includes("8vp")),
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
      id: "all-placed",
      label: "全部元素获得坐标",
      passed: orderedNodes.length === dsl.elements.length,
    },
  ];

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
  };
}

export function solveLayout(dsl: ElementDSL): LayoutResult {
  const action = dsl.elements.find(
    (element): element is IconButtonElement =>
      element.type === "iconButton",
  );
  const placements: AnchorPlacement[] =
    action?.placement === "bottom-start"
      ? ["bottom-start"]
      : action?.placement === "bottom-end"
        ? ["bottom-end"]
        : action
          ? ["bottom-end", "bottom-start"]
          : ["bottom-end"];

  const candidates = placements.map((placement) =>
    attemptLayout(dsl, placement),
  );
  const solvedCandidates = candidates.filter(
    (candidate) => candidate.status === "solved",
  );
  const best =
    solvedCandidates.sort((a, b) => b.score - a.score)[0] ??
    candidates.sort(
      (a, b) => a.violations.length - b.violations.length,
    )[0];

  return {
    ...best,
    candidateCount: candidates.length,
  };
}
