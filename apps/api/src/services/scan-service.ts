import type { DesignDebtResults, ScanSummary, TokenProposal } from "@designdebt/shared";
import {
  analyzeSnapshots,
  demoResults,
  demoSnapshots,
  demoTokens,
  exportTokensCss,
  exportTokensJson,
  generateTokenProposals,
} from "@designdebt/analysis";
import type { Prisma } from "@prisma/client";
import { PlaywrightWebsiteScanner, validatePublicHttpUrl } from "@designdebt/scanner";
import {
  completeScanRecord,
  createScanRecord,
  failScanRecord,
  getPersistedResults,
  getPersistedTokens,
  getScanRecord,
  listScanRecords,
  markScanRunning,
  replacePersistedTokens,
  resetScanRecord,
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
      analysis: demoResults as unknown as Prisma.InputJsonValue,
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

export async function getResults(id: string): Promise<DesignDebtResults | null> {
  await ensureDemoScan();
  return getPersistedResults(id);
}

export async function getTokens(id: string): Promise<TokenProposal[] | null> {
  await ensureDemoScan();
  return getPersistedTokens(id);
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

  await markScanRunning(scanId);

  try {
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
    await failScanRecord(
      scanId,
      error instanceof Error ? error.message : "Scan failed.",
    );
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
