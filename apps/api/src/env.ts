import "dotenv/config";

function databaseHost(): string | null {
  if (!process.env.DATABASE_URL) return null;
  try {
    return new URL(process.env.DATABASE_URL).host;
  } catch {
    return "unparseable";
  }
}

export const env = {
  port: Number(process.env.API_PORT ?? 4310),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:4200",
  databaseUrl: process.env.DATABASE_URL,
  databaseConfigured: Boolean(process.env.DATABASE_URL),
  databaseHost: databaseHost(),
};
