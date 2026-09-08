import type { Metadata } from "next";
import ArchitectureComparison from "./architecture-comparison";

export const metadata: Metadata = {
  title: "技术方案演进 · 2×2 Card DSL Lab",
  description: "对比 SemanticPlan v1 与 SemanticDocument 2.0，并逐阶段展示端到端输入、输出和最终卡片。",
};

export default function ArchitecturePage() {
  return <ArchitectureComparison />;
}
