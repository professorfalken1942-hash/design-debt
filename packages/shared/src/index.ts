export type ScanStatus = "queued" | "running" | "completed" | "failed";

export interface ElementSnapshot {
  pageUrl: string;
  tagName: string;
  text?: string;
  selector?: string;
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  gap?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  boxShadow?: string;
  width?: number;
  height?: number;
}

export interface ScanSummary {
  id: string;
  rootUrl: string;
  status: ScanStatus;
  createdAt: string;
  completedAt?: string | null;
  pageCount: number;
  progress: number;
  healthScore?: number | null;
  error?: string | null;
  warnings?: string[];
}

export interface MetricSummary {
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "warning" | "danger";
}

export interface Finding {
  id: string;
  category: "colors" | "typography" | "spacing" | "borders" | "shadows" | "buttons" | "forms";
  title: string;
  severity: "info" | "suggestion" | "warning";
  description: string;
  count: number;
  targetView: string;
}

export interface InventoryItem {
  value: string;
  normalizedValue: string;
  count: number;
  pages: string[];
  examples: Pick<ElementSnapshot, "pageUrl" | "selector" | "tagName" | "text">[];
}

export interface DesignDebtResults {
  healthScore: number;
  metrics: {
    uniqueColors: number;
    spacingValues: number;
    buttonPatterns: number;
    typographyStyles: number;
    potentialInconsistencies: number;
  };
  findings: Finding[];
  inventories: {
    colors: InventoryItem[];
    typography: InventoryItem[];
    spacing: InventoryItem[];
    borders: InventoryItem[];
    shadows: InventoryItem[];
    buttons: InventoryItem[];
    forms: InventoryItem[];
  };
}

export interface TokenProposal {
  id: string;
  name: string;
  value: string;
  type: "primitive" | "semantic" | "component";
  category: "color" | "space" | "typography" | "radius" | "shadow";
  uses: number;
  status: "enabled" | "disabled" | "needs-review";
  confidence?: "high" | "medium" | "low";
  mapsTo?: string;
}
