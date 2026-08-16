import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink, RouterLinkActive } from "@angular/router";
import type { Finding, InventoryItem } from "@designdebt/shared";
import { ApiService } from "../../core/api.service";

const categories = ["colors", "typography", "spacing", "borders", "shadows", "buttons", "forms"] as const;

@Component({
  selector: "dd-design-debt-page",
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <section class="page">
      <p class="eyebrow">Design Debt</p>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem); letter-spacing:-.04em; margin:.2rem 0;">Visual inventory and drift</h1>
      <p class="lede">Review detected values, usage counts, examples, and likely inconsistencies across the scanned interface.</p>

      <nav class="tabs section" aria-label="Design debt categories">
        @for (category of categories; track category) {
          <a [routerLink]="['/design-debt', category]" routerLinkActive="active">{{ label(category) }}</a>
        }
      </nav>

      @if (!api.results()) {
        <section class="section panel" style="padding:1.2rem;">
          <h2 style="margin:0;">No scan selected</h2>
          <p style="color:var(--muted);">Open the demo scan or start a new scan from Overview.</p>
          <button class="button primary" type="button" (click)="api.loadDemo()">View demo scan</button>
        </section>
      } @else {
        @if (api.results()?.findings?.length) {
          <section class="section detail-grid">
            <article class="panel" style="padding:1rem;">
              <div class="section-title">
                <div>
                  <p class="eyebrow">Findings</p>
                  <h2 style="margin:0;">What to review first</h2>
                </div>
                <span class="badge">{{ api.results()?.findings?.length }} signals</span>
              </div>
              <div class="finding-list">
                @for (finding of api.results()?.findings; track finding.id) {
                  <button
                    class="finding-row finding-button"
                    type="button"
                    [class.active]="selectedFinding()?.id === finding.id"
                    (click)="selectFinding(finding)"
                  >
                    <span>{{ label(finding.category) }} · {{ finding.severity }}</span>
                    <strong>{{ finding.title }}</strong>
                    <small>{{ finding.description }}</small>
                  </button>
                }
              </div>
            </article>

            <article class="panel" style="padding:1rem;">
              @if (selectedFinding(); as finding) {
                <p class="eyebrow">Finding Detail</p>
                <h2 style="margin:0 0 .65rem;">{{ finding.title }}</h2>
                <p style="color:var(--muted-strong); line-height:1.6;">{{ finding.description }}</p>
                <div class="scan-facts" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
                  <div><span>Severity</span><strong>{{ finding.severity }}</strong></div>
                  <div><span>Detected</span><strong>{{ finding.count }}</strong></div>
                </div>
                <div class="explain-box">
                  <strong>Why this was flagged</strong>
                  <p>{{ whyFlagged(finding) }}</p>
                </div>
                <div class="explain-box">
                  <strong>Recommended action</strong>
                  <p>{{ recommendedAction(finding) }}</p>
                </div>
                <div class="finding-list">
                  @for (example of findingExamples(finding); track example.pageUrl + example.selector) {
                    <div class="example-row">
                      <strong>{{ example.selector ?? example.tagName }}</strong>
                      <span>{{ example.text || "No visible text captured" }}</span>
                      <small>{{ example.pageUrl }}</small>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty-state">
                  <strong>Select a finding</strong>
                  <span>Open a signal to see why it matters and where it appears.</span>
                </div>
              }
            </article>
          </section>
        }

        <section class="section panel" style="padding:1rem;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1rem;">
            <div>
              <p class="eyebrow">{{ label(activeCategory()) }}</p>
              <h2 style="margin:0;">{{ items().length }} detected patterns</h2>
            </div>
            <span class="badge">Sortable inventory</span>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Value</th>
                  <th>Uses</th>
                  <th>Pages</th>
                  <th>Examples</th>
                </tr>
              </thead>
              <tbody>
                @for (item of items(); track item.normalizedValue) {
                  <tr>
                    <td data-label="Value">
                      @if (activeCategory() === 'colors') {
                        <span class="swatch" [style.background]="item.normalizedValue"></span>
                      }
                      <strong style="margin-left:.5rem;">{{ item.normalizedValue }}</strong>
                    </td>
                    <td data-label="Uses">{{ item.count }}</td>
                    <td data-label="Pages">{{ item.pages.length }}</td>
                    <td data-label="Examples">
                      @for (example of item.examples.slice(0, 3); track example.pageUrl + example.selector) {
                        <div class="compact-example">
                          <strong>{{ example.selector ?? example.tagName }}</strong>
                          <span>{{ example.pageUrl }}</span>
                        </div>
                      }
                    </td>
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
export class DesignDebtPageComponent {
  readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly categories = categories;
  readonly selectedFinding = signal<Finding | null>(null);
  readonly activeCategory = computed(() => {
    const value = this.route.snapshot.paramMap.get("category");
    return categories.includes(value as (typeof categories)[number])
      ? (value as (typeof categories)[number])
      : "colors";
  });
  readonly items = computed(() => this.api.results()?.inventories[this.activeCategory()] ?? []);

  selectFinding(finding: Finding): void {
    this.selectedFinding.set(finding);
  }

  findingExamples(finding: Finding) {
    const category = categories.includes(finding.targetView as (typeof categories)[number])
      ? (finding.targetView as (typeof categories)[number])
      : finding.category;
    return this.api.results()?.inventories[category].flatMap((item: InventoryItem) => item.examples).slice(0, 6) ?? [];
  }

  whyFlagged(finding: Finding): string {
    if (finding.id === "similar-colors") {
      return "Multiple colors are visually close enough that users may read them as the same role, while engineers have to maintain them as separate values.";
    }
    if (finding.id === "rare-spacing") {
      return "These spacing values appear only a few times, which often means one-off layout decisions have slipped outside the intended scale.";
    }
    if (finding.id === "button-fragmentation") {
      return "Buttons are varying across color, radius, padding, or typography. That usually creates extra component states and weakens visual rhythm.";
    }
    return "This pattern stands out from the rest of the scan and may deserve design-system review.";
  }

  recommendedAction(finding: Finding): string {
    if (finding.category === "colors") return "Group nearby colors, choose the intended canonical token, then map aliases or semantic roles to that value.";
    if (finding.category === "spacing") return "Compare each rare value against the nearest spacing step and keep it only when the layout truly needs an exception.";
    if (finding.category === "buttons") return "Choose the button variants the product actually needs, then consolidate padding, radius, color, and text styles into component tokens.";
    return "Review the examples, decide whether the variation is intentional, and promote repeated decisions into named tokens.";
  }

  label(value: string): string {
    return value.replace("-", " ").replace(/^\w/, (letter) => letter.toUpperCase());
  }
}
