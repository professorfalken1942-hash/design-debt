import { nanoid } from "nanoid";
import type {
  DesignDebtResults,
  BacklogItem,
  BacklogStatus,
  ElementSnapshot,
  Finding,
  PageGroup,
  PageScreenshot,
  ScanStatus,
  ScheduledScan,
  ScanSummary,
  TeamMember,
  TokenProposal,
  WorkspaceSettings,
} from "../../../../packages/shared/src/index.js";
import { prisma } from "../lib/prisma.js";

type PrismaTransaction = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
type TokenProposalRecord = {
  id: string;
  name: string;
  value: string;
  type: string;
  category: string;
  uses: number;
  status: string;
  confidence: string | null;
  mapsTo: string | null;
};
type SettingsRecord = {
  id: string;
  teamName: string;
  defaultPageLimit: number;
  crawlerMode: string;
  namingPreset: string;
  reviewThreshold: string;
  ignoredPaths: unknown;
  teamNotes: string;
  screenshotEvidence: boolean;
  reportFormatDefault: string;
  updatedAt: Date;
};
type PageGroupRecord = {
  id: string;
  name: string;
  matchers: unknown;
  color: string;
  createdAt: Date;
  updatedAt: Date;
};
type ScanScheduleRecord = {
  id: string;
  rootUrl: string;
  cadence: string;
  maxPages: number;
  enabled: boolean;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type TeamMemberRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface PersistedScan extends ScanSummary {
  maxPages: number;
}

export interface CompleteScanInput {
  scanId: string;
  pageUrls: string[];
  snapshots: ElementSnapshot[];
  screenshots: Omit<PageScreenshot, "id" | "scanId">[];
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
  workspaceId = "default",
): Promise<PersistedScan> {
  const scan = await prisma.scan.create({
    data: {
      id: nanoid(),
      workspaceId,
      rootUrl,
      status: "queued",
      maxPages,
      progress: 0,
    },
  });

  return toScanSummary(scan);
}

export async function listScanRecords(workspaceId = "default"): Promise<PersistedScan[]> {
  const scans = await prisma.scan.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return scans.map(toScanSummary);
}

export async function getScanRecord(id: string, workspaceId = "default"): Promise<PersistedScan | null> {
  const scan = await prisma.scan.findFirst({ where: { id, workspaceId } });
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
    prisma.pageScreenshot.deleteMany({ where: { scanId: input.scanId } }),
    prisma.finding.deleteMany({ where: { scanId: input.scanId } }),
    prisma.tokenProposal.deleteMany({ where: { scanId: input.scanId } }),
    prisma.backlogItem.deleteMany({ where: { scanId: input.scanId } }),
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
    ...(input.screenshots.length
      ? [
          prisma.pageScreenshot.createMany({
            data: input.screenshots.map((screenshot) => ({
              id: scopedId(input.scanId, `screenshot-${screenshot.pageUrl}`),
              scanId: input.scanId,
              pageUrl: screenshot.pageUrl,
              dataUrl: screenshot.dataUrl,
              width: screenshot.width,
              height: screenshot.height,
              capturedAt: new Date(screenshot.capturedAt),
            })),
          }),
        ]
      : []),
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
        analysis: input.results as never,
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

export async function resetScanRecord(scanId: string, workspaceId = "default"): Promise<PersistedScan | null> {
  const scan = await prisma.$transaction(async (transaction: PrismaTransaction) => {
    const existing = await transaction.scan.findFirst({ where: { id: scanId, workspaceId } });
    if (!existing) return null;

    await transaction.page.deleteMany({ where: { scanId } });
    await transaction.elementSnapshot.deleteMany({ where: { scanId } });
    await transaction.pageScreenshot.deleteMany({ where: { scanId } });
    await transaction.finding.deleteMany({ where: { scanId } });
    await transaction.tokenProposal.deleteMany({ where: { scanId } });
    await transaction.backlogItem.deleteMany({ where: { scanId } });

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
        analysis: null as never,
      },
    });
  });

  return scan ? toScanSummary(scan) : null;
}

