import { Hono } from "hono";
import type { Env } from "../types";
import { requireSession } from "../middleware/session";

export const authorizedAppRoutes = new Hono<{ Bindings: Env }>();

authorizedAppRoutes.get("/v1/authorized-apps", requireSession, async (c) => {
  const user = c.get("user");

  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.app_prefix, a.developer_name, a.provider_config_id, a.last_used_at, a.expires_at, a.revoked_at, a.created_at
     FROM authorized_apps a
     WHERE a.user_id = ?
     ORDER BY a.created_at DESC`,
  ).bind(user.id).all();

  return c.json({ apps: results });
});

authorizedAppRoutes.post("/v1/authorized-apps/:id/revoke", requireSession, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM authorized_apps WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
  ).bind(id, user.id).first();

  if (!existing) {
    return c.json({ error: { message: "Authorization not found or already revoked", code: "not_found" } }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE authorized_apps SET revoked_at = datetime('now') WHERE id = ?",
  ).bind(id).run();

  return c.json({ success: true });
});

authorizedAppRoutes.put("/v1/authorized-apps/:id/provider", requireSession, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{ provider_config_id: string | null }>();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM authorized_apps WHERE id = ? AND user_id = ?",
  ).bind(id, user.id).first();

  if (!existing) {
    return c.json({ error: { message: "Authorization not found", code: "not_found" } }, 404);
  }

  if (body.provider_config_id) {
    const provider = await c.env.DB.prepare(
      "SELECT id FROM provider_configs WHERE id = ? AND user_id = ?",
    ).bind(body.provider_config_id, user.id).first();

    if (!provider) {
      return c.json({ error: { message: "Provider not found", code: "not_found" } }, 404);
    }
  }

  await c.env.DB.prepare(
    "UPDATE authorized_apps SET provider_config_id = ? WHERE id = ?",
  ).bind(body.provider_config_id ?? null, id).run();

  return c.json({ success: true });
});
