import type {
  DesignDebtResults,
  BacklogItem,
  BacklogStatus,
  Finding,
  FindingChange,
  MetricDelta,
  ScanComparison,
  ScanSummary,
  TokenProposal,
} from "../../../../packages/shared/src/index.js";
import {
  analyzeSnapshots,
  demoResults,
  demoSnapshots,
  demoTokens,
  exportTokensCss,
  exportTokensJson,
  generateTokenProposals,
} from "../../../../packages/analysis/src/index.js";
import { PlaywrightWebsiteScanner, validatePublicHttpUrl } from "../../../../packages/scanner/src/index.js";
import {
  completeScanRecord,
  createScanRecord,
  deleteScanRecord,
  failScanRecord,
  getPersistedResults,
  getPersistedBacklog,
  getPersistedTokens,
  getScanRecord,
  getScanWithResults,
  listScanRecords,
  markScanRunning,
  patchPersistedBacklogItem,
  replacePersistedTokens,
  resetScanRecord,
  seedPersistedBacklog,
  setScanProgress,
  type PersistedScan,
} from "./scan-repository.js";
import { prisma } from "../lib/prisma.js";

const scanner = new PlaywrightWebsiteScanner();

export async function ensureDemoScan(): Promise<void> {
  const existing = await getScanRecord("demo");
  if (existing) return;

  await prisma.scan.create({
    data: {
      id: "demo",
      rootUrl: "https://example-product.test",
      status: "completed",
      createdAt: new Date(Date.now() - 1000 * 60 * 18),
      completedAt: new Date(Date.now() - 1000 * 60 * 12),
      pageCount: 7,
      maxPages: 20,
      progress: 100,
      healthScore: 68,
      warnings: [],
      analysis: demoResults as never,
    },
  });

  await completeScanRecord({
    scanId: "demo",
    pageUrls: [...new Set(demoSnapshots.map((snapshot) => snapshot.pageUrl))],
    snapshots: demoSnapshots,
    results: demoResults,
    tokens: demoTokens,
    warnings: [],
  });
}

export async function createScan(rootUrl: string, maxPages: number): Promise<PersistedScan> {
  const validation = await validatePublicHttpUrl(rootUrl);
  if (!validation.ok || !validation.normalizedUrl) {
    throw new ScanInputError(validation.error ?? "Invalid URL.");
  }

  const scan = await createScanRecord(validation.normalizedUrl, maxPages);
  return startExecution(scan);
}

export async function listScans(): Promise<PersistedScan[]> {
  await ensureDemoScan();
  return listScanRecords();
}

export async function getScan(id: string): Promise<ScanSummary | null> {
  await ensureDemoScan();
  return getScanRecord(id);
}

export async function deleteScan(id: string): Promise<boolean> {
  await ensureDemoScan();
  if (id === "demo") {
    throw new ScanInputError("The demo scan cannot be deleted.");
  }
  return deleteScanRecord(id);
}

export async function getResults(id: string): Promise<DesignDebtResults | null> {
  await ensureDemoScan();
  return getPersistedResults(id);
}

export async function getTokens(id: string): Promise<TokenProposal[] | null> {
  await ensureDemoScan();
  return getPersistedTokens(id);
}

export async function getBacklog(id: string): Promise<BacklogItem[] | null> {
  await ensureDemoScan();
  const [results, tokens] = await Promise.all([getPersistedResults(id), getPersistedTokens(id)]);
  if (!results || !tokens) return null;

  const existing = await getPersistedBacklog(id);
  if (existing?.length) return existing;

  return seedPersistedBacklog(id, buildBacklogSuggestions(results, tokens));
}

export async function updateBacklogItem(
  scanId: string,
  itemId: string,
  patch: Partial<Pick<BacklogItem, "status" | "owner" | "notes">>,
): Promise<BacklogItem | null> {
  await ensureDemoScan();
  return patchPersistedBacklogItem(scanId, itemId, patch);
}

export async function compareScans(baseId: string, targetId: string): Promise<ScanComparison | null> {
  await ensureDemoScan();
  if (baseId === targetId) {
    throw new ScanInputError("Choose two different scans to compare.");
  }

  const [base, target] = await Promise.all([
    getScanWithResults(baseId),
    getScanWithResults(targetId),
  ]);
  if (!base || !target) return null;

  const metricDeltas = buildMetricDeltas(base.results, target.results);
  const findingChanges = compareFindings(base.results.findings, target.results.findings);
  const scoreDelta = target.results.healthScore - base.results.healthScore;

  return {
    baseScan: base.scan,
    targetScan: target.scan,
    scoreDelta,
    metricDeltas,
    ...findingChanges,
    summary: comparisonSummary(scoreDelta, findingChanges.addedFindings.length, findingChanges.resolvedFindings.length),
  };
}

export async function updateTokens(
  id: string,
  tokens: TokenProposal[],
): Promise<TokenProposal[] | null> {
  return replacePersistedTokens(id, tokens);
}

export async function retryScan(id: string): Promise<PersistedScan | null> {
  await ensureDemoScan();
  if (id === "demo") {
    const scan = await resetScanRecord(id);
    if (!scan) return null;
    await completeScanRecord({
      scanId: "demo",
      pageUrls: [...new Set(demoSnapshots.map((snapshot) => snapshot.pageUrl))],
      snapshots: demoSnapshots,
      results: demoResults,
      tokens: demoTokens,
      warnings: [],
    });
    return getScanRecord(id);
  }

  const scan = await resetScanRecord(id);
  if (!scan) return null;
  return startExecution(scan);
}

export async function exportTokens(
  id: string,
  format: "css" | "json",
): Promise<string | Record<string, unknown> | null> {
  const tokens = await getTokens(id);
  if (!tokens) return null;
  return format === "css" ? exportTokensCss(tokens) : exportTokensJson(tokens);
}

