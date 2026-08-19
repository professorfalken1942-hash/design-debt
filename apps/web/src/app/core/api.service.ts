import { HttpClient } from "@angular/common/http";
import { Injectable, computed, inject, signal } from "@angular/core";
import type {
  BacklogItem,
  DesignDebtResults,
  PageGroup,
  PageScreenshot,
  ScanComparison,
  ScanSummary,
  ScheduledScan,
  TeamMember,
  TokenProposal,
  WorkspaceSettings,
} from "@designdebt/shared";

const API_BASE = "/api";

@Injectable({ providedIn: "root" })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly activeScan = signal<ScanSummary | null>(null);
  readonly results = signal<DesignDebtResults | null>(null);
  readonly tokens = signal<TokenProposal[]>([]);
  readonly backlog = signal<BacklogItem[]>([]);
  readonly screenshots = signal<PageScreenshot[]>([]);
  readonly settings = signal<WorkspaceSettings | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingScanUrl = signal<string | null>(null);
  readonly scanInProgress = computed(() => {
    const status = this.activeScan()?.status;
    return status === "queued" || status === "running";
  });
  readonly scoreLabel = computed(() => {
    const score = this.results()?.healthScore ?? 0;
    if (score >= 80) return "Healthy";
    if (score >= 60) return "Needs review";
    return "High drift";
  });

  async loadDemo(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.loadScan("demo");
    } finally {
      this.loading.set(false);
    }
  }

  async startScan(rootUrl: string, maxPages: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.pendingScanUrl.set(rootUrl);
    try {
      const scan = await firstValue<ScanSummary>(
        this.http.post<ScanSummary>(`${API_BASE}/scans`, { rootUrl, maxPages }),
      );
      this.activeScan.set(scan);
      if (scan.status === "failed" && scan.error) {
        this.error.set(scan.error);
      }
      this.pollScan(scan.id);
    } catch (error) {
      this.error.set(apiErrorMessage(error, "Unable to start scan."));
    } finally {
      this.pendingScanUrl.set(null);
      this.loading.set(false);
    }
  }

  async listScans(): Promise<ScanSummary[]> {
    const response = await firstValue<{ scans: ScanSummary[] }>(
      this.http.get<{ scans: ScanSummary[] }>(`${API_BASE}/scans`),
    );
    return response.scans;
  }

  async compareScans(baseId: string, targetId: string): Promise<ScanComparison> {
    return firstValue<ScanComparison>(
      this.http.get<ScanComparison>(`${API_BASE}/scans/compare`, {
        params: { baseId, targetId },
      }),
    );
  }

  async loadScan(id: string): Promise<void> {
    this.error.set(null);
    const scan = await firstValue<ScanSummary>(this.http.get<ScanSummary>(`${API_BASE}/scans/${id}`));
    this.activeScan.set(scan);
    if (scan.status === "completed") {
      const [results, tokenResponse, screenshotResponse] = await Promise.all([
        firstValue<DesignDebtResults>(this.http.get<DesignDebtResults>(`${API_BASE}/scans/${id}/results`)),
        firstValue<{ tokens: TokenProposal[] }>(this.http.get<{ tokens: TokenProposal[] }>(`${API_BASE}/scans/${id}/tokens`)),
        firstValue<{ screenshots: PageScreenshot[] }>(this.http.get<{ screenshots: PageScreenshot[] }>(`${API_BASE}/scans/${id}/screenshots`)),
      ]);
      this.results.set(results);
      this.tokens.set(tokenResponse.tokens);
      this.screenshots.set(screenshotResponse.screenshots);
      const backlogResponse = await firstValue<{ backlog: BacklogItem[] }>(
        this.http.get<{ backlog: BacklogItem[] }>(`${API_BASE}/scans/${id}/backlog`),
      );
      this.backlog.set(backlogResponse.backlog);
    } else {
      this.results.set(null);
      this.tokens.set([]);
      this.backlog.set([]);
      this.screenshots.set([]);
    }
  }

  async loadSettings(): Promise<WorkspaceSettings> {
    const settings = await firstValue<WorkspaceSettings>(this.http.get<WorkspaceSettings>(`${API_BASE}/settings`));
    this.settings.set(settings);
    return settings;
  }

  async saveSettings(
    patch: Partial<Pick<WorkspaceSettings, "teamName" | "defaultPageLimit" | "crawlerMode" | "namingPreset" | "reviewThreshold" | "ignoredPaths" | "teamNotes" | "screenshotEvidence" | "reportFormatDefault">>,
  ): Promise<WorkspaceSettings> {
    const settings = await firstValue<WorkspaceSettings>(this.http.put<WorkspaceSettings>(`${API_BASE}/settings`, patch));
    this.settings.set(settings);
    return settings;
  }

  async savePageGroups(pageGroups: PageGroup[]): Promise<WorkspaceSettings> {
    const settings = await firstValue<WorkspaceSettings>(
      this.http.put<WorkspaceSettings>(`${API_BASE}/settings/page-groups`, { pageGroups }),
    );
    this.settings.set(settings);
    return settings;
  }

  async saveSchedules(schedules: ScheduledScan[]): Promise<WorkspaceSettings> {
    const settings = await firstValue<WorkspaceSettings>(
      this.http.put<WorkspaceSettings>(`${API_BASE}/settings/schedules`, { schedules }),
    );
    this.settings.set(settings);
    return settings;
  }

  async saveTeamMembers(teamMembers: TeamMember[]): Promise<WorkspaceSettings> {
    const settings = await firstValue<WorkspaceSettings>(
      this.http.put<WorkspaceSettings>(`${API_BASE}/settings/team-members`, { teamMembers }),
    );
    this.settings.set(settings);
    return settings;
  }

  async saveTokens(tokens: TokenProposal[]): Promise<void> {
    const scan = this.activeScan();
    if (!scan) return;
    const response = await firstValue<{ tokens: TokenProposal[] }>(
      this.http.put<{ tokens: TokenProposal[] }>(`${API_BASE}/scans/${scan.id}/tokens`, { tokens }),
    );
    this.tokens.set(response.tokens);
  }

  async retryScan(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.pendingScanUrl.set(this.activeScan()?.rootUrl ?? null);
    try {
      const scan = await firstValue<ScanSummary>(
        this.http.post<ScanSummary>(`${API_BASE}/scans/${id}/retry`, {}),
      );
      this.activeScan.set(scan);
      this.results.set(null);
      this.tokens.set([]);
      this.screenshots.set([]);
      this.pollScan(scan.id);
    } catch (error) {
      this.error.set(apiErrorMessage(error, "Unable to retry scan."));
    } finally {
      this.pendingScanUrl.set(null);
      this.loading.set(false);
    }
  }

  async deleteScan(id: string): Promise<void> {
    this.error.set(null);
    try {
      await firstValue<void>(this.http.delete<void>(`${API_BASE}/scans/${id}`));
      if (this.activeScan()?.id === id) {
        this.activeScan.set(null);
        this.results.set(null);
        this.tokens.set([]);
        this.backlog.set([]);
        this.screenshots.set([]);
      }
    } catch (error) {
      this.error.set(apiErrorMessage(error, "Unable to delete scan."));
      throw error;
    }
  }

  async copyExport(format: "css" | "json"): Promise<string> {
    const scan = this.activeScan();
    if (!scan) return "";
    const response = await fetch(`${API_BASE}/scans/${scan.id}/tokens/export?format=${format}`);
    return format === "css" ? response.text() : JSON.stringify(await response.json(), null, 2);
  }

  async reportExport(format: "markdown" | "html"): Promise<string> {
    const scan = this.activeScan();
    if (!scan) return "";
    const response = await fetch(`${API_BASE}/scans/${scan.id}/report?format=${format}`);
    return response.text();
  }

  async updateBacklogItem(
    item: BacklogItem,
    patch: Partial<Pick<BacklogItem, "status" | "owner" | "notes">>,
  ): Promise<void> {
    const response = await firstValue<{ item: BacklogItem }>(
      this.http.patch<{ item: BacklogItem }>(`${API_BASE}/scans/${item.scanId}/backlog/${item.id}`, patch),
    );
    this.backlog.update((items) => items.map((current) => current.id === response.item.id ? response.item : current));
  }

  private pollScan(id: string): void {
    const interval = window.setInterval(async () => {
      await this.loadScan(id);
      const status = this.activeScan()?.status;
      if (status === "completed" || status === "failed") {
        window.clearInterval(interval);
      }
    }, 1400);
  }
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const maybe = error as { error?: unknown; message?: unknown; status?: unknown };
    if (maybe.error && typeof maybe.error === "object" && "error" in maybe.error) {
      const message = (maybe.error as { error?: unknown }).error;
      if (typeof message === "string") return message;
    }
    if (typeof maybe.message === "string") return maybe.message;
    if (typeof maybe.status === "number") return `${fallback} (${maybe.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function firstValue<T>(source: { subscribe: (observer: { next: (value: T) => void; error: (error: unknown) => void }) => { unsubscribe: () => void } }): Promise<T> {
  return new Promise((resolve, reject) => {
    const subscription = source.subscribe({
      next: (value) => {
        resolve(value);
        subscription.unsubscribe();
      },
      error: (error) => reject(error),
    });
  });
}
