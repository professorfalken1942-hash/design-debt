import { Router } from "express";
import { z } from "zod";
import {
  AuthInputError,
  clearSessionCookie,
  currentSession,
  login,
  logout,
  readSessionCookie,
  sessionCookie,
  signup,
} from "../services/auth-service.js";

export const authRouter = Router();

const signupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(180),
  password: z.string().min(8).max(200),
  workspaceName: z.string().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(1).max(200),
});

authRouter.get("/me", async (request, response, next) => {
  try {
    const session = await currentSession(readSessionCookie(request.headers.cookie));
    response.json({ session });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/signup", async (request, response, next) => {
  try {
    const result = await signup(signupSchema.parse(request.body));
    response.setHeader("Set-Cookie", sessionCookie(result.token, result.expiresAt));
    response.status(201).json({ session: result.session });
  } catch (error) {
    if (error instanceof AuthInputError) {
      response.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

authRouter.post("/login", async (request, response, next) => {
  try {
    const result = await login(loginSchema.parse(request.body));
    response.setHeader("Set-Cookie", sessionCookie(result.token, result.expiresAt));
    response.json({ session: result.session });
  } catch (error) {
    if (error instanceof AuthInputError) {
      response.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

authRouter.post("/logout", async (request, response, next) => {
  try {
    await logout(readSessionCookie(request.headers.cookie));
    response.setHeader("Set-Cookie", clearSessionCookie());
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
