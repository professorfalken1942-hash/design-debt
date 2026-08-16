import { Routes } from "@angular/router";
import { OverviewPageComponent } from "./features/overview/overview-page.component";
import { DesignDebtPageComponent } from "./features/design-debt/design-debt-page.component";
import { TokenForgePageComponent } from "./features/token-forge/token-forge-page.component";
import { ScansPageComponent } from "./features/scans/scans-page.component";
import { ScanDetailPageComponent } from "./features/scans/scan-detail-page.component";
import { SettingsPageComponent } from "./features/settings/settings-page.component";

export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "overview" },
  { path: "overview", component: OverviewPageComponent },
  { path: "design-debt", component: DesignDebtPageComponent },
  { path: "design-debt/:category", component: DesignDebtPageComponent },
  { path: "token-forge", component: TokenForgePageComponent },
  { path: "scans", component: ScansPageComponent },
  { path: "scans/:id", component: ScanDetailPageComponent },
  { path: "settings", component: SettingsPageComponent },
];
