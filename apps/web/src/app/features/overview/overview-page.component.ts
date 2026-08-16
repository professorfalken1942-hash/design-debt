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
      <div class="topbar">
        <span class="badge">MVP demo ready</span>
      </div>

      <div class="panel" style="padding: clamp(1.2rem, 4vw, 2.5rem);">
        <p class="eyebrow">DesignDebt + TokenForge</p>
        <h1 class="headline">Understand your interface.</h1>
        <p class="lede">
          Scan a website to uncover visual inconsistencies, design-system drift,
          and opportunities for token consolidation.
        </p>

        <form (ngSubmit)="startScan()" class="scan-form">
          <label class="field url-field">
            <span class="eyebrow" style="margin-bottom: .4rem;">Website URL</span>
            <input class="input" name="url" [(ngModel)]="url" placeholder="https://example.com" />
          </label>
          <label class="field pages-field">
            <span class="eyebrow" style="margin-bottom: .4rem;">Max pages</span>
            <input class="input" name="maxPages" type="number" min="1" max="50" [(ngModel)]="maxPages" />
          </label>
          <button class="button primary" type="submit">Start scan</button>
        </form>

        <div style="display:flex; gap:.75rem; flex-wrap:wrap; margin-top: 1rem;">
          <button class="button secondary" type="button" (click)="loadDemo()">View demo scan</button>
          @if (api.error()) {
            <p style="color: var(--danger); margin: .65rem 0 0;">{{ api.error() }}</p>
          }
        </div>
      </div>

      @if (api.activeScan()) {
        <section class="section panel" style="padding: 1rem;">
          <div class="section-title">
            <div>
              <p class="eyebrow">Current scan</p>
              <h2 style="margin:.2rem 0 0;">{{ api.activeScan()?.rootUrl }}</h2>
            </div>
            <span class="badge">{{ api.activeScan()?.status }}</span>
          </div>
          <div class="progress" style="margin-top:1rem;">
            <span [style.width.%]="api.activeScan()?.status === 'completed' ? 100 : 42"></span>
          </div>
        </section>
      }

      @if (api.results(); as results) {
        <section class="section metrics-grid">
          <article class="metric">
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

        <section class="section panel" style="padding:1rem;">
          <div class="section-title">
            <div>
              <p class="eyebrow">Highest-impact findings</p>
              <h2 style="margin:0;">Suggestions to review first</h2>
            </div>
            <a class="button secondary" routerLink="/design-debt">Open Design Debt</a>
          </div>
          <div class="table-wrap">
            <table class="table" style="margin-top:1rem;">
              <tbody>
                @for (finding of results.findings; track finding.id) {
                  <tr>
                    <td data-label="Finding"><strong>{{ finding.title }}</strong><br><span style="color:var(--muted);">{{ finding.description }}</span></td>
                    <td data-label="Count">{{ finding.count }}</td>
                    <td data-label="Action"><a [routerLink]="['/design-debt', finding.targetView]">View</a></td>
                  </tr>
                }
              </tbody>
            </table>
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

  async loadDemo() {
    await this.api.loadDemo();
  }

  async startScan() {
    await this.api.startScan(this.url, Number(this.maxPages));
  }
}
