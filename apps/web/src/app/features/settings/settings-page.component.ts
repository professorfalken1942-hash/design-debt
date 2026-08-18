import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "dd-settings-page",
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page">
      <p class="eyebrow">Settings</p>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem); letter-spacing:0; margin:.2rem 0;">Workspace settings</h1>
      <p class="lede">Save lightweight team rules for token naming, scan scope, ignored paths, and review expectations. These settings guide handoff until full project accounts exist.</p>

      <section class="section panel" style="padding:1.2rem;">
        <h2 style="margin-top:0;">Scan defaults</h2>
        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));">
          <label class="field">
            <span>Default page limit</span>
            <input class="input" type="number" min="1" max="50" [(ngModel)]="settings.defaultPageLimit" />
          </label>
          <label class="field">
            <span>Crawler mode</span>
            <select class="select" [(ngModel)]="settings.crawlerMode">
              <option value="same-origin">Same-origin only</option>
              <option value="page-list">Curated page list</option>
            </select>
          </label>
          <label class="field">
            <span>Live limit</span>
            <input class="input" value="3 pages on Vercel" readonly />
          </label>
          <label class="field">
            <span>Timeout</span>
            <input class="input" value="12 seconds per serverless scan" readonly />
          </label>
        </div>
      </section>

      <section class="section panel" style="padding:1.2rem;">
        <div class="section-title">
          <div>
            <p class="eyebrow">Team rules</p>
            <h2 style="margin:0;">Handoff conventions</h2>
          </div>
          <button class="button primary" type="button" (click)="save()">Save settings</button>
        </div>
        <div class="settings-grid">
          <label class="field">
            <span>Token naming preset</span>
            <select class="select" [(ngModel)]="settings.namingPreset">
              <option value="scale">Scale names</option>
              <option value="semantic">Semantic-friendly</option>
              <option value="css">CSS variable style</option>
            </select>
          </label>
          <label class="field">
            <span>Review threshold</span>
            <select class="select" [(ngModel)]="settings.reviewThreshold">
              <option value="strict">Strict: review low-confidence tokens</option>
              <option value="balanced">Balanced: review medium and low</option>
              <option value="fast">Fast: include repeated values sooner</option>
            </select>
          </label>
          <label class="field">
            <span>Ignored paths</span>
            <textarea class="input" rows="4" [(ngModel)]="settings.ignoredPaths" placeholder="/admin&#10;/checkout&#10;/account"></textarea>
          </label>
          <label class="field">
            <span>Team notes</span>
            <textarea class="input" rows="4" [(ngModel)]="settings.teamNotes" placeholder="Document naming rules, exception policy, and handoff expectations."></textarea>
          </label>
        </div>
        @if (message()) {
          <span class="badge" style="margin-top:1rem;">{{ message() }}</span>
        }
      </section>

      <section class="section panel" style="padding:1.2rem;">
        <h2 style="margin-top:0;">Still planned</h2>
        <div class="workflow-grid">
          <article class="workflow-card"><span>Next</span><strong>Page groups</strong><p>Compare marketing, app, docs, and checkout pages separately.</p></article>
          <article class="workflow-card"><span>Next</span><strong>Schedules</strong><p>Run recurring scans and track regressions over time.</p></article>
          <article class="workflow-card"><span>Next</span><strong>Shared accounts</strong><p>Move local workspace rules into database-backed team projects.</p></article>
        </div>
      </section>
    </section>
  `,
})
export class SettingsPageComponent {
  readonly message = signal("");
  settings = loadSettings();

  save(): void {
    window.localStorage.setItem("uipen.workspaceSettings", JSON.stringify(this.settings));
    this.message.set("Settings saved on this device");
  }
}

interface WorkspaceSettings {
  defaultPageLimit: number;
  crawlerMode: "same-origin" | "page-list";
  namingPreset: "scale" | "semantic" | "css";
  reviewThreshold: "strict" | "balanced" | "fast";
  ignoredPaths: string;
  teamNotes: string;
}

function loadSettings(): WorkspaceSettings {
  const defaults: WorkspaceSettings = {
    defaultPageLimit: 20,
    crawlerMode: "same-origin",
    namingPreset: "scale",
    reviewThreshold: "balanced",
    ignoredPaths: "/admin\n/checkout\n/account",
    teamNotes: "",
  };
  try {
    return { ...defaults, ...JSON.parse(window.localStorage.getItem("uipen.workspaceSettings") ?? "{}") };
  } catch {
    return defaults;
  }
}
