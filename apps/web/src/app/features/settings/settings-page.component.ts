import { Component } from "@angular/core";

@Component({
  selector: "dd-settings-page",
  standalone: true,
  template: `
    <section class="page">
      <p class="eyebrow">Settings</p>
      <h1 style="font-size:clamp(2rem,5vw,3.4rem); letter-spacing:-.04em; margin:.2rem 0;">Workspace settings</h1>
      <p class="lede">Settings are intentionally light in the MVP. Authentication, billing, teams, and permissions are deferred.</p>

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
        </div>
      </section>
    </section>
  `,
})
export class SettingsPageComponent {}

