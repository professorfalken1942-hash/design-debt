import { Component } from "@angular/core";

@Component({
  selector: "dd-settings-page",
  standalone: true,
  template: `
    <section class="page">
      <p class="eyebrow">Settings</p>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem); letter-spacing:-.03em; margin:.2rem 0;">Workspace settings</h1>
      <p class="lede">Current scan behavior is intentionally conservative while the scanner hardens: public URLs only, same-origin crawling, and bounded page counts for predictable production runs.</p>

      <section class="section panel" style="padding:1.2rem;">
        <h2 style="margin-top:0;">Scan defaults</h2>
        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));">
          <label>
            <span class="eyebrow">Default page limit</span>
            <input class="input" value="20" readonly />
          </label>
          <label>
            <span class="eyebrow">Crawler mode</span>
            <input class="input" value="Same-origin only" readonly />
          </label>
          <label>
            <span class="eyebrow">Live limit</span>
            <input class="input" value="3 pages on Vercel" readonly />
          </label>
          <label>
            <span class="eyebrow">Timeout</span>
            <input class="input" value="12 seconds per serverless scan" readonly />
          </label>
        </div>
      </section>

      <section class="section panel" style="padding:1.2rem;">
        <h2 style="margin-top:0;">Planned controls</h2>
        <div class="workflow-grid">
          <article class="workflow-card"><span>Next</span><strong>Ignored paths</strong><p>Exclude routes like admin, checkout, account, or docs from future scans.</p></article>
          <article class="workflow-card"><span>Next</span><strong>Page groups</strong><p>Compare marketing, app, docs, and checkout pages separately.</p></article>
          <article class="workflow-card"><span>Next</span><strong>Schedules</strong><p>Run recurring scans and track regressions over time.</p></article>
          <article class="workflow-card"><span>Next</span><strong>Team rules</strong><p>Save preferred token naming and review thresholds per project.</p></article>
        </div>
      </section>
    </section>
  `,
})
export class SettingsPageComponent {}
