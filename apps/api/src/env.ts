import "dotenv/config";

export const env = {
  port: Number(process.env.API_PORT ?? 4310),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:4200",
  databaseUrl: process.env.DATABASE_URL,
};
