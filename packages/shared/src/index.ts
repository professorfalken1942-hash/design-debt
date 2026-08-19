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

export interface PageScreenshot {
  id: string;
  scanId: string;
  pageUrl: string;
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
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

export interface MetricDelta {
  label: string;
  before: number;
  after: number;
  delta: number;
  direction: "up" | "down" | "flat";
}

export interface FindingChange {
  id: string;
  title: string;
  category: Finding["category"];
  severity: Finding["severity"];
  count: number;
}

export interface ScanComparison {
  baseScan: ScanSummary;
  targetScan: ScanSummary;
  scoreDelta: number;
  metricDeltas: MetricDelta[];
  addedFindings: FindingChange[];
  resolvedFindings: FindingChange[];
  persistentFindings: FindingChange[];
  summary: string;
}

export type BacklogStatus = "open" | "accepted" | "ignored" | "fixed";

export interface BacklogItem {
  id: string;
  scanId: string;
  sourceType: "finding" | "token-review" | "manual";
  sourceId: string;
  title: string;
  category: Finding["category"] | "tokens";
  priority: "High" | "Medium" | "Low";
  status: BacklogStatus;
  owner: string;
  notes: string;
  route: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageGroup {
  id: string;
  name: string;
  matchers: string[];
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledScan {
  id: string;
  rootUrl: string;
  cadence: "weekly" | "biweekly" | "monthly";
  maxPages: number;
  enabled: boolean;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "designer" | "developer" | "viewer";
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSettings {
  id: string;
  teamName: string;
  defaultPageLimit: number;
  crawlerMode: "same-origin" | "page-list";
  namingPreset: "scale" | "semantic" | "css";
  reviewThreshold: "strict" | "balanced" | "fast";
  ignoredPaths: string[];
  teamNotes: string;
  screenshotEvidence: boolean;
  reportFormatDefault: "markdown" | "html";
  updatedAt: string;
  pageGroups: PageGroup[];
  schedules: ScheduledScan[];
  teamMembers: TeamMember[];
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
