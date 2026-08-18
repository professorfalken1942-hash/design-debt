import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { TokenProposal } from "@designdebt/shared";
import { ApiService } from "../../core/api.service";

@Component({
  selector: "dd-token-forge-page",
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page">
      <p class="eyebrow">Tokens</p>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem); letter-spacing:0; margin:.2rem 0;">Turn repeated UI values into tokens.</h1>
      <p class="lede">UIpen turns scan evidence into named color and spacing decisions that teams can copy into code, docs, or a design system.</p>

      @if (!api.tokens().length) {
        <section class="section panel" style="padding:1.2rem;">
          <h2 style="margin:0;">No tokens yet</h2>
          <p style="color:var(--muted);">Load the demo scan to review proposed primitives and semantic roles.</p>
          <button class="button primary" type="button" (click)="api.loadDemo()">View demo scan</button>
        </section>
      } @else {
        <section class="section metrics-grid">
          <article class="metric"><span>Enabled</span><strong>{{ statusCount('enabled') }}</strong></article>
          <article class="metric"><span>Needs review</span><strong>{{ statusCount('needs-review') }}</strong></article>
          <article class="metric"><span>Disabled</span><strong>{{ statusCount('disabled') }}</strong></article>
          <article class="metric"><span>Primitives</span><strong>{{ primitiveTokens().length }}</strong></article>
          <article class="metric"><span>Semantic roles</span><strong>{{ semanticTokens().length }}</strong></article>
        </section>

        <section class="section token-intro-grid">
          <article class="token-guide panel">
            <span>What this page does</span>
            <h2>Review proposed design tokens before you export them</h2>
            <p>
              A token is a named design value, like <code>color.brand.500</code> or <code>space.4</code>. Instead of hard-coding the same blue or gap across screens, teams reuse the token name so product UI stays consistent.
            </p>
          </article>
          <article class="token-guide panel">
            <span>What export means</span>
            <h2>Copy the included tokens as CSS or JSON</h2>
            <p>
              The export is the token set produced by the two copy buttons. CSS variables are ready for stylesheets. JSON is better for design tools, build pipelines, or documentation.
            </p>
          </article>
          <article class="token-guide panel">
            <span>How to use it</span>
            <h2>Include reusable values, exclude one-offs</h2>
            <p>
              Use the review queue to decide which detected values belong in the system. Rename tokens when the intent is clearer than the raw value, then save your decisions before copying an export.
            </p>
          </article>
        </section>

        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Token export</p>
              <h2 style="margin:0;">{{ readinessTitle() }}</h2>
            </div>
            <span class="badge">{{ exportableCount() }} included</span>
          </div>
          <div class="readiness-bar" aria-label="Token review progress">
            <span [style.width.%]="readinessPercent()"></span>
          </div>
          <p class="token-rationale" style="margin-top:.8rem;">{{ readinessCopy() }}</p>
        </section>

        <section class="section action-strip">
          <div>
            <strong>Export included tokens</strong>
            <p class="token-rationale">These copy actions are the export. They include only tokens marked “Included in export.”</p>
          </div>
          <div style="display:flex; gap:.75rem; flex-wrap:wrap;">
            <button class="button primary" type="button" (click)="save()">Save changes</button>
            <button class="button secondary" type="button" (click)="copy('css')" [disabled]="!exportableCount()">Export CSS variables</button>
            <button class="button secondary" type="button" (click)="copy('json')" [disabled]="!exportableCount()">Export JSON</button>
          </div>
          @if (message) {
            <span class="badge">{{ message }}</span>
          }
        </section>

        <section class="section panel" style="padding:1rem;">
          <div class="section-title">
            <div>
              <p class="eyebrow">Review queue</p>
              <h2 style="margin:0;">Decide what goes into the exported token set</h2>
              <p class="token-rationale" style="margin-top:.45rem;">
                Including a token adds it to CSS and JSON exports. Keeping it in review leaves it visible here but out of exports. Excluding it documents the rejected proposal.
              </p>
            </div>
            <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
              <button class="button secondary" type="button" (click)="filter = 'needs-review'">Needs review</button>
              <button class="button secondary" type="button" (click)="filter = 'enabled'">Enabled</button>
              <button class="button secondary" type="button" (click)="filter = 'all'">All</button>
              <button class="button primary" type="button" (click)="approveReviewed()" [disabled]="!reviewQueue().length">Include pending decisions</button>
            </div>
          </div>

          <div class="token-review-grid" style="margin-top:1rem;">
            @for (token of filteredTokens().slice(0, 12); track token.id) {
              <article class="token-card">
                <header>
                  <div>
                    <strong>{{ token.name }}</strong>
                    <div class="token-value" style="margin-top:.45rem;">
                      @if (token.category === 'color') {
                        <span class="swatch" [style.background]="token.value"></span>
                      }
                      <span>{{ token.value }}</span>
                    </div>
                  </div>
                  <span class="badge">{{ token.confidence ?? 'low' }}</span>
                </header>
                <p class="token-rationale">{{ rationale(token) }}</p>
                <div class="decision-summary">
                  <span class="badge" [class.enabled]="token.status === 'enabled'" [class.disabled]="token.status === 'disabled'">{{ statusLabel(token.status) }}</span>
                  <p>{{ decisionCopy(token) }}</p>
                </div>
                <div class="decision-actions">
                  <button class="button primary" type="button" (click)="setStatus(token, 'enabled')" [disabled]="token.status === 'enabled'">Include in export</button>
                  <button class="button secondary" type="button" (click)="setStatus(token, 'needs-review')" [disabled]="token.status === 'needs-review'">Keep reviewing</button>
                  <button class="button secondary" type="button" (click)="setStatus(token, 'disabled')" [disabled]="token.status === 'disabled'">Exclude from export</button>
                </div>
              </article>
            }
          </div>
        </section>

        <section class="section panel" style="padding:1rem;">
          <p class="eyebrow">Primitive tokens</p>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Token</th><th>Value</th><th>Uses</th><th>Rationale</th><th>Decision</th></tr></thead>
              <tbody>
                @for (token of primitiveTokens(); track token.id) {
                  <tr>
                    <td data-label="Token"><input class="input" [(ngModel)]="token.name" /></td>
                    <td data-label="Value"><input class="input" [(ngModel)]="token.value" /></td>
                    <td data-label="Uses">{{ token.uses }}</td>
                    <td data-label="Rationale"><p class="token-rationale">{{ rationale(token) }}</p></td>
                    <td data-label="Decision">
                      <div class="decision-cell">
                        <span class="badge" [class.enabled]="token.status === 'enabled'" [class.disabled]="token.status === 'disabled'">{{ statusLabel(token.status) }}</span>
                        <div class="decision-actions compact">
                          <button class="button primary" type="button" (click)="setStatus(token, 'enabled')" [disabled]="token.status === 'enabled'">Include</button>
                          <button class="button secondary" type="button" (click)="setStatus(token, 'needs-review')" [disabled]="token.status === 'needs-review'">Review</button>
                          <button class="button secondary" type="button" (click)="setStatus(token, 'disabled')" [disabled]="token.status === 'disabled'">Exclude</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="section panel" style="padding:1rem;">
          <p class="eyebrow">Semantic tokens</p>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Semantic role</th><th>Primitive</th><th>Confidence</th><th>Rationale</th><th>Decision</th></tr></thead>
              <tbody>
                @for (token of semanticTokens(); track token.id) {
                  <tr>
                    <td data-label="Semantic role"><input class="input" [(ngModel)]="token.name" /></td>
                    <td data-label="Primitive"><input class="input" [(ngModel)]="token.value" /></td>
                    <td data-label="Confidence">{{ token.confidence ?? 'low' }}</td>
                    <td data-label="Rationale"><p class="token-rationale">{{ rationale(token) }}</p></td>
                    <td data-label="Decision">
                      <div class="decision-cell">
                        <span class="badge" [class.enabled]="token.status === 'enabled'" [class.disabled]="token.status === 'disabled'">{{ statusLabel(token.status) }}</span>
                        <div class="decision-actions compact">
                          <button class="button primary" type="button" (click)="setStatus(token, 'enabled')" [disabled]="token.status === 'enabled'">Include</button>
                          <button class="button secondary" type="button" (click)="setStatus(token, 'needs-review')" [disabled]="token.status === 'needs-review'">Review</button>
                          <button class="button secondary" type="button" (click)="setStatus(token, 'disabled')" [disabled]="token.status === 'disabled'">Exclude</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="section panel" style="padding:1rem;">
          <p class="eyebrow">Suggested consolidation</p>
          <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));">
            <article class="metric">
              <span>Near-duplicate blues</span>
              <strong>#0066cc</strong>
              <p style="color:var(--muted); line-height:1.5;">Consolidate #0569c9 and #0065c8 into color.blue.500.</p>
            </article>
            <article class="metric">
              <span>Spacing outlier</span>
              <strong>18px</strong>
              <p style="color:var(--muted); line-height:1.5;">Appears rarely next to a dominant 8px spacing scale.</p>
            </article>
          </div>
        </section>
      }
    </section>
  `,
})
export class TokenForgePageComponent {
  readonly api = inject(ApiService);
  message = "";
  filter: "needs-review" | "enabled" | "disabled" | "all" = "needs-review";

  primitiveTokens(): TokenProposal[] {
    return this.api.tokens().filter((token) => token.type === "primitive");
  }

  semanticTokens(): TokenProposal[] {
    return this.api.tokens().filter((token) => token.type === "semantic");
  }

  reviewQueue(): TokenProposal[] {
    return this.api.tokens().filter((token) => token.status === "needs-review").slice(0, 12);
  }

  filteredTokens(): TokenProposal[] {
    if (this.filter === "all") return this.api.tokens();
    return this.api.tokens().filter((token) => token.status === this.filter);
  }

  statusCount(status: TokenProposal["status"]): number {
    return this.api.tokens().filter((token) => token.status === status).length;
  }

  exportableCount(): number {
    return this.statusCount("enabled");
  }

  rationale(token: TokenProposal): string {
    const confidence = token.confidence ?? "low";
    if (token.type === "semantic") {
      const mapped = token.mapsTo ? ` It maps back to ${token.mapsTo},` : " It maps to a detected primitive,";
      return `${token.name} is a role proposal, not a raw value.${mapped} so teams can rename intent without changing the underlying color or spacing. Confidence is ${confidence} because it is inferred from usage patterns and still needs human review.`;
    }
    if (token.category === "color") {
      return `${token.value} appeared ${token.uses} times in the scan, enough to be treated as a reusable color candidate. Confidence is ${confidence} based on how often it appears.`;
    }
    if (token.category === "space") {
      return `${token.value} appeared ${token.uses} times across margin, padding, or gap values. Promote it when it belongs to the spacing scale; disable it if it is a one-off layout exception.`;
    }
    return `${token.value} appeared ${token.uses} times and may deserve a named token if the usage is intentional.`;
  }

  readinessPercent(): number {
    const total = this.api.tokens().length;
    if (!total) return 0;
    return Math.round((this.statusCount("enabled") / total) * 100);
  }

  readinessTitle(): string {
    const review = this.statusCount("needs-review");
    if (!review) return "Included set is ready";
    if (review <= 3) return "Almost ready to copy";
    return "Decide what belongs in the export";
  }

  readinessCopy(): string {
    const review = this.statusCount("needs-review");
    const included = this.exportableCount();
    if (!review) return `${included} tokens are included. Save your edits, then export CSS variables for app styling or JSON for design-system tooling.`;
    return `${included} tokens are included and ${review} still need review. Only included tokens are copied into CSS or JSON, so the export stays intentional.`;
  }

  statusLabel(status: TokenProposal["status"]): string {
    if (status === "enabled") return "Included in export";
    if (status === "disabled") return "Excluded from export";
    return "Needs a decision";
  }

  decisionCopy(token: TokenProposal): string {
    if (token.status === "enabled") return "This proposal will be included when you export CSS variables or JSON.";
    if (token.status === "disabled") return "This proposal will stay saved here but will not appear in the export.";
    if (token.type === "semantic") return "Confirm whether this role name matches product intent before including it.";
    return "Decide whether this detected value is a reusable token or a one-off implementation detail.";
  }

  setStatus(token: TokenProposal, status: TokenProposal["status"]): void {
    token.status = status;
    this.message = "";
  }

  approveReviewed(): void {
    for (const token of this.reviewQueue()) {
      token.status = "enabled";
    }
    this.message = "Pending decisions included";
  }

  async save() {
    await this.api.saveTokens(this.api.tokens());
    this.message = "Saved";
  }

  async copy(format: "css" | "json") {
    await navigator.clipboard.writeText(await this.api.copyExport(format));
    this.message = `${format === "css" ? "CSS variables" : "JSON"} exported`;
  }
}
