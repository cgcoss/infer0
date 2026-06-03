import type { Context, Next } from "hono";
import type { Env } from "../types";
import { hashKey } from "../lib/keys";

type AppContext = Context<{ Bindings: Env }>;

declare module "hono" {
  interface ContextVariableMap {
    developerKeyId: string;
    developerKey: { key_prefix: string; name: string };
  }
}

export async function requireDeveloperKey(c: AppContext, next: Next): Promise<void> {
  const apiKey = c.req.header("X-API-Key");
  if (!apiKey) {
    c.status(401);
    c.res = c.json({ error: { message: "Missing X-API-Key header", code: "auth_error" } });
    return;
  }

  const hash = await hashKey(apiKey);

  const key = await c.env.DB.prepare(
    "SELECT id, key_prefix, name, is_active FROM api_keys WHERE key_hash = ?",
  ).bind(hash).first<{ id: string; key_prefix: string; name: string; is_active: number }>();

  if (!key) {
    c.status(401);
    c.res = c.json({ error: { message: "Invalid API key", code: "auth_error" } });
    return;
  }

  if (!key.is_active) {
    c.status(403);
    c.res = c.json({ error: { message: "API key is disabled", code: "key_disabled" } });
    return;
  }

  // Update last_used_at (fire-and-forget)
  c.env.DB.prepare(
    "UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?",
  ).bind(key.id).run().catch(() => {});

  c.set("developerKeyId", key.id);
  c.set("developerKey", { key_prefix: key.key_prefix, name: key.name });
  await next();
}