export async function deleteScanRecord(scanId: string, workspaceId = "default"): Promise<boolean> {
  const deleted = await prisma.$transaction(async (transaction: PrismaTransaction) => {
    const existing = await transaction.scan.findFirst({ where: { id: scanId, workspaceId } });
    if (!existing) return false;

    await transaction.page.deleteMany({ where: { scanId } });
    await transaction.elementSnapshot.deleteMany({ where: { scanId } });
    await transaction.pageScreenshot.deleteMany({ where: { scanId } });
    await transaction.finding.deleteMany({ where: { scanId } });
    await transaction.tokenProposal.deleteMany({ where: { scanId } });
    await transaction.scan.delete({ where: { id: scanId } });
    return true;
  });

  return deleted;
}

export async function getPersistedResults(scanId: string, workspaceId = "default"): Promise<DesignDebtResults | null> {
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, workspaceId },
    select: { analysis: true },
  });

  return (scan?.analysis as unknown as DesignDebtResults | null) ?? null;
}

export async function getScanWithResults(
  scanId: string,
  workspaceId = "default",
): Promise<{ scan: PersistedScan; results: DesignDebtResults } | null> {
  const scan = await prisma.scan.findFirst({ where: { id: scanId, workspaceId } });
  if (!scan || scan.status !== "completed" || !scan.analysis) return null;

  return {
    scan: toScanSummary(scan),
    results: scan.analysis as unknown as DesignDebtResults,
  };
}

export async function getPersistedTokens(scanId: string, workspaceId = "default"): Promise<TokenProposal[] | null> {
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, workspaceId },
    select: { id: true },
  });
  if (!scan) return null;

  const tokens = await prisma.tokenProposal.findMany({
    where: { scanId },
    orderBy: [{ type: "asc" }, { category: "asc" }, { uses: "desc" }],
  });

  return tokens.map((token: TokenProposalRecord) => ({
    id: token.id,
    name: token.name,
    value: token.value,
    type: token.type as TokenProposal["type"],
    category: token.category as TokenProposal["category"],
    uses: token.uses,
    status: token.status as TokenProposal["status"],
    confidence: (token.confidence ?? "medium") as TokenProposal["confidence"],
    mapsTo: token.mapsTo ?? undefined,
  }));
}

export async function replacePersistedTokens(
  scanId: string,
  tokens: TokenProposal[],
  workspaceId = "default",
): Promise<TokenProposal[] | null> {
  const scan = await prisma.scan.findFirst({ where: { id: scanId, workspaceId } });
  if (!scan) return null;

  await prisma.$transaction([
    prisma.tokenProposal.deleteMany({ where: { scanId } }),
    prisma.tokenProposal.createMany({
      data: tokens.map((token) => ({ ...token, id: scopedId(scanId, token.id), scanId })),
    }),
  ]);

  return getPersistedTokens(scanId, workspaceId);
}

export async function getPersistedBacklog(scanId: string, workspaceId = "default"): Promise<BacklogItem[] | null> {
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, workspaceId },
    select: { id: true },
  });
  if (!scan) return null;

  const backlog = await prisma.backlogItem.findMany({
    where: { scanId },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
  });

  return backlog.map(toBacklogItem);
}

export async function seedPersistedBacklog(
  scanId: string,
  items: Omit<BacklogItem, "id" | "scanId" | "createdAt" | "updatedAt">[],
  workspaceId = "default",
): Promise<BacklogItem[] | null> {
  const scan = await prisma.scan.findFirst({ where: { id: scanId, workspaceId } });
  if (!scan) return null;

  await prisma.$transaction(
    items.map((item) =>
      prisma.backlogItem.upsert({
        where: {
          scanId_sourceType_sourceId: {
            scanId,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
          },
        },
        update: {},
        create: {
          id: scopedId(scanId, `backlog-${item.sourceType}-${item.sourceId}`),
          scanId,
          ...item,
        },
      }),
    ),
  );

  return getPersistedBacklog(scanId, workspaceId);
}

export async function patchPersistedBacklogItem(
  scanId: string,
  itemId: string,
  patch: Partial<Pick<BacklogItem, "status" | "owner" | "notes">>,
  workspaceId = "default",
): Promise<BacklogItem | null> {
  const scan = await prisma.scan.findFirst({ where: { id: scanId, workspaceId }, select: { id: true } });
  if (!scan) return null;

  const existing = await prisma.backlogItem.findFirst({
    where: { id: itemId, scanId },
  });
  if (!existing) return null;

  const updated = await prisma.backlogItem.update({
    where: { id: itemId },
    data: {
      status: patch.status,
      owner: patch.owner,
      notes: patch.notes,
    },
  });

  return toBacklogItem(updated);
}

