import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import type { BacklogItem, BacklogStatus, Finding, ScanComparison, ScanSummary, TokenProposal } from "@designdebt/shared";
import { ApiService } from "../../core/api.service";

@Component({
  selector: "dd-overview-page",
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page">
      <section class="hero-panel">
        <div class="hero-copy">
          <span class="badge">Live scanner</span>
          <p class="eyebrow">UIpen</p>
          <h1 class="headline">Find the friction.<br>Fix the experience.</h1>
          <p class="lede">
            Scan a site, see where visual decisions drift, and turn repeated colors,
            spacing, type, and component patterns into a reviewable token plan.
          </p>
        </div>

        <aside class="hero-card">
          <div class="hero-card-header">
            <div>
              <p class="eyebrow">Start a scan</p>
              <h2 style="margin:.2rem 0 0;">Audit a public site</h2>
            </div>
            <span class="badge">1-3 min</span>
          </div>

          <form (ngSubmit)="startScan()" class="scan-form">
            <label class="field url-field">
              <span>Website URL</span>
              <input class="input" name="url" [(ngModel)]="url" placeholder="https://example.com" [disabled]="api.loading()" />
            </label>
            <label class="field pages-field">
              <span>Pages</span>
              <input class="input" name="maxPages" type="number" min="1" max="50" [(ngModel)]="maxPages" [disabled]="api.loading()" />
            </label>
            <button class="button primary" type="submit" [disabled]="api.loading()">
              {{ api.loading() ? "Starting scan..." : "Start scan" }}
            </button>
          </form>

          <div class="scan-actions">
            <button class="button secondary" type="button" (click)="loadDemo()" [disabled]="api.loading()">View demo scan</button>
            @if (api.error()) {
              <p class="form-error">{{ api.error() }}</p>
            }
          </div>

          @if (api.pendingScanUrl()) {
            <div class="activity-panel" role="status" aria-live="polite">
              <span class="activity-dot" aria-hidden="true"></span>
              <div>
                <strong>Scan is running</strong>
                <p>UIpen is opening {{ api.pendingScanUrl() }}, waiting for rendered styles, and preparing the audit. This can take a minute on production scans.</p>
              </div>
            </div>
          }
        </aside>
      </section>

      @if (api.activeScan()) {
        <section class="section status-card" [class.running]="api.scanInProgress()">
          <div class="status-main">
            <div>
              <p class="eyebrow">{{ api.scanInProgress() ? "Scan running" : "Current scan" }}</p>
              <h2 style="margin:.2rem 0 0;">{{ api.activeScan()?.rootUrl }}</h2>
              @if (api.scanInProgress()) {
                <p style="color:var(--muted); margin:.45rem 0 0;">Collecting visible styles and same-origin pages. You can leave this view open; results will appear automatically.</p>
              }
            </div>
            <span class="badge" [class.running]="api.scanInProgress()">{{ api.activeScan()?.status }}</span>
          </div>
          <div class="progress" style="margin-top:1rem;">
            <span [style.width.%]="api.activeScan()?.progress ?? 0"></span>
          </div>
          @if (api.scanInProgress()) {
            <div class="progress-indeterminate" aria-hidden="true"><span></span></div>
          }
          <div class="status-meta">
            <span>{{ api.activeScan()?.progress ?? 0 }}% complete</span>
            <a routerLink="/scans">Open scan history</a>
          </div>
        </section>
      }

      <section class="section workflow-grid" aria-label="Audit workflow">
        @for (step of workflowSteps(); track step.title) {
          <article class="workflow-card" [class.active]="step.active">
            <span>{{ step.step }}</span>
            <strong>{{ step.title }}</strong>
            <p>{{ step.copy }}</p>
          </article>
        }
      </section>

      @if (api.results(); as results) {
        <section class="section action-dashboard">
          <article class="panel next-action-hero">
            <p class="eyebrow">Next best action</p>
            <h2>{{ primaryAction().title }}</h2>
            <p>{{ primaryAction().copy }}</p>
            <div class="dashboard-actions">
              <a class="button primary" [routerLink]="primaryAction().route">{{ primaryAction().cta }}</a>
              <button class="button secondary" type="button" (click)="downloadReport('html')">Download HTML</button>
              <button class="button secondary" type="button" (click)="downloadReport('markdown')">Download Markdown</button>
              <button class="button quiet" type="button" (click)="openPrintReport()">Print / PDF</button>
              <button class="button quiet" type="button" (click)="loadLatestComparison()" [disabled]="comparisonLoading()">
                {{ comparisonLoading() ? "Comparing..." : "Compare latest" }}
              </button>
            </div>
            @if (comparisonNote()) {
              <small class="muted-note">{{ comparisonNote() }}</small>
            }
          </article>
          <div class="next-action-list">
            @for (action of nextActions(); track action.title) {
              <a class="next-action-card" [routerLink]="action.route">
                <span>{{ action.meta }}</span>
                <strong>{{ action.title }}</strong>
                <small>{{ action.copy }}</small>
              </a>
            }
          </div>
        </section>

        @if (comparison(); as comparison) {
          <section class="section panel section-panel">
            <div class="section-title">
              <div>
                <p class="eyebrow">Before / after</p>
                <h2 style="margin:0;">{{ comparison.summary }}</h2>
                <p class="token-rationale" style="margin-top:.45rem;">
                  Compared {{ scanLabel(comparison.baseScan) }} against {{ scanLabel(comparison.targetScan) }}.
                </p>
              </div>
              <span class="badge" [class.enabled]="comparison.scoreDelta > 0" [class.danger]="comparison.scoreDelta < 0">
                {{ comparison.scoreDelta > 0 ? "+" : "" }}{{ comparison.scoreDelta }} score
              </span>
            </div>
            <div class="delta-grid">
              @for (delta of comparison.metricDeltas; track delta.label) {
                <article class="delta-card" [class.up]="delta.direction === 'up'" [class.down]="delta.direction === 'down'">
                  <span>{{ delta.label }}</span>
                  <strong>{{ delta.after }}</strong>
                  <small>{{ delta.delta > 0 ? "+" : "" }}{{ delta.delta }} from previous</small>
                </article>
              }
            </div>
          </section>
        }

        <section class="section insight-grid">
          <article class="metric score-card">
            <span class="metric-label">
              Design Health Score
              <span class="info-tooltip" tabindex="0" aria-label="How Design Health Score is calculated">
                i
                <span class="tooltip-panel" role="tooltip">
                  Starts at 100, then subtracts weighted penalties for design-system drift: too many colors beyond 16, typography styles beyond 8, spacing values beyond 12, button patterns beyond 4, form patterns beyond 3, and each flagged finding. Higher scores mean the interface is more consistent and easier to turn into reusable tokens.
                </span>
              </span>
            </span>
            <strong>{{ results.healthScore }} / 100</strong>
            <p style="color:var(--muted); line-height:1.5;">
              A quick read on how consistent the scanned interface feels across visual patterns.
            </p>
          </article>
          <article class="metric"><span>Unique colors</span><strong>{{ results.metrics.uniqueColors }}</strong></article>
          <article class="metric"><span>Spacing values</span><strong>{{ results.metrics.spacingValues }}</strong></article>
          <article class="metric"><span>Button patterns</span><strong>{{ results.metrics.buttonPatterns }}</strong></article>
          <article class="metric"><span>Potential inconsistencies</span><strong>{{ results.metrics.potentialInconsistencies }}</strong></article>
        </section>

        @if (api.screenshots().length) {
          <section class="section panel section-panel">
            <div class="section-title">
              <div>
                <p class="eyebrow">Screenshot evidence</p>
                <h2 style="margin:0;">Captured pages for stakeholder review</h2>
                <p class="token-rationale" style="margin-top:.45rem;">These images are stored with the scan and included in HTML reports.</p>
              </div>
              <span class="badge">{{ api.screenshots().length }} pages</span>
            </div>
            <div class="screenshot-strip">
              @for (screenshot of api.screenshots().slice(0, 4); track screenshot.id) {
                <figure>
                  <img [src]="screenshot.dataUrl" [alt]="'Screenshot of ' + screenshot.pageUrl" />
                  <figcaption>{{ screenshot.pageUrl }}</figcaption>
                </figure>
              }
            </div>
          </section>
        }

        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Design-system backlog</p>
              <h2 style="margin:0;">Persistent cleanup work</h2>
              <p class="token-rationale" style="margin-top:.45rem;">Accept, ignore, or mark work fixed. Owner and notes are saved to the scan.</p>
            </div>
            <span class="badge">{{ backlogItems().length }} items</span>
          </div>
          <div class="backlog-list">
            @for (item of backlogItems(); track item.id) {
              <article class="backlog-row" [class.fixed]="item.status === 'fixed'" [class.ignored]="item.status === 'ignored'">
                <span class="badge" [class.danger]="item.priority === 'High'">{{ item.priority }}</span>
                <div>
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.notes || fallbackBacklogNote(item) }}</p>
                  <div class="backlog-controls">
                    <label class="field compact-field">
                      <span>Status</span>
                      <select class="select" [ngModel]="item.status" (ngModelChange)="updateBacklog(item, { status: $event })">
                        @for (status of backlogStatuses; track status) {
                          <option [value]="status">{{ statusLabel(status) }}</option>
                        }
                      </select>
                    </label>
                    <label class="field compact-field">
                      <span>Owner</span>
                      <input class="input" [ngModel]="item.owner" (change)="updateBacklog(item, { owner: textValue($event) })" />
                    </label>
                    <label class="field notes-field">
                      <span>Notes</span>
                      <textarea class="input" rows="2" [ngModel]="item.notes" (change)="updateBacklog(item, { notes: textValue($event) })"></textarea>
                    </label>
                  </div>
                </div>
                <a class="button secondary" [routerLink]="item.route">Open source</a>
              </article>
            }
          </div>
        </section>

        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Highest-impact findings</p>
              <h2 style="margin:0;">Suggestions to review first</h2>
            </div>
            <a class="button secondary" routerLink="/audit">Open Audit</a>
          </div>
          <div class="finding-preview-grid">
            @for (finding of results.findings.slice(0, 4); track finding.id) {
              <a class="finding-preview" [routerLink]="['/audit', finding.targetView]">
                <span>{{ finding.category }} · {{ finding.count }} uses</span>
                <strong>{{ finding.title }}</strong>
                <small>{{ finding.description }}</small>
              </a>
            }
          </div>
        </section>
      }
    </section>
  `,
})
export class OverviewPageComponent {
  readonly api = inject(ApiService);
  readonly loading = signal(false);
  readonly comparison = signal<ScanComparison | null>(null);
  readonly comparisonLoading = signal(false);
  readonly comparisonNote = signal("");
  readonly backlogStatuses: BacklogStatus[] = ["open", "accepted", "ignored", "fixed"];
  url = "https://example.com";
  maxPages = 20;

  constructor() {
    void this.api.loadSettings().then((settings) => {
      this.maxPages = settings.defaultPageLimit;
    }).catch(() => undefined);
  }

  workflowSteps() {
    const scan = this.api.activeScan();
    const hasResults = Boolean(this.api.results());
    return [
      {
        step: "01",
        title: "Scan",
        copy: "Collect visible UI decisions from rendered pages.",
        active: !scan || scan.status === "queued" || scan.status === "running",
      },
      {
        step: "02",
        title: "Review",
        copy: "Prioritize drift by impact, frequency, and category.",
        active: hasResults,
      },
      {
        step: "03",
        title: "Tokenize",
        copy: "Approve primitives and semantic roles before export.",
        active: hasResults && this.api.tokens().some((token) => token.status === "needs-review"),
      },
      {
        step: "04",
        title: "Export",
        copy: "Download CSS or JSON once the token set looks intentional.",
        active: hasResults && this.api.tokens().every((token) => token.status !== "needs-review"),
      },
    ];
  }

  primaryAction() {
    const reviewTokens = this.reviewTokens();
    const topFinding = this.topFinding();
    if (reviewTokens.length) {
      return {
        title: `Resolve ${reviewTokens.length} token decisions`,
        copy: "Review the proposed reusable values, include the ones that belong in the system, and export a token file developers or designers can use.",
        cta: "Review tokens",
        route: "/tokens",
      };
    }
    if (topFinding) {
      return {
        title: topFinding.title,
        copy: `${topFinding.count} detected examples need a design-system decision before this drift becomes harder to clean up.`,
        cta: "Inspect finding",
        route: `/audit/${topFinding.targetView}`,
      };
    }
    return {
      title: "Export the current token package",
      copy: "The scan has no urgent review queue. Download the included CSS or JSON token file and move it into your team workflow.",
      cta: "Open exports",
      route: "/tokens",
    };
  }

  nextActions() {
    const results = this.api.results();
    const reviewTokens = this.reviewTokens();
    const enabledTokens = this.api.tokens().filter((token) => token.status === "enabled");
    const topFinding = this.topFinding();
    return [
      {
        title: reviewTokens.length ? "Decide token exports" : "Download token files",
        copy: reviewTokens.length
          ? "Include reusable values, keep uncertain roles in review, and exclude one-off values."
          : `${enabledTokens.length} approved tokens are ready for CSS or JSON handoff.`,
        meta: `${reviewTokens.length} pending`,
        route: "/tokens",
      },
      {
        title: topFinding ? `Fix ${this.label(topFinding.category)} drift` : "Review visual inventory",
        copy: topFinding?.description ?? "Inspect categories to see which UI values are repeated, rare, or inconsistent.",
        meta: `${results?.findings.length ?? 0} findings`,
        route: topFinding ? `/audit/${topFinding.targetView}` : "/audit",
      },
      {
        title: "Compare scan history",
        copy: "Use previous scans to show regressions, improvements, and whether cleanup work is reducing drift.",
        meta: "MRR habit",
        route: "/scans",
      },
    ];
  }

  backlogItems() {
    return this.api.backlog();
  }

  async updateBacklog(
    item: BacklogItem,
    patch: Partial<Pick<BacklogItem, "status" | "owner" | "notes">>,
  ): Promise<void> {
    await this.api.updateBacklogItem(item, patch);
  }

  statusLabel(status: BacklogStatus): string {
    if (status === "accepted") return "Accepted";
    if (status === "ignored") return "Ignored";
    if (status === "fixed") return "Fixed";
    return "Open";
  }

  fallbackBacklogNote(item: BacklogItem): string {
    if (item.category === "tokens") return "Resolve token proposals before exporting a handoff package.";
    if (item.category === "colors") return "Choose canonical roles for repeated or near-duplicate colors.";
    if (item.category === "spacing") return "Map rare values to the spacing scale or document why the exception should remain.";
    if (item.category === "buttons") return "Reduce variants into named component patterns.";
    return "Review the source signal and decide whether it should become design-system work.";
  }

  textValue(event: Event): string {
    return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
      ? event.target.value
      : "";
  }

  async loadLatestComparison(): Promise<void> {
    const active = this.api.activeScan();
    if (!active || active.status !== "completed") {
      this.comparisonNote.set("Complete a scan before comparing results.");
      return;
    }

    this.comparisonLoading.set(true);
    this.comparisonNote.set("");
    try {
      const scans = await this.api.listScans();
      const previous = this.previousCompletedScan(scans, active);
      if (!previous) {
        this.comparison.set(null);
        this.comparisonNote.set("Run another completed scan to compare before and after.");
        return;
      }
      this.comparison.set(await this.api.compareScans(previous.id, active.id));
    } finally {
      this.comparisonLoading.set(false);
    }
  }

  async downloadReport(format: "markdown" | "html"): Promise<void> {
    const report = await this.api.reportExport(format);
    const blob = new Blob([report], {
      type: format === "html" ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uipen-${this.reportSlug()}-report.${format === "html" ? "html" : "md"}`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async openPrintReport(): Promise<void> {
    const report = await this.api.reportExport("html");
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.write(report);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 300);
  }

  scanLabel(scan: ScanSummary): string {
    return new Intl.DateTimeFormat(void 0, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(scan.completedAt ?? scan.createdAt),
    );
  }

  private reviewTokens(): TokenProposal[] {
    return this.api.tokens().filter((token) => token.status === "needs-review");
  }

  private topFinding(): Finding | undefined {
    const findings = this.api.results()?.findings ?? [];
    return [...findings].sort((a, b) => this.priorityScore(b) - this.priorityScore(a))[0];
  }

  private priorityScore(finding: Finding): number {
    const severity = finding.severity === "warning" ? 100 : finding.severity === "suggestion" ? 50 : 10;
    return severity + finding.count;
  }

  private label(value: string): string {
    return value.replace("-", " ").replace(/^\w/, (letter) => letter.toUpperCase());
  }

  private previousCompletedScan(scans: ScanSummary[], active: ScanSummary): ScanSummary | undefined {
    const completed = scans
      .filter((scan) => scan.status === "completed" && scan.id !== active.id)
      .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime());
    return completed.find((scan) => scan.rootUrl === active.rootUrl) ?? completed[0];
  }

  private reportSlug(): string {
    const source = this.api.activeScan()?.rootUrl ?? "scan";
    try {
      return new URL(source).hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "scan";
    } catch {
      return source.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "scan";
    }
  }

  async loadDemo() {
    await this.api.loadDemo();
  }

  async startScan() {
    await this.api.startScan(this.url, Number(this.maxPages));
  }
}
