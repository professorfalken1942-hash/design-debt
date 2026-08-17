import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";
import type {
  DesignDebtResults,
  ElementSnapshot,
  Finding,
  ScanStatus,
  ScanSummary,
  TokenProposal,
} from "../../../../packages/shared/src/index.js";
import { prisma } from "../lib/prisma.js";

export interface PersistedScan extends ScanSummary {
  maxPages: number;
}

export interface CompleteScanInput {
  scanId: string;
  pageUrls: string[];
  snapshots: ElementSnapshot[];
  results: DesignDebtResults;
  tokens: TokenProposal[];
  warnings: string[];
}

export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export async function createScanRecord(
  rootUrl: string,
  maxPages: number,
): Promise<PersistedScan> {
  const scan = await prisma.scan.create({
    data: {
      id: nanoid(),
      rootUrl,
      status: "queued",
      maxPages,
      progress: 0,
    },
  });

  return toScanSummary(scan);
}

export async function listScanRecords(): Promise<PersistedScan[]> {
  const scans = await prisma.scan.findMany({
    orderBy: { createdAt: "desc" },
  });

  return scans.map(toScanSummary);
}

export async function getScanRecord(id: string): Promise<PersistedScan | null> {
  const scan = await prisma.scan.findUnique({ where: { id } });
  return scan ? toScanSummary(scan) : null;
}

export async function markScanRunning(scanId: string): Promise<void> {
  await prisma.scan.update({
    where: { id: scanId },
    data: { status: "running", progress: 15 },
  });
}

export async function setScanProgress(scanId: string, progress: number): Promise<void> {
  await prisma.scan.update({
    where: { id: scanId },
    data: { progress },
  });
}

export async function completeScanRecord(input: CompleteScanInput): Promise<void> {
  await prisma.$transaction([
    prisma.page.deleteMany({ where: { scanId: input.scanId } }),
    prisma.elementSnapshot.deleteMany({ where: { scanId: input.scanId } }),
    prisma.finding.deleteMany({ where: { scanId: input.scanId } }),
    prisma.tokenProposal.deleteMany({ where: { scanId: input.scanId } }),
    prisma.page.createMany({
      data: input.pageUrls.map((url) => ({
        id: nanoid(),
        scanId: input.scanId,
        url,
      })),
    }),
    prisma.elementSnapshot.createMany({
      data: input.snapshots.map((snapshot) => ({
        id: nanoid(),
        scanId: input.scanId,
        pageUrl: snapshot.pageUrl,
        tagName: snapshot.tagName,
        selector: snapshot.selector,
        text: snapshot.text,
        width: snapshot.width,
        height: snapshot.height,
        styles: snapshotStyles(snapshot),
      })),
    }),
    prisma.finding.createMany({
      data: input.results.findings.map((finding) => ({
        ...finding,
        id: scopedId(input.scanId, finding.id),
        scanId: input.scanId,
      })),
    }),
    prisma.tokenProposal.createMany({
      data: input.tokens.map((token) => ({
        ...token,
        id: scopedId(input.scanId, token.id),
        scanId: input.scanId,
      })),
    }),
    prisma.scan.update({
      where: { id: input.scanId },
      data: {
        status: "completed",
        completedAt: new Date(),
        pageCount: input.pageUrls.length,
        progress: 100,
        healthScore: input.results.healthScore,
        warnings: input.warnings,
        analysis: input.results as unknown as Prisma.InputJsonValue,
        error: null,
      },
    }),
  ]);
}

export async function failScanRecord(scanId: string, error: string): Promise<void> {
  await prisma.scan.update({
    where: { id: scanId },
    data: {
      status: "failed",
      completedAt: new Date(),
      progress: 100,
      error,
    },
  });
}

export async function resetScanRecord(scanId: string): Promise<PersistedScan | null> {
  const scan = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.scan.findUnique({ where: { id: scanId } });
    if (!existing) return null;

    await transaction.page.deleteMany({ where: { scanId } });
    await transaction.elementSnapshot.deleteMany({ where: { scanId } });
    await transaction.finding.deleteMany({ where: { scanId } });
    await transaction.tokenProposal.deleteMany({ where: { scanId } });

    return transaction.scan.update({
      where: { id: scanId },
      data: {
        status: "queued",
        completedAt: null,
        pageCount: 0,
        progress: 0,
        healthScore: null,
        error: null,
        warnings: [],
        analysis: Prisma.JsonNull,
      },
    });
  });

  return scan ? toScanSummary(scan) : null;
}

