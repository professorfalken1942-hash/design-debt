import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../core/api.service";

@Component({
  selector: "dd-auth-page",
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="auth-shell">
      <section class="auth-hero">
        <span class="brand-mark" aria-hidden="true">U</span>
        <p class="eyebrow">UIpen</p>
        <h1 class="headline">Design debt, now scoped to your team.</h1>
        <p class="lede">Create a workspace, keep scans private to that workspace, and give each team its own settings, schedules, backlog, screenshots, and reports.</p>
      </section>

      <section class="auth-panel panel">
        <div class="tabs" aria-label="Auth mode">
          <button class="button" type="button" [class.primary]="mode() === 'signup'" [class.secondary]="mode() !== 'signup'" (click)="mode.set('signup')">Create account</button>
          <button class="button" type="button" [class.primary]="mode() === 'login'" [class.secondary]="mode() !== 'login'" (click)="mode.set('login')">Sign in</button>
        </div>

        @if (mode() === 'signup') {
          <form class="auth-form" (ngSubmit)="signup()">
            <label class="field">
              <span>Name</span>
              <input class="input" name="name" [(ngModel)]="name" autocomplete="name" required />
            </label>
            <label class="field">
              <span>Email</span>
              <input class="input" type="email" name="email" [(ngModel)]="email" autocomplete="email" required />
            </label>
            <label class="field">
              <span>Workspace</span>
              <input class="input" name="workspaceName" [(ngModel)]="workspaceName" required />
            </label>
            <label class="field">
              <span>Password</span>
              <input class="input" type="password" name="password" [(ngModel)]="password" autocomplete="new-password" required minlength="8" />
            </label>
            <button class="button primary" type="submit" [disabled]="api.loading()">Create workspace</button>
          </form>
        } @else {
          <form class="auth-form" (ngSubmit)="login()">
            <label class="field">
              <span>Email</span>
              <input class="input" type="email" name="email" [(ngModel)]="email" autocomplete="email" required />
            </label>
            <label class="field">
              <span>Password</span>
              <input class="input" type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required />
            </label>
            <button class="button primary" type="submit" [disabled]="api.loading()">Sign in</button>
          </form>
        }

        @if (api.error()) {
          <p class="form-error">{{ api.error() }}</p>
        }
      </section>
    </main>
  `,
})
export class AuthPageComponent {
  readonly api = inject(ApiService);
  readonly mode = signal<"signup" | "login">("signup");
  name = "";
  email = "";
  workspaceName = "My design system";
  password = "";

  async signup(): Promise<void> {
    await this.api.signup({
      name: this.name,
      email: this.email,
      password: this.password,
      workspaceName: this.workspaceName,
    });
  }

  async login(): Promise<void> {
    await this.api.login({
      email: this.email,
      password: this.password,
    });
  }
}
