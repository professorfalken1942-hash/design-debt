import { Component, OnDestroy, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink, RouterLinkActive } from "@angular/router";
import type { Finding, InventoryItem } from "@designdebt/shared";
import type { Subscription } from "rxjs";
import { ApiService } from "../../core/api.service";

const categories = ["colors", "typography", "spacing", "borders", "shadows", "buttons", "forms"] as const;

@Component({
  selector: "dd-design-debt-page",
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive],
  template: `
    <section class="page">
      <p class="eyebrow">Audit</p>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem); letter-spacing:0; margin:.2rem 0;">Visual inventory and drift</h1>
      <p class="lede">Review detected values, usage counts, examples, and likely inconsistencies across the scanned interface.</p>

      <nav class="tabs section" aria-label="Design debt categories">
        @for (category of categories; track category) {
          <a [routerLink]="['/audit', category]" routerLinkActive="active">{{ label(category) }}</a>
        }
      </nav>

      @if (!api.results()) {
        <section class="section panel" style="padding:1.2rem;">
          <h2 style="margin:0;">No scan selected</h2>
          <p style="color:var(--muted);">Open the demo scan or start a new scan from Overview.</p>
          <button class="button primary" type="button" (click)="api.loadDemo()">View demo scan</button>
        </section>
      } @else {
        <section class="section metrics-grid">
          @for (summary of findingSummary(); track summary.label) {
            <article class="metric">
              <span>{{ summary.label }}</span>
              <strong>{{ summary.value }}</strong>
              <p style="color:var(--muted); line-height:1.45; margin:.45rem 0 0;">{{ summary.copy }}</p>
            </article>
          }
        </section>

        <section class="section category-playbook">
          <article class="panel playbook-main">
            <p class="eyebrow">{{ label(activeCategory()) }} playbook</p>
            <h2>{{ categoryGoal(activeCategory()) }}</h2>
            <p>{{ categoryWhy(activeCategory()) }}</p>
          </article>
          <article class="playbook-card">
            <span>What to inspect</span>
            <p>{{ categoryInspection(activeCategory()) }}</p>
          </article>
          <article class="playbook-card">
            <span>Done when</span>
            <p>{{ categoryDone(activeCategory()) }}</p>
          </article>
        </section>

        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Audit filters</p>
              <h2 style="margin:0;">Narrow the review surface</h2>
            </div>
            <span class="badge">{{ filteredFindings().length }} findings · {{ filteredItems().length }} patterns</span>
          </div>
          <div class="audit-filter-grid">
            <label class="field">
              <span>Severity</span>
              <select class="select" [ngModel]="severityFilter()" (ngModelChange)="severityFilter.set($event)">
                <option value="all">All severities</option>
                <option value="warning">Warnings</option>
                <option value="suggestion">Suggestions</option>
                <option value="info">Info</option>
              </select>
            </label>
            <label class="field">
              <span>Page</span>
              <select class="select" [ngModel]="pageFilter()" (ngModelChange)="pageFilter.set($event)">
                <option value="all">All pages</option>
                @for (page of availablePages(); track page) {
                  <option [value]="page">{{ page }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Page group</span>
              <select class="select" [ngModel]="pageGroupFilter()" (ngModelChange)="pageGroupFilter.set($event)">
                <option value="all">All groups</option>
                @for (group of api.settings()?.pageGroups ?? []; track group.id) {
                  <option [value]="group.id">{{ group.name }}</option>
                }
              </select>
            </label>
            <label class="toggle-field">
              <input type="checkbox" [ngModel]="tokenCandidateOnly()" (ngModelChange)="tokenCandidateOnly.set($event)" />
              <span>Token candidates only</span>
            </label>
          </div>
        </section>

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
                @for (finding of filteredFindings(); track finding.id) {
                  <button
                    class="finding-row finding-button"
                    type="button"
                    [class.active]="selectedFinding()?.id === finding.id"
                    (click)="selectFinding(finding)"
                  >
                    <span>{{ priorityLabel(finding) }} · {{ label(finding.category) }}</span>
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
                  <div><span>Category</span><strong>{{ label(finding.category) }}</strong></div>
                  <div><span>Priority</span><strong>{{ priorityLabel(finding) }}</strong></div>
                </div>
                <div class="explain-box">
                  <strong>Why this was flagged</strong>
                  <p>{{ whyFlagged(finding) }}</p>
                </div>
                <div class="explain-box">
                  <strong>Recommended action</strong>
                  <p>{{ recommendedAction(finding) }}</p>
                </div>
                <div class="explain-box">
                  <strong>Acceptance check</strong>
                  <p>{{ acceptanceCheck(finding) }}</p>
                </div>
                @if (findingScreenshot(finding); as screenshot) {
                  <figure class="finding-screenshot">
                    <img [src]="screenshot.dataUrl" [alt]="'Screenshot of ' + screenshot.pageUrl" />
                    <figcaption>{{ screenshot.pageUrl }}</figcaption>
                  </figure>
                }
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
              <h2 style="margin:0;">{{ filteredItems().length }} detected patterns</h2>
              <p class="token-rationale" style="margin-top:.45rem;">{{ inventoryHelp(activeCategory()) }}</p>
            </div>
            <span class="badge">Sortable inventory</span>
          </div>

          <div class="visual-evidence-grid">
            @for (item of filteredItems().slice(0, 4); track item.normalizedValue) {
              <article class="visual-evidence-card">
                <div class="evidence-preview" [style.background]="activeCategory() === 'colors' ? item.normalizedValue : ''">
                  @if (activeCategory() !== 'colors') {
                    <strong>{{ item.normalizedValue }}</strong>
                  }
                </div>
                <div>
                  <span>{{ item.count }} uses · {{ item.pages.length }} pages</span>
                  <strong>{{ item.normalizedValue }}</strong>
                  <p>{{ evidenceCopy(item) }}</p>
                </div>
              </article>
            }
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
                @for (item of filteredItems(); track item.normalizedValue) {
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
export class DesignDebtPageComponent implements OnDestroy {
  readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly routeSub: Subscription;
  readonly categories = categories;
  readonly selectedFinding = signal<Finding | null>(null);
  readonly activeCategory = signal<(typeof categories)[number]>("colors");
  readonly severityFilter = signal<Finding["severity"] | "all">("all");
  readonly pageFilter = signal("all");
  readonly pageGroupFilter = signal("all");
  readonly tokenCandidateOnly = signal(false);
  readonly items = computed(() => this.api.results()?.inventories[this.activeCategory()] ?? []);
  readonly filteredItems = computed(() =>
    this.items().filter((item) => {
      if (this.pageFilter() !== "all" && !item.pages.includes(this.pageFilter())) return false;
      if (this.pageGroupFilter() !== "all" && !item.pages.some((page) => this.pageMatchesActiveGroup(page))) return false;
      if (this.tokenCandidateOnly() && !this.isTokenCandidate(item)) return false;
      return true;
    }),
  );
  readonly filteredFindings = computed(() =>
    (this.api.results()?.findings ?? []).filter((finding) => {
      if (this.severityFilter() !== "all" && finding.severity !== this.severityFilter()) return false;
      if (finding.category !== this.activeCategory() && finding.targetView !== this.activeCategory()) return false;
      if (this.pageFilter() !== "all") {
        return this.findingExamples(finding).some((example) => example.pageUrl === this.pageFilter());
      }
      if (this.pageGroupFilter() !== "all") {
        return this.findingExamples(finding).some((example) => this.pageMatchesActiveGroup(example.pageUrl));
      }
      return true;
    }),
  );

  constructor() {
    void this.api.loadSettings().catch(() => undefined);
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const value = params.get("category");
      this.activeCategory.set(
        categories.includes(value as (typeof categories)[number])
          ? (value as (typeof categories)[number])
          : "colors",
      );
      this.selectedFinding.set(null);
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  findingSummary() {
    const findings = this.api.results()?.findings ?? [];
    const warningCount = findings.filter((finding) => finding.severity === "warning").length;
    const categories = new Set(findings.map((finding) => finding.category)).size;
    return [
      {
        label: "Open findings",
        value: findings.length,
        copy: "Signals worth reviewing before token export.",
      },
      {
        label: "Warnings",
        value: warningCount,
        copy: "Likely drift with higher design-system impact.",
      },
      {
        label: "Categories touched",
        value: categories,
        copy: "Areas of the interface affected by detected variation.",
      },
    ];
  }

  selectFinding(finding: Finding): void {
    this.selectedFinding.set(finding);
  }

  findingExamples(finding: Finding) {
    const category = categories.includes(finding.targetView as (typeof categories)[number])
      ? (finding.targetView as (typeof categories)[number])
      : finding.category;
    return this.api.results()?.inventories[category].flatMap((item: InventoryItem) => item.examples).slice(0, 6) ?? [];
  }

  findingScreenshot(finding: Finding) {
    const examples = this.findingExamples(finding);
    const pageUrl = examples[0]?.pageUrl;
    return this.api.screenshots().find((screenshot) => screenshot.pageUrl === pageUrl) ?? this.api.screenshots()[0];
  }

  availablePages(): string[] {
    return [...new Set(this.items().flatMap((item) => item.pages))].sort();
  }

  pageMatchesActiveGroup(pageUrl: string): boolean {
    const group = this.api.settings()?.pageGroups.find((item) => item.id === this.pageGroupFilter());
    if (!group) return true;
    return group.matchers.some((matcher) => pageUrl.includes(matcher));
  }

  isTokenCandidate(item: InventoryItem): boolean {
    if (this.activeCategory() === "colors") return item.count >= 2;
    if (this.activeCategory() === "spacing") return item.count >= 3;
    if (this.activeCategory() === "typography") return item.count >= 2;
    return item.count >= 2;
  }

  evidenceCopy(item: InventoryItem): string {
    const example = item.examples[0];
    const source = example?.selector ?? example?.tagName ?? "captured element";
    return `Example: ${source} on ${item.pages[0] ?? "the scanned site"}.`;
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

  acceptanceCheck(finding: Finding): string {
    if (finding.category === "colors") return "One canonical color is chosen for each visual role, and near-duplicates are either merged or intentionally named.";
    if (finding.category === "spacing") return "Rare spacing values are mapped to the closest scale step unless a layout exception is documented.";
    if (finding.category === "buttons") return "Button variants have clear names, shared primitives, and no one-off padding, radius, or color decisions.";
    return "The team can explain whether the variation is intentional, reusable, or safe to remove.";
  }

  priorityLabel(finding: Finding): string {
    if (finding.severity === "warning") return "High priority";
    if (finding.severity === "suggestion") return "Review";
    return "Informational";
  }

  categoryGoal(category: string): string {
    if (category === "colors") return "Reduce color drift into clear roles";
    if (category === "typography") return "Identify the type styles that should become standards";
    if (category === "spacing") return "Find the spacing scale hiding in the UI";
    if (category === "borders") return "Normalize radius and border treatment";
    if (category === "shadows") return "Keep elevation meaningful instead of decorative";
    if (category === "buttons") return "Collapse one-off buttons into reusable variants";
    return "Make form controls consistent enough to reuse";
  }

  categoryWhy(category: string): string {
    if (category === "colors") return "Too many nearby colors make themes harder to maintain and weaken product meaning. The goal is to pick canonical primitives and semantic roles.";
    if (category === "typography") return "Type drift makes pages feel assembled from different systems. Look for repeated size, weight, and line-height combinations that deserve names.";
    if (category === "spacing") return "Spacing is where visual rhythm usually breaks first. Repeated values suggest a scale; rare values are candidates for cleanup.";
    if (category === "borders") return "Mixed radii and border widths make components feel unrelated even when layout is consistent.";
    if (category === "shadows") return "Elevation should communicate hierarchy. Too many shadows often signal custom component styling.";
    if (category === "buttons") return "Button fragmentation creates extra implementation work and unclear hierarchy for users.";
    return "Forms carry a lot of repeated interaction detail. Consistent controls reduce implementation drift and user hesitation.";
  }

  categoryInspection(category: string): string {
    if (category === "colors") return "Sort by uses, compare similar swatches, and decide which values map to brand, text, border, surface, and action roles.";
    if (category === "typography") return "Look for styles with similar size and weight. Keep the few that match real content hierarchy.";
    if (category === "spacing") return "Look at the most common values first, then challenge rare values against the nearest scale step.";
    if (category === "buttons") return "Compare color, radius, padding, and text treatment. Each surviving variant should have a clear product purpose.";
    return "Review high-use patterns first, then inspect rare values to decide whether they are intentional exceptions.";
  }

  categoryDone(category: string): string {
    if (category === "colors") return "Each repeated color has a token name or an intentional reason to stay raw.";
    if (category === "typography") return "The team can name the core text styles and explain outliers.";
    if (category === "spacing") return "Rare values are either mapped to the scale or documented as layout exceptions.";
    if (category === "buttons") return "Primary, secondary, destructive, and quiet actions are clear, with no accidental variants.";
    return "Repeated decisions are promoted into tokens or component rules, and exceptions are documented.";
  }

  inventoryHelp(category: string): string {
    if (category === "colors") return "Use the count to find canonical values; use examples to confirm whether a value is brand, text, surface, border, or status.";
    if (category === "spacing") return "Counts reveal the scale. Low-count values are not always wrong, but they should earn their place.";
    if (category === "typography") return "Repeated combinations are candidates for named text styles; rare combinations may be local overrides.";
    return "Start with high-use patterns, then inspect examples for values that should become shared component decisions.";
  }

  label(value: string): string {
    return value.replace("-", " ").replace(/^\w/, (letter) => letter.toUpperCase());
  }
}