export async function deleteScanRecord(scanId: string): Promise<boolean> {
  const deleted = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.scan.findUnique({ where: { id: scanId } });
    if (!existing) return false;

    await transaction.page.deleteMany({ where: { scanId } });
    await transaction.elementSnapshot.deleteMany({ where: { scanId } });
    await transaction.finding.deleteMany({ where: { scanId } });
    await transaction.tokenProposal.deleteMany({ where: { scanId } });
    await transaction.scan.delete({ where: { id: scanId } });
    return true;
  });

  return deleted;
}

export async function getPersistedResults(scanId: string): Promise<DesignDebtResults | null> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { analysis: true },
  });

  return (scan?.analysis as unknown as DesignDebtResults | null) ?? null;
}

export async function getScanWithResults(
  scanId: string,
): Promise<{ scan: PersistedScan; results: DesignDebtResults } | null> {
  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan || scan.status !== "completed" || !scan.analysis) return null;

  return {
    scan: toScanSummary(scan),
    results: scan.analysis as unknown as DesignDebtResults,
  };
}

export async function getPersistedTokens(scanId: string): Promise<TokenProposal[] | null> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { id: true },
  });
  if (!scan) return null;

  const tokens = await prisma.tokenProposal.findMany({
    where: { scanId },
    orderBy: [{ type: "asc" }, { category: "asc" }, { uses: "desc" }],
  });

  return tokens.map((token) => ({
    id: token.id,
    name: token.name,
    value: token.value,
    type: token.type as TokenProposal["type"],
    category: token.category as TokenProposal["category"],
    uses: token.uses,
    status: token.status as TokenProposal["status"],
    confidence: token.confidence as TokenProposal["confidence"],
    mapsTo: token.mapsTo ?? undefined,
  }));
}

export async function replacePersistedTokens(
  scanId: string,
  tokens: TokenProposal[],
): Promise<TokenProposal[] | null> {
  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan) return null;

  await prisma.$transaction([
    prisma.tokenProposal.deleteMany({ where: { scanId } }),
    prisma.tokenProposal.createMany({
      data: tokens.map((token) => ({ ...token, id: scopedId(scanId, token.id), scanId })),
    }),
  ]);

  return getPersistedTokens(scanId);
}

function toScanSummary(scan: {
  id: string;
  rootUrl: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  pageCount: number;
  progress: number;
  maxPages: number;
  healthScore: number | null;
  error: string | null;
  warnings: Prisma.JsonValue | null;
}): PersistedScan {
  return {
    id: scan.id,
    rootUrl: scan.rootUrl,
    status: scan.status as ScanStatus,
    createdAt: scan.createdAt.toISOString(),
    completedAt: scan.completedAt?.toISOString() ?? null,
    pageCount: scan.pageCount,
    progress: scan.progress,
    maxPages: scan.maxPages,
    healthScore: scan.healthScore,
    error: scan.error,
    warnings: Array.isArray(scan.warnings)
      ? scan.warnings.filter((warning): warning is string => typeof warning === "string")
      : [],
  };
}

function snapshotStyles(snapshot: ElementSnapshot): Record<string, string | undefined> {
  return {
    color: snapshot.color,
    backgroundColor: snapshot.backgroundColor,
    fontFamily: snapshot.fontFamily,
    fontSize: snapshot.fontSize,
    fontWeight: snapshot.fontWeight,
    lineHeight: snapshot.lineHeight,
    marginTop: snapshot.marginTop,
    marginRight: snapshot.marginRight,
    marginBottom: snapshot.marginBottom,
    marginLeft: snapshot.marginLeft,
    paddingTop: snapshot.paddingTop,
    paddingRight: snapshot.paddingRight,
    paddingBottom: snapshot.paddingBottom,
    paddingLeft: snapshot.paddingLeft,
    gap: snapshot.gap,
    borderRadius: snapshot.borderRadius,
    borderWidth: snapshot.borderWidth,
    borderColor: snapshot.borderColor,
    boxShadow: snapshot.boxShadow,
  };
}

function scopedId(scanId: string, id: string): string {
  return id.startsWith(`${scanId}-`) ? id : `${scanId}-${id}`;
}
