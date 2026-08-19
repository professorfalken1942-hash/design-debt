import type {
  DesignDebtResults,
  ElementSnapshot,
  Finding,
  InventoryItem,
  TokenProposal,
} from "../../shared/src/index.js";
import {
  colorSimilarity,
  normalizeColor,
  normalizeFontFamily,
  normalizeFontWeight,
  normalizePixelValue,
} from "./normalize.js";
import { demoSnapshots } from "./demo.js";

export { colorSimilarity, normalizeColor, normalizePixelValue } from "./normalize.js";
export { demoScreenshots, demoSnapshots } from "./demo.js";
export { exportTokensCss, exportTokensJson } from "./token-export.js";

export function analyzeSnapshots(snapshots: ElementSnapshot[]): DesignDebtResults {
  const colors = inventory(snapshots, colorValues);
  const typography = inventory(snapshots, typographyValue);
  const spacing = inventory(snapshots, spacingValues);
  const borders = inventory(snapshots, borderValues);
  const shadows = inventory(snapshots, (snapshot) => [snapshot.boxShadow].filter(Boolean) as string[]);
  const buttons = inventory(snapshots.filter(isLikelyButton), buttonValue);
  const forms = inventory(snapshots.filter(isFormControl), formValue);
  const findings = buildFindings({ colors, typography, spacing, borders, shadows, buttons, forms });
  const healthScore = calculateHealthScore({
    colors: colors.length,
    typography: typography.length,
    spacing: spacing.length,
    buttons: buttons.length,
    forms: forms.length,
    findings: findings.length,
  });

  return {
    healthScore,
    metrics: {
      uniqueColors: colors.length,
      spacingValues: spacing.length,
      buttonPatterns: buttons.length,
      typographyStyles: typography.length,
      potentialInconsistencies: findings.reduce((total, finding) => total + finding.count, 0),
    },
    findings,
    inventories: { colors, typography, spacing, borders, shadows, buttons, forms },
  };
}

export function generateTokenProposals(results: DesignDebtResults): TokenProposal[] {
  const colorTokens = results.inventories.colors
    .filter((item) => item.count >= 3)
    .slice(0, 12)
    .map((item, index): TokenProposal => ({
      id: `primitive-color-${index}`,
      name: inferColorName(item.normalizedValue, index),
      value: item.normalizedValue,
      type: "primitive",
      category: "color",
      uses: item.count,
      status: "enabled",
      confidence: item.count > 20 ? "high" : "medium",
    }));

  const spaceTokens = results.inventories.spacing
    .filter((item) => item.count >= 3)
    .slice(0, 10)
    .map((item, index): TokenProposal => ({
      id: `primitive-space-${index}`,
      name: `space.${String((index + 1) * 100)}`,
      value: item.normalizedValue,
      type: "primitive",
      category: "space",
      uses: item.count,
      status: "enabled",
      confidence: "medium",
    }));

  const textColor = colorTokens.find((token) => token.name.includes("gray")) ?? colorTokens[0];
  const actionColor = colorTokens.find((token) => token.name.includes("blue")) ?? colorTokens[1] ?? colorTokens[0];

  const semanticTokens: TokenProposal[] = [
    textColor && {
      id: "semantic-text-primary",
      name: "color.text.primary",
      value: `{${textColor.name}}`,
      mapsTo: textColor.name,
      type: "semantic",
      category: "color",
      uses: textColor.uses,
      status: "needs-review",
      confidence: "medium",
    },
    actionColor && {
      id: "semantic-action-primary",
      name: "color.action.primary",
      value: `{${actionColor.name}}`,
      mapsTo: actionColor.name,
      type: "semantic",
      category: "color",
      uses: actionColor.uses,
      status: "needs-review",
      confidence: "medium",
    },
  ].filter(Boolean) as TokenProposal[];

  return [...colorTokens, ...spaceTokens, ...semanticTokens];
}