export async function getPersistedScreenshots(scanId: string, workspaceId = "default"): Promise<PageScreenshot[] | null> {
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, workspaceId },
    select: { id: true },
  });
  if (!scan) return null;

  const screenshots = await prisma.pageScreenshot.findMany({
    where: { scanId },
    orderBy: { capturedAt: "asc" },
  });

  return screenshots.map(toPageScreenshot);
}

export async function seedPersistedScreenshots(
  scanId: string,
  screenshots: Omit<PageScreenshot, "id" | "scanId">[],
  workspaceId = "default",
): Promise<PageScreenshot[] | null> {
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, workspaceId },
    select: { id: true },
  });
  if (!scan) return null;

  if (screenshots.length) {
    await prisma.$transaction(
      screenshots.map((screenshot) =>
        prisma.pageScreenshot.upsert({
          where: { id: scopedId(scanId, `screenshot-${screenshot.pageUrl}`) },
          update: {},
          create: {
            id: scopedId(scanId, `screenshot-${screenshot.pageUrl}`),
            scanId,
            pageUrl: screenshot.pageUrl,
            dataUrl: screenshot.dataUrl,
            width: screenshot.width,
            height: screenshot.height,
            capturedAt: new Date(screenshot.capturedAt),
          },
        }),
      ),
    );
  }

  return getPersistedScreenshots(scanId, workspaceId);
}

export async function getWorkspaceSettings(workspaceId = "default"): Promise<WorkspaceSettings> {
  await ensureWorkspaceSettingsRecord(workspaceId);
  const [settings, pageGroups, schedules, teamMembers] = await Promise.all([
    prisma.workspaceSettings.findUniqueOrThrow({ where: { workspaceId } }),
    prisma.pageGroup.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
    prisma.scanSchedule.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
    prisma.teamMember.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
  ]);

  return toWorkspaceSettings(settings, pageGroups, schedules, teamMembers);
}

export async function updateWorkspaceSettings(
  patch: Partial<Pick<WorkspaceSettings, "teamName" | "defaultPageLimit" | "crawlerMode" | "namingPreset" | "reviewThreshold" | "ignoredPaths" | "teamNotes" | "screenshotEvidence" | "reportFormatDefault">>,
  workspaceId = "default",
): Promise<WorkspaceSettings> {
  await ensureWorkspaceSettingsRecord(workspaceId);
  await prisma.workspaceSettings.update({
    where: { workspaceId },
    data: {
      teamName: patch.teamName,
      defaultPageLimit: patch.defaultPageLimit,
      crawlerMode: patch.crawlerMode,
      namingPreset: patch.namingPreset,
      reviewThreshold: patch.reviewThreshold,
      ignoredPaths: patch.ignoredPaths as never,
      teamNotes: patch.teamNotes,
      screenshotEvidence: patch.screenshotEvidence,
      reportFormatDefault: patch.reportFormatDefault,
    },
  });
  return getWorkspaceSettings(workspaceId);
}

export async function replacePageGroups(
  groups: Array<Pick<PageGroup, "id" | "name" | "matchers" | "color">>,
  workspaceId = "default",
): Promise<WorkspaceSettings> {
  await prisma.$transaction([
    prisma.pageGroup.deleteMany({ where: { workspaceId } }),
    ...(groups.length
      ? [
          prisma.pageGroup.createMany({
            data: groups.map((group) => ({
              id: group.id || nanoid(),
              workspaceId,
              name: group.name,
              matchers: group.matchers as never,
              color: group.color,
            })),
          }),
        ]
      : []),
  ]);
  return getWorkspaceSettings(workspaceId);
}

