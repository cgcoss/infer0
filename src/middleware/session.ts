import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "../types";
import { verifyToken } from "../lib/auth";

declare module "hono" {
  interface ContextVariableMap {
    user: SessionUser;
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

export async function getSessionUser(
  c: Context<{ Bindings: Env }>,
): Promise<SessionUser | null> {
  let token = getCookie(c, "session");

  if (!token) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) return null;

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) return null;

  return {
    id: payload.sub,
    email: payload.email ?? "",
    name: (payload as Record<string, unknown>).name as string | null ?? null,
    avatar_url: (payload as Record<string, unknown>).avatar_url as string | null ?? null,
  };
}

export async function requireAuth(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<Response | void> {
  const user = await getSessionUser(c);
  if (!user) {
    return c.redirect("/login");
  }
  c.set("user", user);
  await next();
}

export async function requireSession(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<Response | void> {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: { message: "Authentication required", code: "auth_error" } }, 401);
  }
  c.set("user", user);
  await next();
}
