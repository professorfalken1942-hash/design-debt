import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import type { FindingChange, MetricDelta, ScanComparison, ScanSummary } from "@designdebt/shared";
import { ApiService } from "../../core/api.service";
import { DeleteScanDialogComponent } from "./delete-scan-dialog.component";

@Component({
  selector: "dd-scans-page",
  standalone: true,
  imports: [FormsModule, RouterLink, DeleteScanDialogComponent],
  template: `
    <section class="page">
      <div class="topbar">
        <div>
          <p class="eyebrow">Scans</p>
          <h1 style="font-size:clamp(2rem,5vw,3.4rem); letter-spacing:0; margin:.2rem 0;">Recent scan activity</h1>
          <p class="lede">Track submitted sites, inspect scan progress, and open completed UIpen audit and token results.</p>
        </div>
        <button class="button secondary" type="button" (click)="load()">Refresh</button>
      </div>

      @if (scans().length) {
        <section class="section metrics-grid">
          <article class="metric"><span>Total scans</span><strong>{{ scans().length }}</strong></article>
          <article class="metric"><span>Completed</span><strong>{{ statusCount("completed") }}</strong></article>
          <article class="metric"><span>Needs attention</span><strong>{{ attentionCount() }}</strong></article>
          <article class="metric"><span>Average score</span><strong>{{ averageScore() }}</strong></article>
        </section>
      }

      @if (completedScans().length >= 2) {
        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Compare scans</p>
              <h2 style="margin:0;">Track drift between two audits</h2>
            </div>
            <button class="button primary" type="button" (click)="loadComparison()" [disabled]="comparisonLoading()">
              {{ comparisonLoading() ? "Comparing..." : "Compare" }}
            </button>
          </div>

          <div class="compare-controls">
            <label class="field">
              <span>Baseline</span>
              <select class="select" name="baseScanId" [(ngModel)]="baseScanId">
                @for (scan of completedScans(); track scan.id) {
                  <option [value]="scan.id">{{ scan.rootUrl }} · {{ formatDate(scan.createdAt) }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Target</span>
              <select class="select" name="targetScanId" [(ngModel)]="targetScanId">
                @for (scan of completedScans(); track scan.id) {
                  <option [value]="scan.id">{{ scan.rootUrl }} · {{ formatDate(scan.createdAt) }}</option>
                }
              </select>
            </label>
          </div>

          @if (comparisonError()) {
            <p class="form-error" style="margin-top:.8rem;">{{ comparisonError() }}</p>
          }

          @if (comparison(); as compare) {
            <div class="comparison-summary">
              <article class="score-change" [class.good]="compare.scoreDelta > 0" [class.danger]="compare.scoreDelta < 0">
                <span>Design health movement</span>
                <strong>{{ signed(compare.scoreDelta) }}</strong>
                <p>{{ compare.summary }}</p>
              </article>
              <article class="comparison-copy">
                <span>{{ compare.baseScan.rootUrl }}</span>
                <strong>{{ compare.baseScan.healthScore ?? "-" }} → {{ compare.targetScan.healthScore ?? "-" }}</strong>
                <small>{{ formatDate(compare.baseScan.createdAt) }} to {{ formatDate(compare.targetScan.createdAt) }}</small>
              </article>
            </div>

            <div class="delta-grid">
              @for (metric of compare.metricDeltas; track metric.label) {
                <article class="delta-card" [class]="metric.direction">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.before }} → {{ metric.after }}</strong>
                  <small>{{ signed(metric.delta) }}</small>
                </article>
              }
            </div>

            <div class="comparison-columns">
              <article>
                <p class="eyebrow">New findings</p>
                @for (finding of compare.addedFindings; track finding.id) {
                  <div class="mini-finding">{{ findingTitle(finding) }}</div>
                } @empty {
                  <div class="mini-finding quiet">No new findings</div>
                }
              </article>
              <article>
                <p class="eyebrow">Resolved</p>
                @for (finding of compare.resolvedFindings; track finding.id) {
                  <div class="mini-finding good">{{ findingTitle(finding) }}</div>
                } @empty {
                  <div class="mini-finding quiet">Nothing resolved yet</div>
                }
              </article>
              <article>
                <p class="eyebrow">Still present</p>
                @for (finding of compare.persistentFindings; track finding.id) {
                  <div class="mini-finding">{{ findingTitle(finding) }}</div>
                } @empty {
                  <div class="mini-finding quiet">No persistent findings</div>
                }
              </article>
            </div>
          }
        </section>
      }

      <section class="section panel" style="padding:1rem;">
        @if (loading()) {
          <div class="empty-state">
            <strong>Loading scans</strong>
            <span>Fetching the latest persisted records.</span>
          </div>
        } @else if (error()) {
          <div class="empty-state danger">
            <strong>Unable to load scans</strong>
            <span>{{ error() }}</span>
          </div>
        } @else if (!scans().length) {
          <div class="empty-state">
            <strong>No scans yet</strong>
            <span>Start a scan from Overview or load the demo record.</span>
            <button class="button primary" type="button" (click)="loadDemo()">Load demo scan</button>
          </div>
        } @else {
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>URL</th><th>Status</th><th>Progress</th><th>Pages</th><th>Warnings</th><th>Score</th><th></th></tr></thead>
              <tbody>
                @for (scan of scans(); track scan.id) {
                  <tr>
                    <td data-label="URL">
                      <strong>{{ scan.rootUrl }}</strong>
                      <div style="color:var(--muted); margin-top:.25rem;">{{ formatDate(scan.createdAt) }}</div>
                    </td>
                    <td data-label="Status"><span class="badge" [class]="scan.status">{{ scan.status }}</span></td>
                    <td data-label="Progress" style="min-width:9rem;">
                      <div class="progress"><span [style.width.%]="scan.progress"></span></div>
                      <div style="color:var(--muted); margin-top:.35rem;">{{ scan.progress }}%</div>
                    </td>
                    <td data-label="Pages">{{ scan.pageCount }}</td>
                    <td data-label="Warnings">{{ scan.warnings?.length ?? 0 }}</td>
                    <td data-label="Score">{{ scan.healthScore ?? '-' }}</td>
                    <td data-label="Action">
                      <div class="row-actions">
                        <a class="button secondary" [routerLink]="['/scans', scan.id]">Open</a>
                        @if (scan.id !== "demo") {
                          <button
                            class="button quiet-danger"
                            type="button"
                            (click)="requestDelete(scan)"
                            [disabled]="deletingId() === scan.id"
                          >
                            {{ deletingId() === scan.id ? "Removing..." : "Remove" }}
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <dd-delete-scan-dialog
        [scan]="scanPendingDelete()"
        [deleting]="deletingId() !== null"
        [error]="deleteError()"
        (cancel)="cancelDelete()"
        (confirm)="deleteScan()"
      />
    </section>
  `,
})
export class ScansPageComponent {
  readonly api = inject(ApiService);
  readonly scans = signal<ScanSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly scanPendingDelete = signal<ScanSummary | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly comparison = signal<ScanComparison | null>(null);
  readonly comparisonLoading = signal(false);
  readonly comparisonError = signal<string | null>(null);
  baseScanId = "";
  targetScanId = "";

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.scans.set(await this.api.listScans());
      this.ensureComparisonDefaults();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "The API did not return scan activity.");
    } finally {
      this.loading.set(false);
    }
  }

  async loadDemo() {
    await this.api.loadDemo();
    await this.load();
  }

  statusCount(status: ScanSummary["status"]): number {
    return this.scans().filter((scan) => scan.status === status).length;
  }

  attentionCount(): number {
    return this.scans().filter((scan) => scan.status === "failed" || (scan.warnings?.length ?? 0) > 0).length;
  }

  averageScore(): string {
    const scores = this.scans()
      .map((scan) => scan.healthScore)
      .filter((score): score is number => typeof score === "number");
    if (!scores.length) return "-";
    return String(Math.round(scores.reduce((total, score) => total + score, 0) / scores.length));
  }

  requestDelete(scan: ScanSummary): void {
    this.deleteError.set(null);
    this.scanPendingDelete.set(scan);
  }

  cancelDelete(): void {
    if (this.deletingId()) return;
    this.scanPendingDelete.set(null);
    this.deleteError.set(null);
  }

  async deleteScan(): Promise<void> {
    const scan = this.scanPendingDelete();
    if (!scan) return;

    this.deletingId.set(scan.id);
    this.deleteError.set(null);
    try {
      await this.api.deleteScan(scan.id);
      this.scans.set(this.scans().filter((item) => item.id !== scan.id));
      this.scanPendingDelete.set(null);
    } catch (error) {
      this.deleteError.set(error instanceof Error ? error.message : "The scan could not be deleted.");
    } finally {
      this.deletingId.set(null);
    }
  }

  completedScans(): ScanSummary[] {
    return this.scans().filter((scan) => scan.status === "completed");
  }

  async loadComparison(): Promise<void> {
    this.comparisonLoading.set(true);
    this.comparisonError.set(null);
    try {
      this.comparison.set(await this.api.compareScans(this.baseScanId, this.targetScanId));
    } catch (error) {
      this.comparison.set(null);
      this.comparisonError.set(error instanceof Error ? error.message : "The scans could not be compared.");
    } finally {
      this.comparisonLoading.set(false);
    }
  }

  signed(value: number): string {
    if (value > 0) return `+${value}`;
    return String(value);
  }

  findingTitle(finding: FindingChange): string {
    return `${finding.title} (${finding.count})`;
  }

  private ensureComparisonDefaults(): void {
    const completed = this.completedScans();
    if (completed.length < 2) return;
    this.targetScanId ||= completed[0].id;
    this.baseScanId ||= completed[1]?.id ?? completed[0].id;
    if (this.targetScanId === this.baseScanId) {
      this.baseScanId = completed.find((scan) => scan.id !== this.targetScanId)?.id ?? this.baseScanId;
    }
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }
}
