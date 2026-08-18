import { Component, inject, signal } from "@angular/core";
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
            <h2>Download the included tokens as CSS or JSON</h2>
            <p>
              The export is the approved token set. CSS variables are ready for app stylesheets. JSON is better for design tools, build pipelines, documentation, or future token sync.
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

        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Naming preset</p>
              <h2 style="margin:0;">Choose a convention before handoff</h2>
              <p class="token-rationale" style="margin-top:.45rem;">Presets rename token proposals in the table. Save changes before downloading files.</p>
            </div>
            <div class="export-actions">
              <select class="select" [ngModel]="namingPreset()" (ngModelChange)="namingPreset.set($event)">
                <option value="scale">Scale names</option>
                <option value="semantic">Semantic-friendly</option>
                <option value="css">CSS variable style</option>
              </select>
              <button class="button secondary" type="button" (click)="applyNamingPreset()">Apply preset</button>
            </div>
          </div>
        </section>

        <section class="section action-strip">
          <div>
            <strong>Export included tokens</strong>
            <p class="token-rationale">Downloads and copy actions include only tokens marked “Included in export.” Save first when you rename values or change decisions.</p>
          </div>
          <div class="export-actions">
            <button class="button primary" type="button" (click)="save()">Save changes</button>
            <button class="button secondary" type="button" (click)="downloadBundle()" [disabled]="!exportableCount()">Download handoff bundle</button>
            <button class="button secondary" type="button" (click)="download('css')" [disabled]="!exportableCount()">Download CSS file</button>
            <button class="button secondary" type="button" (click)="download('json')" [disabled]="!exportableCount()">Download JSON file</button>
            <button class="button quiet" type="button" (click)="copy('css')" [disabled]="!exportableCount()">Copy CSS</button>
            <button class="button quiet" type="button" (click)="copy('json')" [disabled]="!exportableCount()">Copy JSON</button>
          </div>
          @if (message) {
            <span class="badge">{{ message }}</span>
          }
        </section>

        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Export preview</p>
              <h2 style="margin:0;">Inspect the file before handoff</h2>
              <p class="token-rationale" style="margin-top:.45rem;">Preview uses the same included-token export as downloads and copy actions.</p>
            </div>
            <div class="export-actions">
              <button class="button secondary" type="button" (click)="loadPreview('css')" [disabled]="previewLoading() || !exportableCount()">Preview CSS</button>
              <button class="button secondary" type="button" (click)="loadPreview('json')" [disabled]="previewLoading() || !exportableCount()">Preview JSON</button>
            </div>
          </div>
          @if (exportPreview(); as preview) {
            <pre class="export-preview"><code>{{ preview.content }}</code></pre>
          } @else {
            <div class="empty-state subtle">
              <strong>No preview selected</strong>
              <span>Choose CSS or JSON to inspect exactly what the export will contain.</span>
            </div>
          }
        </section>

        <section class="section handoff-grid">
          <article class="handoff-card">
            <span>For developers</span>
            <strong>Ship a usable token file</strong>
            <p>Download <code>{{ exportFileName('css') }}</code>, import it near your app root, and replace repeated raw values with variables like <code>var(--color-blue-700)</code>.</p>
          </article>
          <article class="handoff-card">
            <span>For designers</span>
            <strong>Turn scan evidence into naming decisions</strong>
            <p>Use the review queue to confirm intent, then download <code>{{ exportFileName('json') }}</code> for docs, design-token plugins, or handoff notes.</p>
          </article>
          <article class="handoff-card">
            <span>For teams</span>
            <strong>Keep the system deliberate</strong>
            <p>Leave uncertain values in review, exclude one-offs, and save decisions so the scan becomes a shared source of truth instead of another loose audit.</p>
          </article>
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
  readonly exportPreview = signal<{ format: "css" | "json"; content: string } | null>(null);
  readonly previewLoading = signal(false);
  readonly namingPreset = signal<"scale" | "semantic" | "css">("scale");
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
    if (!review) return `${included} tokens are included. Save your edits, then download CSS variables for app styling or JSON for design-system tooling.`;
    return `${included} tokens are included and ${review} still need review. Only included tokens are exported, so the files stay intentional.`;
  }

  statusLabel(status: TokenProposal["status"]): string {
    if (status === "enabled") return "Included in export";
    if (status === "disabled") return "Excluded from export";
    return "Needs a decision";
  }

  decisionCopy(token: TokenProposal): string {
    if (token.status === "enabled") return "This proposal will be included in downloaded CSS and JSON files.";
    if (token.status === "disabled") return "This proposal will stay saved here but will not appear in the export.";
    if (token.type === "semantic") return "Confirm whether this role name matches product intent before including it.";
    return "Decide whether this detected value is a reusable token or a one-off implementation detail.";
  }

  setStatus(token: TokenProposal, status: TokenProposal["status"]): void {
    token.status = status;
    this.message = "";
    this.exportPreview.set(null);
  }

  approveReviewed(): void {
    for (const token of this.reviewQueue()) {
      token.status = "enabled";
    }
    this.message = "Pending decisions included";
  }

  applyNamingPreset(): void {
    const counters = new Map<string, number>();
    for (const token of this.api.tokens()) {
      token.name = this.nameForPreset(token, counters);
    }
    this.exportPreview.set(null);
    this.message = "Naming preset applied";
  }

  async save() {
    await this.api.saveTokens(this.api.tokens());
    this.message = "Saved";
  }

  async copy(format: "css" | "json") {
    await navigator.clipboard.writeText(await this.api.copyExport(format));
    this.message = `${format === "css" ? "CSS variables" : "JSON"} copied`;
  }

  async loadPreview(format: "css" | "json") {
    this.previewLoading.set(true);
    try {
      this.exportPreview.set({ format, content: await this.api.copyExport(format) });
      this.message = `${format === "css" ? "CSS" : "JSON"} preview loaded`;
    } finally {
      this.previewLoading.set(false);
    }
  }

  async download(format: "css" | "json") {
    const content = await this.api.copyExport(format);
    const type = format === "css" ? "text/css" : "application/json";
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = this.exportFileName(format);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.message = `${link.download} downloaded`;
  }

  async downloadBundle() {
    const [css, json] = await Promise.all([this.api.copyExport("css"), this.api.copyExport("json")]);
    const cssName = this.exportFileName("css");
    const jsonName = this.exportFileName("json");
    const readmeName = "README.md";
    const zip = createStoredZip([
      { name: cssName, content: css },
      { name: jsonName, content: json },
      { name: readmeName, content: this.handoffReadme(cssName, jsonName) },
    ]);
    const zipBuffer = new ArrayBuffer(zip.byteLength);
    new Uint8Array(zipBuffer).set(zip);
    const url = URL.createObjectURL(new Blob([zipBuffer], { type: "application/zip" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = this.exportBundleFileName();
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.message = `${link.download} downloaded`;
  }

  exportFileName(format: "css" | "json"): string {
    const scan = this.api.activeScan();
    const source = scan?.rootUrl ?? scan?.id ?? "tokens";
    const name = this.exportSourceName(source);
    return `uipen-${name}-tokens.${format}`;
  }

  exportBundleFileName(): string {
    const scan = this.api.activeScan();
    const source = scan?.rootUrl ?? scan?.id ?? "tokens";
    const name = this.exportSourceName(source);
    return `uipen-${name}-token-handoff.zip`;
  }

  private handoffReadme(cssName: string, jsonName: string): string {
    const scan = this.api.activeScan();
    return [
      "# UIpen Token Handoff",
      "",
      `Source: ${scan?.rootUrl ?? "Current scan"}`,
      `Included tokens: ${this.exportableCount()}`,
      `Needs review: ${this.statusCount("needs-review")}`,
      `Generated: ${new Date().toISOString()}`,
      "",
      "## Files",
      "",
      `- ${cssName}: CSS custom properties for application stylesheets.`,
      `- ${jsonName}: structured token data for design tools, docs, or build pipelines.`,
      "",
      "## Suggested workflow",
      "",
      "1. Import the CSS file near the application root.",
      "2. Replace repeated raw values with token variables.",
      "3. Use the JSON file as the source for design-system documentation or token sync.",
      "4. Keep uncertain proposals in UIpen review until design and engineering agree on intent.",
      "",
    ].join("\n");
  }

  private exportSourceName(source: string): string {
    try {
      return this.slug(new URL(source).hostname);
    } catch {
      return this.slug(source);
    }
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tokens";
  }

  private nameForPreset(token: TokenProposal, counters: Map<string, number>): string {
    const preset = this.namingPreset();
    if (preset === "css") return this.slug(token.name).replaceAll("-", ".");
    if (token.type === "semantic") return this.semanticName(token);

    const family = token.category === "space" ? "space" : token.category;
    const index = this.nextPresetIndex(counters, family);
    if (preset === "semantic" && token.category === "color") return `color.palette.${index}`;
    return `${family}.${index}`;
  }

  private semanticName(token: TokenProposal): string {
    if (token.name.includes("text")) return "color.text.primary";
    if (token.name.includes("action") || token.name.includes("button")) return "color.action.primary";
    if (token.category === "space") return "space.layout.default";
    return token.name;
  }

  private nextPresetIndex(counters: Map<string, number>, family: string): string {
    const next = (counters.get(family) ?? 0) + 1;
    counters.set(family, next);
    return String(next * 100);
  }
}

interface ZipFile {
  name: string;
  content: string;
}

function createStoredZip(files: ZipFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const crc = crc32(content);
    const local = zipLocalHeader(name, content, crc);
    const central = zipCentralHeader(name, content, crc, offset);
    localParts.push(local, content);
    centralParts.push(central);
    offset += local.length + content.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = zipEndRecord(files.length, centralSize, centralOffset);
  return concatUint8([...localParts, ...centralParts, end]);
}

function zipLocalHeader(name: Uint8Array, content: Uint8Array, crc: number): Uint8Array {
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, content.length, true);
  view.setUint32(22, content.length, true);
  view.setUint16(26, name.length, true);
  header.set(name, 30);
  return header;
}

function zipCentralHeader(name: Uint8Array, content: Uint8Array, crc: number, offset: number): Uint8Array {
  const header = new Uint8Array(46 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, content.length, true);
  view.setUint32(24, content.length, true);
  view.setUint16(28, name.length, true);
  view.setUint32(42, offset, true);
  header.set(name, 46);
  return header;
}

function zipEndRecord(fileCount: number, centralSize: number, centralOffset: number): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return header;
}

function concatUint8(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
