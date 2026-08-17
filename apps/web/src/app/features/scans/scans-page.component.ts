import { Component, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { ScanSummary } from "@designdebt/shared";
import { ApiService } from "../../core/api.service";

@Component({
  selector: "dd-scans-page",
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page">
      <div class="topbar">
        <div>
          <p class="eyebrow">Scans</p>
          <h1 style="font-size:clamp(2rem,5vw,3.4rem); letter-spacing:-.04em; margin:.2rem 0;">Recent scan activity</h1>
          <p class="lede">Track submitted sites, inspect scan progress, and open completed DesignDebt and TokenForge results.</p>
        </div>
        <button class="button secondary" type="button" (click)="load()">Refresh</button>
      </div>

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
                          <button class="button danger" type="button" (click)="deleteScan(scan)">Delete</button>
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
    </section>
  `,
})
export class ScansPageComponent {
  readonly api = inject(ApiService);
  readonly scans = signal<ScanSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.scans.set(await this.api.listScans());
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

  async deleteScan(scan: ScanSummary): Promise<void> {
    const confirmed = window.confirm(`Delete scan for ${scan.rootUrl}? This cannot be undone.`);
    if (!confirmed) return;

    this.loading.set(true);
    this.error.set(null);
    try {
      await this.api.deleteScan(scan.id);
      this.scans.set(this.scans().filter((item) => item.id !== scan.id));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "The scan could not be deleted.");
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }
}