export async function replaceScanSchedules(
  schedules: Array<Pick<ScheduledScan, "id" | "rootUrl" | "cadence" | "maxPages" | "enabled" | "nextRunAt">>,
  workspaceId = "default",
): Promise<WorkspaceSettings> {
  await prisma.$transaction([
    prisma.scanSchedule.deleteMany({ where: { workspaceId } }),
    ...(schedules.length
      ? [
          prisma.scanSchedule.createMany({
            data: schedules.map((schedule) => ({
              id: schedule.id || nanoid(),
              workspaceId,
              rootUrl: schedule.rootUrl,
              cadence: schedule.cadence,
              maxPages: schedule.maxPages,
              enabled: schedule.enabled,
              nextRunAt: schedule.nextRunAt ? new Date(schedule.nextRunAt) : null,
            })),
          }),
        ]
      : []),
  ]);
  return getWorkspaceSettings(workspaceId);
}

export async function replaceTeamMembers(
  members: Array<Pick<TeamMember, "id" | "name" | "email" | "role">>,
  workspaceId = "default",
): Promise<WorkspaceSettings> {
  await prisma.$transaction([
    prisma.teamMember.deleteMany({ where: { workspaceId } }),
    ...(members.length
      ? [
          prisma.teamMember.createMany({
            data: members.map((member) => ({
              id: member.id || nanoid(),
              workspaceId,
              name: member.name,
              email: member.email,
              role: member.role,
            })),
          }),
        ]
      : []),
  ]);
  return getWorkspaceSettings(workspaceId);
}

async function ensureWorkspaceSettingsRecord(workspaceId = "default"): Promise<void> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return;

  await prisma.workspaceSettings.upsert({
    where: { workspaceId },
    update: {},
    create: {
      id: workspaceId,
      workspaceId,
      teamName: workspace.name,
      ignoredPaths: ["/admin", "/checkout", "/account"] as never,
    },
  });
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
  warnings: unknown;
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

function toBacklogItem(item: {
  id: string;
  scanId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  owner: string;
  notes: string;
  route: string;
  createdAt: Date;
  updatedAt: Date;
}): BacklogItem {
  return {
    id: item.id,
    scanId: item.scanId,
    sourceType: item.sourceType as BacklogItem["sourceType"],
    sourceId: item.sourceId,
    title: item.title,
    category: item.category as BacklogItem["category"],
    priority: item.priority as BacklogItem["priority"],
    status: item.status as BacklogStatus,
    owner: item.owner,
    notes: item.notes,
    route: item.route,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toPageScreenshot(item: {
  id: string;
  scanId: string;
  pageUrl: string;
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: Date;
}): PageScreenshot {
  return {
    id: item.id,
    scanId: item.scanId,
    pageUrl: item.pageUrl,
    dataUrl: item.dataUrl,
    width: item.width,
    height: item.height,
    capturedAt: item.capturedAt.toISOString(),
  };
}

function toWorkspaceSettings(
  settings: SettingsRecord,
  pageGroups: PageGroupRecord[],
  schedules: ScanScheduleRecord[],
  teamMembers: TeamMemberRecord[],
): WorkspaceSettings {
  return {
    id: settings.id,
    teamName: settings.teamName,
    defaultPageLimit: settings.defaultPageLimit,
    crawlerMode: settings.crawlerMode as WorkspaceSettings["crawlerMode"],
    namingPreset: settings.namingPreset as WorkspaceSettings["namingPreset"],
    reviewThreshold: settings.reviewThreshold as WorkspaceSettings["reviewThreshold"],
    ignoredPaths: stringArray(settings.ignoredPaths),
    teamNotes: settings.teamNotes,
    screenshotEvidence: settings.screenshotEvidence,
    reportFormatDefault: settings.reportFormatDefault as WorkspaceSettings["reportFormatDefault"],
    updatedAt: settings.updatedAt.toISOString(),
    pageGroups: pageGroups.map(toPageGroup),
    schedules: schedules.map(toScanSchedule),
    teamMembers: teamMembers.map(toTeamMember),
  };
}

function toPageGroup(group: PageGroupRecord): PageGroup {
  return {
    id: group.id,
    name: group.name,
    matchers: stringArray(group.matchers),
    color: group.color,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

function toScanSchedule(schedule: ScanScheduleRecord): ScheduledScan {
  return {
    id: schedule.id,
    rootUrl: schedule.rootUrl,
    cadence: schedule.cadence as ScheduledScan["cadence"],
    maxPages: schedule.maxPages,
    enabled: schedule.enabled,
    nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

function toTeamMember(member: TeamMemberRecord): TeamMember {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role as TeamMember["role"],
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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