function inventory(
  snapshots: ElementSnapshot[],
  getValues: (snapshot: ElementSnapshot) => string[],
): InventoryItem[] {
  const map = new Map<string, InventoryItem>();

  for (const snapshot of snapshots) {
    for (const rawValue of getValues(snapshot)) {
      const normalizedValue = rawValue;
      const existing = map.get(normalizedValue);
      const example = {
        pageUrl: snapshot.pageUrl,
        selector: snapshot.selector,
        tagName: snapshot.tagName,
        text: snapshot.text,
      };
      if (existing) {
        existing.count += 1;
        if (!existing.pages.includes(snapshot.pageUrl)) existing.pages.push(snapshot.pageUrl);
        if (existing.examples.length < 5) existing.examples.push(example);
      } else {
        map.set(normalizedValue, {
          value: rawValue,
          normalizedValue,
          count: 1,
          pages: [snapshot.pageUrl],
          examples: [example],
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count);
}

function colorValues(snapshot: ElementSnapshot): string[] {
  return [snapshot.color, snapshot.backgroundColor, snapshot.borderColor]
    .map(normalizeColor)
    .filter((value): value is string => Boolean(value && value !== "transparent"));
}

function typographyValue(snapshot: ElementSnapshot): string[] {
  const family = normalizeFontFamily(snapshot.fontFamily);
  const size = normalizePixelValue(snapshot.fontSize);
  const weight = normalizeFontWeight(snapshot.fontWeight);
  const lineHeight = normalizePixelValue(snapshot.lineHeight);
  return family && size ? [`${family} / ${size} / ${weight ?? "400"} / ${lineHeight ?? "normal"}`] : [];
}

function spacingValues(snapshot: ElementSnapshot): string[] {
  return [
    snapshot.marginTop,
    snapshot.marginRight,
    snapshot.marginBottom,
    snapshot.marginLeft,
    snapshot.paddingTop,
    snapshot.paddingRight,
    snapshot.paddingBottom,
    snapshot.paddingLeft,
    snapshot.gap,
  ]
    .map(normalizePixelValue)
    .filter((value): value is string => Boolean(value && value !== "0"));
}

function borderValues(snapshot: ElementSnapshot): string[] {
  return [snapshot.borderRadius, snapshot.borderWidth, snapshot.borderColor]
    .map((value) => normalizePixelValue(value) ?? normalizeColor(value))
    .filter((value): value is string => Boolean(value && value !== "0" && value !== "transparent"));
}

function buttonValue(snapshot: ElementSnapshot): string[] {
  return [
    [
      normalizeColor(snapshot.color),
      normalizeColor(snapshot.backgroundColor),
      normalizePixelValue(snapshot.borderRadius),
      normalizePixelValue(snapshot.paddingTop),
      normalizePixelValue(snapshot.paddingRight),
      normalizeFontWeight(snapshot.fontWeight),
    ]
      .filter(Boolean)
      .join(" / "),
  ];
}

function formValue(snapshot: ElementSnapshot): string[] {
  return [
    [
      normalizeColor(snapshot.backgroundColor),
      normalizeColor(snapshot.borderColor),
      normalizePixelValue(snapshot.borderRadius),
      normalizePixelValue(snapshot.height ? `${snapshot.height}px` : undefined),
    ]
      .filter(Boolean)
      .join(" / "),
  ];
}

function isLikelyButton(snapshot: ElementSnapshot): boolean {
  return snapshot.tagName === "button" || snapshot.tagName === "a" || /button/i.test(snapshot.selector ?? "");
}

function isFormControl(snapshot: ElementSnapshot): boolean {
  return ["input", "select", "textarea"].includes(snapshot.tagName);
}

function buildFindings(inventories: DesignDebtResults["inventories"]): Finding[] {
  const findings: Finding[] = [];
  const similarColors = findSimilarColors(inventories.colors);
  if (similarColors > 0) {
    findings.push({
      id: "similar-colors",
      category: "colors",
      title: `${similarColors} visually similar color groups detected`,
      severity: "warning",
      description: "Near-duplicate colors may indicate token drift or ungoverned brand variants.",
      count: similarColors,
      targetView: "colors",
    });
  }
  const rareSpacing = inventories.spacing.filter((item) => item.count <= 2).length;
  if (rareSpacing) {
    findings.push({
      id: "rare-spacing",
      category: "spacing",
      title: `${rareSpacing} spacing values appear rarely`,
      severity: "suggestion",
      description: "Rare values are suggestions for review, not automatic defects.",
      count: rareSpacing,
      targetView: "spacing",
    });
  }
  if (inventories.buttons.length > 5) {
    findings.push({
      id: "button-fragmentation",
      category: "buttons",
      title: `${inventories.buttons.length} likely button patterns`,
      severity: "warning",
      description: "Button variants differ across color, padding, radius, or typography.",
      count: inventories.buttons.length,
      targetView: "buttons",
    });
  }
  return findings;
}

function findSimilarColors(colors: InventoryItem[]): number {
  let groups = 0;
  const visited = new Set<string>();
  for (const color of colors) {
    if (visited.has(color.normalizedValue)) continue;
    const matches = colors.filter(
      (candidate) =>
        candidate.normalizedValue !== color.normalizedValue &&
        colorSimilarity(color.normalizedValue, candidate.normalizedValue) >= 94,
    );
    if (matches.length) {
      groups += 1;
      visited.add(color.normalizedValue);
      matches.forEach((match) => visited.add(match.normalizedValue));
    }
  }
  return groups;
}

function calculateHealthScore(input: {
  colors: number;
  typography: number;
  spacing: number;
  buttons: number;
  forms: number;
  findings: number;
}): number {
  const penalty =
    Math.max(input.colors - 16, 0) * 0.8 +
    Math.max(input.typography - 8, 0) * 1.8 +
    Math.max(input.spacing - 12, 0) * 1.2 +
    Math.max(input.buttons - 4, 0) * 2.2 +
    Math.max(input.forms - 3, 0) * 2 +
    input.findings * 4;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

function inferColorName(value: string, index: number): string {
  const lower = value.toLowerCase();
  if (["#0066cc", "#0569c9", "#0065c8"].includes(lower)) return `color.blue.${index === 0 ? "500" : 500 + index * 100}`;
  if (["#111827", "#1f2937", "#374151"].includes(lower)) return `color.gray.${900 - index * 100}`;
  if (lower === "#ffffff") return "color.white";
  return `color.palette.${String(index + 1).padStart(2, "0")}`;
}

export const demoResults: DesignDebtResults = {
  ...analyzeSnapshots(demoSnapshots),
  healthScore: 68,
  metrics: {
    uniqueColors: 57,
    spacingValues: 24,
    buttonPatterns: 11,
    typographyStyles: 8,
    potentialInconsistencies: 19,
  },
};

export const demoTokens = generateTokenProposals(demoResults);
