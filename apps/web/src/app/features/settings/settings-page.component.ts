import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { PageGroup, ScheduledScan, TeamMember, WorkspaceSettings } from "@designdebt/shared";
import { ApiService } from "../../core/api.service";

@Component({
  selector: "dd-settings-page",
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page">
      <div class="topbar">
        <div>
          <p class="eyebrow">Settings</p>
          <h1 style="font-size:clamp(2rem,5vw,3.4rem); letter-spacing:0; margin:.2rem 0;">Workspace settings</h1>
          <p class="lede">Shared team rules for scan scope, evidence capture, token naming, page groups, schedules, and handoff ownership.</p>
        </div>
        <button class="button secondary" type="button" (click)="load()" [disabled]="loading()">Refresh</button>
      </div>

      @if (loading()) {
        <section class="section panel empty-state">
          <strong>Loading workspace</strong>
          <span>Fetching shared settings from the database.</span>
        </section>
      } @else if (error()) {
        <section class="section panel empty-state danger">
          <strong>Unable to load settings</strong>
          <span>{{ error() }}</span>
        </section>
      } @else if (settings) {
        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Account-backed rules</p>
              <h2 style="margin:0;">{{ settings.teamName }}</h2>
              <p class="token-rationale" style="margin-top:.45rem;">Updated {{ formatDate(settings.updatedAt) }}. Changes save to the shared workspace database.</p>
            </div>
            <button class="button primary" type="button" (click)="saveSettings()" [disabled]="saving()">
              {{ saving() ? "Saving..." : "Save rules" }}
            </button>
          </div>
          <div class="settings-grid">
            <label class="field">
              <span>Team name</span>
              <input class="input" [(ngModel)]="settings.teamName" />
            </label>
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
                <option value="strict">Strict</option>
                <option value="balanced">Balanced</option>
                <option value="fast">Fast</option>
              </select>
            </label>
            <label class="field">
              <span>Default report</span>
              <select class="select" [(ngModel)]="settings.reportFormatDefault">
                <option value="html">HTML report</option>
                <option value="markdown">Markdown report</option>
              </select>
            </label>
            <label class="toggle-field">
              <input type="checkbox" [(ngModel)]="settings.screenshotEvidence" />
              <span>Capture screenshot evidence</span>
            </label>
            <label class="field">
              <span>Ignored paths</span>
              <textarea class="input" rows="4" [(ngModel)]="ignoredPathsText" placeholder="/admin&#10;/checkout"></textarea>
            </label>
            <label class="field">
              <span>Team notes</span>
              <textarea class="input" rows="4" [(ngModel)]="settings.teamNotes" placeholder="Document exception policy, naming rules, and handoff expectations."></textarea>
            </label>
          </div>
          @if (message()) {
            <span class="badge" style="margin-top:1rem;">{{ message() }}</span>
          }
        </section>

        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Page groups</p>
              <h2 style="margin:0;">Segment audits by product area</h2>
              <p class="token-rationale" style="margin-top:.45rem;">Use path matchers to separate marketing, app, docs, checkout, or account surfaces.</p>
            </div>
            <div class="row-actions">
              <button class="button secondary" type="button" (click)="addPageGroup()">Add group</button>
              <button class="button primary" type="button" (click)="savePageGroups()" [disabled]="saving()">Save groups</button>
            </div>
          </div>
          <div class="settings-list">
            @for (group of pageGroups; track group.id) {
              <article class="settings-row">
                <label class="field">
                  <span>Name</span>
                  <input class="input" [(ngModel)]="group.name" />
                </label>
                <label class="field">
                  <span>Matchers</span>
                  <textarea class="input" rows="3" [(ngModel)]="pageGroupMatchers[group.id]"></textarea>
                </label>
                <label class="field">
                  <span>Color</span>
                  <input class="input" [(ngModel)]="group.color" />
                </label>
                <button class="button quiet-danger" type="button" (click)="removePageGroup(group.id)">Remove</button>
              </article>
            } @empty {
              <div class="empty-state">
                <strong>No page groups yet</strong>
                <span>Add groups to compare different parts of a product separately.</span>
              </div>
            }
          </div>
        </section>

        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Scheduled scans</p>
              <h2 style="margin:0;">Recurring audit intent</h2>
              <p class="token-rationale" style="margin-top:.45rem;">Schedules are saved for the team. A hosted cron runner can execute these records next.</p>
            </div>
            <div class="row-actions">
              <button class="button secondary" type="button" (click)="addSchedule()">Add schedule</button>
              <button class="button primary" type="button" (click)="saveSchedules()" [disabled]="saving()">Save schedules</button>
            </div>
          </div>
          <div class="settings-list">
            @for (schedule of schedules; track schedule.id) {
              <article class="settings-row schedule-row">
                <label class="field">
                  <span>URL</span>
                  <input class="input" [(ngModel)]="schedule.rootUrl" />
                </label>
                <label class="field">
                  <span>Cadence</span>
                  <select class="select" [(ngModel)]="schedule.cadence">
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                <label class="field">
                  <span>Pages</span>
                  <input class="input" type="number" min="1" max="50" [(ngModel)]="schedule.maxPages" />
                </label>
                <label class="toggle-field">
                  <input type="checkbox" [(ngModel)]="schedule.enabled" />
                  <span>Enabled</span>
                </label>
                <button class="button quiet-danger" type="button" (click)="removeSchedule(schedule.id)">Remove</button>
              </article>
            } @empty {
              <div class="empty-state">
                <strong>No schedules yet</strong>
                <span>Add recurring scans to make drift review a weekly operating habit.</span>
              </div>
            }
          </div>
        </section>

        <section class="section panel section-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Shared accounts</p>
              <h2 style="margin:0;">Team access list</h2>
              <p class="token-rationale" style="margin-top:.45rem;">Keep designers, developers, and stakeholders attached to the workspace until login roles are added.</p>
            </div>
            <div class="row-actions">
              <button class="button secondary" type="button" (click)="addTeamMember()">Add member</button>
              <button class="button primary" type="button" (click)="saveTeamMembers()" [disabled]="saving()">Save members</button>
            </div>
          </div>
          <div class="settings-list">
            @for (member of teamMembers; track member.id) {
              <article class="settings-row member-row">
                <label class="field">
                  <span>Name</span>
                  <input class="input" [(ngModel)]="member.name" />
                </label>
                <label class="field">
                  <span>Email</span>
                  <input class="input" type="email" [(ngModel)]="member.email" />
                </label>
                <label class="field">
                  <span>Role</span>
                  <select class="select" [(ngModel)]="member.role">
                    <option value="owner">Owner</option>
                    <option value="designer">Designer</option>
                    <option value="developer">Developer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
                <button class="button quiet-danger" type="button" (click)="removeTeamMember(member.id)">Remove</button>
              </article>
            } @empty {
              <div class="empty-state">
                <strong>No team members yet</strong>
                <span>Add the people who should review reports, token decisions, and cleanup work.</span>
              </div>
            }
          </div>
        </section>
      }
    </section>
  `,
})
export class SettingsPageComponent {
  readonly api = inject(ApiService);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal("");
  settings: WorkspaceSettings | null = null;
  pageGroups: PageGroup[] = [];
  schedules: ScheduledScan[] = [];
  teamMembers: TeamMember[] = [];
  pageGroupMatchers: Record<string, string> = {};
  ignoredPathsText = "";

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.applySettings(await this.api.loadSettings());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Settings could not be loaded.");
    } finally {
      this.loading.set(false);
    }
  }

  async saveSettings(): Promise<void> {
    if (!this.settings) return;
    await this.save(async () => this.api.saveSettings({
      teamName: this.settings?.teamName,
      defaultPageLimit: Number(this.settings?.defaultPageLimit ?? 20),
      crawlerMode: this.settings?.crawlerMode,
      namingPreset: this.settings?.namingPreset,
      reviewThreshold: this.settings?.reviewThreshold,
      ignoredPaths: lines(this.ignoredPathsText),
      teamNotes: this.settings?.teamNotes,
      screenshotEvidence: this.settings?.screenshotEvidence,
      reportFormatDefault: this.settings?.reportFormatDefault,
    }), "Workspace rules saved");
  }

  addPageGroup(): void {
    const id = localId("group");
    this.pageGroups = [...this.pageGroups, { id, name: "New group", matchers: ["/"], color: "#4cbaf7", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    this.pageGroupMatchers[id] = "/";
  }

  removePageGroup(id: string): void {
    this.pageGroups = this.pageGroups.filter((group) => group.id !== id);
    delete this.pageGroupMatchers[id];
  }

  async savePageGroups(): Promise<void> {
    await this.save(
      async () => this.api.savePageGroups(this.pageGroups.map((group) => ({
        ...group,
        matchers: lines(this.pageGroupMatchers[group.id] ?? ""),
      })).filter((group) => group.name.trim() && group.matchers.length)),
      "Page groups saved",
    );
  }

  addSchedule(): void {
    const now = new Date().toISOString();
    this.schedules = [...this.schedules, {
      id: localId("schedule"),
      rootUrl: "https://example.com",
      cadence: "weekly",
      maxPages: this.settings?.defaultPageLimit ?? 20,
      enabled: true,
      nextRunAt: null,
      createdAt: now,
      updatedAt: now,
    }];
  }

  removeSchedule(id: string): void {
    this.schedules = this.schedules.filter((schedule) => schedule.id !== id);
  }

  async saveSchedules(): Promise<void> {
    await this.save(
      async () => this.api.saveSchedules(this.schedules.filter((schedule) => schedule.rootUrl.trim())),
      "Schedules saved",
    );
  }

  addTeamMember(): void {
    const now = new Date().toISOString();
    this.teamMembers = [...this.teamMembers, {
      id: localId("member"),
      name: "New teammate",
      email: "teammate@example.com",
      role: "viewer",
      createdAt: now,
      updatedAt: now,
    }];
  }

  removeTeamMember(id: string): void {
    this.teamMembers = this.teamMembers.filter((member) => member.id !== id);
  }

  async saveTeamMembers(): Promise<void> {
    await this.save(
      async () => this.api.saveTeamMembers(this.teamMembers.filter((member) => member.name.trim() && member.email.trim())),
      "Team members saved",
    );
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  private async save(action: () => Promise<WorkspaceSettings>, message: string): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      this.applySettings(await action());
      this.message.set(message);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Settings could not be saved.");
    } finally {
      this.saving.set(false);
    }
  }

  private applySettings(settings: WorkspaceSettings): void {
    this.settings = { ...settings };
    this.pageGroups = settings.pageGroups.map((group) => ({ ...group, matchers: [...group.matchers] }));
    this.schedules = settings.schedules.map((schedule) => ({ ...schedule }));
    this.teamMembers = settings.teamMembers.map((member) => ({ ...member }));
    this.ignoredPathsText = settings.ignoredPaths.join("\n");
    this.pageGroupMatchers = Object.fromEntries(this.pageGroups.map((group) => [group.id, group.matchers.join("\n")]));
  }
}

function lines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function localId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