async function executeScan(scanId: string): Promise<void> {
  const scan = await getScanRecord(scanId);
  if (!scan) return;

  try {
    await markScanRunning(scanId);
    const scanResult = await scanner.scan(scan.rootUrl, {
      maxPages: isServerlessRuntime() ? Math.min(scan.maxPages, 3) : scan.maxPages,
      timeoutMs: isServerlessRuntime() ? 12_000 : undefined,
    });
    await setScanProgress(scanId, 76);
    const snapshots = scanResult.snapshots.length ? scanResult.snapshots : demoSnapshots;
    const results = analyzeSnapshots(snapshots);
    const tokens = generateTokenProposals(results);

    await completeScanRecord({
      scanId,
      pageUrls: scanResult.pages,
      snapshots,
      results,
      tokens,
      warnings: scanResult.warnings,
    });
  } catch (error) {
    try {
      await failScanRecord(
        scanId,
        error instanceof Error ? error.message : "Scan failed.",
      );
    } catch {
      // The scan may have been deleted while a background crawl was still running.
    }
  }
}

async function startExecution(scan: PersistedScan): Promise<PersistedScan> {
  if (isServerlessRuntime()) {
    await executeScan(scan.id);
    return (await getScanRecord(scan.id)) ?? scan;
  }

  void executeScan(scan.id);
  return scan;
}

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
}

export class ScanInputError extends Error {}

function buildMetricDeltas(base: DesignDebtResults, target: DesignDebtResults): MetricDelta[] {
  return [
    metricDelta("Unique colors", base.metrics.uniqueColors, target.metrics.uniqueColors),
    metricDelta("Typography styles", base.metrics.typographyStyles, target.metrics.typographyStyles),
    metricDelta("Spacing values", base.metrics.spacingValues, target.metrics.spacingValues),
    metricDelta("Button patterns", base.metrics.buttonPatterns, target.metrics.buttonPatterns),
    metricDelta("Potential inconsistencies", base.metrics.potentialInconsistencies, target.metrics.potentialInconsistencies),
  ];
}

function metricDelta(label: string, before: number, after: number): MetricDelta {
  const delta = after - before;
  return {
    label,
    before,
    after,
    delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

function compareFindings(baseFindings: Finding[], targetFindings: Finding[]) {
  const base = new Map(baseFindings.map((finding) => [finding.id, finding]));
  const target = new Map(targetFindings.map((finding) => [finding.id, finding]));

  const addedFindings = targetFindings.filter((finding) => !base.has(finding.id)).map(toFindingChange);
  const resolvedFindings = baseFindings.filter((finding) => !target.has(finding.id)).map(toFindingChange);
  const persistentFindings = targetFindings.filter((finding) => base.has(finding.id)).map(toFindingChange);

  return { addedFindings, resolvedFindings, persistentFindings };
}

function toFindingChange(finding: Finding): FindingChange {
  return {
    id: finding.id,
    title: finding.title,
    category: finding.category,
    severity: finding.severity,
    count: finding.count,
  };
}

function comparisonSummary(scoreDelta: number, added: number, resolved: number): string {
  if (scoreDelta > 0 && resolved >= added) {
    return `Health improved by ${scoreDelta} points with ${resolved} resolved findings.`;
  }
  if (scoreDelta < 0) {
    return `Health dropped by ${Math.abs(scoreDelta)} points; review ${added} new findings before exporting tokens.`;
  }
  if (added || resolved) {
    return `Health is flat, but findings changed: ${added} added and ${resolved} resolved.`;
  }
  return "No meaningful design health movement between these scans.";
}

function buildBacklogSuggestions(
  results: DesignDebtResults,
  tokens: TokenProposal[],
): Omit<BacklogItem, "id" | "scanId" | "createdAt" | "updatedAt">[] {
  const findingItems = [...results.findings]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, 6)
    .map((finding) => ({
      sourceType: "finding" as const,
      sourceId: finding.id,
      title: finding.title,
      category: finding.category,
      priority: finding.severity === "warning" ? "High" as const : "Medium" as const,
      status: "open" as BacklogStatus,
      owner: ownerForFinding(finding),
      notes: backlogNotes(finding),
      route: `/audit/${finding.targetView}`,
    }));

  const reviewTokens = tokens.filter((token) => token.status === "needs-review");
  const tokenItem = reviewTokens.length
    ? [{
        sourceType: "token-review" as const,
        sourceId: "token-review",
        title: "Resolve token export decisions",
        category: "tokens" as const,
        priority: "High" as const,
        status: "open" as BacklogStatus,
        owner: "Design + engineering",
        notes: `${reviewTokens.length} proposed tokens need include, review, or exclude decisions before handoff.`,
        route: "/tokens",
      }]
    : [];

  return [...tokenItem, ...findingItems];
}

function priorityScore(finding: Finding): number {
  const severity = finding.severity === "warning" ? 100 : finding.severity === "suggestion" ? 50 : 10;
  return severity + finding.count;
}

function ownerForFinding(finding: Finding): string {
  if (finding.category === "buttons" || finding.category === "forms") return "Design system";
  if (finding.category === "spacing" || finding.category === "colors") return "Design + engineering";
  return "Design";
}

function backlogNotes(finding: Finding): string {
  if (finding.category === "colors") return "Choose canonical roles for repeated or near-duplicate colors, then map them into named tokens.";
  if (finding.category === "spacing") return "Map rare values to the spacing scale or document why the exception should remain.";
  if (finding.category === "buttons") return "Reduce button variants into named component patterns with shared padding, radius, and color roles.";
  return finding.description;
}
