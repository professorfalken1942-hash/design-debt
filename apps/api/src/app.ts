import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { scansRouter } from "./routes/scans.js";
import { settingsRouter } from "./routes/settings.js";
import { checkDatabaseConnection } from "./services/scan-repository.js";

export const app = express();

app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get(["/health", "/api/health"], (_request, response) => {
  response.json({
    ok: true,
    service: "uipen-api",
    databaseConfigured: env.databaseConfigured,
    databaseHost: env.databaseHost,
  });
});

app.get(["/health/db", "/api/health/db"], async (_request, response) => {
  if (!env.databaseConfigured) {
    response.status(503).json({
      ok: false,
      error: "DATABASE_URL is not configured.",
      hint: "Add a hosted Postgres DATABASE_URL in Vercel project environment variables.",
    });
    return;
  }

  try {
    await checkDatabaseConnection();
    response.json({ ok: true, databaseHost: env.databaseHost });
  } catch (error) {
    response.status(503).json({
      ok: false,
      error: readableApiError(error),
      hint: databaseHint(error),
      databaseHost: env.databaseHost,
    });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/scans", requireAuth, scansRouter);
app.use("/api/settings", requireAuth, settingsRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(apiStatus(error)).json({
    error: readableApiError(error),
    hint: databaseHint(error),
  });
});

function apiStatus(error: unknown): number {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.startsWith("P1") || code === "P2021") return 503;
  return 500;
}

function readableApiError(error: unknown): string {
  if (!env.databaseConfigured) return "DATABASE_URL is not configured.";
  if (error instanceof Error) return error.message;
  return "Unexpected API error.";
}

function databaseHint(error: unknown): string | undefined {
  if (!env.databaseConfigured) {
    return "Add DATABASE_URL in Vercel. It must point to a hosted Postgres database, not localhost.";
  }
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (env.databaseHost?.includes("localhost") || env.databaseHost?.startsWith("127.0.0.1")) {
    return "The live app cannot reach localhost. Use a hosted Postgres provider such as Neon, Supabase, or Vercel Postgres.";
  }
  if (code === "P2021" || /does not exist|table .* not found/i.test(message)) {
    return "The database is reachable, but migrations have not been applied. Run prisma migrate deploy for apps/api/prisma/schema.prisma.";
  }
  if (code.startsWith("P1") || /connect|authentication|password|timeout/i.test(message)) {
    return "Check the Vercel DATABASE_URL value, network access, SSL settings, and database credentials.";
  }
  return undefined;
}
