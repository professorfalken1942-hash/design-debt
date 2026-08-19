import type { NextFunction, Request, Response } from "express";
import type { AuthContext } from "../services/auth-service.js";
import { authContext, readSessionCookie } from "../services/auth-service.js";

export interface AuthedRequest extends Request {
  auth: AuthContext;
}

export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const context = await authContext(readSessionCookie(request.headers.cookie));
    if (!context) {
      response.status(401).json({ error: "Sign in to continue." });
      return;
    }
    (request as AuthedRequest).auth = context;
    next();
  } catch (error) {
    next(error);
  }
}

export function authOf(request: Request): AuthContext {
  return (request as AuthedRequest).auth;
}
