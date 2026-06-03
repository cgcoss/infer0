import { Hono } from "hono";
import type { Env } from "../types";
import { requireSession } from "../middleware/session";
import { generateApiKey, hashKey } from "../lib/keys";

export const apiKeyRoutes = new Hono<{ Bindings: Env }>();

apiKeyRoutes.get("/v1/api-keys", requireSession, async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, key_prefix, is_active, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
  ).bind(user.id).all();

  return c.json({ keys: results });
});

apiKeyRoutes.post("/v1/api-keys", requireSession, async (c) => {
  const user = c.get("user");
  let name = "";

  const contentType = c.req.header("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await c.req.json()) as { name?: string };
    name = body.name ?? "";
  } else if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData();
    name = (form.get("name") as string) ?? "";
  }

  const { plaintext, prefix } = generateApiKey();
  const hash = await hashKey(plaintext);
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, user.id, name, prefix, hash).run();

  return c.json({
    key: {
      id,
      name,
      key_prefix: prefix,
      plaintext_key: plaintext,
      created_at: new Date().toISOString(),
    },
  });
});

apiKeyRoutes.delete("/v1/api-keys/:id", requireSession, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM api_keys WHERE id = ? AND user_id = ?",
  ).bind(id, user.id).first();

  if (!existing) {
    return c.json({ error: { message: "Key not found", code: "not_found" } }, 404);
  }

  // Soft-delete: deactivate instead of actually deleting
  await c.env.DB.prepare(
    "UPDATE api_keys SET is_active = 0 WHERE id = ?",
  ).bind(id).run();

  return c.json({ success: true });
});
