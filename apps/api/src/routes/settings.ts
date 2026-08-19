import { Router } from "express";
import { z } from "zod";
import { authOf } from "../middleware/auth.js";
import {
  getSettings,
  savePageGroups,
  saveSchedules,
  saveSettings,
  saveTeamMembers,
} from "../services/scan-service.js";

export const settingsRouter = Router();

const settingsSchema = z.object({
  teamName: z.string().min(1).max(120).optional(),
  defaultPageLimit: z.number().int().min(1).max(50).optional(),
  crawlerMode: z.enum(["same-origin", "page-list"]).optional(),
  namingPreset: z.enum(["scale", "semantic", "css"]).optional(),
  reviewThreshold: z.enum(["strict", "balanced", "fast"]).optional(),
  ignoredPaths: z.array(z.string().max(240)).max(40).optional(),
  teamNotes: z.string().max(4000).optional(),
  screenshotEvidence: z.boolean().optional(),
  reportFormatDefault: z.enum(["markdown", "html"]).optional(),
});

const pageGroupsSchema = z.object({
  pageGroups: z.array(z.object({
    id: z.string().optional().default(""),
    name: z.string().min(1).max(80),
    matchers: z.array(z.string().min(1).max(240)).min(1).max(20),
    color: z.string().min(1).max(40).default("#4cbaf7"),
  })).max(24),
});

const schedulesSchema = z.object({
  schedules: z.array(z.object({
    id: z.string().optional().default(""),
    rootUrl: z.string().url(),
    cadence: z.enum(["weekly", "biweekly", "monthly"]),
    maxPages: z.number().int().min(1).max(50),
    enabled: z.boolean(),
    nextRunAt: z.string().datetime().nullable().optional(),
  })).max(24),
});

const teamMembersSchema = z.object({
  teamMembers: z.array(z.object({
    id: z.string().optional().default(""),
    name: z.string().min(1).max(120),
    email: z.string().email().max(180),
    role: z.enum(["owner", "designer", "developer", "viewer"]),
  })).max(50),
});

settingsRouter.get("/", async (_request, response, next) => {
  try {
    response.json(await getSettings(authOf(_request).workspaceId));
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/", async (request, response, next) => {
  try {
    response.json(await saveSettings(settingsSchema.parse(request.body), authOf(request).workspaceId));
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/page-groups", async (request, response, next) => {
  try {
    const body = pageGroupsSchema.parse(request.body);
    response.json(await savePageGroups(body.pageGroups, authOf(request).workspaceId));
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/schedules", async (request, response, next) => {
  try {
    const body = schedulesSchema.parse(request.body);
    response.json(await saveSchedules(body.schedules, authOf(request).workspaceId));
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/team-members", async (request, response, next) => {
  try {
    const body = teamMembersSchema.parse(request.body);
    response.json(await saveTeamMembers(body.teamMembers, authOf(request).workspaceId));
  } catch (error) {
    next(error);
  }
});
