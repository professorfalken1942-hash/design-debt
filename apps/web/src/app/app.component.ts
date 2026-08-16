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
          <strong>DesignDebt</strong>
          <span>UI observability for design quality</span>
        </a>
        <nav class="nav" aria-label="Primary">
          <a routerLink="/overview" routerLinkActive="active">Overview <span>⌘1</span></a>
          <a routerLink="/design-debt" routerLinkActive="active">Design Debt <span>⌘2</span></a>
          <a routerLink="/token-forge" routerLinkActive="active">Token Forge <span>⌘3</span></a>
          <a routerLink="/scans" routerLinkActive="active">Scans <span>⌘4</span></a>
          <a routerLink="/settings" routerLinkActive="active">Settings <span>⌘5</span></a>
        </nav>
      </aside>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {}

