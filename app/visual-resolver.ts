export type VisualDomain =
  | "weather"
  | "wellness"
  | "fitness"
  | "system"
  | "energy"
  | "productivity"
  | "environment"
  | "generic";

export type VisualEmphasis = "quiet" | "standard" | "high";

export type VisualContext = {
  domain: VisualDomain;
  state?: string;
  emphasis?: VisualEmphasis;
};

export type VisualPalette =
  | "sky"
  | "violet"
  | "orange"
  | "mint"
  | "amber"
  | "indigo"
  | "graphite";

export type VisualSurface = "neutral" | "tint" | "solid" | "gradient" | "dark";

export type VisualScoreBreakdown = {
  semanticFit: number;
  contrast: number;
  hierarchy: number;
  emphasisFit: number;
  restraint: number;
};

export type VisualDecision = {
  id: string;
  rank: number;
  palette: VisualPalette;
  surface: VisualSurface;
  foreground: "dark" | "light";
  actionStyle: "soft" | "glass";
  heroStyle: "number" | "icon-number" | "ring" | "standard";
  score: number;
  contrastRatio: number;
  scoreBreakdown: VisualScoreBreakdown;
  candidateCount: number;
  reasons: string[];
};

type VisualElement = { type: string };

export const DOMAIN_PALETTES: Record<VisualDomain, VisualPalette[]> = {
  weather: ["sky", "indigo", "graphite"],
  wellness: ["violet", "indigo", "sky"],
  fitness: ["orange", "amber", "graphite"],
  system: ["mint", "sky", "graphite"],
  energy: ["amber", "orange", "mint"],
  productivity: ["indigo", "sky", "graphite"],
  environment: ["mint", "sky", "graphite"],
  generic: ["graphite", "indigo", "mint"],
};

const paletteContrast: Record<VisualPalette, number> = {
  sky: 6.95,
  violet: 8.11,
  orange: 5.82,
  mint: 5.58,
  amber: 5.36,
  indigo: 8.25,
  graphite: 15.54,
};

function contrastRatioFor(palette: VisualPalette, surface: VisualSurface) {
  if (surface === "neutral") return 17.18;
  if (surface === "tint") return 15.62;
  if (surface === "dark") return 11.68;
  return paletteContrast[palette];
}

function surfaceCandidates(context: VisualContext | undefined): VisualSurface[] {
  if (context?.state === "night") return ["dark", "gradient", "tint", "neutral"];
  if (context?.emphasis === "high") return ["gradient", "solid", "tint", "dark"];
  if (context?.emphasis === "quiet") return ["tint", "neutral", "gradient", "dark"];
  return ["tint", "gradient", "solid", "neutral"];
}

function resolveHeroStyle(elements: VisualElement[]): VisualDecision["heroStyle"] {
  if (elements.some((element) => element.type === "progressRing")) return "ring";
  if (elements.some((element) => element.type === "heroMetric")) return "icon-number";
  if (elements.some((element) => element.type === "metric" || element.type === "miniProgress")) return "number";
  return "standard";
}

function scoreCandidate(
  context: VisualContext | undefined,
  paletteIndex: number,
  surface: VisualSurface,
  elements: VisualElement[],
): VisualScoreBreakdown {
  const emphasis = context?.emphasis ?? "standard";
  const hasHero = elements.some((element) =>
    ["heroMetric", "progressRing", "miniProgress"].includes(element.type),
  );
  const hasImage = elements.some((element) => element.type === "image");
  const semanticFit = [24, 18, 13][paletteIndex] ?? 10;
  const contrast = surface === "neutral" ? 20 : surface === "tint" ? 19 : 18;
  const hierarchy = hasHero ? (surface === "gradient" || surface === "dark" ? 20 : 18) : 16;
  let emphasisFit = 12;
  if (emphasis === "high" && (surface === "gradient" || surface === "solid")) emphasisFit = 19;
  if (emphasis === "quiet" && (surface === "tint" || surface === "neutral")) emphasisFit = 19;
  if (context?.state === "night" && surface === "dark") emphasisFit = 20;
  const restraint = hasImage
    ? surface === "neutral" ? 17 : 12
    : surface === "gradient" && emphasis !== "high" ? 13 : 17;
  return { semanticFit, contrast, hierarchy, emphasisFit, restraint };
}

function sumScore(score: VisualScoreBreakdown) {
  return Math.min(100, Object.values(score).reduce((sum, value) => sum + value, 0));
}

export function resolveVisualCandidates(
  context: VisualContext | undefined,
  elements: VisualElement[],
): VisualDecision[] {
  const palettes = DOMAIN_PALETTES[context?.domain ?? "generic"];
  const surfaces = surfaceCandidates(context);
  const heroStyle = resolveHeroStyle(elements);
  const raw = palettes.flatMap((palette, paletteIndex) =>
    surfaces.map((surface) => {
      const scoreBreakdown = scoreCandidate(context, paletteIndex, surface, elements);
      const foreground = surface === "gradient" || surface === "solid" || surface === "dark" ? "light" : "dark";
      const contrastRatio = contrastRatioFor(palette, surface);
      return {
        id: `${palette}-${surface}`,
        rank: 0,
        palette,
        surface,
        foreground,
        actionStyle: foreground === "light" ? "glass" as const : "soft" as const,
        heroStyle,
        score: sumScore(scoreBreakdown),
        contrastRatio,
        scoreBreakdown,
        candidateCount: palettes.length * surfaces.length,
        reasons: [
          `${context?.domain ?? "generic"} 领域与 ${palette} 色彩族的语义匹配度为 ${scoreBreakdown.semanticFit}/24`,
          `${surface} 表面获得 ${scoreBreakdown.contrast}/20 的对比度基础分`,
          `前景与最弱背景停靠点的对比度为 ${contrastRatio.toFixed(2)}:1`,
          `${heroStyle} 主视觉获得 ${scoreBreakdown.hierarchy}/20 的层级分`,
          `强调状态 ${context?.emphasis ?? "standard"} 与表面组合得分 ${scoreBreakdown.emphasisFit}/20`,
        ],
      };
    }),
  );

  return raw
    .sort((first, second) => second.score - first.score || first.id.localeCompare(second.id))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

export function resolveVisual(
  context: VisualContext | undefined,
  elements: VisualElement[],
): VisualDecision {
  return resolveVisualCandidates(context, elements)[0];
}

export function selectDiverseVisuals(candidateGroups: VisualDecision[][]): VisualDecision[] {
  const paletteUsage = new Map<VisualPalette, number>();
  const surfaceUsage = new Map<VisualSurface, number>();
  const pairUsage = new Map<string, number>();

  return candidateGroups.map((candidates) => {
    const selected = [...candidates].sort((first, second) => {
      const adjusted = (candidate: VisualDecision) =>
        candidate.score
        - (paletteUsage.get(candidate.palette) ?? 0) * 2
        - (surfaceUsage.get(candidate.surface) ?? 0) * 4
        - (pairUsage.get(candidate.id) ?? 0) * 9;
      return adjusted(second) - adjusted(first) || first.rank - second.rank;
    })[0];
    paletteUsage.set(selected.palette, (paletteUsage.get(selected.palette) ?? 0) + 1);
    surfaceUsage.set(selected.surface, (surfaceUsage.get(selected.surface) ?? 0) + 1);
    pairUsage.set(selected.id, (pairUsage.get(selected.id) ?? 0) + 1);
    return selected;
  });
}
