import { Hono } from "hono";
import type { Env } from "../types";
import { verifyToken } from "../lib/auth";

export const userinfoRoutes = new Hono<{ Bindings: Env }>();

userinfoRoutes.get("/v1/userinfo", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: { message: "Missing or invalid Authorization header", code: "auth_error" } }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload?.sub) {
    return c.json({ error: { message: "Invalid or expired token", code: "auth_error" } }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, avatar_url FROM users WHERE id = ?",
  ).bind(payload.sub).first<{ id: string; email: string; name: string | null; avatar_url: string | null }>();

  if (!user) {
    return c.json({ error: { message: "User not found", code: "not_found" } }, 404);
  }

  return c.json({
    sub: user.id,
    email: user.email,
    name: user.name,
    picture: user.avatar_url,
  });
});
