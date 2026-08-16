import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { scansRouter } from "./routes/scans.js";

const app = express();

app.use(cors({ origin: env.webOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "designdebt-api" });
});

app.use("/api/scans", scansRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({ error: "Unexpected API error." });
});

app.listen(env.port, () => {
  console.log(`DesignDebt API listening on http://localhost:${env.port}`);
});

