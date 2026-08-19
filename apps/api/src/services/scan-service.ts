import type {
  DesignDebtResults,
  BacklogItem,
  BacklogStatus,
  Finding,
  FindingChange,
  MetricDelta,
  PageGroup,
  PageScreenshot,
  ScanComparison,
  ScanSummary,
  ScheduledScan,
  TeamMember,
  WorkspaceSettings,
  TokenProposal,
} from "../../../../packages/shared/src/index.js";
import {
  analyzeSnapshots,
  demoResults,
  demoScreenshots,
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
  getPersistedScreenshots,
  getPersistedTokens,
  getScanRecord,
  getScanWithResults,
  getWorkspaceSettings,
  listScanRecords,
  markScanRunning,
  patchPersistedBacklogItem,
  replacePageGroups,
  replacePersistedTokens,
  replaceScanSchedules,
  replaceTeamMembers,
  resetScanRecord,
  seedPersistedBacklog,
  seedPersistedScreenshots,
  setScanProgress,
  type PersistedScan,
  updateWorkspaceSettings,
} from "./scan-repository.js";
import { prisma } from "../lib/prisma.js";

const scanner = new PlaywrightWebsiteScanner();

export async function ensureDemoScan(workspaceId = "default"): Promise<void> {
  const demoId = workspaceDemoId(workspaceId);
  const existing = await getScanRecord(demoId, workspaceId);
  if (existing) {
    const screenshots = await getPersistedScreenshots(demoId, workspaceId);
    if (!screenshots?.length) await seedPersistedScreenshots(demoId, demoScreenshots, workspaceId);
    return;
  }

  await prisma.scan.create({
    data: {
      id: demoId,
      workspaceId,
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
    scanId: demoId,
    pageUrls: [...new Set(demoSnapshots.map((snapshot) => snapshot.pageUrl))],
    snapshots: demoSnapshots,
    screenshots: demoScreenshots,
    results: demoResults,
    tokens: demoTokens,
    warnings: [],
  });
}

export async function createScan(rootUrl: string, maxPages: number, workspaceId = "default"): Promise<PersistedScan> {
  const validation = await validatePublicHttpUrl(rootUrl);
  if (!validation.ok || !validation.normalizedUrl) {
    throw new ScanInputError(validation.error ?? "Invalid URL.");
  }

  const scan = await createScanRecord(validation.normalizedUrl, maxPages, workspaceId);
  return startExecution(scan, workspaceId);
}

export async function listScans(workspaceId = "default"): Promise<PersistedScan[]> {
  await ensureDemoScan(workspaceId);
  return listScanRecords(workspaceId);
}

export async function getScan(id: string, workspaceId = "default"): Promise<ScanSummary | null> {
  await ensureDemoScan(workspaceId);
  return getScanRecord(scanIdForWorkspace(id, workspaceId), workspaceId);
}

export async function deleteScan(id: string, workspaceId = "default"): Promise<boolean> {
  await ensureDemoScan(workspaceId);
  if (id === "demo") {
    throw new ScanInputError("The demo scan cannot be deleted.");
  }
  return deleteScanRecord(scanIdForWorkspace(id, workspaceId), workspaceId);
}

export async function getResults(id: string, workspaceId = "default"): Promise<DesignDebtResults | null> {
  await ensureDemoScan(workspaceId);
  return getPersistedResults(scanIdForWorkspace(id, workspaceId), workspaceId);
}

export async function getTokens(id: string, workspaceId = "default"): Promise<TokenProposal[] | null> {
  await ensureDemoScan(workspaceId);
  return getPersistedTokens(scanIdForWorkspace(id, workspaceId), workspaceId);
}

export async function getBacklog(id: string, workspaceId = "default"): Promise<BacklogItem[] | null> {
  await ensureDemoScan(workspaceId);
  const scanId = scanIdForWorkspace(id, workspaceId);
  const [results, tokens] = await Promise.all([
    getPersistedResults(scanId, workspaceId),
    getPersistedTokens(scanId, workspaceId),
  ]);
  if (!results || !tokens) return null;

  const existing = await getPersistedBacklog(scanId, workspaceId);
  if (existing?.length) return existing;

  return seedPersistedBacklog(scanId, buildBacklogSuggestions(results, tokens), workspaceId);
}

export async function getScreenshots(id: string, workspaceId = "default"): Promise<PageScreenshot[] | null> {
  await ensureDemoScan(workspaceId);
  const scanId = scanIdForWorkspace(id, workspaceId);
  const screenshots = await getPersistedScreenshots(scanId, workspaceId);
  if (id === "demo" && !screenshots?.length) return seedPersistedScreenshots(scanId, demoScreenshots, workspaceId);
  return screenshots;
}

export async function getSettings(workspaceId = "default"): Promise<WorkspaceSettings> {
  return getWorkspaceSettings(workspaceId);
}

export async function saveSettings(
  patch: Partial<Pick<WorkspaceSettings, "teamName" | "defaultPageLimit" | "crawlerMode" | "namingPreset" | "reviewThreshold" | "ignoredPaths" | "teamNotes" | "screenshotEvidence" | "reportFormatDefault">>,
  workspaceId = "default",
): Promise<WorkspaceSettings> {
  return updateWorkspaceSettings(patch, workspaceId);
}

export async function savePageGroups(
  groups: Array<Pick<PageGroup, "id" | "name" | "matchers" | "color">>,
  workspaceId = "default",
): Promise<WorkspaceSettings> {
  return replacePageGroups(groups, workspaceId);
}

export async function saveSchedules(
  schedules: Array<Pick<ScheduledScan, "id" | "rootUrl" | "cadence" | "maxPages" | "enabled" | "nextRunAt">>,
  workspaceId = "default",
): Promise<WorkspaceSettings> {
  return replaceScanSchedules(schedules, workspaceId);
}

export async function saveTeamMembers(
  members: Array<Pick<TeamMember, "id" | "name" | "email" | "role">>,
  workspaceId = "default",
): Promise<WorkspaceSettings> {
  return replaceTeamMembers(members, workspaceId);
}

export async function updateBacklogItem(
  scanId: string,
  itemId: string,
  patch: Partial<Pick<BacklogItem, "status" | "owner" | "notes">>,
  workspaceId = "default",
): Promise<BacklogItem | null> {
  await ensureDemoScan(workspaceId);
  return patchPersistedBacklogItem(scanIdForWorkspace(scanId, workspaceId), itemId, patch, workspaceId);
}

export async function compareScans(baseId: string, targetId: string, workspaceId = "default"): Promise<ScanComparison | null> {
  await ensureDemoScan(workspaceId);
  if (baseId === targetId) {
    throw new ScanInputError("Choose two different scans to compare.");
  }

  const [base, target] = await Promise.all([
    getScanWithResults(scanIdForWorkspace(baseId, workspaceId), workspaceId),
    getScanWithResults(scanIdForWorkspace(targetId, workspaceId), workspaceId),
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
  workspaceId = "default",
): Promise<TokenProposal[] | null> {
  return replacePersistedTokens(scanIdForWorkspace(id, workspaceId), tokens, workspaceId);
}

export async function retryScan(id: string, workspaceId = "default"): Promise<PersistedScan | null> {
  await ensureDemoScan(workspaceId);
  if (id === "demo") {
    const demoId = workspaceDemoId(workspaceId);
    const scan = await resetScanRecord(demoId, workspaceId);
    if (!scan) return null;
    await completeScanRecord({
      scanId: demoId,
      pageUrls: [...new Set(demoSnapshots.map((snapshot) => snapshot.pageUrl))],
      snapshots: demoSnapshots,
      screenshots: demoScreenshots,
      results: demoResults,
      tokens: demoTokens,
      warnings: [],
    });
    return getScanRecord(demoId, workspaceId);
  }

  const scan = await resetScanRecord(scanIdForWorkspace(id, workspaceId), workspaceId);
  if (!scan) return null;
  return startExecution(scan, workspaceId);
}

export async function exportTokens(
  id: string,
  format: "css" | "json",
  workspaceId = "default",
): Promise<string | Record<string, unknown> | null> {
  const tokens = await getTokens(id, workspaceId);
  if (!tokens) return null;
  return format === "css" ? exportTokensCss(tokens) : exportTokensJson(tokens);
}

async function executeScan(scanId: string, workspaceId = "default"): Promise<void> {
  const scan = await getScanRecord(scanId, workspaceId);
  if (!scan) return;

  try {
    await markScanRunning(scanId);
    const settings = await getWorkspaceSettings(workspaceId);
    const scanResult = await scanner.scan(scan.rootUrl, {
      maxPages: isServerlessRuntime() ? Math.min(scan.maxPages, 3) : scan.maxPages,
      timeoutMs: isServerlessRuntime() ? 12_000 : undefined,
      ignoredPaths: settings.ignoredPaths,
      captureScreenshots: settings.screenshotEvidence,
    });
    await setScanProgress(scanId, 76);
    const snapshots = scanResult.snapshots.length ? scanResult.snapshots : demoSnapshots;
    const results = analyzeSnapshots(snapshots);
    const tokens = generateTokenProposals(results);

    await completeScanRecord({
      scanId,
      pageUrls: scanResult.pages,
      snapshots,
      screenshots: scanResult.screenshots,
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

export async function exportStakeholderReport(
  id: string,
  format: "markdown" | "html",
  workspaceId = "default",
): Promise<string | null> {
  await ensureDemoScan(workspaceId);
  const scanId = scanIdForWorkspace(id, workspaceId);
  const [scan, results, tokens, backlog, screenshots] = await Promise.all([
    getScanRecord(scanId, workspaceId),
    getPersistedResults(scanId, workspaceId),
    getPersistedTokens(scanId, workspaceId),
    getBacklog(scanId, workspaceId),
    getPersistedScreenshots(scanId, workspaceId),
  ]);
  if (!scan || !results || !tokens || !backlog) return null;

  return format === "html"
    ? htmlReport(scan, results, tokens, backlog, screenshots ?? [])
    : markdownReport(scan, results, tokens, backlog);
}

function markdownReport(
  scan: ScanSummary,
  results: DesignDebtResults,
  tokens: TokenProposal[],
  backlog: BacklogItem[],
): string {
  return [
    "# UIpen Stakeholder Report",
    "",
    `Source: ${scan.rootUrl}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Design Health Score: ${results.healthScore}`,
    `- Findings: ${results.findings.length}`,
    `- Included tokens: ${tokens.filter((token) => token.status === "enabled").length}`,
    `- Token decisions pending: ${tokens.filter((token) => token.status === "needs-review").length}`,
    `- Open backlog items: ${backlog.filter((item) => item.status === "open" || item.status === "accepted").length}`,
    "",
    "## Top Backlog",
    "",
    ...(backlog.length
      ? backlog.slice(0, 8).map((item) => `- [${item.status}] ${item.title} (${item.priority}, ${item.owner || "Unassigned"})`)
      : ["- No backlog items yet."]),
    "",
    "## Highest-Impact Findings",
    "",
    ...(results.findings.slice(0, 6).map((finding) => `- ${finding.title}: ${finding.description}`)),
    "",
  ].join("\n");
}

function htmlReport(
  scan: ScanSummary,
  results: DesignDebtResults,
  tokens: TokenProposal[],
  backlog: BacklogItem[],
  screenshots: PageScreenshot[],
): string {
  const topFindings = results.findings.slice(0, 6);
  const evidence = screenshots.slice(0, 6);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UIpen stakeholder report</title>
  <style>
    body{margin:0;background:#f8fafc;color:#111827;font-family:Raleway,Arial,sans-serif;line-height:1.55}
    main{max-width:1080px;margin:0 auto;padding:32px}
    header{border-bottom:1px solid #dbe3ea;padding-bottom:24px;margin-bottom:24px}
    h1{font-size:42px;line-height:1;margin:0 0 12px}
    h2{font-size:22px;margin:0 0 12px}
    .muted{color:#52616b}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:18px 0 28px}
    .card{background:white;border:1px solid #dbe3ea;border-radius:8px;padding:16px;break-inside:avoid}
    .metric strong{display:block;font-size:34px;line-height:1.1}
    .badge{display:inline-block;border:1px solid #bdd7e8;border-radius:999px;color:#005f8f;padding:4px 10px;font-size:13px}
    ol,ul{padding-left:22px}
    li{margin:8px 0}
    img{display:block;max-width:100%;border:1px solid #dbe3ea;border-radius:8px}
    .screens{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
    .page-break{break-before:page}
    @media print{body{background:white}main{padding:0}.card{box-shadow:none}}
  </style>
</head>
<body>
<main>
  <header>
    <span class="badge">Stakeholder report</span>
    <h1>Design-system audit</h1>
    <p class="muted">${escapeHtml(scan.rootUrl)} · Generated ${escapeHtml(new Date().toLocaleString("en-US"))}</p>
  </header>

  <section class="grid">
    <article class="card metric"><span>Design Health Score</span><strong>${results.healthScore}</strong></article>
    <article class="card metric"><span>Findings</span><strong>${results.findings.length}</strong></article>
    <article class="card metric"><span>Included tokens</span><strong>${tokens.filter((token) => token.status === "enabled").length}</strong></article>
    <article class="card metric"><span>Backlog items</span><strong>${backlog.length}</strong></article>
  </section>

  <section class="card">
    <h2>Executive summary</h2>
    <p>This scan found ${results.metrics.potentialInconsistencies} potential consistency issues across ${scan.pageCount} pages. The highest-value work is to resolve accepted backlog items, approve reusable token candidates, and keep visual evidence attached to each finding.</p>
  </section>

  <section class="grid">
    <article class="card"><h2>Top backlog</h2><ul>${backlog.slice(0, 8).map((item) => `<li><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.priority)} · ${escapeHtml(item.status)} · ${escapeHtml(item.owner || "Unassigned")}</span></li>`).join("") || "<li>No backlog items yet.</li>"}</ul></article>
    <article class="card"><h2>Top findings</h2><ul>${topFindings.map((finding) => `<li><strong>${escapeHtml(finding.title)}</strong><br><span class="muted">${escapeHtml(finding.description)}</span></li>`).join("") || "<li>No findings available.</li>"}</ul></article>
  </section>

  <section class="page-break">
    <h2>Visual evidence</h2>
    <div class="screens">${evidence.map((screenshot) => `<figure class="card"><img src="${screenshot.dataUrl}" width="${screenshot.width}" height="${screenshot.height}" alt="Screenshot of ${escapeHtml(screenshot.pageUrl)}"><figcaption class="muted">${escapeHtml(screenshot.pageUrl)}</figcaption></figure>`).join("") || "<p>No screenshots captured for this scan.</p>"}</div>
  </section>
</main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

async function startExecution(scan: PersistedScan, workspaceId = "default"): Promise<PersistedScan> {
  if (isServerlessRuntime()) {
    await executeScan(scan.id, workspaceId);
    return (await getScanRecord(scan.id, workspaceId)) ?? scan;
  }

  void executeScan(scan.id, workspaceId);
  return scan;
}

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
}

export class ScanInputError extends Error {}

function workspaceDemoId(workspaceId: string): string {
  return workspaceId === "default" ? "demo" : `demo-${workspaceId}`;
}

function scanIdForWorkspace(id: string, workspaceId: string): string {
  return id === "demo" ? workspaceDemoId(workspaceId) : id;
}

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
