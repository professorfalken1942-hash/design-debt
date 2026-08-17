import { Component, OnDestroy, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import type { Finding, ScanSummary, TokenProposal } from "@designdebt/shared";
import { ApiService } from "../../core/api.service";

@Component({
  selector: "dd-scan-detail-page",
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page">
      <div class="topbar">
        <div>
          <a routerLink="/scans" style="color:var(--muted); text-decoration:none;">Back to scans</a>
          <p class="eyebrow">Scan Detail</p>
          <h1 style="font-size:clamp(1.8rem,4vw,3rem); letter-spacing:-.04em; margin:.2rem 0;">
            {{ scan()?.rootUrl ?? "Loading scan" }}
          </h1>
        </div>
        <div style="display:flex; gap:.75rem; flex-wrap:wrap;">
          <button class="button secondary" type="button" (click)="refresh()">Refresh</button>
          @if (scan(); as active) {
            <button class="button secondary" type="button" (click)="retry(active.id)">
              {{ active.status === "completed" ? "Run again" : "Retry" }}
            </button>
            @if (active.id !== "demo") {
              <button class="button danger" type="button" (click)="deleteScan(active)">Delete</button>
            }
          }
        </div>
      </div>

      @if (error()) {
        <section class="section panel" style="padding:1.2rem;">
          <div class="empty-state danger">
            <strong>Unable to load this scan</strong>
            <span>{{ error() }}</span>
          </div>
        </section>
      } @else if (scan(); as active) {
        <section class="section panel" style="padding:1rem;">
          <div class="detail-header">
            <div>
              <span class="badge" [class]="active.status">{{ active.status }}</span>
              <h2 style="margin:.8rem 0 .35rem;">{{ statusTitle(active) }}</h2>
              <p style="color:var(--muted); margin:0;">{{ statusCopy(active) }}</p>
            </div>
            <div class="score-ring">
              <span>{{ active.healthScore ?? "--" }}</span>
              <small>
                score
                <span class="info-tooltip" tabindex="0" aria-label="How Design Health Score is calculated">
                  i
                  <span class="tooltip-panel" role="tooltip">
                    Starts at 100, then subtracts weighted penalties for drift: excess colors, typography styles, spacing values, button patterns, form patterns, and flagged findings. It is a consistency signal, not a quality verdict.
                  </span>
                </span>
              </small>
            </div>
          </div>
          <div class="progress" style="margin-top:1.1rem;">
            <span [style.width.%]="active.progress"></span>
          </div>
          <div class="scan-facts">
            <div><span>Progress</span><strong>{{ active.progress }}%</strong></div>
            <div><span>Pages</span><strong>{{ active.pageCount }}</strong></div>
            <div><span>Created</span><strong>{{ formatDate(active.createdAt) }}</strong></div>
            <div><span>Completed</span><strong>{{ active.completedAt ? formatDate(active.completedAt) : "-" }}</strong></div>
          </div>
        </section>

        @if (active.status === "failed") {
          <section class="section panel" style="padding:1rem;">
            <p class="eyebrow">Failure</p>
            <p style="color:var(--danger); margin:0;">{{ active.error ?? "The scanner could not complete this site." }}</p>
          </section>
        }

        @if (active.warnings?.length) {
          <section class="section panel" style="padding:1rem;">
            <div class="section-title">
              <div>
                <p class="eyebrow">Scan Warnings</p>
                <h2 style="margin:0;">Partial crawl notes</h2>
              </div>
              <span class="badge danger">{{ active.warnings.length }} warnings</span>
            </div>
            <div class="warning-list">
              @for (warning of active.warnings; track warning) {
                <div class="warning-row">{{ readableWarning(warning) }}</div>
              }
            </div>
          </section>
        }

        @if (active.status !== "completed") {
          <section class="section panel" style="padding:1.2rem;">
            <div class="empty-state">
              <strong>Results are not ready yet</strong>
              <span>This page refreshes while the scan is queued or running. Completed scans unlock findings and token review.</span>
            </div>
          </section>
        } @else {
          <section class="section metrics-grid">
            @for (metric of metricCards(); track metric.label) {
              <article class="metric">
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
              </article>
            }
          </section>

          <section class="section action-strip">
            <a class="button primary" routerLink="/design-debt">Inspect DesignDebt</a>
            <a class="button secondary" routerLink="/token-forge">Review TokenForge</a>
          </section>

          <section class="section detail-grid">
            <article class="panel" style="padding:1rem;">
              <div class="section-title">
                <div>
                  <p class="eyebrow">Findings</p>
                  <h2 style="margin:0;">Highest-impact drift</h2>
                </div>
                <span class="badge">{{ findings().length }} items</span>
              </div>
              <div class="finding-list">
                @for (finding of findings().slice(0, 6); track finding.id) {
                  <a class="finding-row" [routerLink]="['/design-debt', finding.targetView]">
                    <span>{{ finding.category }}</span>
                    <strong>{{ finding.title }}</strong>
                    <small>{{ finding.description }}</small>
                  </a>
                }
              </div>
            </article>

            <article class="panel" style="padding:1rem;">
              <div class="section-title">
                <div>
                  <p class="eyebrow">TokenForge</p>
                  <h2 style="margin:0;">Review queue</h2>
                </div>
                <span class="badge">{{ reviewTokens().length }} review</span>
              </div>
              <div class="token-stack">
                @for (token of previewTokens(); track token.id) {
                  <div class="token-row">
                    <div>
                      <strong>{{ token.name }}</strong>
                      <span>{{ token.value }}</span>
                    </div>
                    <small>{{ token.status }}</small>
                  </div>
                }
              </div>
            </article>
          </section>
        }
      } @else {
        <section class="section panel" style="padding:1.2rem;">
          <div class="empty-state">
            <strong>Loading scan</strong>
            <span>Fetching scan status and result data.</span>
          </div>
        </section>
      }
    </section>
  `,
})
export class ScanDetailPageComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private pollHandle: number | null = null;
  readonly scan = this.api.activeScan;
  readonly error = signal<string | null>(null);
  readonly findings = computed<Finding[]>(() => this.api.results()?.findings ?? []);
  readonly reviewTokens = computed<TokenProposal[]>(() =>
    this.api.tokens().filter((token) => token.status === "needs-review"),
  );
  readonly previewTokens = computed<TokenProposal[]>(() =>
    [...this.reviewTokens(), ...this.api.tokens().filter((token) => token.status === "enabled")].slice(0, 6),
  );
  readonly metricCards = computed(() => {
    const metrics = this.api.results()?.metrics;
    if (!metrics) return [];
    return [
      { label: "Unique colors", value: metrics.uniqueColors },
      { label: "Spacing values", value: metrics.spacingValues },
      { label: "Button patterns", value: metrics.buttonPatterns },
      { label: "Typography styles", value: metrics.typographyStyles },
      { label: "Potential inconsistencies", value: metrics.potentialInconsistencies },
    ];
  });

  constructor() {
    void this.refresh();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async refresh(): Promise<void> {
    this.error.set(null);
    try {
      await this.api.loadScan(this.route.snapshot.paramMap.get("id") ?? "demo");
      this.syncPolling();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "The API could not load this scan.");
    }
  }

  async retry(id: string): Promise<void> {
    await this.api.retryScan(id);
    this.syncPolling();
  }

  async deleteScan(scan: ScanSummary): Promise<void> {
    const confirmed = window.confirm(`Delete scan for ${scan.rootUrl}? This cannot be undone.`);
    if (!confirmed) return;

    this.stopPolling();
    this.error.set(null);
    try {
      await this.api.deleteScan(scan.id);
      await this.router.navigate(["/scans"]);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "The scan could not be deleted.");
    }
  }

  statusTitle(scan: ScanSummary): string {
    if (scan.status === "completed") return "Results are ready";
    if (scan.status === "failed") return "Scan failed";
    if (scan.status === "running") return "Scanning rendered pages";
    return "Queued for scanning";
  }

  statusCopy(scan: ScanSummary): string {
    if (scan.status === "completed") return "Findings and token proposals are available for review.";
    if (scan.status === "failed") return scan.error ?? "The scanner hit an unrecoverable issue.";
    if (scan.status === "running") return "The crawler is collecting visible styles and same-origin pages.";
    return "The scan has been accepted and will begin shortly.";
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  readableWarning(warning: string): string {
    return warning.replace(/^https?:\/\/[^:]+:\d*:?\s*/, "").replace(/^https?:\/\/[^:]+:\s*/, "");
  }

  private syncPolling(): void {
    const status = this.scan()?.status;
    if (status === "queued" || status === "running") {
      if (this.pollHandle !== null) return;
      this.pollHandle = window.setInterval(() => void this.refresh(), 1800);
      return;
    }
    this.stopPolling();
  }

  private stopPolling(): void {
    if (this.pollHandle === null) return;
    window.clearInterval(this.pollHandle);
    this.pollHandle = null;
  }
}
