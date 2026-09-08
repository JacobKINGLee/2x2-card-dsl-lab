import { parseElementDSL, solveLayout, type LayoutResult } from "./layout-engine";
import type { ComponentDecision } from "./component-decision";

export type DeliveryResult = ComponentDecision & {
  delivery: {
    status: "deliverable" | "not_applicable" | "rejected";
    dslValid: boolean | null;
    layoutStatus: LayoutResult["status"] | null;
    qualityStatus: LayoutResult["quality"]["status"] | null;
    reasons: string[];
  };
};

export function applyDeliveryGate(component: ComponentDecision): DeliveryResult {
  if (component.status !== "ready" || !component.dsl) return {
    ...component,
    delivery: { status: "not_applicable", dslValid: null, layoutStatus: null, qualityStatus: null, reasons: [] },
  };
  const parsed = parseElementDSL(JSON.stringify(component.dsl));
  if (!parsed.data) return {
    status: "unsupported",
    dsl: null,
    decision: {
      ...component.decision,
      code: "dsl_validation_failed",
      message: "组件结果未通过 DSL 交付门禁。",
      alternatives: ["修正规则映射后重试"],
    },
    delivery: { status: "rejected", dslValid: false, layoutStatus: null, qualityStatus: null, reasons: parsed.errors },
  };
  const layout = solveLayout(parsed.data);
  const requiredIds = new Set(parsed.data.elements.filter((element) => element.optional !== true).map((element) => element.id));
  const lostRequired = layout.droppedIds.filter((id) => requiredIds.has(id));
  const truncatedRequired = layout.nodes.filter((node) => node.truncated && requiredIds.has(node.id)).map((node) => node.id);
  const rejected = layout.status !== "solved" || layout.quality.status === "rejected" || lostRequired.length > 0 || truncatedRequired.length > 0;
  if (rejected) {
    const reasons = [
      ...(layout.status !== "solved" ? ["布局求解失败"] : []),
      ...(layout.quality.status === "rejected" ? layout.quality.issues.map((issue) => issue.message) : []),
      ...(lostRequired.length ? [`必要元素被移除：${lostRequired.join("、")}`] : []),
      ...(truncatedRequired.length ? [`必要元素被截断：${truncatedRequired.join("、")}`] : []),
    ];
    return {
      status: "unsupported",
      dsl: null,
      decision: {
        ...component.decision,
        code: "layout_not_deliverable",
        message: "组件决策完成，但当前 2×2 布局无法无损交付必要内容。",
        alternatives: ["拆分卡片", "由用户确认可省略内容"],
      },
      delivery: { status: "rejected", dslValid: true, layoutStatus: layout.status, qualityStatus: layout.quality.status, reasons },
    };
  }
  return {
    ...component,
    decision: { ...component.decision, code: "ready", message: "组件、DSL 与布局门禁均已通过，可以交付。" },
    delivery: { status: "deliverable", dslValid: true, layoutStatus: layout.status, qualityStatus: layout.quality.status, reasons: [] },
  };
}
