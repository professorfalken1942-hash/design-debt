import { Router } from "express";
import { z } from "zod";
import {
  compareScans,
  createScan,
  deleteScan,
  exportTokens,
  getBacklog,
  getResults,
  getScan,
  getTokens,
  listScans,
  retryScan,
  ScanInputError,
  updateBacklogItem,
  updateTokens,
} from "../services/scan-service.js";

export const scansRouter = Router();

const createScanSchema = z.object({
  rootUrl: z.string().min(1),
  maxPages: z.number().int().min(1).max(50).default(20),
});

const compareScansSchema = z.object({
  baseId: z.string().min(1),
  targetId: z.string().min(1),
});

const updateBacklogSchema = z.object({
  status: z.enum(["open", "accepted", "ignored", "fixed"]).optional(),
  owner: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

scansRouter.post("/", async (request, response, next) => {
  try {
    const body = createScanSchema.parse(request.body);
    response.status(202).json(await createScan(body.rootUrl, body.maxPages));
  } catch (error) {
    if (error instanceof ScanInputError) {
      response.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

scansRouter.get("/", async (_request, response, next) => {
  try {
    response.json({ scans: await listScans() });
  } catch (error) {
    next(error);
  }
});

scansRouter.get("/compare", async (request, response, next) => {
  try {
    const query = compareScansSchema.parse(request.query);
    const comparison = await compareScans(query.baseId, query.targetId);
    if (!comparison) {
      response.status(404).json({ error: "Both scans must exist and be completed before they can be compared." });
      return;
    }
    response.json(comparison);
  } catch (error) {
    if (error instanceof ScanInputError) {
      response.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

scansRouter.get("/:id", async (request, response, next) => {
  try {
    const scan = await getScan(request.params.id);
    if (!scan) {
      response.status(404).json({ error: "Scan not found." });
      return;
    }
    response.json(scan);
  } catch (error) {
    next(error);
  }
});

scansRouter.post("/:id/retry", async (request, response, next) => {
  try {
    const scan = await retryScan(request.params.id);
    if (!scan) {
      response.status(404).json({ error: "Scan not found." });
      return;
    }
    response.status(202).json(scan);
  } catch (error) {
    next(error);
  }
});

scansRouter.delete("/:id", async (request, response, next) => {
  try {
    const deleted = await deleteScan(request.params.id);
    if (!deleted) {
      response.status(404).json({ error: "Scan not found." });
      return;
    }
    response.status(204).send();
  } catch (error) {
    if (error instanceof ScanInputError) {
      response.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

scansRouter.get("/:id/results", async (request, response, next) => {
  try {
    const results = await getResults(request.params.id);
    if (!results) {
      response.status(404).json({ error: "Results are not ready." });
      return;
    }
    response.json(results);
  } catch (error) {
    next(error);
  }
});

for (const category of ["colors", "typography", "spacing", "borders", "shadows", "buttons", "forms"] as const) {
  scansRouter.get(`/:id/${category}`, async (request, response, next) => {
    try {
      const results = await getResults(request.params.id);
      if (!results) {
        response.status(404).json({ error: "Results are not ready." });
        return;
      }
      response.json({ items: results.inventories[category] });
    } catch (error) {
      next(error);
    }
  });
}

scansRouter.get("/:id/tokens", async (request, response, next) => {
  try {
    const tokens = await getTokens(request.params.id);
    if (!tokens) {
      response.status(404).json({ error: "Tokens are not ready." });
      return;
    }
    response.json({ tokens });
  } catch (error) {
    next(error);
  }
});

scansRouter.put("/:id/tokens", async (request, response, next) => {
  try {
    const tokens = await updateTokens(request.params.id, request.body.tokens ?? []);
    if (!tokens) {
      response.status(404).json({ error: "Scan not found." });
      return;
    }
    response.json({ tokens });
  } catch (error) {
    next(error);
  }
});

scansRouter.get("/:id/backlog", async (request, response, next) => {
  try {
    const backlog = await getBacklog(request.params.id);
    if (!backlog) {
      response.status(404).json({ error: "Backlog is not ready." });
      return;
    }
    response.json({ backlog });
  } catch (error) {
    next(error);
  }
});

scansRouter.patch("/:id/backlog/:itemId", async (request, response, next) => {
  try {
    const body = updateBacklogSchema.parse(request.body);
    const item = await updateBacklogItem(request.params.id, request.params.itemId, body);
    if (!item) {
      response.status(404).json({ error: "Backlog item not found." });
      return;
    }
    response.json({ item });
  } catch (error) {
    next(error);
  }
});

scansRouter.get("/:id/tokens/export", async (request, response, next) => {
  try {
    const format = request.query.format === "json" ? "json" : "css";
    const exported = await exportTokens(request.params.id, format);
    if (!exported) {
      response.status(404).json({ error: "Tokens are not ready." });
      return;
    }
    if (format === "css") {
      response.type("text/css").send(exported);
      return;
    }
    response.json(exported);
  } catch (error) {
    next(error);
  }
});
