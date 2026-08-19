import crypto from "node:crypto";
import { nanoid } from "nanoid";
import type { AuthSession, WorkspaceRole } from "../../../../packages/shared/src/index.js";
import { env } from "../env.js";
import { prisma } from "../lib/prisma.js";

const SESSION_COOKIE = "uipen_session";
const SESSION_DAYS = 30;

export class AuthInputError extends Error {}

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export async function signup(input: {
  name: string;
  email: string;
  password: string;
  workspaceName?: string;
}): Promise<{ session: AuthSession; token: string; expiresAt: Date }> {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AuthInputError("An account already exists for that email.");
  validatePassword(input.password);

  const userId = nanoid();
  const workspaceId = nanoid();
  const role: WorkspaceRole = "owner";
  const passwordHash = await hashPassword(input.password);
  const workspaceName = input.workspaceName?.trim() || `${input.name.trim() || "My"} workspace`;

  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        email,
        name: input.name.trim() || email.split("@")[0],
        passwordHash,
      },
    }),
    prisma.workspace.create({
      data: {
        id: workspaceId,
        name: workspaceName,
      },
    }),
    prisma.workspaceMembership.create({
      data: {
        id: nanoid(),
        userId,
        workspaceId,
        role,
      },
    }),
    prisma.workspaceSettings.create({
      data: {
        id: workspaceId,
        workspaceId,
        teamName: workspaceName,
        ignoredPaths: ["/admin", "/checkout", "/account"] as never,
      },
    }),
    prisma.teamMember.create({
      data: {
        id: nanoid(),
        workspaceId,
        name: input.name.trim() || email,
        email,
        role,
      },
    }),
  ]);

  const issued = await createSession(userId);
  return {
    ...issued,
    session: {
      user: { id: userId, email, name: input.name.trim() || email.split("@")[0] },
      workspace: { id: workspaceId, name: workspaceName, role },
    },
  };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ session: AuthSession; token: string; expiresAt: Date }> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AuthInputError("Email or password is incorrect.");
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new AuthInputError("This account is not attached to a workspace.");

  const issued = await createSession(user.id);
  return {
    ...issued,
    session: {
      user: { id: user.id, email: user.email, name: user.name },
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        role: membership.role as WorkspaceRole,
      },
    },
  };
}

export async function currentSession(token: string | undefined): Promise<AuthSession | null> {
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: {
      user: {
        include: {
          memberships: {
            include: { workspace: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) await prisma.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const membership = session.user.memberships[0];
  if (!membership) return null;

  return {
    user: { id: session.user.id, email: session.user.email, name: session.user.name },
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      role: membership.role as WorkspaceRole,
    },
  };
}

export async function authContext(token: string | undefined): Promise<AuthContext | null> {
  const session = await currentSession(token);
  if (!session) return null;
  return {
    userId: session.user.id,
    workspaceId: session.workspace.id,
    role: session.workspace.role,
  };
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.authSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
}

export function sessionCookie(token: string, expiresAt: Date): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    env.secureCookies ? "Secure" : "",
    `Expires=${expiresAt.toUTCString()}`,
  ].filter(Boolean).join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    env.secureCookies ? "Secure" : "",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].filter(Boolean).join("; ");
}

export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}

async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.authSession.create({
    data: {
      id: nanoid(),
      userId,
      tokenHash: tokenHash(token),
      expiresAt,
    },
  });
  return { token, expiresAt };
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt);
  return `scrypt:${salt}:${derived}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, derived] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !derived) return false;
  const candidate = await scrypt(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(derived));
}

function scrypt(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString("base64url"));
    });
  });
}

function tokenHash(token: string): string {
  return crypto.createHmac("sha256", env.sessionSecret).update(token).digest("base64url");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validatePassword(password: string): void {
  if (password.length < 8) throw new AuthInputError("Password must be at least 8 characters.");
}
