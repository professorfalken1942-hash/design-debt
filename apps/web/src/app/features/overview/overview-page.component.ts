import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
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
          <p class="eyebrow">DesignDebt + TokenForge</p>
          <h1 class="headline">Turn messy UI evidence into clear design decisions.</h1>
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
              <input class="input" name="url" [(ngModel)]="url" placeholder="https://example.com" />
            </label>
            <label class="field pages-field">
              <span>Pages</span>
              <input class="input" name="maxPages" type="number" min="1" max="50" [(ngModel)]="maxPages" />
            </label>
            <button class="button primary" type="submit" [disabled]="api.loading()">Start scan</button>
          </form>

          <div class="scan-actions">
            <button class="button secondary" type="button" (click)="loadDemo()">View demo scan</button>
            @if (api.error()) {
              <p class="form-error">{{ api.error() }}</p>
            }
          </div>
        </aside>
      </section>

      @if (api.activeScan()) {
        <section class="section status-card">
          <div class="status-main">
            <div>
              <p class="eyebrow">Current scan</p>
              <h2 style="margin:.2rem 0 0;">{{ api.activeScan()?.rootUrl }}</h2>
            </div>
            <span class="badge">{{ api.activeScan()?.status }}</span>
          </div>
          <div class="progress" style="margin-top:1rem;">
            <span [style.width.%]="api.activeScan()?.progress ?? 0"></span>
          </div>
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

        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Highest-impact findings</p>
              <h2 style="margin:0;">Suggestions to review first</h2>
            </div>
            <a class="button secondary" routerLink="/design-debt">Open Design Debt</a>
          </div>
          <div class="finding-preview-grid">
            @for (finding of results.findings.slice(0, 4); track finding.id) {
              <a class="finding-preview" [routerLink]="['/design-debt', finding.targetView]">
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
  url = "https://example.com";
  maxPages = 20;

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
        copy: "Copy CSS or JSON once the token set looks intentional.",
        active: hasResults && this.api.tokens().every((token) => token.status !== "needs-review"),
      },
    ];
  }

  async loadDemo() {
    await this.api.loadDemo();
  }

  async startScan() {
    await this.api.startScan(this.url, Number(this.maxPages));
  }
}
