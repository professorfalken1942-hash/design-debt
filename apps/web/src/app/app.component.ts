import { Component } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

@Component({
  selector: "dd-root",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <a routerLink="/overview" class="brand">
          <span class="brand-mark" aria-hidden="true">U</span>
          <span>
            <strong>UIpen</strong>
            <small>UI intelligence for design quality</small>
          </span>
        </a>
        <nav class="nav" aria-label="Primary">
          <a routerLink="/overview" routerLinkActive="active">Overview <span>Start</span></a>
          <a routerLink="/audit" routerLinkActive="active">Audit <span>Debt</span></a>
          <a routerLink="/tokens" routerLinkActive="active">Tokens <span>Forge</span></a>
          <a routerLink="/scans" routerLinkActive="active">Scans <span>History</span></a>
          <a routerLink="/settings" routerLinkActive="active">Settings <span>Defaults</span></a>
        </nav>
      </aside>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {}
